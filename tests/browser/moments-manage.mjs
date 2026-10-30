// Only simulated GitHub requests. Never deletes real data.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseMoments, removeMomentBlock } from "../../src/lib/moments.js";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const base = process.env.QA_BASE_URL || "http://localhost:5173",
  out = process.env.QA_OUTPUT_DIR || ".qa";
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
await ctx.addInitScript(() => {
  if (window === top) {
    sessionStorage.setItem("write_pass", "ok");
    sessionStorage.setItem("moments_pat", "not-a-real-token-moments-test");
  }
});
const initial =
  "## 2026-10-29 | 开心\n测试甲\n\n## 2026-10-28 | 开心\n测试乙\n\n## 2026-10-27 | 平静\n测试丙\n";
let raw = initial,
  sha = "v1",
  puts = 0,
  fail = false,
  releaseWrite;
const waitingWrite = new Promise((resolve) => (releaseWrite = resolve));
const requests = [];
await ctx.route("https://api.github.com/**", async (r) => {
  const req = r.request(),
    url = req.url(),
    body = req.postDataJSON();
  requests.push([req.method(), url]);
  const send = (status, data) =>
    r.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  if (
    req.method() === "PUT" &&
    url.endsWith("/contents/src/content/moments.md")
  ) {
    puts++;
    if (fail) return send(403, { message: "forbidden" });
    if (puts === 1) {
      raw += "\n## 2026-10-30 | 平静\n其他设备新增\n";
      sha = "external";
      return send(409, { message: "sha mismatch" });
    }
    await waitingWrite;
    if (body.sha !== sha) return send(409, { message: "stale SHA" });
    raw = Buffer.from(body.content, "base64").toString("utf8");
    sha = "v" + puts;
    return send(200, {
      content: { sha },
      commit: { html_url: "https://github.com/test/commit/mock" },
    });
  }
  if (url.includes("/contents/src/content/moments.md"))
    return send(200, { sha, content: Buffer.from(raw).toString("base64") });
  if (
    url.includes("/contents/src/data/livePosts.json") ||
    url.includes("/contents/src/data/hidden.json")
  )
    return send(200, {
      sha: "index",
      content: Buffer.from("[]").toString("base64"),
    });
  return send(404, {});
});
const page = await ctx.newPage(),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const rows = () =>
  page.locator(".manage-group").first().locator(".manage-item");
try {
  await page.goto(`${base}/write?type=manage`);
  await page.waitForFunction(
    () =>
      document
        .querySelectorAll(".manage-group")[0]
        ?.querySelectorAll(".manage-item").length === 3,
  );
  const target = rows().filter({ hasText: "测试甲" });
  await target.getByRole("button", { name: "删除", exact: true }).click();
  await target.getByRole("button", { name: "确认删除", exact: true }).click();
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".manage-btn")].some((e) =>
      e.textContent.includes("删除中"),
    ),
  );
  assert.ok(
    await page
      .locator(".manage-card .manage-btn")
      .evaluateAll((es) =>
        es.filter((e) => e.tagName === "BUTTON").every((e) => e.disabled),
      ),
  );
  assert.equal(
    await page.getByRole("button", { name: "刷新", exact: true }).isDisabled(),
    true,
  );
  await page.screenshot({ path: `${out}/moments-delete-locked-mobile.png` });
  releaseWrite();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll(".manage-btn")].some((e) =>
        e.textContent.includes("删除中"),
      ),
  );
  assert.equal(puts, 2);
  assert.ok(!raw.includes("测试甲"));
  assert.ok(raw.includes("其他设备新增"));
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await page.getByText("其他设备新增", { exact: true }).waitFor();
  assert.equal(await rows().count(), 3);
  // Auth errors do not retry, and the item remains visible.
  fail = true;
  const before = puts;
  const second = rows().filter({ hasText: "测试乙" });
  await second.getByRole("button", { name: "删除", exact: true }).click();
  await second.getByRole("button", { name: "确认删除", exact: true }).click();
  await page.getByText("没有权限：", { exact: false }).waitFor();
  assert.equal(puts, before + 1);
  assert.equal(await second.count(), 1);
  assert.equal(
    await second.getByRole("button", { name: "删除", exact: true }).isEnabled(),
    true,
  );
  await page.screenshot({ path: `${out}/moments-delete-error-mobile.png` });
  // Another device deleted it: the stale row is cleared without any second PUT.
  fail = false;
  raw = removeMomentBlock(
    raw,
    parseMoments(raw).find((m) => m.text === "测试乙"),
  );
  sha = "external-again";
  const count = puts;
  await second.getByRole("button", { name: "删除", exact: true }).click();
  await second.getByRole("button", { name: "确认删除", exact: true }).click();
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll(".manage-text")].some(
        (e) => e.textContent === "测试乙",
      ),
  );
  assert.equal(puts, count);
  assert.deepEqual(errors, []);
  console.log(
    "PASS management deletion / global lock / fresh 409 retry / concurrent new entry preserved / 403 no retry / already removed no-op / mobile",
  );
} finally {
  console.log("Page errors:", errors);
  await browser.close();
}
