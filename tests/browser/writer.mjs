// All GitHub requests are intercepted. Never enter a real credential in these tests.
const base = process.env.QA_BASE_URL || "http://localhost:5173",
  out = process.env.QA_OUTPUT_DIR || ".qa";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  args: ["--no-sandbox"],
  headless: true,
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir(`${out}`, { recursive: true });
const calls = [];
await ctx.route("https://api.github.com/**", async (route) => {
  const req = route.request(),
    url = req.url(),
    method = req.method();
  calls.push({ url, method, body: req.postDataJSON() });
  let data = {},
    status = 200;
  if (url.endsWith("/repos/BeachGiraffe7/96_blog"))
    data = {
      full_name: "BeachGiraffe7/96_blog",
      private: false,
      permissions: { push: true },
    };
  else if (url.includes("/git/ref/")) data = { object: { sha: "HEAD" } };
  else if (url.includes("/git/commits/")) data = { tree: { sha: "TREE" } };
  else if (url.includes("/contents/src/data/livePosts.json"))
    data = { sha: "INDEX", content: Buffer.from("[]").toString("base64") };
  else if (method === "GET" && url.includes("/contents/")) {
    status = 404;
    data = { message: "not found" };
  } else if (url.endsWith("/git/blobs")) data = { sha: "BLOB" };
  else if (url.endsWith("/git/trees")) data = { sha: "NEWTREE" };
  else if (url.endsWith("/git/commits"))
    data = {
      sha: "COMMIT",
      html_url: "https://github.com/BeachGiraffe7/96_blog/commit/COMMIT",
    };
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await ctx.addInitScript(() => {
  if (window === window.top) sessionStorage.setItem("write_pass", "ok");
});
try {
  await page.goto(`${base}/write?type=post`);
  await page.getByRole("button", { name: "载入时钟树示例 →" }).click();
  await page.getByText("已载入示例。", { exact: false }).waitFor();
  await page.waitForTimeout(1600);
  assert.equal(await page.locator(".edit-block").count(), 5);
  assert.equal(
    await page
      .getByRole("button", { name: "提交发布", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await page.locator(".composer-sidebar select").count(), 2);
  await page.screenshot({ path: `${out}/editor-desktop.png`, fullPage: true });
  await page.getByRole("button", { name: "启用交互", exact: true }).click();
  const f = page.frameLocator(".html-module iframe");
  await f.getByRole("button", { name: "载入168 MHz基准", exact: true }).click();
  await f.getByRole("link", { name: "打开PDF中文总图", exact: false }).click();
  await page.waitForTimeout(300);
  assert.equal(await page.getByLabel("PDF页码").inputValue(), "2");
  await page.getByRole("button", { name: "暂停交互", exact: true }).click();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出文章包 ↗", exact: true }).click();
  await (await dl).saveAs(`${out}/article.zip`);
  // Connection must not remount and lose an immediate unsaved change.
  await page
    .getByLabel("正文Markdown")
    .first()
    .fill("## 我自己的理解\n\n连接前最后输入的内容。");
  await page.locator(".write-connect summary").click();
  await page
    .locator("input[type=password]")
    .fill("not-a-real-token-browser-test-only");
  await page.getByRole("button", { name: "验证并连接", exact: true }).click();
  await page.getByRole("button", { name: "提交发布", exact: true }).waitFor();
  await page.waitForTimeout(200);
  assert.ok(
    (await page.getByLabel("正文Markdown").first().inputValue()).includes(
      "连接前最后输入",
    ),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("moments_pat")),
    null,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.screenshot({ path: `${out}/editor-mobile.png`, fullPage: true });
  await page.getByRole("button", { name: "提交发布", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.screenshot({ path: `${out}/publish-confirm-mobile.png` });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "确认", exact: true })
    .click();
  try {
    await page
      .getByRole("heading", { name: "已提交，正在构建", exact: true })
      .waitFor({ timeout: 12000 });
  } catch (e) {
    console.log("ALERTS", await page.getByRole("alert").allInnerTexts());
    console.log("MESSAGES", await page.locator(".message").allInnerTexts());
    console.log(
      "API",
      JSON.stringify(calls.map((c) => [c.method, c.url, c.body?.message])),
    );
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true });
    throw e;
  }
  assert.equal(calls.filter((c) => c.method === "PATCH").length, 1);
  assert.equal(calls.find((c) => c.method === "PATCH").body.force, false);
  assert.ok(
    (await page.locator("body").innerText()).includes("GitHub Desktop"),
  );
  await page.screenshot({ path: `${out}/published-mobile.png` });
  await page.getByRole("button", { name: "再写一篇", exact: true }).click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator("#article-title").inputValue(), "");
  console.log(
    "PASS writing / PDF / HTML bridge / local export / live connection preserving text / mobile width / atomic simulated publish / fresh next draft",
  );
  assert.deepEqual(errors, []);
} finally {
  console.log("Page errors:", errors);
  await browser.close();
}
