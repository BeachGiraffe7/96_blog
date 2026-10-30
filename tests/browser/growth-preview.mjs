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
  const dates = await page.evaluate(async () => {
    const g = await import("/src/data/growth.js");
    const m = await import("/src/lib/growthPreview.js");
    const week = m.lastFullWeek();
    return {
      week,
      ...g.weekRange(week),
      today: g.localDate(),
      current: g.isoWeek(g.localDate()),
    };
  });
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
  await nav("长期项目").click();
  await page.getByRole("button", { name: "＋ 新建长期项目" }).click();
  await page.getByLabel("项目名称（必填）").fill("英语四级");
  await page.getByLabel("目标说明").fill("积累词汇，系统备考");
  await page.getByLabel("内容规划").fill("每天背 30 个单词，每周练一套听力。");
  await page.getByLabel("预期成果").fill("完成真题与错题整理");
  await shot("desktop-project-editor");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await shot("desktop-projects");
  await page.getByRole("button", { name: "＋ 新建长期项目" }).click();
  await page.getByLabel("项目名称（必填）").fill("英语四级");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "已有同名项目" }).waitFor();
  await page.getByRole("button", { name: "取消编辑" }).click();
  await nav("今日行动").click();
  await page.getByLabel("所属项目").selectOption({ label: "英语四级" });
  await page.getByLabel("新增行动").fill("背 30 个四级单词");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page.getByRole("checkbox", { name: "完成：背 30 个四级单词" }).check();
  await page
    .getByLabel("今天学了什么", { exact: true })
    .fill("记住了 30 个词，完成一组听力。");
  await page.getByLabel("卡在哪", { exact: true }).fill("听力里的连读还不熟。");
  await page
    .getByLabel("明天接着做什么", { exact: true })
    .fill("复习错词，并跟读一段听力。");
  await nav("长期项目").click();
  await page.getByRole("button", { name: "编辑项目：英语四级" }).click();
  await page.getByLabel("项目名称（必填）").fill("四级备考");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await nav("今日行动").click();
  assert.equal(
    await page
      .getByLabel("所属项目")
      .locator("option", { hasText: "四级备考" })
      .count(),
    1,
  );
  assert.equal(
    await page
      .getByLabel("调整分类：背 30 个四级单词")
      .locator("option:checked")
      .textContent(),
    "四级备考",
  );
  await page.getByRole("button", { name: "已完成", exact: true }).click();
  assert.equal(await page.getByRole("checkbox").count(), 2);
  await page.getByRole("button", { name: "全部", exact: true }).click();
  await page.getByRole("button", { name: "删除：背 30 个四级单词" }).click();
  await page.getByRole("button", { name: "撤销上次操作" }).click();
  await nav("长期项目").click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "删除项目：四级备考" }).click();
  await nav("今日行动").click();
  assert.equal(
    await page
      .getByLabel("调整分类：背 30 个四级单词")
      .locator("option:checked")
      .textContent(),
    "英语四级（已删除）",
  );
  assert.equal(await page.getByLabel("所属项目").inputValue(), "");
  await page.getByLabel("调整分类：背 30 个四级单词").selectOption("p-blog");
  assert.equal(
    await page.getByLabel("调整分类：背 30 个四级单词").inputValue(),
    "p-blog",
  );
  await page.getByLabel("记录日期").fill(dates.start);
  await page
    .getByLabel("今天学了什么", { exact: true })
    .fill("QA：在上周一完成英语学习。");
  await page.getByLabel("新增行动").fill("QA：上周一背单词");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page.getByRole("button", { name: "今天", exact: true }).click();
  assert.equal(
    await page.getByLabel("今天学了什么", { exact: true }).inputValue(),
    "记住了 30 个词，完成一组听力。",
  );
  await nav("每周复盘").click();
  await page.getByText(dates.current, { exact: true }).waitFor();
  await page.getByRole("button", { name: "查看导出内容", exact: true }).click();
  let digest = await page
    .getByLabel("交给 AI 的完整内容（预览示例）")
    .inputValue();
  assert.equal((digest.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length, 7);
  assert(digest.includes("QA：在上周一完成英语学习。"));
  assert(!digest.includes("记住了 30 个词，完成一组听力。"));
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "一键导出七天记录 .md" }).click();
  const download = await downloadPromise;
  await download.saveAs(`${root}/weekly.md`);
  assert.equal(await fs.readFile(`${root}/weekly.md`, "utf8"), digest);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async (text) => {
      window.__copied = text;
    };
  });
  await page.getByRole("button", { name: "复制给 AI", exact: true }).click();
  assert.equal(await page.evaluate(() => window.__copied), digest);
  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => {
      throw Error("blocked");
    };
  });
  await page.getByRole("button", { name: "复制给 AI", exact: true }).click();
  await page
    .getByText("自动复制不可用，请全选下方导出文本复制，或下载文件。")
    .waitFor();
  await page
    .getByLabel("粘贴 AI 生成的周复盘")
    .fill("# 上周复盘\n\n- 完成了实验验证。\n- 下周复习听力连读。");
  await page.getByRole("button", { name: "保存本周复盘" }).click();
  await page.getByRole("button", { name: "阅读预览", exact: true }).click();
  await page.getByRole("heading", { name: "上周复盘", exact: true }).waitFor();
  const savedWeekly = await page.evaluate(
    () => JSON.parse(localStorage.getItem("growth-workbench-demo-v1")).weekly,
  );
  assert.equal(savedWeekly[dates.current].sourceWeek, dates.week);
  await shot("desktop-review");
  await page.getByRole("button", { name: "下一周", exact: true }).click();
  await page.getByLabel("粘贴 AI 生成的周复盘").fill("本周独立草稿");
  await page.getByRole("button", { name: "上一周", exact: true }).click();
  assert(
    (await page.getByLabel("粘贴 AI 生成的周复盘").inputValue()).includes(
      "上周复盘",
    ),
  );
  await page.reload();
  await nav("每周复盘").click();
  await page.getByRole("button", { name: "下一周", exact: true }).click();
  assert.equal(
    await page.getByLabel("粘贴 AI 生成的周复盘").inputValue(),
    "本周独立草稿",
  );
  await page.getByRole("button", { name: "保存本周复盘" }).click();
  assert.equal(await page.locator(".gw-week-history button").count(), 2);
  await page.getByRole("button", { name: "下一周", exact: true }).click();
  await page.getByRole("button", { name: "查看导出内容", exact: true }).click();
  digest = await page.getByLabel("交给 AI 的完整内容（预览示例）").inputValue();
  assert.equal((digest.match(/（这天没有记录）/g) || []).length, 7);
  await shot("desktop-empty-week");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "回到本周", exact: true }).click();
  await shot("mobile-review");
  await page.getByRole("button", { name: "阅读预览", exact: true }).click();
  await shot("mobile-review-reading");
  await nav("长期项目").click();
  await shot("mobile-projects");
  await page.getByRole("button", { name: "＋ 新建长期项目" }).click();
  await page.getByLabel("项目名称（必填）").fill("英语四级");
  await shot("mobile-project-editor");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await nav("今日行动").click();
  await shot("mobile-today");
  await page.getByLabel("今日成果", { exact: true }).fill("QA：成果归档");
  await page.getByRole("button", { name: "留下这一步" }).click();
  await nav("成果记录").click();
  await page.getByText("QA：成果归档", { exact: true }).waitFor();
  await shot("mobile-archive");
  await nav("长期项目").click();
  while (await page.getByRole("button", { name: /^删除项目：/ }).count()) {
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("button", { name: /^删除项目：/ })
      .first()
      .click();
  }
  await shot("mobile-empty-projects");
  await nav("今日行动").click();
  assert.equal(await page.getByLabel("所属项目").locator("option").count(), 1);
  await page.getByLabel("新增行动").fill("没有项目也能记录");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "完成：没有项目也能记录" })
    .waitFor();
  await page.emulateMedia({ colorScheme: "dark" });
  await nav("每周复盘").click();
  await shot("mobile-dark-review");
  await page.setViewportSize({ width: 1440, height: 1050 });
  await shot("desktop-dark-review");
  assert.deepEqual(errors, []);
  assert.deepEqual(writes, []);
  console.log(
    "PASS: project CRUD, duplicate validation, dynamic categories, safe deletion, daily isolation, previous-week defaults, exact seven-day export/download, clipboard+fallback, per-week paste/save/history/preview/drafts, reload, empty states, mobile/dark, no GitHub writes",
  );
} catch (e) {
  console.error("PAGE_ERRORS", errors);
  console.error("LABELS", await page.locator("label").allTextContents());
  await page.screenshot({ path: `${root}/failure.png`, fullPage: true });
  throw e;
} finally {
  await browser.close();
}
