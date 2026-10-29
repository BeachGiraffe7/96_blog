import { useEffect, useState } from 'react'
import TaskList from './TaskList'
import Markdown from '../Markdown'
import { localDate, MOODS, DAY_PARTS, readDay, joinDayParts } from '../../data/growth'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function DailyPanel({ date, day, onSave, onSelectDate, canWrite }) {
  const [tasks, setTasks] = useState(readDay(day).tasks)
  const [parts, setParts] = useState(() => {
    const d = readDay(day)
    return { learned: d.learned, stuck: d.stuck, next: d.next }
  })
  const [mood, setMood] = useState(readDay(day).mood)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const d = readDay(day)
    setTasks(d.tasks)
    setParts({ learned: d.learned, stuck: d.stuck, next: d.next })
    setMood(d.mood)
    setMsg('')
    setPreview(false)
  }, [date, day])

  const base = JSON.stringify(readDay(day))
  const now = JSON.stringify({ tasks, learned: parts.learned, stuck: parts.stuck, next: parts.next, mood })
  const dirty = base !== now
  const isToday = date === localDate()
  const filled = Boolean(parts.learned.trim() || parts.stuck.trim() || parts.next.trim())
  const totalChars = [parts.learned, parts.stuck, parts.next].join('').replace(/\s/g, '').length

  const save = async () => {
    if (!canWrite || saving) return
    setSaving(true)
    setMsg('')
    try {
      await onSave({
        date,
        tasks,
        learned: parts.learned,
        stuck: parts.stuck,
        next: parts.next,
        summary: joinDayParts(parts),
        mood,
        updatedAt: new Date().toISOString(),
      })
      setMsg('已提交，约 1–2 分钟后线上生效')
    } catch (e) {
      setMsg(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

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
          <button type="button" className="growth-btn ghost sm" onClick={() => onSelectDate(localDate())}>
            回到今天
          </button>
        )}
      </header>

      <TaskList tasks={tasks} onChange={setTasks} readOnly={!canWrite} />

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
          {msg && <span className="daily-msg">{msg}</span>}
          <button
            type="button"
            className="growth-btn"
            onClick={save}
            disabled={!canWrite || !dirty || saving}
          >
            {saving ? '保存中…' : dirty ? '保存' : '已保存'}
          </button>
        </div>
      </footer>
    </section>
  )
}
