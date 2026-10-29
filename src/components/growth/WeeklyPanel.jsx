import { useEffect, useState } from 'react'
import { weekRange, shiftWeek, isoWeek, localDate } from '../../data/growth'

const FIELDS = [
  { key: 'done', label: '这周做成了什么', placeholder: '完成的事、推进的进度……' },
  { key: 'stuck', label: '卡在哪里', placeholder: '没搞懂的、走弯路的……' },
  { key: 'next', label: '下周怎么调', placeholder: '要改的做法、要补的缺口……' },
]

export default function WeeklyPanel({ week, entry, onSave, onChangeWeek, canWrite }) {
  const [form, setForm] = useState({ done: '', stuck: '', next: '', score: 0 })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setForm({
      done: entry?.done || '',
      stuck: entry?.stuck || '',
      next: entry?.next || '',
      score: entry?.score || 0,
    })
    setMsg('')
  }, [week, entry])

  const base = JSON.stringify({
    done: entry?.done || '',
    stuck: entry?.stuck || '',
    next: entry?.next || '',
    score: entry?.score || 0,
  })
  const dirty = base !== JSON.stringify(form)
  const range = weekRange(week)

  const save = async () => {
    if (!canWrite || saving) return
    setSaving(true)
    setMsg('')
    try {
      await onSave({ week, ...range, ...form, updatedAt: new Date().toISOString() })
      setMsg('已提交，约 1–2 分钟后线上生效')
    } catch (e) {
      setMsg(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="growth-card">
      <header className="weekly-head">
        <div className="weekly-nav">
          <button type="button" className="growth-btn ghost sm" onClick={() => onChangeWeek(shiftWeek(week, -1))}>
            ‹
          </button>
          <div>
            <h2 className="weekly-title">
              {week.split('-')[0]} 第 {Number(week.split('W')[1])} 周
              {week === isoWeek(localDate()) && <span className="daily-badge">本周</span>}
            </h2>
            <p className="daily-sub">
              {range.start.slice(5).replace('-', '.')} – {range.end.slice(5).replace('-', '.')}
            </p>
          </div>
          <button type="button" className="growth-btn ghost sm" onClick={() => onChangeWeek(shiftWeek(week, 1))}>
            ›
          </button>
        </div>
        <div className="weekly-score">
          <span>这周的状态</span>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className={form.score === n ? 'score-dot active' : 'score-dot'}
              onClick={() => canWrite && setForm({ ...form, score: form.score === n ? 0 : n })}
              disabled={!canWrite}
              aria-label={`${n} 分`}
            >
              {n}
            </button>
          ))}
        </div>
      </header>

      {FIELDS.map((f) => (
        <div key={f.key} className="weekly-field">
          <label>{f.label}</label>
          <textarea
            className="growth-textarea sm"
            placeholder={f.placeholder}
            value={form[f.key]}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            readOnly={!canWrite}
            rows={4}
          />
        </div>
      ))}

      <footer className="daily-foot">
        <span className="daily-count">{week}</span>
        <div className="daily-actions">
          {msg && <span className="daily-msg">{msg}</span>}
          <button type="button" className="growth-btn" onClick={save} disabled={!canWrite || !dirty || saving}>
            {saving ? '保存中…' : dirty ? '保存' : '已保存'}
          </button>
        </div>
      </footer>
    </section>
  )
}
