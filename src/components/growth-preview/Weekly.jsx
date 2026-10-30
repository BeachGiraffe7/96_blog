import { useState } from "react";
import { isoWeek, localDate, shiftWeek, weekRange } from "../../data/growth";
import { lastFullWeek, previewDigest } from "../../lib/growthPreview";
import Markdown from "../Markdown";
export default function Weekly({ data, commit, onOpenDay }) {
  const [week, setWeek] = useState(() => lastFullWeek());
  const [showExport, setShowExport] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  // week is the learning-record source; its review is archived in the following week.
  const archiveWeek = shiftWeek(week, 1);
  const archiveRange = weekRange(archiveWeek);
  const range = weekRange(week);
  const text =
    data.reviewDrafts[archiveWeek] ?? data.weekly[archiveWeek]?.text ?? "";
  const digest = previewDigest(data, week);
  const hasRecord = Object.entries(data.days).filter(
    ([d, v]) =>
      d >= range.start &&
      d <= range.end &&
      ((v.tasks || []).length || v.learned || v.stuck || v.next),
  ).length;
  const select = (w) => {
    setWeek(w);
    setMessage("");
    setPreview(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(digest);
      setMessage("已复制七天记录和复盘提示词，可以粘贴给其他 AI。");
    } catch {
      setShowExport(true);
      setMessage("自动复制不可用，请全选下方导出文本复制，或下载文件。");
    }
  };
  const download = () => {
    const blob = new Blob([digest], { type: "text/markdown;charset=utf-8" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `${week}-${range.start}-至-${range.end}-学习记录-预览.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("七天学习记录已下载为 Markdown，可交给其他 AI。");
  };
  const save = () => {
    setMessage("");
    const drafts = { ...data.reviewDrafts };
    delete drafts[archiveWeek];
    commit(
      {
        ...data,
        weekly: {
          ...data.weekly,
          [archiveWeek]: {
            text,
            sourceWeek: week,
            updatedAt: new Date().toISOString(),
          },
        },
        reviewDrafts: drafts,
      },
      "周复盘已保存在本机预览中，可切换周次回看。",
    );
  };
  const history = Object.entries(data.weekly)
    .filter(([, e]) => e.text.trim())
    .sort(([a], [b]) => b.localeCompare(a));
  return (
    <main className="gw-review-layout">
      <div className="gw-week-main">
        <section className="gw-card">
          <span className="gw-eyebrow">WEEKLY REVIEW / 让 AI 帮你复盘</span>
          <h2>导出七天记录，把复盘带回来。</h2>
          <p className="gw-muted">
            先导出 → 交给你常用的 AI →
            将结果粘贴保存。不需要在这里再手填一套复盘问卷。
          </p>
          <div className="gw-week-nav">
            <button
              className="gw-outline"
              aria-label="上一周"
              onClick={() => select(shiftWeek(week, -1))}
            >
              ‹
            </button>
            <div>
              <strong>{archiveWeek}</strong>
              <span>
                {archiveRange.start} — {archiveRange.end}
              </span>
              <small>
                {archiveWeek === isoWeek(localDate())
                  ? "本周复盘"
                  : archiveWeek > isoWeek(localDate())
                    ? "未来周复盘"
                    : "历史周复盘"}{" "}
                · 回顾前一周
              </small>
            </div>
            <button
              className="gw-outline"
              aria-label="下一周"
              onClick={() => select(shiftWeek(week, 1))}
            >
              ›
            </button>
          </div>
          <div className="gw-week-shortcuts">
            <button
              className="gw-text-button"
              onClick={() => select(lastFullWeek())}
            >
              回到本周
            </button>
          </div>
          <section className="gw-export-step">
            <span className="gw-small-tag">步骤 1 · 导出给 AI</span>
            <h3>上一周每天做了什么？</h3>
            <p>
              <strong>学习记录来源：{week}</strong>
              <br />
              {range.start} — {range.end}（周一至周日）
            </p>
            <p>
              有记录 {hasRecord} / 7
              天。导出包含任务与完成状态、分类、学习收获、卡点和下一步；缺失日期会明确标注。
            </p>
            <div className="gw-button-row">
              <button className="gw-primary" onClick={download}>
                一键导出七天记录 .md
              </button>
              <button className="gw-outline" onClick={copy}>
                复制给 AI
              </button>
              <button
                className="gw-text-button"
                onClick={() => setShowExport(!showExport)}
              >
                {showExport ? "收起导出内容" : "查看导出内容"}
              </button>
            </div>
            {hasRecord === 0 && (
              <p className="gw-form-error">
                这一周没有学习记录。导出将保留七天日期并标注无记录，不会自动补写。
              </p>
            )}
            {showExport && (
              <label className="gw-export-preview">
                <span>交给 AI 的完整内容（预览示例）</span>
                <textarea
                  aria-label="交给 AI 的完整内容（预览示例）"
                  value={digest}
                  readOnly
                  rows={12}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            )}
            <p className="gw-muted">
              本周复盘使用上一周的七天记录；切换归档周时，素材范围也随之切换。文件含学习内容，交给外部
              AI 前请检查。
            </p>
          </section>
          <section className="gw-paste-step">
            <span className="gw-small-tag">步骤 2 · 粘贴并保存</span>
            <div className="gw-section-head">
              <h3>这一周的复盘</h3>
              <button
                className="gw-text-button"
                onClick={() => setPreview(!preview)}
              >
                {preview ? "继续编辑" : "阅读预览"}
              </button>
            </div>
            {preview ? (
              <div className="gw-review-reading">
                {text ? (
                  <Markdown source={text} skipH1={false} />
                ) : (
                  <p className="gw-muted">尚未粘贴复盘内容。</p>
                )}
              </div>
            ) : (
              <label className="gw-review-field">
                <span className="gw-sr">粘贴 AI 生成的周复盘</span>
                <textarea
                  aria-label="粘贴 AI 生成的周复盘"
                  className="gw-review-paste"
                  value={text}
                  placeholder="把其他 AI 生成的周复盘粘贴到这里，可直接编辑，支持 Markdown。"
                  maxLength={50000}
                  onChange={(e) =>
                    commit(
                      {
                        ...data,
                        reviewDrafts: {
                          ...data.reviewDrafts,
                          [archiveWeek]: e.target.value,
                        },
                      },
                      "复盘草稿已自动保存在本机；点击保存后加入历史周复盘。",
                    )
                  }
                />
              </label>
            )}
            <div className="gw-form-bottom">
              <span>
                {data.reviewDrafts[archiveWeek] !== undefined
                  ? "有草稿待保存"
                  : data.weekly[archiveWeek]
                    ? "已保存到本周记录"
                    : "尚未保存复盘"}{" "}
                · 本机预览
              </span>
              <button
                className="gw-primary"
                onClick={save}
                disabled={!text.trim()}
              >
                保存本周复盘
              </button>
            </div>
          </section>
          <p role="status" className="gw-muted gw-copy-status">
            {message}
          </p>
        </section>
      </div>
      <aside>
        <section className="gw-card">
          <h3>以往每周做了什么</h3>
          <p className="gw-muted">
            保存的复盘按周排列。切换周次时，未保存草稿也会保留。
          </p>
          {history.length ? (
            <div className="gw-week-history">
              {history.map(([w, e]) => (
                <button
                  key={w}
                  className={w === archiveWeek ? "active" : ""}
                  onClick={() => select(e.sourceWeek || shiftWeek(w, -1))}
                >
                  <strong>{w}</strong>
                  <span>
                    回顾：{weekRange(e.sourceWeek || shiftWeek(w, -1)).start} —{" "}
                    {weekRange(e.sourceWeek || shiftWeek(w, -1)).end}
                  </span>
                  <small>{e.text.replace(/[#*`]/g, "").slice(0, 60)}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="gw-empty">
              还没有保存的复盘。粘贴第一篇后，就能在这里回看。
            </p>
          )}
        </section>
        <section className="gw-note">
          <span className="gw-eyebrow">每日记录是复盘的原料</span>
          <h3>想补充某天的记录？</h3>
          <p>回到素材周的每日记录，补充学习收获和卡点，再重新导出。</p>
          <button onClick={() => onOpenDay(range.start)}>
            打开素材周一记录 →
          </button>
        </section>
      </aside>
    </main>
  );
}
