const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
import fs from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ["--no-sandbox"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 1050 },
  colorScheme: "light",
});
const page = await ctx.newPage();
const errors = [];
const writes = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (r.url().includes("api.github.com") && r.method() !== "GET")
    writes.push(r.url());
});
const base = process.env.QA_BASE_URL || "http://127.0.0.1:5173";
const root = process.env.QA_OUTPUT_DIR || ".qa/growth-preview";
await fs.mkdir(root, { recursive: true });
async function shot(name) {
  await page.screenshot({ path: `${root}/${name}.png`, fullPage: true });
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    `overflow ${name}`,
  );
}
const nav = (name) =>
  page
    .getByRole("navigation", { name: "成长工作台" })
    .getByRole("button", { name, exact: false });
try {
  await page.goto(`${base}/growth-preview`);
  await page.getByRole("heading", { name: "今日行动", exact: true }).waitFor();
  assert.equal(
    await page.locator("meta[name=robots]").getAttribute("content"),
    "noindex, nofollow",
  );
  await shot("desktop-today");
  const first = page.getByRole("checkbox", {
    name: "完成：跑通一次机械臂逆运动学示例",
  });
  await first.check();
  await page.getByRole("button", { name: "撤销上次操作" }).click();
  assert.equal(await first.isChecked(), false);
  await page.getByLabel("新增行动").fill("QA：验证一个小行动");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "完成：QA：验证一个小行动" })
    .check();
  await page.getByRole("button", { name: "已完成", exact: true }).click();
  assert.equal(await page.getByRole("checkbox").count(), 2);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "删除：QA：验证一个小行动" }).click();
  await page.getByRole("button", { name: "撤销上次操作" }).click();
  assert.equal(
    await page
      .getByRole("checkbox", { name: "完成：QA：验证一个小行动" })
      .count(),
    1,
  );
  await page.getByLabel("今日成果", { exact: true }).fill("QA：已完成实验记录");
  await page.getByRole("button", { name: "留下这一步" }).click();
  await nav("成果记录").click();
  await page.getByText("QA：已完成实验记录", { exact: true }).waitFor();
  await shot("desktop-archive");
  await nav("长期项目").click();
  await shot("desktop-projects");
  await page.getByRole("button", { name: "安排一个行动" }).first().click();
  assert.equal(await page.getByLabel("所属项目").inputValue(), "机械臂");
  await nav("每周复盘").click();
  await page
    .getByLabel("这周，哪一步真的有效？")
    .fill("QA：小实验比堆任务更有效");
  await shot("desktop-review");
  await page.reload();
  await nav("每周复盘").click();
  assert.equal(
    await page.getByLabel("这周，哪一步真的有效？").inputValue(),
    "QA：小实验比堆任务更有效",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await nav("今日行动").click();
  await shot("mobile-today");
  await nav("长期项目").click();
  await shot("mobile-projects");
  await nav("每周复盘").click();
  await shot("mobile-review");
  await nav("成果记录").click();
  await shot("mobile-archive");
  while (
    await page.getByRole("button", { name: "移除记录", exact: true }).count()
  ) {
    await page
      .getByRole("button", { name: "移除记录", exact: true })
      .first()
      .click();
  }
  await shot("mobile-empty");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "重置示例" }).click();
  await nav("今日行动").click();
  await page.emulateMedia({ colorScheme: "dark" });
  await shot("mobile-dark");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await shot("desktop-dark");
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "PASS: add, toggle, undo, delete, filter, capture, project action, review persistence, reset, empty, 390px/1440px, dark, no GitHub writes",
  );
} finally {
  await browser.close();
}
