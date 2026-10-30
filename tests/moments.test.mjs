import test from "node:test";
import assert from "node:assert/strict";
import { updateText, readFile } from "../src/lib/github.js";
import {
  parseMoments,
  removeMomentBlock,
  momentKey,
} from "../src/lib/moments.js";
const base = {
  repo: "test/repo",
  branch: "main",
  path: "src/content/moments.md",
  token: "test-only",
  message: "test",
};
const a = { date: "2026-10-29", mood: "开心", text: "保留 A" },
  b = { date: "2026-10-28", mood: "开心", text: "保留 B" },
  c = { date: "2026-10-27", mood: "平静", text: "删除 C" };
const block = (m) => `## ${m.date} | ${m.mood}\n${m.text}\n\n`;
function fake(handler) {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, opt = {}) => {
    const call = {
      url: String(url),
      method: opt.method || "GET",
      cache: opt.cache,
      body: opt.body ? JSON.parse(opt.body) : null,
    };
    calls.push(call);
    const r = await handler(call);
    return new Response(JSON.stringify(r.data || {}), {
      status: r.status || 200,
    });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}
const contents = (raw, sha) => ({
  data: { sha, content: Buffer.from(raw).toString("base64") },
});
const written = (r) => Buffer.from(r.body.content, "base64").toString("utf8");
test("连续删除排队读取最新SHA，不复用旧浏览器缓存", async () => {
  let raw = block(a) + block(b) + block(c),
    version = 0;
  const m = fake(async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 2));
    if (r.method === "GET") {
      assert.equal(r.cache, "no-store");
      return contents(raw, "sha" + version);
    }
    if (r.body.sha !== "sha" + version) return { status: 409 };
    raw = written(r);
    version++;
    return {
      data: {
        content: { sha: "sha" + version },
        commit: { html_url: "commit" },
      },
    };
  });
  try {
    await Promise.all([
      updateText({ ...base, update: (s) => removeMomentBlock(s, a) }),
      updateText({ ...base, update: (s) => removeMomentBlock(s, b) }),
    ]);
    assert.deepEqual(parseMoments(raw), [c]);
    assert.deepEqual(
      m.calls.map((r) => r.method),
      ["GET", "PUT", "GET", "PUT"],
    );
    assert.equal(version, 2);
  } finally {
    m.restore();
  }
});
test("跨设备并发409后重新读取并保留另一设备新增内容", async () => {
  let raw = block(a) + block(b),
    sha = "old",
    puts = 0;
  const added = { date: "2026-10-30", mood: "平静", text: "另一设备新增" };
  const m = fake((r) => {
    if (r.method === "GET") return contents(raw, sha);
    if (++puts === 1) {
      raw += block(added);
      sha = "external";
      return { status: 409 };
    }
    assert.equal(r.body.sha, "external");
    raw = written(r);
    return { data: { content: { sha: "new" } } };
  });
  try {
    await updateText({ ...base, update: (s) => removeMomentBlock(s, a) });
    assert.deepEqual(parseMoments(raw), [b, added]);
    assert.equal(puts, 2);
  } finally {
    m.restore();
  }
});
test("403权限错误不盲目重试", async () => {
  let puts = 0;
  const m = fake((r) =>
    r.method === "GET" ? contents(block(a), "sha") : (puts++, { status: 403 }),
  );
  try {
    await assert.rejects(
      updateText({ ...base, update: (s) => s + "x" }),
      (e) => e.status === 403,
    );
    assert.equal(puts, 1);
  } finally {
    m.restore();
  }
});
test("写入网络结果不明确时不重放，避免重复发布", async () => {
  let puts = 0,
    raw = block(a);
  const m = fake((r) => {
    if (r.method === "GET") return contents(raw, "sha");
    puts++;
    raw = written(r);
    throw new TypeError("network disconnected after send");
  });
  try {
    await assert.rejects(
      updateText({ ...base, update: (s) => s + block(b) }),
      /network/,
    );
    assert.equal(puts, 1);
    assert.deepEqual(parseMoments(raw), [a, b]);
  } finally {
    m.restore();
  }
});
test("目标已被另一设备删除时无需提交也成功", async () => {
  const m = fake(() => contents(block(a), "sha"));
  try {
    const r = await updateText({
      ...base,
      update: (s) => removeMomentBlock(s, b) ?? s,
    });
    assert.equal(r.unchanged, true);
    assert.equal(m.calls.length, 1);
  } finally {
    m.restore();
  }
});
test("一次失败不会阻塞后续同文件修改", async () => {
  let puts = 0;
  const m = fake((r) => {
    if (r.method === "GET") return contents(block(a), "sha");
    if (++puts === 1) return { status: 401 };
    return { data: { content: { sha: "ok" } } };
  });
  try {
    await assert.rejects(updateText({ ...base, update: (s) => s + "x" }));
    await updateText({ ...base, update: (s) => s + "y" });
    assert.equal(puts, 2);
  } finally {
    m.restore();
  }
});
test("持续409有重试上限，不强制覆盖", async () => {
  let puts = 0;
  const m = fake((r) =>
    r.method === "GET" ? contents(block(a), "sha") : (puts++, { status: 409 }),
  );
  try {
    await assert.rejects(
      updateText({ ...base, retries: 3, update: (s) => s + "x" }),
      /多次重新读取/,
    );
    assert.equal(puts, 3);
    assert.equal(m.calls.filter((r) => r.method === "GET").length, 3);
    assert.ok(!m.calls.some((r) => r.body?.force));
  } finally {
    m.restore();
  }
});
test("读取编码分支名与中文路径，绕过旧缓存", async () => {
  const m = fake(() => contents("text", "sha"));
  try {
    await readFile({ ...base, branch: "feature/a", path: "src/中文.md" });
    assert.ok(m.calls[0].url.includes("feature%2Fa"));
    assert.ok(m.calls[0].url.includes("%E4%B8%AD%E6%96%87.md"));
    assert.equal(m.calls[0].cache, "no-store");
  } finally {
    m.restore();
  }
});
test("注释示例不当作真实条目，删除保留原格式与其他内容", () => {
  const header = "<!--\r\n## 2099-01-01 | 开心\r\n只是示例\r\n-->\r\n";
  const raw = header + (block(a) + block(b)).replace(/\n/g, "\r\n");
  assert.deepEqual(parseMoments(raw), [a, b]);
  assert.equal(
    removeMomentBlock(raw, a),
    header + block(b).replace(/\n/g, "\r\n"),
  );
});
test("日期和文字相同但心情不同时精确匹配", () => {
  const other = { ...a, mood: "平静" };
  assert.deepEqual(
    parseMoments(removeMomentBlock(block(a) + block(other), other)),
    [a],
  );
  assert.notEqual(momentKey(a), momentKey(other));
});
test("相同条目存在多个时不猜测删除", () => {
  assert.throws(() => removeMomentBlock(block(a) + block(a), a), /重复/);
});
test("目标正文内部注释与空白归一化不影响匹配", () => {
  const raw = "## 2026-10-29 | 开心\n保留 <!--隐藏说明--> A\n\n" + block(b);
  assert.deepEqual(parseMoments(raw), [a, b]);
  assert.deepEqual(parseMoments(removeMomentBlock(raw, a)), [b]);
});
