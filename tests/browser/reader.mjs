// All GitHub requests are intercepted. Never enter a real credential in these tests.
const base = process.env.QA_BASE_URL || "http://localhost:5173",
  out = process.env.QA_OUTPUT_DIR || ".qa";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readArticleZIP } from "../../src/lib/article/zip.js";
const file = await fs.readFile(`${out}/article.zip`);
const entries = readArticleZIP(
    file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
  ),
  files = new Map(entries.map((e) => [e.path, e.bytes]));
const m = JSON.parse(new TextDecoder().decode(files.get("article.json"))),
  slug = m.meta.slug;
const post = {
  slug,
  title: m.meta.title,
  category: m.meta.category,
  series: m.meta.series,
  date: "2026-10-30",
  views: 0,
  words: 174,
  tags: ["STM32"],
  excerpt: m.meta.excerpt,
  hasBody: true,
  contentType: "article-v1",
  articlePath: `/articles/${slug}/article.json`,
};
const b = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } }),
  p = await ctx.newPage(),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
let bad = false;
await ctx.route("**/src/data/livePosts.json*", (r) =>
  r.fulfill({
    contentType: "application/javascript",
    body: `export default ${JSON.stringify([post])}`,
  }),
);
await ctx.route("**/articles/**", async (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname).split(
    `/articles/${slug}/`,
  )[1];
  if (bad && path === "article.json")
    return r.fulfill({
      contentType: "application/json",
      body: '{"schemaVersion":999}',
    });
  const bytes = files.get(path);
  if (!bytes) return r.fulfill({ status: 404, body: "not found" });
  return r.fulfill({
    contentType:
      path === "article.json"
        ? "application/json"
        : path.endsWith(".pdf")
          ? "application/pdf"
          : "text/plain",
    body: Buffer.from(bytes),
  });
});
try {
  await p.goto(`${base}/post/${slug}`);
  await p
    .locator(".article-content .article-components .article-reader")
    .waitFor();
  await p.waitForFunction(
    () =>
      document.querySelector('[aria-label="PDF页码"]')?.options.length === 3,
  );
  assert.equal(
    await p
      .getByRole("heading", { level: 1, name: m.meta.title, exact: true })
      .count(),
    1,
  );
  assert.equal(await p.getByLabel("PDF页码").locator("option").count(), 3);
  assert.ok((await p.locator(".toc-link").count()) > 0);
  await p.getByRole("button", { name: "启用交互", exact: true }).click();
  await p
    .frameLocator("iframe")
    .getByRole("link", { name: "打开PDF中文总图", exact: false })
    .click();
  await p.waitForTimeout(300);
  assert.equal(await p.getByLabel("PDF页码").inputValue(), "2");
  await p.getByRole("button", { name: "暂停交互", exact: true }).click();
  await p.screenshot({
    path: `${out}/article-reader-desktop.png`,
    fullPage: true,
  });
  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await p.screenshot({
    path: `${out}/article-reader-mobile.png`,
    fullPage: true,
  });
  bad = true;
  await p.reload();
  await p.getByRole("alert").waitFor();
  await p.screenshot({ path: `${out}/reader-error-mobile.png` });
  bad = false;
  await p.getByRole("button", { name: "重新加载文章", exact: true }).click();
  await p.locator(".article-reader").waitFor();
  // Old published Markdown article keeps its original rendering path.
  await p.goto(`${base}/post/git-github-desktop`);
  await p.locator(".article-content .md").waitFor();
  assert.equal(
    await p.locator(".article-content .article-components").count(),
    0,
  );
  // Edit existing composite article from GitHub: real origin SHA is required.
  await ctx.addInitScript(() => {
    if (window === window.top) {
      sessionStorage.setItem("write_pass", "ok");
      sessionStorage.setItem("moments_pat", "not-a-real-token-reader-test");
    }
  });
  await ctx.route("https://api.github.com/**", async (r) => {
    const u = new URL(r.request().url());
    const parts = decodeURIComponent(u.pathname).split(
      `/contents/public/articles/${slug}/`,
    );
    if (parts.length === 2) {
      const name = parts[1];
      if (name === "article.json")
        return r.fulfill({
          contentType: "application/json",
          body: JSON.stringify({
            sha: "MANIFEST_V1",
            content: Buffer.from(JSON.stringify(m)).toString("base64"),
          }),
        });
      const bytes = files.get(name);
      if (bytes)
        return r.fulfill({
          contentType: "application/octet-stream",
          body: Buffer.from(bytes),
        });
    }
    return r.fulfill({
      status: 404,
      contentType: "application/json",
      body: "{}",
    });
  });
  await p.goto(`${base}/write?type=post&edit=${slug}`);
  await p.waitForFunction(
    (title) => document.querySelector("#article-title")?.value === title,
    m.meta.title,
  );
  assert.equal(await p.locator(".edit-block").count(), 5);
  assert.equal(await p.getByRole("alert").count(), 0);
  await p.screenshot({
    path: `${out}/edit-existing-mobile.png`,
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "PASS published article / title once / TOC / PDF bridge / mobile / retry / legacy Markdown / editing loaded from mocked GitHub",
  );
} finally {
  console.log("Page errors:", errors);
  await b.close();
}
