// Preview-only model. Never imports the vault or reads real private records.
import {
  localDate,
  shiftDate,
  isoWeek,
  shiftWeek,
  weekRange,
  weekDigest,
} from "../data/growth";
export const PREVIEW_KEY = "growth-workbench-demo-v1";
export const lastFullWeek = (today = localDate()) =>
  shiftWeek(isoWeek(today), -1);
export const initialProjects = [
  {
    id: "p-arm",
    name: "机械臂",
    desc: "从公式走到一次真实运动",
    stage: "验证中",
    next: "跑通逆运动学 → 记录误差 → 实机验证",
    output: "运动学实验记录",
  },
  {
    id: "p-vision",
    name: "机器视觉",
    desc: "让每次实验都有可比较的结论",
    stage: "探索中",
    next: "整理失败样本 → 对比光照条件 → 调整方案",
    output: "识别实验对照表",
  },
  {
    id: "p-blog",
    name: "个人网站",
    desc: "把学习沉淀为能被读懂的内容",
    stage: "持续迭代",
    next: "优化阅读体验 → 整理文章 → 发布总结",
    output: "一篇可复用的技术文章",
  },
];
export function seedPreview(today = localDate()) {
  const { start } = weekRange(lastFullWeek(today));
  const entries = [
    [
      "p-arm",
      "机械臂",
      "阅读逆运动学推导",
      "理清了坐标变换顺序。",
      "末端姿态约定还需要确认。",
      "用一个简单位置验证公式。",
    ],
    [
      "p-arm",
      "机械臂",
      "验证一个运动学示例",
      "在仿真中验证了一个位置。",
      "有一组输入出现多解。",
      "记录输入条件并对比。",
    ],
    [
      "p-vision",
      "机器视觉",
      "整理识别失败样本",
      "分出了光照变化和遮挡两类样本。",
      "光照条件不统一。",
      "固定光照重新测试。",
    ],
    [
      "p-vision",
      "机器视觉",
      "固定光照重做实验",
      "同一组样本的结果更稳定。",
      "",
      "继续记录边界样本。",
    ],
    [
      "p-blog",
      "个人网站",
      "整理实验笔记",
      "将实验过程写成了可回看的笔记。",
      "结论里还缺少对照条件。",
      "补充对照条件。",
    ],
    [
      "p-blog",
      "个人网站",
      "补充实验对照条件",
      "补全了输入条件和实验现象。",
      "",
      "回看一周的学习记录。",
    ],
    [
      "p-arm",
      "机械臂",
      "回看本周未解决的问题",
      "整理出了下一步要验证的问题。",
      "多解时还没有选择策略。",
      "下周先比较两种解的限制。",
    ],
  ];
  const days = Object.fromEntries(
    entries.map(([projectId, project, text, learned, stuck, next], i) => [
      shiftDate(start, i),
      {
        tasks: [{ id: `sample-${i}`, projectId, project, text, done: i !== 6 }],
        learned,
        stuck,
        next,
        mood: "平静",
        sample: true,
      },
    ]),
  );
  days[today] = {
    tasks: [
      {
        id: "a",
        text: "跑通一次机械臂逆运动学示例",
        projectId: "p-arm",
        project: "机械臂",
        done: false,
      },
      {
        id: "b",
        text: "整理视觉识别实验的失败原因",
        projectId: "p-vision",
        project: "机器视觉",
        done: false,
      },
      {
        id: "c",
        text: "优化博客的文章阅读体验",
        projectId: "p-blog",
        project: "个人网站",
        done: true,
      },
    ],
    learned: "",
    stuck: "",
    next: "",
    mood: "平静",
  };
  return {
    version: 2,
    projects: initialProjects.map((p) => ({ ...p })),
    days,
    weekly: {},
    reviewDrafts: {},
    wins: [
      {
        text: "把时钟树笔记整理成了可以复用的实验记录。",
        project: "个人网站",
        sample: true,
        date: shiftDate(start, 4),
      },
    ],
    energy: "平稳",
  };
}
export function migratePreview(raw, today = localDate()) {
  if (
    raw?.version === 2 &&
    Array.isArray(raw.projects) &&
    raw.days &&
    raw.weekly &&
    raw.reviewDrafts &&
    Array.isArray(raw.wins)
  )
    return raw;
  const next = seedPreview(today);
  if (!raw || !Array.isArray(raw.tasks)) return next;
  // Preserve the previous preview's tasks, captures and handwritten reflection.
  next.days[today].tasks = raw.tasks.map((t) => ({
    ...t,
    projectId: initialProjects.find((p) => p.name === t.project)?.id || "",
  }));
  if (Array.isArray(raw.wins)) next.wins = raw.wins;
  if (raw.energy) next.energy = raw.energy;
  const legacy = [raw.reviews?.win, raw.reviews?.stuck, raw.reviews?.next]
    .filter(Boolean)
    .join("\n\n");
  if (legacy)
    next.reviewDrafts[isoWeek(today)] =
      `（上一版预览迁入的草稿，原内容未标注日期）\n\n${legacy}`;
  return next;
}
export function taskProject(task, projects) {
  if (!task.projectId) return task.project || "未分类";
  return (
    projects.find((p) => p.id === task.projectId)?.name ||
    `${task.project || "原项目"}（已删除）`
  );
}
export function previewDigest(data, week, {previewMode=true}={}) {
  // Category snapshots keep historical exports intact after rename/deletion.
  const days = Object.fromEntries(
    Object.entries(data.days).map(([date, day]) => [
      date,
      {
        ...day,
        tasks: (day.tasks || []).map((t) => ({
          ...t,
          text: `${t.text}（分类：${t.project || "未分类"}）`,
        })),
      },
    ]),
  );
  const { start, end } = weekRange(week);
  const wins = data.wins.filter((w) => w.date >= start && w.date <= end);
  const captured = wins.map((w) => `- ${w.date}：${w.text}`).join("\n");
  const recorded = Object.entries(data.days).filter(
    ([date, day]) =>
      date >= start &&
      date <= end &&
      ((day.tasks || []).length ||
        day.learned ||
        day.stuck ||
        day.next ||
        day.summary),
  ).length;
  const digest = weekDigest(days, week).replace(
    /有记录：\d+\/7 天/,
    `有记录：${recorded}/7 天`,
  );
  return `${previewMode ? "> 独立预览导出：只含本机示例/测试记录，不是正式私密数据。\n" : ""}> 请仅依据有记录的内容复盘；缺失日期标为无记录，不推断未记录的学习，也不把未完成任务当作成果。\n\n${digest}${captured ? `\n## 本周成果速记\n${captured}\n` : ""}`;
}
