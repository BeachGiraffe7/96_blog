import test from "node:test";
import assert from "node:assert/strict";
import { commitFiles } from "../src/lib/github.js";
import { publishArticle } from "../src/lib/article/publish.js";
import {
  emptyArticle,
  readAsset,
  articleManifest,
  resolveAsset,
  MAX_FILE_BYTES,
} from "../src/lib/article/article.js";
import { validateManifest, readLimited } from "../src/lib/article/load.js";
import { zipFiles, readArticleZIP } from "../src/lib/article/zip.js";
import { articleToc } from "../src/lib/article/toc.js";
import {
  fileToMarkdown,
  rowsToMarkdown,
  rowsFromItems,
} from "../src/lib/importDocs.js";
function mockAPI(handler) {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, opt = {}) => {
    const r = {
      url: String(url),
      method: opt.method || "GET",
      body: opt.body ? JSON.parse(opt.body) : null,
    };
    calls.push(r);
    const out = handler(r, calls);
    return new Response(JSON.stringify(out?.data ?? out ?? {}), {
      status: out?.status || 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, restore: () => (globalThis.fetch = original) };
}
function standard(r) {
  if (r.url.includes("/git/ref/")) return { object: { sha: "HEAD" } };
  if (r.url.includes("/git/commits/")) return { tree: { sha: "TREE" } };
  if (r.url.includes("/contents/src/data/livePosts.json"))
    return { sha: "INDEX", content: btoa("[]") };
  if (r.method === "GET" && r.url.includes("/contents/"))
    return { status: 404 };
  if (r.url.endsWith("/git/blobs")) return { sha: "BLOB" };
  if (r.url.endsWith("/git/trees")) return { sha: "NEW_TREE" };
  if (r.url.endsWith("/git/commits"))
    return {
      sha: "COMMIT",
      html_url: "https://github.com/test/repo/commit/COMMIT",
    };
  return {};
}
const base = {
  repo: "test/repo",
  branch: "main",
  token: "test-only-placeholder",
};
function doc() {
  const d = emptyArticle();
  d.meta.title = "文章";
  d.meta.slug = "test-post";
  d.blocks[0].text = "## 理解\n\n正文";
  return d;
}
test("完整文章仅最后一步更新ref，不使用逐文件PUT", async () => {
  const m = mockAPI(standard);
  try {
    await commitFiles({
      ...base,
      snapshot: { head: "HEAD", tree: "TREE" },
      files: [
        { path: "a.md", text: "中文" },
        { path: "assets/a.pdf", bytes: new Uint8Array([1, 2]).buffer },
      ],
      message: "test",
    });
    assert.equal(m.calls.filter((c) => c.method === "PATCH").length, 1);
    assert.equal(m.calls.at(-1).method, "PATCH");
    assert.equal(m.calls.at(-1).body.force, false);
    assert.ok(!m.calls.some((c) => c.method === "PUT"));
    assert.deepEqual(
      m.calls.find((c) => c.url.endsWith("git/commits")).body.parents,
      ["HEAD"],
    );
  } finally {
    m.restore();
  }
});
test("附件上传失败，不更新公开ref", async () => {
  const m = mockAPI((r) =>
    r.url.endsWith("git/blobs")
      ? { status: 500, data: { message: "failure" } }
      : standard(r),
  );
  try {
    await assert.rejects(
      commitFiles({
        ...base,
        snapshot: { head: "HEAD", tree: "TREE" },
        files: [{ path: "x", text: "x" }],
        message: "test",
      }),
    );
    assert.ok(!m.calls.some((c) => c.method === "PATCH"));
  } finally {
    m.restore();
  }
});
test("版本冲突不force、不自动覆盖", async () => {
  const m = mockAPI((r) =>
    r.method === "PATCH"
      ? { status: 422, data: { message: "not fast forward" } }
      : standard(r),
  );
  try {
    await assert.rejects(
      commitFiles({
        ...base,
        snapshot: { head: "HEAD", tree: "TREE" },
        files: [{ path: "x", text: "x" }],
        message: "test",
      }),
      /冲突/,
    );
    assert.equal(m.calls.filter((c) => c.method === "PATCH").length, 1);
    assert.equal(m.calls.at(-1).body.force, false);
  } finally {
    m.restore();
  }
});
test("文章发布包含manifest、降级MD与目录；未连接不可写入", async () => {
  const m = mockAPI(standard);
  try {
    await assert.rejects(
      publishArticle({ ...base, token: "", doc: doc(), assets: {} }),
      /连接GitHub/,
    );
    assert.equal(m.calls.length, 0);
    const r = await publishArticle({ ...base, doc: doc(), assets: {} });
    assert.equal(r.revision, "COMMIT");
    const tree = m.calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/git/trees"),
    ).body.tree;
    assert.deepEqual(
      tree.map((x) => x.path),
      [
        "public/articles/test-post/article.json",
        "src/content/notes/test-post.md",
        "src/data/livePosts.json",
      ],
    );
  } finally {
    m.restore();
  }
});
test("新建不得覆盖已有网址", async () => {
  const m = mockAPI(standard);
  try {
    await assert.rejects(
      publishArticle({
        ...base,
        doc: doc(),
        assets: {},
        knownPosts: [{ slug: "test-post" }],
      }),
      /已有文章/,
    );
    assert.ok(!m.calls.some((c) => c.method === "POST"));
  } finally {
    m.restore();
  }
});
test("编辑版本SHA不一致时拒绝覆盖", async () => {
  const d = doc();
  d.origin = { slug: "test-post", manifestSha: "old" };
  const m = mockAPI((r) =>
    r.url.includes("article.json")
      ? { sha: "new", content: btoa("{}") }
      : standard(r),
  );
  try {
    await assert.rejects(
      publishArticle({ ...base, doc: d, assets: {} }),
      /已变更/,
    );
    assert.ok(!m.calls.some((c) => c.method === "POST"));
  } finally {
    m.restore();
  }
});
test("清单路径与类型校验，拒绝目录穿越与重复ID", () => {
  const d = doc(),
    m = articleManifest(d, {});
  assert.equal(validateManifest(m), m);
  assert.throws(
    () =>
      validateManifest({
        ...m,
        assets: [
          {
            id: "constructor",
            path: "../x",
            type: "html",
            name: "x.html",
            size: 1,
          },
        ],
      }),
    /不合法/,
  );
  assert.throws(
    () => validateManifest({ ...m, blocks: [d.blocks[0], d.blocks[0]] }),
    /不合法/,
  );
});
test("中文ZIP可回读并验证CRC；拒绝恶意路径", async () => {
  const b = await zipFiles([["assets/中文.txt", "正文"]]).arrayBuffer();
  assert.equal(new TextDecoder().decode(readArticleZIP(b)[0].bytes), "正文");
  assert.throws(() => readArticleZIP(new Uint8Array([0, 1, 2]).buffer));
  const evil = await zipFiles([["../x", "x"]]).arrayBuffer();
  assert.throws(() => readArticleZIP(evil), /路径/);
  const bad = b.slice(0);
  new Uint8Array(bad)[
    30 + new TextEncoder().encode("assets/中文.txt").length
  ] ^= 1;
  assert.throws(() => readArticleZIP(bad), /校验/);
});
test("源文件签名与20MB限制", async () => {
  await assert.rejects(readAsset(new File(["x"], "x.pdf")), /不是有效/);
  await assert.rejects(
    readAsset({ name: "x.pdf", size: MAX_FILE_BYTES + 1 }),
    /20MB/,
  );
});
test("引用唯一匹配，不猜测同名文件", () => {
  const a = { id: "a", name: "知识.pdf" },
    b = { id: "b", name: "x.pdf", aliases: "知识.pdf" };
  assert.equal(resolveAsset("./知识.pdf#page=2", { a })?.id, "a");
  assert.equal(resolveAsset("./知识.pdf", { a, b }), null);
});
test("组合目录保留块前缀、同名标题与PDF模块；忽略代码中的标题", () => {
  const d = doc();
  d.blocks[0].id = "a";
  d.blocks[0].text = "# 概览\n\n## 概览\n\n```c\n## 不应出现\n```";
  d.blocks.push({ id: "pdf", type: "pdf", title: "中文总图" });
  assert.deepEqual(
    articleToc(d).map((x) => x.id),
    ["a-概览", "a-概览-1", "block-pdf"],
  );
});
test("读取响应有硬大小限制", async () => {
  await assert.rejects(readLimited(new Response("12345"), 3), /超出/);
  assert.equal(
    new TextDecoder().decode(await readLimited(new Response("123"), 3)),
    "123",
  );
});
test("旧文字导入接口与PDF纯函数保持兼容", async () => {
  const r = await fileToMarkdown(new File(["## 标题\n正文"], "x.md"));
  assert.equal(r.markdown, "## 标题\n正文");
  assert.ok(Array.isArray(r.warnings));
  assert.equal(rowsToMarkdown([]), "");
  assert.equal(rowsFromItems([]).length, 0);
});

test("非法路径在上传任何文件前拒绝", async () => {
  const m = mockAPI(standard);
  try {
    await assert.rejects(
      commitFiles({
        ...base,
        snapshot: { head: "HEAD", tree: "TREE" },
        files: [
          { path: "ok.txt", text: "ok" },
          { path: "../bad", text: "bad" },
        ],
        message: "test",
      }),
      /路径/,
    );
    assert.equal(m.calls.length, 0);
  } finally {
    m.restore();
  }
});
test("清单过大在读写GitHub之前拒绝", async () => {
  const d = doc();
  d.blocks[0].text = "中".repeat(800000);
  const m = mockAPI(standard);
  try {
    await assert.rejects(
      publishArticle({ ...base, doc: d, assets: {} }),
      /2MB/,
    );
    assert.equal(m.calls.length, 0);
  } finally {
    m.restore();
  }
});
test("合法编辑保留日期和阅读数并移除私人origin", async () => {
  const d = doc();
  d.origin = { slug: "test-post", manifestSha: "ORIGINAL" };
  const m = mockAPI((r) => {
    if (r.url.includes("/contents/src/data/livePosts.json"))
      return {
        sha: "INDEX",
        content: btoa(
          JSON.stringify([
            {
              slug: "test-post",
              date: "2025-01-02",
              views: 29,
              contentType: "article-v1",
            },
          ]),
        ),
      };
    if (r.url.includes("/contents/public/articles/test-post/article.json"))
      return { sha: "ORIGINAL", content: btoa("{}") };
    return standard(r);
  });
  try {
    await publishArticle({ ...base, doc: d, assets: {} });
    const blobs = m.calls
      .filter((r) => r.url.endsWith("/git/blobs"))
      .map((r) => r.body.content);
    const manifest = JSON.parse(blobs[0]),
      entry = JSON.parse(blobs.at(-1))[0];
    assert.ok(!manifest.origin);
    assert.equal(entry.date, "2025-01-02");
    assert.equal(entry.views, 29);
    assert.equal(m.calls.filter((r) => r.method === "PATCH").length, 1);
  } finally {
    m.restore();
  }
});

const { removeArticle } = await import("../src/lib/article/remove.js");
function removeAPI(r) {
  if (r.url.includes("/contents/src/data/livePosts.json"))
    return {
      sha: "INDEX",
      content: btoa(
        JSON.stringify([
          { slug: "test-post", contentType: "article-v1" },
          { slug: "other" },
        ]),
      ),
    };
  if (r.url.includes("/contents/src/content/notes/test-post.md"))
    return { sha: "BODY", content: btoa("old") };
  for (const [parent, path, sha] of [
    ["TREE", "public", "PUBLIC"],
    ["PUBLIC", "articles", "ARTICLES"],
    ["ARTICLES", "test-post", "POST"],
  ])
    if (r.url.endsWith(`/git/trees/${parent}`))
      return { tree: [{ type: "tree", path, sha }] };
  if (r.url.includes("/git/trees/POST?recursive=1"))
    return {
      tree: [
        { type: "blob", path: "article.json" },
        { type: "blob", path: "assets/a.pdf" },
        { type: "blob", path: "assets/old-unused.html.txt" },
      ],
    };
  return standard(r);
}
test("删除组合文章同一提交移除正文、目录和所有当前附件", async () => {
  const m = mockAPI(removeAPI);
  try {
    await removeArticle({ ...base, slug: "test-post" });
    const tree = m.calls.find(
      (r) => r.method === "POST" && r.url.endsWith("/git/trees"),
    ).body.tree;
    assert.equal(tree.filter((x) => x.sha === null).length, 4);
    assert.ok(
      tree.some(
        (x) =>
          x.path === "public/articles/test-post/assets/old-unused.html.txt" &&
          x.sha === null,
      ),
    );
    assert.equal(m.calls.filter((r) => r.method === "PATCH").length, 1);
    assert.equal(m.calls.at(-1).body.force, false);
  } finally {
    m.restore();
  }
});
test("附件目录截断时不删除任何公开文件", async () => {
  const m = mockAPI((r) =>
    r.url.includes("/git/trees/POST?recursive=1")
      ? { truncated: true, tree: [] }
      : removeAPI(r),
  );
  try {
    await assert.rejects(
      removeArticle({ ...base, slug: "test-post" }),
      /目录过大/,
    );
    assert.ok(
      !m.calls.some((r) => r.method === "POST" || r.method === "PATCH"),
    );
  } finally {
    m.restore();
  }
});
