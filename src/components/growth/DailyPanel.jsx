import { useEffect, useState } from 'react'
import TaskList from './TaskList'
import Markdown from '../Markdown'
import { localDate, MOODS } from '../../data/growth'

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function DailyPanel({ date, day, onSave, onSelectDate, canWrite }) {
  const [tasks, setTasks] = useState(day?.tasks || [])
  const [summary, setSummary] = useState(day?.summary || '')
  const [mood, setMood] = useState(day?.mood || '平静')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setTasks(day?.tasks || [])
    setSummary(day?.summary || '')
    setMood(day?.mood || '平静')
    setMsg('')
    setPreview(false)
  }, [date, day])

  const base = JSON.stringify({ tasks: day?.tasks || [], summary: day?.summary || '', mood: day?.mood || '平静' })
  const now = JSON.stringify({ tasks, summary, mood })
  const dirty = base !== now
  const isToday = date === localDate()
  const checkedIn = Boolean(summary.trim())

  const save = async () => {
    if (!canWrite || saving) return
    setSaving(true)
    setMsg('')
    try {
      await onSave({ date, tasks, summary, mood, updatedAt: new Date().toISOString() })
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
            {checkedIn && <span className="daily-badge">已打卡</span>}
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
          disabled={!summary.trim()}
        >
          {preview ? '编辑' : '预览'}
        </button>
      </div>

      {preview ? (
        <div className="daily-preview article-content">
          <Markdown source={summary} />
        </div>
      ) : (
        <textarea
          className="growth-textarea"
          placeholder="今天学了什么、卡在哪、明天接着做什么……（支持 Markdown）"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          readOnly={!canWrite}
          rows={9}
        />
      )}

      <footer className="daily-foot">
        <span className="daily-count">{summary.trim().length} 字</span>
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
