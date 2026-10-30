// 浏览器直连 GitHub API：兼容单文件写入，并支持整篇文章的原子提交
// 无服务端密钥库；token默认仅会话内保存，仅发送到GitHub API，禁止写入文章或导出包。

const API = "https://api.github.com";

let sessionToken = "";
export const gh = {
  tokenKey: "moments_pat",
  getToken() {
    try {
      if (sessionToken) return sessionToken;
      const current = sessionStorage.getItem(this.tokenKey);
      if (current) return current;
      // One-time migration: remove the old persistent credential from localStorage.
      const legacy = localStorage.getItem(this.tokenKey);
      if (legacy) {
        sessionToken = legacy;
        sessionStorage.setItem(this.tokenKey, legacy);
        localStorage.removeItem(this.tokenKey);
      }
      return legacy || "";
    } catch {
      return sessionToken;
    }
  },
  setToken(token) {
    sessionToken = token.trim();
    try {
      sessionStorage.setItem(this.tokenKey, sessionToken);
      localStorage.removeItem(this.tokenKey);
    } catch {
      /* Session memory still works without browser storage. */
    }
  },
  clearToken() {
    sessionToken = "";
    try {
      sessionStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.tokenKey);
    } catch {}
  },
};

const headers = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
});

// UTF-8 安全的 base64
const encodeB64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => {
    bin += String.fromCharCode(b);
  });
  return btoa(bin);
};

const decodeB64 = (b64) => {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

// 统一超时：网络卡住时不要把界面永久挂在“加载中”
const TIMEOUT = 15000;
const request = (url, options = {}) => {
  const opt = { ...options };
  if ((opt.method || "GET") === "GET") opt.cache = "no-store";
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    opt.signal = AbortSignal.timeout(TIMEOUT);
  }
  return fetch(url, opt);
};

async function handle(res) {
  if (res.ok) return res.json();
  let detail = "";
  try {
    const j = await res.json();
    detail = j.message || "";
  } catch {
    detail = res.statusText;
  }
  const messages = {
    401: "token 无效或已过期，请重新连接",
    403: "没有权限：确认 token 已授予该仓库 Contents 读写权限，或检查 API 限额",
    404: "找不到仓库或文件：检查仓库名和 token 权限",
    409: "仓库内容发生并发变更，尚未覆盖其他修改",
  };
  const error = new Error(
    messages[res.status] || detail || `请求失败（${res.status}）`,
  );
  error.status = res.status;
  throw error;
}

// 校验 token，返回仓库信息
export async function checkRepo({ repo, token }) {
  const res = await request(`${API}/repos/${repo}`, {
    headers: headers(token),
  });
  const data = await handle(res);
  return { fullName: data.full_name, private: data.private };
}

// 读取文件，返回 { sha, text }；文件不存在返回 null
export async function readFile({ repo, branch, path, token }) {
  const res = await request(
    `${API}/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
    {
      headers: headers(token),
    },
  );
  if (res.status === 404) return null;
  const data = await handle(res);
  if (data.encoding === "none") {
    const raw = await request(
      `${API}/repos/${repo}/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(branch)}`,
      {
        headers: {
          ...headers(token),
          Accept: "application/vnd.github.raw+json",
        },
      },
    );
    if (!raw.ok) await handle(raw);
    return { sha: data.sha, text: await raw.text() };
  }
  return { sha: data.sha, text: decodeB64(data.content) };
}

// 写入文件（带 sha 为更新，不带为新建）
export async function writeFile({
  repo,
  branch,
  path,
  token,
  text,
  sha,
  message,
}) {
  const res = await request(`${API}/repos/${repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: encodeB64(text),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  const data = await handle(res);
  return { commitUrl: data.commit?.html_url || "", sha: data.content?.sha };
}

// 删除文件（需要 sha）
export async function deleteFile({ repo, branch, path, token, sha, message }) {
  const res = await request(`${API}/repos/${repo}/contents/${path}`, {
    method: "DELETE",
    headers: { ...headers(token), "Content-Type": "application/json" },
    body: JSON.stringify({ message, sha, branch }),
  });
  const data = await handle(res);
  return { commitUrl: data.commit?.html_url || "" };
}

// Serialize mutations to the same branch/file in this tab. Never reuse a failed read's SHA.
const textWriteQueues = new Map();
export function updateText({
  repo,
  branch,
  path,
  token,
  message,
  update,
  retries = 4,
}) {
  const key = JSON.stringify([repo, branch, path]);
  const previous = textWriteQueues.get(key) || Promise.resolve();
  const pending = previous
    .catch(() => {})
    .then(async () => {
      const attempts = Math.max(1, Math.min(5, retries));
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const file = await readFile({ repo, branch, path, token });
        const before = file ? file.text : "";
        const after = update(before);
        if (after === null)
          throw new Error(
            "未找到原内容，可能已被修改；请刷新列表核对，未覆盖任何文件。",
          );
        if (after === before) return { unchanged: true };
        try {
          return await writeFile({
            repo,
            branch,
            path,
            token,
            text: after,
            sha: file?.sha,
            message,
          });
        } catch (error) {
          // Only a definite rejected conflict can be safely retried. Never replay an
          // ambiguous network timeout (an append might already have reached GitHub).
          if (error.status !== 409) throw error;
          if (attempt + 1 === attempts)
            throw new Error(
              "其他设备正在修改同一文件，多次重新读取后仍有冲突。请稍后刷新再试；本次没有覆盖其他内容。",
              { cause: error },
            );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(150 * 2 ** attempt, 1200)),
          );
        }
      }
    });
  textWriteQueues.set(key, pending);
  return pending.finally(() => {
    if (textWriteQueues.get(key) === pending) textWriteQueues.delete(key);
  });
}

// A commit is published only by the final non-forced ref update. No partial article goes live.
export async function githubJSON({
  repo,
  token,
  path,
  method = "GET",
  body,
  timeout = 15000,
}) {
  const res = await fetch(`${API}/repos/${repo}/${path}`, {
    method,
    ...(method === "GET" ? { cache: "no-store" } : {}),
    headers: {
      ...headers(token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeout),
  });
  if (res.status === 409 || res.status === 422) {
    throw new Error(
      "仓库版本冲突或提交被拒绝：没有覆盖最新版本，请保留草稿并刷新后重试。",
    );
  }
  return handle(res);
}
export async function gitSnapshot({ repo, branch, token }) {
  const ref = await githubJSON({
    repo,
    token,
    path: `git/ref/heads/${encodeURIComponent(branch)}`,
  });
  const commit = await githubJSON({
    repo,
    token,
    path: `git/commits/${ref.object.sha}`,
  });
  return { head: ref.object.sha, tree: commit.tree.sha };
}
export async function commitFiles({
  repo,
  branch,
  token,
  snapshot,
  files,
  message,
  onProgress,
}) {
  if (!snapshot?.head || !snapshot?.tree || !files.length)
    throw new Error("缺少提交基线或文件。");
  const paths = new Set(),
    tree = [];
  for (const file of files) {
    if (
      !file.path ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      file.path.split("/").some((p) => !p || p === "." || p === "..") ||
      paths.has(file.path)
    )
      throw new Error("提交路径不合法或重复。");
    paths.add(file.path);
  }
  for (const [i, file] of files.entries()) {
    onProgress?.(`准备文件 ${i + 1}/${files.length}`);
    if (file.delete) {
      tree.push({ path: file.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    let content, encoding;
    if (typeof file.text === "string") {
      content = file.text;
      encoding = "utf-8";
    } else {
      const b = new Uint8Array(file.bytes);
      let binary = "";
      for (let o = 0; o < b.length; o += 32768)
        binary += String.fromCharCode(...b.subarray(o, o + 32768));
      content = btoa(binary);
      encoding = "base64";
    }
    const blob = await githubJSON({
      repo,
      token,
      path: "git/blobs",
      method: "POST",
      body: { content, encoding },
      timeout: 90000,
    });
    tree.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const nextTree = await githubJSON({
    repo,
    token,
    path: "git/trees",
    method: "POST",
    body: { base_tree: snapshot.tree, tree },
  });
  const commit = await githubJSON({
    repo,
    token,
    path: "git/commits",
    method: "POST",
    body: { message, tree: nextTree.sha, parents: [snapshot.head] },
  });
  onProgress?.("正在提交完整文章版本…");
  try {
    await githubJSON({
      repo,
      token,
      path: `git/refs/heads/${encodeURIComponent(branch)}`,
      method: "PATCH",
      body: { sha: commit.sha, force: false },
    });
  } catch (error) {
    throw new Error(
      `${error.message} 如果网络在最后一步断开，请先检查GitHub提交记录再重试，避免重复提交。`,
    );
  }
  return {
    revision: commit.sha,
    commitUrl:
      commit.html_url || `https://github.com/${repo}/commit/${commit.sha}`,
  };
}
