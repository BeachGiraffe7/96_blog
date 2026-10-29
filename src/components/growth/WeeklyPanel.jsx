import { useEffect, useMemo, useState } from 'react'
import Markdown from '../Markdown'
import { weekRange, shiftWeek, isoWeek, localDate, weekDigest } from '../../data/growth'

// 兼容旧数据：之前是 done / stuck / next 三段，合并成一整块
const entryText = (e) => {
  if (!e) return ''
  if (e.text) return e.text
  return [e.done, e.stuck, e.next].filter((v) => v && v.trim()).join('\n\n')
}

export default function WeeklyPanel({ week, entry, days, onSave, onChangeWeek, canWrite }) {
  const [text, setText] = useState(entryText(entry))
  const [score, setScore] = useState(entry?.score || 0)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [showExport, setShowExport] = useState(false)
  const [copyMsg, setCopyMsg] = useState('')

  useEffect(() => {
    setText(entryText(entry))
    setScore(entry?.score || 0)
    setMsg('')
    setPreview(false)
    setCopyMsg('')
  }, [week, entry])

  const base = JSON.stringify({ text: entryText(entry), score: entry?.score || 0 })
  const dirty = base !== JSON.stringify({ text, score })
  const range = weekRange(week)
  const digest = useMemo(() => (days ? weekDigest(days, week) : ''), [days, week])
  const blankDays = useMemo(() => (digest.match(/（这天没有记录）/g) || []).length, [digest])

  const save = async () => {
    if (!canWrite || saving) return
    setSaving(true)
    setMsg('')
    try {
      await onSave({ week, ...range, text, score, updatedAt: new Date().toISOString() })
      setMsg('已提交，约 1–2 分钟后线上生效')
    } catch (e) {
      setMsg(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const copyDigest = async () => {
    try {
      await navigator.clipboard.writeText(digest)
      setCopyMsg('已复制，去粘贴给 AI 就行')
    } catch {
      setCopyMsg('浏览器不让自动复制，手动全选下面那段文本')
    }
  }

  const downloadDigest = () => {
    const blob = new Blob([digest], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${week}-学习记录.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    setCopyMsg('已下载，可以直接拖进 AI 对话')
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
              className={score === n ? 'score-dot active' : 'score-dot'}
              onClick={() => canWrite && setScore(score === n ? 0 : n)}
              disabled={!canWrite}
              aria-label={`${n} 分`}
            >
              {n}
            </button>
          ))}
        </div>
      </header>

      <div className="weekly-tools">
        <p className="weekly-hint">
          这周记录了 <strong>{digest ? 7 - blankDays : '–'}</strong> / 7 天
        </p>
        <button
          type="button"
          className="growth-btn ghost sm"
          onClick={() => {
            setShowExport((v) => !v)
            setCopyMsg('')
          }}
          disabled={!digest}
        >
          {showExport ? '收起' : '导出这周记录'}
        </button>
      </div>

      {showExport && (
        <div className="weekly-export">
          <p className="weekly-export-note">
            已把这一周每天的记录拼成一段文本，开头带好了复盘要求。复制或下载后粘给任意 AI（GPT / Claude / 豆包都行），
            把它的输出再粘回下面那个大框里。
            {dirty && <em>（导出的是上次保存的内容，未保存的改动不在里面）</em>}
          </p>
          <textarea className="growth-textarea sm export-text" value={digest} readOnly rows={12} />
          <div className="weekly-export-actions">
            {copyMsg && <span className="daily-msg">{copyMsg}</span>}
            <button type="button" className="growth-btn ghost sm" onClick={downloadDigest}>
              下载 .md
            </button>
            <button type="button" className="growth-btn sm" onClick={copyDigest}>
              复制全部
            </button>
          </div>
        </div>
      )}

      <div className="weekly-field">
        <div className="weekly-label-row">
          <label htmlFor="week-review">本周复盘</label>
          <button
            type="button"
            className="link-btn"
            onClick={() => setPreview((v) => !v)}
            disabled={!text.trim()}
          >
            {preview ? '编辑' : '预览'}
          </button>
        </div>
        {preview ? (
          <div className="daily-preview article-content">
            <Markdown source={text} />
          </div>
        ) : (
          <textarea
            id="week-review"
            className="growth-textarea week-text"
            placeholder="把 AI 给的复盘粘进来，也可以自己写。支持 Markdown。"
            value={text}
            onChange={(e) => setText(e.target.value)}
            readOnly={!canWrite}
            rows={14}
          />
        )}
      </div>

      <footer className="daily-foot">
        <span className="daily-count">
          {text.replace(/\s/g, '').length} 字
          {score ? ` · 自评 ${score}/5` : ''}
        </span>
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
