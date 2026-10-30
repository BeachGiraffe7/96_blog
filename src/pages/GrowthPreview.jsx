import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icons";
import "../styles/growth-preview.css";

const KEY = "growth-workbench-demo-v1";
const seed = () => ({
  tasks: [
    {
      id: "a",
      text: "跑通一次机械臂逆运动学示例",
      project: "机械臂",
      done: false,
    },
    {
      id: "b",
      text: "整理视觉识别实验的失败原因",
      project: "机器视觉",
      done: false,
    },
    {
      id: "c",
      text: "优化博客的文章阅读体验",
      project: "个人网站",
      done: true,
    },
  ],
  wins: [
    {
      text: "把时钟树笔记整理成了可以复用的实验记录。",
      project: "个人网站",
      sample: true,
    },
  ],
  reviews: { win: "", stuck: "", next: "" },
  energy: "平稳",
});
const projects = [
  {
    name: "机械臂",
    desc: "从公式走到一次真实运动",
    stage: "验证中",
    next: "跑通逆运动学 → 记录误差 → 实机验证",
    output: "运动学实验记录",
    num: "01",
  },
  {
    name: "机器视觉",
    desc: "让每次实验都有可比较的结论",
    stage: "探索中",
    next: "整理失败样本 → 对比光照条件 → 调整方案",
    output: "识别实验对照表",
    num: "02",
  },
  {
    name: "个人网站",
    desc: "把学习沉淀为能被读懂的内容",
    stage: "持续迭代",
    next: "优化阅读体验 → 整理文章 → 发布总结",
    output: "一篇可复用的技术文章",
    num: "03",
  },
];
function restore() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d?.tasks && d?.reviews && d?.wins) return d;
  } catch {
    /* local demo only */
  }
  return seed();
}
export default function GrowthPreview() {
  const [data, setData] = useState(restore);
  const [tab, setTab] = useState("today");
  const [draft, setDraft] = useState("");
  const [project, setProject] = useState("机械臂");
  const [filter, setFilter] = useState("全部");
  const [win, setWin] = useState("");
  const [notice, setNotice] = useState("");
  const [undo, setUndo] = useState(null);
  const [storageError, setStorageError] = useState(false);
  const commit = (next, message, reversible = false) => {
    setUndo(reversible ? data : null);
    setData(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
    setNotice(message || "");
  };
  const toggle = (id) => {
    const task = data.tasks.find((t) => t.id === id);
    commit(
      {
        ...data,
        tasks: data.tasks.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        ),
      },
      task.done ? "已恢复为待办" : "完成了一步。做得不错！",
      true,
    );
  };
  const add = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    commit(
      {
        ...data,
        tasks: [
          ...data.tasks,
          { id: crypto.randomUUID(), text: draft.trim(), project, done: false },
        ],
      },
      "行动已加入今日",
    );
    setDraft("");
  };
  const saveWin = (e) => {
    e.preventDefault();
    if (!win.trim()) return;
    commit(
      {
        ...data,
        wins: [{ text: win.trim(), project: "今日成果" }, ...data.wins],
      },
      "成果已保存在本机预览中",
    );
    setWin("");
  };
  const complete = data.tasks.filter((t) => t.done).length;
  const shown = data.tasks.filter(
    (t) => filter === "全部" || (filter === "待完成" ? !t.done : t.done),
  );
  return (
    <div className="gw">
      <div className="gw-demo">
        <span>
          <strong>交互概念预览</strong> · 全部为示例数据，不连接私密记录或
          GitHub
        </span>
        <button
          onClick={() => {
            if (
              window.confirm(
                "恢复示例数据？这会清除本机的预览修改，不影响正式记录。",
              )
            ) {
              commit(seed(), "已恢复示例");
              setUndo(null);
            }
          }}
        >
          重置示例
        </button>
      </div>
      <div className="gw-shell">
        <header className="gw-top">
          <Link to="/" className="gw-brand">
            <span className="gw-brand-icon">
              <Icon.sun />
            </span>{" "}
            长颈鹿的成长手记
          </Link>
          <Link to="/growth">
            返回原版 <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <section className="gw-heading">
          <div>
            <span className="gw-eyebrow">GROWTH / 慢慢来，比较快</span>
            <h1>把每一步，走成自己的路。</h1>
            <p>不只记录做了什么，也记下为什么做、学会了什么。</p>
          </div>
          <div className="gw-edition">
            <span>设计提案</span>
            <strong>01 / 行动工作台</strong>
          </div>
        </section>
        <nav className="gw-nav" aria-label="成长工作台">
          {[
            ["today", "今日行动"],
            ["projects", "长期项目"],
            ["review", "每周复盘"],
            ["archive", "成果记录"],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setNotice("");
              }}
            >
              {label}
              {key === "archive" && <span>{data.wins.length}</span>}
            </button>
          ))}
        </nav>
        <div className="gw-status" role="status">
          {storageError
            ? "浏览器存储不可用，修改仅在当前页面保留。"
            : notice || "预览修改只保存在当前浏览器，刷新后可继续体验。"}
          {undo && (
            <button
              onClick={() => {
                commit(undo, "已撤销上一步");
                setUndo(null);
              }}
            >
              撤销上次操作
            </button>
          )}
        </div>
        {tab === "today" && (
          <div className="gw-grid">
            <main>
              <section className="gw-focus">
                <span className="gw-eyebrow">今天最重要的一步</span>
                <h2>让学习，落到一次具体的实践。</h2>
                <p>先做一个能验证的小实验，再把结论留下来。</p>
                <button
                  onClick={() =>
                    document.getElementById("gw-new-task")?.focus()
                  }
                >
                  ＋ 拆成一个小行动
                </button>
                <span className="gw-focus-mark" aria-hidden="true">
                  01
                </span>
              </section>
              <section className="gw-card gw-tasks">
                <div className="gw-section-head">
                  <div>
                    <h2>今日行动</h2>
                    <p>
                      完成 {complete} / {data.tasks.length} 项 ·
                      少一点计划，多一点推进
                    </p>
                  </div>
                  <Icon.check />
                </div>
                <div className="gw-filters" aria-label="筛选任务">
                  {["全部", "待完成", "已完成"].map((f) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <ul className="gw-task-list">
                  {shown.map((t) => (
                    <li key={t.id} className={t.done ? "done" : ""}>
                      <label className="gw-check-target">
                        <input
                          type="checkbox"
                          checked={t.done}
                          onChange={() => toggle(t.id)}
                          aria-label={`完成：${t.text}`}
                        />
                        <span className="gw-checkbox" aria-hidden="true">
                          {t.done && <Icon.check />}
                        </span>
                      </label>
                      <div className="gw-task-body">
                        <span className="gw-task-text">{t.text}</span>
                        <span className="gw-project-label">{t.project}</span>
                      </div>
                      <button
                        className="gw-delete"
                        aria-label={`删除：${t.text}`}
                        onClick={() =>
                          commit(
                            {
                              ...data,
                              tasks: data.tasks.filter((x) => x.id !== t.id),
                            },
                            "已删除行动，可撤销",
                            true,
                          )
                        }
                      >
                        <Icon.trash />
                      </button>
                    </li>
                  ))}
                </ul>
                {!shown.length && (
                  <p className="gw-empty">
                    {filter === "已完成"
                      ? "还没有完成项，先从一个小行动开始。"
                      : filter === "待完成"
                        ? "今天的行动都完成了，留点时间回看收获。"
                        : "从一个小行动开始，不必一下排满。"}
                  </p>
                )}
                <form className="gw-add" onSubmit={add}>
                  <label className="gw-sr" htmlFor="gw-new-task">
                    新增行动
                  </label>
                  <input
                    id="gw-new-task"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="下一步具体做什么？"
                    maxLength={160}
                  />
                  <label className="gw-sr" htmlFor="gw-project">
                    所属项目
                  </label>
                  <select
                    id="gw-project"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    {projects.map((p) => (
                      <option key={p.name}>{p.name}</option>
                    ))}
                  </select>
                  <button className="gw-primary" disabled={!draft.trim()}>
                    添加
                  </button>
                </form>
              </section>
              <section className="gw-card">
                <div className="gw-section-head">
                  <div>
                    <h2>今天留下了什么？</h2>
                    <p>一句结论、一次突破，或一个没想通的问题。</p>
                  </div>
                  <span className="gw-small-tag">成果速记</span>
                </div>
                <form onSubmit={saveWin}>
                  <label className="gw-sr" htmlFor="gw-win">
                    今日成果
                  </label>
                  <textarea
                    id="gw-win"
                    placeholder="例如：定位了识别不稳定的原因，下一步固定光照再试。"
                    value={win}
                    onChange={(e) => setWin(e.target.value)}
                    maxLength={2000}
                  />
                  <div className="gw-form-bottom">
                    <span>不必写成一篇文章。</span>
                    <button className="gw-primary" disabled={!win.trim()}>
                      留下这一步
                    </button>
                  </div>
                </form>
              </section>
            </main>
            <aside>
              <section className="gw-card gw-energy">
                <span className="gw-eyebrow">先照顾状态，再推进事情</span>
                <h2>今天的能量如何？</h2>
                <div className="gw-energy-options">
                  {["充沛", "平稳", "有点累"].map((v) => (
                    <button
                      key={v}
                      aria-pressed={data.energy === v}
                      onClick={() =>
                        commit({ ...data, energy: v }, "已记录今日状态")
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p>
                  {data.energy === "有点累"
                    ? "今天只做最小的一步，也算在前进。"
                    : data.energy === "充沛"
                      ? "把好状态用在最想推进的那件事上。"
                      : "按自己的节奏，一件一件来。"}
                </p>
              </section>
              <section className="gw-card">
                <div className="gw-section-head">
                  <h2>正在生长的事</h2>
                  <button
                    className="gw-text-button"
                    onClick={() => setTab("projects")}
                  >
                    全部 ↗
                  </button>
                </div>
                <div className="gw-project-mini">
                  {projects.map((p) => (
                    <button key={p.name} onClick={() => setTab("projects")}>
                      <span className="gw-project-num">{p.num}</span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.output}</small>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              </section>
              <section className="gw-note">
                <span className="gw-eyebrow">给未来的自己</span>
                <p>
                  忙碌不是成果，
                  <br />
                  留下来的理解才是。
                </p>
                <button onClick={() => setTab("review")}>
                  留十分钟，回看这一周 <span aria-hidden="true">→</span>
                </button>
              </section>
            </aside>
          </div>
        )}
        {tab === "projects" && (
          <main className="gw-tab-content">
            <div className="gw-tab-heading">
              <h2>让每天的小事，有一个长期方向。</h2>
              <p>
                项目不只是一串任务，更应该有下一步和看得见的产出。以下为示例项目。
              </p>
            </div>
            <div className="gw-project-grid">
              {projects.map((p) => (
                <section className="gw-card gw-project-card" key={p.name}>
                  <div className="gw-section-head">
                    <span className="gw-project-num">{p.num}</span>
                    <span className="gw-small-tag">{p.stage}</span>
                  </div>
                  <h3>{p.name}</h3>
                  <p>{p.desc}</p>
                  <h4>下一步路径</h4>
                  <p>{p.next}</p>
                  <h4>希望留下的成果</h4>
                  <p>{p.output}</p>
                  <div className="gw-project-actions">
                    <span>
                      {
                        data.tasks.filter(
                          (t) => t.project === p.name && !t.done,
                        ).length
                      }{" "}
                      项待行动
                    </span>
                    <button
                      className="gw-primary"
                      onClick={() => {
                        setProject(p.name);
                        setTab("today");
                        setTimeout(
                          () => document.getElementById("gw-new-task")?.focus(),
                          0,
                        );
                      }}
                    >
                      安排一个行动
                    </button>
                  </div>
                </section>
              ))}
            </div>
            <p className="gw-footnote">
              本轮先验证「项目 → 行动 →
              成果」的组织方式；项目编辑、里程碑与正式数据接入暂未实现。
            </p>
          </main>
        )}
        {tab === "review" && (
          <main className="gw-review-layout">
            <section className="gw-card">
              <span className="gw-eyebrow">WEEKLY REFLECTION</span>
              <h2>不打分，只复盘。</h2>
              <p className="gw-muted">
                复盘不是统计自己有多努力，而是找到下一步更好的做法。
              </p>
              {[
                ["win", "这周，哪一步真的有效？", "写下一件有具体证据的进展。"],
                ["stuck", "卡在哪里？", "是任务太大、方法不对，还是精力不够？"],
                [
                  "next",
                  "下周，只改变一件事。",
                  "把调整写成一个能执行的小动作。",
                ],
              ].map(([key, label, placeholder]) => (
                <label className="gw-review-field" key={key}>
                  <span>{label}</span>
                  <textarea
                    placeholder={placeholder}
                    value={data.reviews[key]}
                    onChange={(e) =>
                      commit(
                        {
                          ...data,
                          reviews: { ...data.reviews, [key]: e.target.value },
                        },
                        "复盘草稿已自动保存在本机预览中",
                      )
                    }
                    maxLength={3000}
                  />
                </label>
              ))}
            </section>
            <aside className="gw-note">
              <span className="gw-eyebrow">从记录里找证据</span>
              <h3>回看最近的成果</h3>
              {data.wins.length ? (
                data.wins.slice(0, 3).map((w, i) => <p key={i}>{w.text}</p>)
              ) : (
                <p>还没有成果记录。先去今日行动留下一条收获。</p>
              )}
              <p className="gw-muted">此处仅演示复盘流程，不是你的真实周报。</p>
            </aside>
          </main>
        )}
        {tab === "archive" && (
          <main className="gw-tab-content">
            <div className="gw-tab-heading">
              <h2>把做过的事，变成带得走的积累。</h2>
              <p>
                从今日速记汇聚到这里。未来可进一步关联笔记、文章和实验文件。
              </p>
            </div>
            <div className="gw-wins">
              {data.wins.map((w, i) => (
                <article className="gw-card" key={i}>
                  <div className="gw-section-head">
                    <span className="gw-small-tag">{w.project}</span>
                    <span className="gw-muted">
                      {w.sample ? "示例记录" : "本机预览记录"}
                    </span>
                  </div>
                  <p>{w.text}</p>
                  <button
                    className="gw-text-button"
                    onClick={() =>
                      commit(
                        { ...data, wins: data.wins.filter((_, j) => i !== j) },
                        "已移除记录，可撤销",
                        true,
                      )
                    }
                  >
                    移除记录
                  </button>
                </article>
              ))}
            </div>
            {!data.wins.length && (
              <div className="gw-card gw-empty">
                还没有留下成果。
                <button
                  className="gw-text-button"
                  onClick={() => setTab("today")}
                >
                  去记录今天的一步 →
                </button>
              </div>
            )}
          </main>
        )}
        <footer className="gw-footer">
          <span>少一点自我催促，多一点真实积累。</span>
          <span>独立预览 · 不影响正式网站</span>
        </footer>
      </div>
    </div>
  );
}
