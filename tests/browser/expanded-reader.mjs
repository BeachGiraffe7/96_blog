// All external APIs are blocked; public article assets are local fixtures.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { readArticleZIP } from "../../src/lib/article/zip.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.QA_BASE_URL || "http://localhost:5173";
const out = process.env.QA_OUTPUT_DIR || ".qa";
const raw = await fs.readFile(`${out}/article.zip`);
const files = new Map(
  readArticleZIP(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  ).map((e) => [e.path, e.bytes]),
);
const m = JSON.parse(new TextDecoder().decode(files.get("article.json")));
const post = {
  ...m.meta,
  slug: m.meta.slug,
  tags: ["STM32"],
  date: "2026-10-30",
  words: 174,
  views: 0,
  contentType: "article-v1",
  hasBody: true,
};
const b = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.route("https://api.github.com/**", (r) => r.abort());
await ctx.route("**/src/data/livePosts.json*", (r) =>
  r.fulfill({
    contentType: "application/javascript",
    body: `export default ${JSON.stringify([post])}`,
  }),
);
await ctx.route("**/articles/**", (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname).split(
    `/articles/${m.meta.slug}/`,
  )[1];
  const bytes = files.get(path);
  return r.fulfill({
    status: bytes ? 200 : 404,
    contentType:
      path === "article.json" ? "application/json" : "application/octet-stream",
    body: bytes ? Buffer.from(bytes) : "not found",
  });
});
const p = await ctx.newPage(),
  errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const modal = () => p.locator("dialog.asset-stage:modal");
const waitPDF = async () => {
  await p.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  await p.waitForFunction(
    () =>
      document.querySelector(".pdf-canvas-area")?.getAttribute("aria-busy") ===
      "false",
  );
};
try {
  await p.goto(`${base}/post/${m.meta.slug}`);
  await p.waitForFunction(
    () =>
      document.querySelector('[aria-label="PDF页码"]')?.options.length === 3,
  );
  await p.getByLabel("PDF页码", { exact: true }).selectOption("2");
  await waitPDF();
  const inline = (await p.locator(".pdf-viewer").boundingBox()).width;
  await p.getByRole("button", { name: "大窗口阅读", exact: true }).click();
  await modal().waitFor();
  await waitPDF();
  const large = await modal().boundingBox();
  assert.ok(
    large.width >= 1380 && large.height >= 950 && large.width > inline * 1.25,
  );
  assert.equal(
    await p.evaluate(() => document.documentElement.style.overflow),
    "hidden",
  );
  await modal().getByRole("button", { name: "下一页", exact: true }).click();
  assert.equal(
    await p.getByLabel("PDF页码", { exact: true }).inputValue(),
    "3",
  );
  await modal().getByRole("button", { name: "上一页", exact: true }).click();
  await waitPDF();
  await p.screenshot({ path: `${out}/expanded-pdf-desktop.png` });
  await p.getByLabel("PDF缩放", { exact: true }).selectOption("2");
  await waitPDF();
  assert.ok(
    await p
      .locator(".pdf-canvas-area")
      .evaluate((e) => e.scrollWidth > e.clientWidth * 1.8),
  );
  assert.ok(
    await p
      .locator(".pdf-canvas-area canvas")
      .evaluate((e) => e.width * e.height <= 16_050_000),
  );
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector("dialog:modal"));
  assert.equal(
    await p.getByLabel("PDF页码", { exact: true }).inputValue(),
    "2",
  );
  assert.equal(
    await p.evaluate(() => document.activeElement?.textContent.trim()),
    "大窗口阅读",
  );
  await p.getByLabel("PDF缩放", { exact: true }).selectOption("1");
  await p.getByRole("button", { name: "大窗口阅读", exact: true }).click();
  await modal().waitFor();
  await p.mouse.click(4, 4);
  await p.waitForFunction(() => !document.querySelector("dialog:modal"));

  await p.getByRole("button", { name: "启用交互", exact: true }).click();
  const frame = p.frameLocator(".html-module iframe");
  await frame.locator("#m").fill("9");
  const f = p.frames().find((f) => f.parentFrame());
  const nonce = await f.evaluate(() => (window.__stateTest = Math.random()));
  await p.getByRole("button", { name: "大窗口打开", exact: true }).click();
  await modal().waitFor();
  assert.equal(await frame.locator("#m").inputValue(), "9");
  assert.equal(await f.evaluate(() => window.__stateTest), nonce);
  assert.ok(
    (await p.locator(".html-module iframe").boundingBox()).width >= 1380,
  );
  await p.screenshot({ path: `${out}/expanded-html-desktop.png` });
  await p.getByRole("button", { name: "关闭大窗口", exact: true }).click();
  assert.equal(await frame.locator("#m").inputValue(), "9");
  assert.equal(await f.evaluate(() => window.__stateTest), nonce);
  await p.getByRole("button", { name: "大窗口打开", exact: true }).click();
  await frame
    .getByRole("link", { name: "打开PDF中文总图", exact: false })
    .click();
  await p.waitForFunction(() => !document.querySelector("dialog:modal"));
  assert.equal(
    await p.getByLabel("PDF页码", { exact: true }).inputValue(),
    "2",
  );
  // The page/iframe can resize without reloading or resetting an experiment.
  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole("button", { name: "大窗口打开", exact: true }).click();
  await modal().waitFor();
  assert.equal(Math.round((await modal().boundingBox()).width), 390);
  assert.equal(await frame.locator("#m").inputValue(), "9");
  assert.equal(
    await f.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await p.screenshot({ path: `${out}/expanded-html-mobile.png` });
  await frame.locator("#m").focus();
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector("dialog:modal"));
  await p.getByRole("button", { name: "大窗口阅读", exact: true }).click();
  await modal().waitFor();
  await waitPDF();
  await p.screenshot({ path: `${out}/expanded-pdf-mobile.png` });
  await p.getByRole("button", { name: "关闭大窗口", exact: true }).click();
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  assert.notEqual(
    await p.evaluate(() => document.documentElement.style.overflow),
    "hidden",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS desktop/mobile expanded PDF & HTML / zoom bounds / Esc from iframe / focus return / state preservation / PDF bridge / scroll unlock",
  );
} finally {
  console.log("Page errors:", errors);
  await b.close();
}
