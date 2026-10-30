import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
after(() => server.close());
const model = await server.ssrLoadModule("/src/lib/growthPreview.js");
const dates = await server.ssrLoadModule("/src/data/growth.js");
test("上一完整周按周一到周日计算，跨年仍正确", () => {
  assert.equal(model.lastFullWeek("2026-01-01"), "2025-W52");
  assert.deepEqual(dates.weekRange(model.lastFullWeek("2026-01-01")), {
    start: "2025-12-22",
    end: "2025-12-28",
  });
  assert.equal(model.lastFullWeek("2026-10-26"), "2026-W43");
  assert.equal(model.lastFullWeek("2026-10-25"), "2026-W42");
});
test("导出完整七天、状态、分类、三段内容，且不夹带相邻周", () => {
  const data = model.seedPreview("2026-10-30"),
    week = model.lastFullWeek("2026-10-30");
  data.days["2026-10-30"].learned = "本周不能混入上周的秘密测试标记";
  const digest = model.previewDigest(data, week);
  assert.equal((digest.match(/^## \d{4}-\d{2}-\d{2}/gm) || []).length, 7);
  assert.match(digest, /范围：2026-10-19 ~ 2026-10-25/);
  for (const t of [
    "分类：机械臂",
    "今天学了什么",
    "卡在哪",
    "明天接着做什么",
    "- [x]",
    "- [ ]",
  ])
    assert.ok(digest.includes(t), t);
  assert.ok(!digest.includes("本周不能混入上周的秘密测试标记"));
});
test("无记录也列出七天，旧 summary 和只有任务的天都保留", () => {
  const data = model.seedPreview("2026-10-30");
  data.days = {};
  let digest = model.previewDigest(data, "2026-W43");
  assert.equal((digest.match(/（这天没有记录）/g) || []).length, 7);
  data.days["2026-10-19"] = { summary: "旧版学习记录", tasks: [] };
  data.days["2026-10-20"] = {
    tasks: [{ text: "仅任务", done: false, project: "英语四级" }],
  };
  digest = model.previewDigest(data, "2026-W43");
  assert.match(digest, /旧版学习记录/);
  assert.match(digest, /仅任务（分类：英语四级）/);
});
test("项目重命名和删除不抹掉历史任务的分类快照", () => {
  const data = model.seedPreview("2026-10-30"),
    task = data.days["2026-10-19"].tasks[0];
  data.projects[0].name = "机器人学习";
  assert.equal(model.taskProject(task, data.projects), "机器人学习");
  assert.match(model.previewDigest(data, "2026-W43"), /分类：机械臂/);
  data.projects = [];
  assert.equal(model.taskProject(task, data.projects), "机械臂（已删除）");
  assert.match(model.previewDigest(data, "2026-W43"), /分类：机械臂/);
});
test("旧版预览迁移保留任务、成果和手写复盘，不冒充有日期的历史周报", () => {
  const migrated = model.migratePreview(
    {
      tasks: [{ id: "old", text: "四级", project: "个人网站", done: true }],
      wins: [{ text: "旧成果" }],
      reviews: { win: "旧手写复盘" },
      energy: "有点累",
    },
    "2026-10-30",
  );
  assert.equal(migrated.days["2026-10-30"].tasks[0].id, "old");
  assert.equal(migrated.wins[0].text, "旧成果");
  assert.equal(migrated.energy, "有点累");
  assert.match(migrated.reviewDrafts["2026-W44"], /原内容未标注日期/);
  assert.match(migrated.reviewDrafts["2026-W44"], /旧手写复盘/);
  assert.deepEqual(migrated.weekly, {});
  assert.equal(model.migratePreview(migrated), migrated);
});
