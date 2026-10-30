import { useState } from "react";
const blank = { name: "", desc: "", stage: "规划中", next: "", output: "" };
export default function Projects({
  projects,
  days,
  onSave,
  onDelete,
  onAction,
}) {
  const [editor, setEditor] = useState(null);
  const [error, setError] = useState("");
  const open = (p) => {
    setEditor(p ? { ...p } : { ...blank });
    setError("");
  };
  const save = (e) => {
    e.preventDefault();
    const fields = Object.fromEntries(
      Object.entries(editor).map(([k, v]) => [
        k,
        typeof v === "string" ? v.trim() : v,
      ]),
    );
    if (!fields.name) {
      setError("请填写项目名称");
      return;
    }
    if (projects.some((p) => p.id !== editor.id && p.name === fields.name)) {
      setError("已有同名项目，请换一个名称");
      return;
    }
    onSave({ ...fields, id: editor.id || crypto.randomUUID() });
    setEditor(null);
  };
  return (
    <main className="gw-tab-content">
      <div className="gw-tab-heading gw-project-heading">
        <div>
          <h2>长期计划，也是每日任务的分类。</h2>
          <p>
            新建「英语四级」，背单词、练听力就都有了归属。分类随项目自动更新。
          </p>
        </div>
        <button className="gw-primary" onClick={() => open()}>
          ＋ 新建长期项目
        </button>
      </div>
      {editor && (
        <section className="gw-card gw-project-editor" aria-label="项目编辑器">
          <div className="gw-section-head">
            <h3>{editor.id ? "编辑长期项目" : "新建长期项目"}</h3>
            <button className="gw-text-button" onClick={() => setEditor(null)}>
              取消编辑
            </button>
          </div>
          <form onSubmit={save}>
            <div className="gw-editor-fields">
              {[
                ["name", "项目名称", "例如：英语四级"],
                ["stage", "当前阶段", "例如：基础积累"],
                ["desc", "目标说明", "例如：系统备考，提升英语基础"],
                ["output", "预期成果", "例如：完成真题与错题整理"],
              ].map(([k, label, placeholder]) => (
                <label key={k}>
                  <span>
                    {label}
                    {k === "name" ? "（必填）" : ""}
                  </span>
                  <input
                    autoFocus={k === "name"}
                    value={editor[k]}
                    required={k === "name"}
                    onChange={(e) =>
                      setEditor({ ...editor, [k]: e.target.value })
                    }
                    maxLength={k === "name" ? 40 : 160}
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
            <label className="gw-review-field">
              <span>内容规划</span>
              <textarea
                aria-label="内容规划"
                placeholder="例如：每天背单词；每周做一套听力；整理真题错题。"
                value={editor.next}
                onChange={(e) => setEditor({ ...editor, next: e.target.value })}
                maxLength={3000}
              />
            </label>
            {error && (
              <p className="gw-form-error" role="alert">
                {error}
              </p>
            )}
            <div className="gw-form-bottom">
              <span>保存后会自动出现在任务分类里。</span>
              <button className="gw-primary">保存项目</button>
            </div>
          </form>
        </section>
      )}
      {!projects.length && (
        <div className="gw-card gw-empty">
          还没有长期项目。新建一个计划，或先用「未分类」记录日常行动。
        </div>
      )}
      <div className="gw-project-grid">
        {projects.map((p, i) => (
          <section className="gw-card gw-project-card" key={p.id}>
            <div className="gw-section-head">
              <span className="gw-project-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="gw-small-tag">{p.stage || "规划中"}</span>
            </div>
            <h3>{p.name}</h3>
            <p>{p.desc || "尚未填写目标说明"}</p>
            <h4>内容规划</h4>
            <p className="gw-preserve">
              {p.next || "还没有规划，可以先安排一个小行动。"}
            </p>
            <h4>希望留下的成果</h4>
            <p>{p.output || "尚未填写预期成果"}</p>
            <div className="gw-project-actions">
              <span>
                {
                  Object.values(days)
                    .flatMap((d) => d.tasks || [])
                    .filter((t) => t.projectId === p.id && !t.done).length
                }{" "}
                项待行动
              </span>
              <button className="gw-primary" onClick={() => onAction(p.id)}>
                安排一个行动
              </button>
            </div>
            <div className="gw-project-manage">
              <button
                className="gw-text-button"
                onClick={() => open(p)}
                aria-label={`编辑项目：${p.name}`}
              >
                编辑规划
              </button>
              <button
                className="gw-text-button"
                aria-label={`删除项目：${p.name}`}
                onClick={() => {
                  if (
                    window.confirm(
                      `删除「${p.name}」？它将不再出现在新任务分类里；已有任务、学习记录和周复盘都会保留。`,
                    )
                  )
                    onDelete(p.id);
                }}
              >
                删除项目
              </button>
            </div>
          </section>
        ))}
      </div>
      <p className="gw-footnote">
        删除项目不会删除历史记录。没有对应长期计划的临时事项，可以选择「未分类」。预览项目与记录仅保存在本机。
      </p>
    </main>
  );
}
