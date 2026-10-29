import { useEffect, useRef, useState } from 'react'
import TaskList from './TaskList'
import Markdown from '../Markdown'
import { localDate, MOODS, DAY_PARTS, readDay, joinDayParts } from '../../data/growth'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 本地草稿：自动保存失败（没网、token 过期）时也不至于白写一场
const draftKey = (date) => `growth_draft_${date}`

const readDraft = (date) => {
  try {
    const raw = localStorage.getItem(draftKey(date))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeDraft = (date, data) => {
  try {
    localStorage.setItem(draftKey(date), JSON.stringify(data))
  } catch {
    /* 隐私模式下写不进去，忽略 */
  }
}

const clearDraft = (date) => {
  try {
    localStorage.removeItem(draftKey(date))
  } catch {
    /* 忽略 */
  }
}

const hasContent = (d) =>
  Boolean(d && ((d.tasks && d.tasks.length) || d.parts?.learned || d.parts?.stuck || d.parts?.next))

export default function DailyPanel({ date, day, onSave, onSelectDate, canWrite }) {
  const init = readDay(day)
  const [tasks, setTasks] = useState(init.tasks)
  const [parts, setParts] = useState({
    learned: init.learned,
    stuck: init.stuck,
    next: init.next,
  })
  const [mood, setMood] = useState(init.mood)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [autoSaved, setAutoSaved] = useState(false)
  const [pendingRestore, setPendingRestore] = useState(false)

  // 最新值放 ref：自动保存的定时器里读它，避免闭包拿到几千毫秒前的旧值
  const latest = useRef({ tasks, parts, mood })
  latest.current = { tasks, parts, mood }

  const dateRef = useRef('')
  const savingRef = useRef(false)
  const lastAuto = useRef(JSON.stringify(init.tasks))

  // 只在「换了一天」时重置本地状态。
  // 同一天内保存成功后父组件会回写 day，这里不能跟着覆盖，
  // 否则会把用户正在输入的总结清掉
  useEffect(() => {
    if (dateRef.current === date) return
    dateRef.current = date

    const remote = readDay(day)
    let next = {
      tasks: remote.tasks,
      parts: { learned: remote.learned, stuck: remote.stuck, next: remote.next },
      mood: remote.mood,
    }
    let note = ''

    // 草稿比远端新，说明上次没保存成功，直接恢复
    const draft = readDraft(date)
    if (hasContent(draft)) {
      const stamp = day?.updatedAt ? Date.parse(day.updatedAt) : 0
      if ((draft.at || 0) > stamp) {
        next = {
          tasks: draft.tasks || [],
          parts: draft.parts || next.parts,
          mood: draft.mood || '平静',
        }
        note = '已恢复上次没保存的内容'
      }
    }

    setTasks(next.tasks)
    setParts(next.parts)
    setMood(next.mood)
    setPreview(false)
    setAutoSaved(false)
    setMsg(note)
    setPendingRestore(Boolean(note))
    lastAuto.current = JSON.stringify(next.tasks)
  }, [date, day])

  const persist = async (auto) => {
    if (!canWrite || savingRef.current) return
    savingRef.current = true
    if (!auto) setSaving(true)
    setMsg('')
    const l = latest.current
    try {
      await onSave({
        date,
        tasks: l.tasks,
        learned: l.parts.learned,
        stuck: l.parts.stuck,
        next: l.parts.next,
        summary: joinDayParts(l.parts),
        mood: l.mood,
        updatedAt: new Date().toISOString(),
      })
      lastAuto.current = JSON.stringify(l.tasks)
      clearDraft(date)
      if (auto) {
        setAutoSaved(true)
        window.setTimeout(() => setAutoSaved(false), 2600)
      } else {
        setMsg('已提交，约 1–2 分钟后线上生效')
      }
    } catch (e) {
      setMsg(`${e.message || '保存失败'}（已暂存在本机）`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  // 任务一改就自动存：勾选、新增、删除都算。
  // 去抖 1.2 秒，避免连续操作提交一串 commit
  const tasksSig = JSON.stringify(tasks)
  useEffect(() => {
    if (!canWrite) return undefined
    if (tasksSig === lastAuto.current) return undefined
    const id = window.setTimeout(() => persist(true), 1200)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksSig, canWrite, date])

  // 任何编辑都写一份本地草稿（含总结文本），断网时也不会白写
  useEffect(() => {
    if (!canWrite) return
    writeDraft(date, { tasks, parts, mood, at: Date.now() })
  }, [tasks, parts, mood, date, canWrite])

  useEffect(() => {
    if (!pendingRestore || !canWrite) return undefined
    const id = window.setTimeout(() => {
      setPendingRestore(false)
      persist(true)
    }, 800)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRestore, canWrite])

  const base = JSON.stringify(readDay(day))
  const now = JSON.stringify({
    tasks,
    learned: parts.learned,
    stuck: parts.stuck,
    next: parts.next,
    mood,
  })
  const dirty = base !== now
  const isToday = date === localDate()
  const filled = Boolean(parts.learned.trim() || parts.stuck.trim() || parts.next.trim())
  const totalChars = [parts.learned, parts.stuck, parts.next].join('').replace(/\s/g, '').length

  const weekday = WEEK[new Date(`${date}T00:00:00`).getDay()]

  return (
    <section className="growth-card">
      <header className="daily-head">
        <div>
          <h2 className="daily-date">
            {date}
            <span className="daily-week">{weekday}</span>
            {filled && <span className="daily-badge">已打卡</span>}
          </h2>
          <p className="daily-sub">{isToday ? '今天' : '补记'}</p>
        </div>
        {!isToday && (
          <button
            type="button"
            className="growth-btn ghost sm"
            onClick={() => onSelectDate(localDate())}
          >
            回到今天
          </button>
        )}
      </header>

      <TaskList tasks={tasks} onChange={setTasks} readOnly={!canWrite} />

      {canWrite && <p className="task-autosave-hint">任务自动保存，不用点下面的按钮</p>}

      <div className="daily-divider">
        <span>今日学习总结</span>
      </div>

      <div className="daily-summary-tools">
        <div className="mood-picker">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              className={m === mood ? 'mood-btn active' : 'mood-btn'}
              onClick={() => canWrite && setMood(m)}
              disabled={!canWrite}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="growth-btn ghost sm"
          onClick={() => setPreview((v) => !v)}
          disabled={!filled}
        >
          {preview ? '编辑' : '预览'}
        </button>
      </div>

      {preview ? (
        <div className="daily-preview article-content">
          {DAY_PARTS.filter((f) => (parts[f.key] || '').trim()).map((f) => (
            <div key={f.key} className="daily-preview-part">
              <h4 className="daily-preview-h">{f.label}</h4>
              <Markdown source={parts[f.key]} />
            </div>
          ))}
        </div>
      ) : (
        <div className="day-fields">
          {DAY_PARTS.map((f) => (
            <div key={f.key} className="growth-field">
              <label htmlFor={`day-${f.key}`}>{f.label}</label>
              <textarea
                id={`day-${f.key}`}
                className={f.key === 'learned' ? 'growth-textarea' : 'growth-textarea sm'}
                placeholder={f.placeholder}
                value={parts[f.key]}
                onChange={(e) => setParts({ ...parts, [f.key]: e.target.value })}
                readOnly={!canWrite}
                rows={f.key === 'learned' ? 5 : 3}
              />
            </div>
          ))}
        </div>
      )}

      <footer className="daily-foot">
        <span className="daily-count">{totalChars} 字</span>
        <div className="daily-actions">
          {autoSaved && !msg && <span className="daily-msg">任务已自动保存</span>}
          {msg && <span className="daily-msg">{msg}</span>}
          <button
            type="button"
            className="growth-btn"
            onClick={() => persist(false)}
            disabled={!canWrite || !dirty || saving}
          >
            {saving ? '保存中…' : dirty ? '保存' : '已保存'}
          </button>
        </div>
      </footer>
    </section>
  )
}
