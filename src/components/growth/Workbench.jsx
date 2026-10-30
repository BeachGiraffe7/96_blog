import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../Icons'
import '../../styles/growth-preview.css'
import { localDate, shiftDate, readDay, DAY_PARTS } from '../../data/growth'
import { seedPreview, taskProject } from '../../lib/growthPreview'
import Projects from '../growth-preview/Projects'
import Weekly from '../growth-preview/Weekly'
import CheckinCalendar from './CheckinCalendar'
import { applyStateChanges } from '../../lib/growthState'
export default function GrowthWorkbench({
  data,
  onChange,
  previewMode = true,
  canWrite = true,
  onLock,
  status = '',
  error = '',
  saving = false,
  onSave,
  initialDate,
  initialTab = 'today',
  initialWeek,
}) {
  const [tab, setTab] = useState(initialTab)
  const [draft, setDraft] = useState('')
  const [project, setProject] = useState('')
  const [date, setDate] = useState(initialDate || localDate)
  const projects = data.projects
  const day = readDay(data.days[date])
  const selectedProject = projects.some((p) => p.id === project) ? project : ''
  const withDay = (patch) => ({
    ...data,
    days: { ...data.days, [date]: { ...data.days[date], ...day, ...patch } },
  })
  const [filter, setFilter] = useState('全部')
  const [win, setWin] = useState('')
  const [notice, setNotice] = useState('')
  const [undo, setUndo] = useState(null)
  const [storageError, setStorageError] = useState(false)
  const commit = (next, message, reversible = false) => {
    setUndo(reversible ? { before: data, after: next } : null)
    if (!canWrite) return
    try {
      onChange(next)
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
    setNotice(previewMode ? message || '' : '改动已暂存，正在加密保存…')
  }
  const toggle = (id) => {
    const task = day.tasks.find((t) => t.id === id)
    commit(
      withDay({
        tasks: day.tasks.map((t) =>
          t.id === id ? { ...t, done: !t.done } : t,
        ),
      }),
      task.done ? '已恢复为待办' : '完成了一步。做得不错！',
      true,
    )
  }
  const add = (e) => {
    e.preventDefault()
    if (!draft.trim()) return
    commit(
      withDay({
        tasks: [
          ...day.tasks,
          {
            id: crypto.randomUUID(),
            text: draft.trim(),
            projectId: selectedProject,
            project:
              projects.find((p) => p.id === selectedProject)?.name || '未分类',
            done: false,
          },
        ],
      }),
      '行动已加入今日',
    )
    setDraft('')
  }
  const saveWin = (e) => {
    e.preventDefault()
    if (!win.trim()) return
    commit(
      {
        ...data,
        wins: [{ text: win.trim(), project: '每日成果', date }, ...data.wins],
      },
      '成果已保存在本机预览中',
    )
    setWin('')
  }
  const complete = day.tasks.filter((t) => t.done).length
  const shown = day.tasks.filter(
    (t) => filter === '全部' || (filter === '待完成' ? !t.done : t.done),
  )
  return (
    <div className={previewMode ? 'gw' : 'gw gw-live'}>
      {previewMode && (
        <div className="gw-demo">
          <span>
            <strong>交互概念预览</strong> · 全部为示例数据，不连接私密记录或
            GitHub
          </span>
          <button
            onClick={() => {
              if (
                window.confirm(
                  '恢复示例数据？这会清除本机的预览修改，不影响正式记录。',
                )
              ) {
                commit(seedPreview(), '已恢复示例')
                setProject('')
                setDate(localDate())
                setUndo(null)
              }
            }}
          >
            重置示例
          </button>
        </div>
      )}
      <div className="gw-shell">
        <header className="gw-top">
          <Link to="/" className="gw-brand">
            <span className="gw-brand-icon">
              <Icon.sun />
            </span>{' '}
            长颈鹿的成长手记
          </Link>
          {previewMode ? (
            <Link to="/growth">返回正式版 ↗</Link>
          ) : (
            <div className="gw-live-actions">
              <Link to="/">返回博客 ↗</Link>
              <button className="gw-outline" onClick={onLock}>
                锁定
              </button>
            </div>
          )}
        </header>
        <section className="gw-heading">
          <div>
            <span className="gw-eyebrow">GROWTH / 慢慢来，比较快</span>
            <h1>把每一步，走成自己的路。</h1>
            <p>不只记录做了什么，也记下为什么做、学会了什么。</p>
          </div>
          <div className="gw-edition">
            <span>{previewMode ? '设计提案' : '私密 · 本地解密'}</span>
            <strong>
              {previewMode ? '01 / 行动工作台' : '原记录保留 · 加密同步'}
            </strong>
          </div>
        </section>
        <nav className="gw-nav" aria-label="成长工作台">
          {[
            ['today', '今日行动'],
            ['projects', '长期项目'],
            ['review', '每周复盘'],
            ['archive', '成果记录'],
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                setTab(key)
                setNotice('')
              }}
            >
              {label}
              {key === 'archive' && <span>{data.wins.length}</span>}
            </button>
          ))}
        </nav>
        <div className="gw-status" role="status">
          {previewMode ? (
            storageError ? (
              '浏览器存储不可用，修改仅在当前页面保留。'
            ) : (
              notice || '预览修改只保存在当前浏览器，刷新后可继续体验。'
            )
          ) : (
            <span>
              {status}
              {!canWrite && (
                <>
                  {' '}
                  · 只读模式，<Link to="/write">连接 GitHub 后编辑</Link>
                </>
              )}
            </span>
          )}
          {!previewMode && canWrite && (
            <button className="gw-outline" onClick={onSave} disabled={saving}>
              {saving ? '加密保存中…' : '立即保存'}
            </button>
          )}
          {undo && canWrite && (
            <button
              onClick={() => {
                try {
                  commit(
                    applyStateChanges(data, undo.after, undo.before),
                    '已撤销上一步',
                  )
                } catch (e) {
                  window.alert(e.message)
                }
                setUndo(null)
              }}
            >
              撤销上次操作
            </button>
          )}
        </div>
        {error && (
          <div className="gw-card gw-form-error" role="alert">
            {error}
          </div>
        )}
        {tab === 'today' && (
          <div className="gw-grid">
            <main>
              <section className="gw-card gw-day-nav">
                <div>
                  <span className="gw-eyebrow">每天记一点，周末交给 AI</span>
                  <h2>每日学习记录</h2>
                </div>
                <div className="gw-date-controls">
                  <button
                    className="gw-outline"
                    aria-label="前一天"
                    onClick={() => setDate(shiftDate(date, -1))}
                  >
                    ‹
                  </button>
                  <label>
                    <span className="gw-sr">记录日期</span>
                    <input
                      type="date"
                      value={date}
                      required
                      onChange={(e) => {
                        if (e.target.value) setDate(e.target.value)
                      }}
                    />
                  </label>
                  <button
                    className="gw-outline"
                    aria-label="后一天"
                    onClick={() => setDate(shiftDate(date, 1))}
                  >
                    ›
                  </button>
                  <button
                    className="gw-text-button"
                    onClick={() => setDate(localDate())}
                  >
                    今天
                  </button>
                </div>
              </section>
              <section className="gw-card gw-tasks">
                <div className="gw-section-head">
                  <div>
                    <h2>今日行动</h2>
                    <p>
                      完成 {complete} / {day.tasks.length} 项 ·
                      少一点计划，多一点推进
                    </p>
                  </div>
                  <Icon.check />
                </div>
                <div className="gw-filters" aria-label="筛选任务">
                  {['全部', '待完成', '已完成'].map((f) => (
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
                    <li key={t.id} className={t.done ? 'done' : ''}>
                      <label className="gw-check-target">
                        <input
                          type="checkbox"
                          disabled={!canWrite}
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
                        <select
                          className="gw-task-category"
                          disabled={!canWrite}
                          aria-label={`调整分类：${t.text}`}
                          value={
                            t.projectId &&
                            !projects.some((p) => p.id === t.projectId)
                              ? '__deleted'
                              : t.projectId || ''
                          }
                          onChange={(e) => {
                            const id = e.target.value
                            const p = projects.find((p) => p.id === id)
                            commit(
                              withDay({
                                tasks: day.tasks.map((x) =>
                                  x.id === t.id
                                    ? {
                                        ...x,
                                        projectId: id,
                                        project: p?.name || '未分类',
                                      }
                                    : x,
                                ),
                              }),
                              '任务分类已更新。',
                            )
                          }}
                        >
                          {t.projectId &&
                            !projects.some((p) => p.id === t.projectId) && (
                              <option value="__deleted" disabled>
                                {taskProject(t, projects)}
                              </option>
                            )}
                          <option value="">未分类</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="gw-delete"
                        disabled={!canWrite}
                        aria-label={`删除：${t.text}`}
                        onClick={() =>
                          commit(
                            withDay({
                              tasks: day.tasks.filter((x) => x.id !== t.id),
                            }),
                            '已删除行动，可撤销',
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
                    {filter === '已完成'
                      ? '还没有完成项，先从一个小行动开始。'
                      : filter === '待完成'
                        ? '今天的行动都完成了，留点时间回看收获。'
                        : '从一个小行动开始，不必一下排满。'}
                  </p>
                )}
                <form className="gw-add" onSubmit={add}>
                  <label className="gw-sr" htmlFor="gw-new-task">
                    新增行动
                  </label>
                  <input
                    id="gw-new-task"
                    disabled={!canWrite}
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
                    disabled={!canWrite}
                    value={selectedProject}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    <option value="">未分类</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="gw-primary"
                    disabled={!canWrite || !draft.trim()}
                  >
                    添加
                  </button>
                </form>
                <button
                  className="gw-text-button"
                  onClick={() => setTab('projects')}
                >
                  ＋ 新建分类（长期项目）
                </button>
              </section>
              <section className="gw-card">
                <div className="gw-section-head">
                  <div>
                    <h2>每日学习记录</h2>
                    <p>
                      沿用原本的记录方式；内容会随日期保留，并进入所选周的导出文件。
                    </p>
                  </div>
                  <span className="gw-small-tag">
                    {previewMode ? '本机自动保存' : '自动加密保存'}
                  </span>
                </div>
                {DAY_PARTS.map((part) => (
                  <label className="gw-review-field" key={part.key}>
                    <span>{part.label}</span>
                    <textarea
                      aria-label={part.label}
                      readOnly={!canWrite}
                      value={day[part.key]}
                      placeholder={part.placeholder}
                      maxLength={10000}
                      onChange={(e) =>
                        commit(
                          withDay({ [part.key]: e.target.value }),
                          '每日学习记录已保存在本机预览中，可按周导出。',
                        )
                      }
                    />
                  </label>
                ))}
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
                    readOnly={!canWrite}
                    placeholder="例如：定位了识别不稳定的原因，下一步固定光照再试。"
                    value={win}
                    onChange={(e) => setWin(e.target.value)}
                    maxLength={2000}
                  />
                  <div className="gw-form-bottom">
                    <span>不必写成一篇文章。</span>
                    <button
                      className="gw-primary"
                      disabled={!canWrite || !win.trim()}
                    >
                      留下这一步
                    </button>
                  </div>
                </form>
              </section>
            </main>
            <aside>
              {!previewMode && (
                <CheckinCalendar
                  days={data.days}
                  selected={date}
                  onSelect={setDate}
                />
              )}
              <section className="gw-card gw-energy">
                <span className="gw-eyebrow">先照顾状态，再推进事情</span>
                <h2>今天的能量如何？</h2>
                <div className="gw-energy-options">
                  {['充沛', '平稳', '有点累'].map((v) => (
                    <button
                      key={v}
                      disabled={!canWrite}
                      aria-pressed={data.energy === v}
                      onClick={() =>
                        commit({ ...data, energy: v }, '已记录今日状态')
                      }
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p>
                  {data.energy === '有点累'
                    ? '今天只做最小的一步，也算在前进。'
                    : data.energy === '充沛'
                      ? '把好状态用在最想推进的那件事上。'
                      : '按自己的节奏，一件一件来。'}
                </p>
              </section>
              <section className="gw-card">
                <div className="gw-section-head">
                  <h2>正在生长的事</h2>
                  <button
                    className="gw-text-button"
                    onClick={() => setTab('projects')}
                  >
                    全部 ↗
                  </button>
                </div>
                <div className="gw-project-mini">
                  {projects.map((p, i) => (
                    <button key={p.id} onClick={() => setTab('projects')}>
                      <span className="gw-project-num">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.output}</small>
                      </span>
                      <span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                <button
                  className="gw-text-button"
                  onClick={() => setTab('projects')}
                >
                  ＋ 管理长期项目与分类
                </button>
              </section>
              <section className="gw-note">
                <span className="gw-eyebrow">给未来的自己</span>
                <p>
                  忙碌不是成果，
                  <br />
                  留下来的理解才是。
                </p>
                <button onClick={() => setTab('review')}>
                  导出七天记录，让 AI 帮你复盘 <span aria-hidden="true">→</span>
                </button>
              </section>
            </aside>
          </div>
        )}
        {tab === 'projects' && (
          <Projects
            previewMode={previewMode}
            canWrite={canWrite}
            projects={projects}
            days={data.days}
            onSave={(p) =>
              commit(
                {
                  ...data,
                  projects: projects.some((x) => x.id === p.id)
                    ? projects.map((x) => (x.id === p.id ? p : x))
                    : [...projects, p],
                },
                '项目已保存，任务分类已同步更新。',
              )
            }
            onDelete={(id) =>
              commit(
                { ...data, projects: projects.filter((p) => p.id !== id) },
                '项目已删除；已有任务和历史记录已保留。',
                true,
              )
            }
            onAction={(id) => {
              setProject(id)
              setTab('today')
              setTimeout(
                () => document.getElementById('gw-new-task')?.focus(),
                0,
              )
            }}
          />
        )}
        {tab === 'review' && (
          <Weekly
            previewMode={previewMode}
            canWrite={canWrite}
            initialWeek={initialWeek}
            data={data}
            commit={commit}
            onOpenDay={(d) => {
              setDate(d)
              setTab('today')
            }}
          />
        )}
        {tab === 'archive' && (
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
                    <span className="gw-small-tag">
                      {w.project}
                      {w.date ? ` · ${w.date}` : ''}
                    </span>
                    <span className="gw-muted">
                      {previewMode
                        ? w.sample
                          ? '示例记录'
                          : '本机预览记录'
                        : '加密记录'}
                    </span>
                  </div>
                  <p>{w.text}</p>
                  <button
                    className="gw-text-button"
                    disabled={!canWrite}
                    onClick={() =>
                      commit(
                        { ...data, wins: data.wins.filter((_, j) => i !== j) },
                        '已移除记录，可撤销',
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
                  onClick={() => setTab('today')}
                >
                  去记录今天的一步 →
                </button>
              </div>
            )}
          </main>
        )}
        <footer className="gw-footer">
          <span>少一点自我催促，多一点真实积累。</span>
          <span>
            {previewMode
              ? '独立预览 · 不影响正式网站'
              : '私密记录 · AES-GCM 加密保存'}
          </span>
        </footer>
      </div>
    </div>
  )
}
