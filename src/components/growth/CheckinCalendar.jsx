import { useEffect, useState } from 'react'
import { Icon } from '../Icons'
import { localDate, isCheckedIn, streakOf, longestStreak } from '../../data/growth'

const WEEK_LABEL = ['一', '二', '三', '四', '五', '六', '日']

export default function CheckinCalendar({ days, selected, onSelect }) {
  const [month, setMonth] = useState((selected || localDate()).slice(0, 7))
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (selected) setMonth(selected.slice(0, 7))
  }, [selected])

  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const offset = (first.getDay() + 6) % 7 // 周一开头
  const total = new Date(y, m, 0).getDate()
  const cellCount = Math.ceil((offset + total) / 7) * 7

  const cells = Array.from({ length: cellCount }, (_, i) => {
    const d = i - offset + 1
    return d >= 1 && d <= total ? `${month}-${String(d).padStart(2, '0')}` : null
  })

  const monthChecked = Object.keys(days || {}).filter(
    (k) => k.startsWith(month) && isCheckedIn(days[k]),
  ).length
  const streak = streakOf(days)
  const longest = longestStreak(days)
  const today = localDate()

  const shiftMonth = (n) => {
    const d = new Date(y, m - 1 + n, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div className={open ? 'cal-card open' : 'cal-card'}>
      <button
        type="button"
        className="cal-bar"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="cal-bar-main">
          <Icon.calendar />
          本月 {monthChecked} 天 · 连续 {streak} 天
        </span>
        <Icon.chevron className={open ? 'cal-chev open' : 'cal-chev'} />
      </button>

      <div className="cal-body">
        <div className="cal-head">
          <button type="button" className="cal-nav" onClick={() => shiftMonth(-1)} aria-label="上个月">
            ‹
          </button>
          <span className="cal-month">
            {y} 年 {m} 月
          </span>
          <button type="button" className="cal-nav" onClick={() => shiftMonth(1)} aria-label="下个月">
            ›
          </button>
        </div>

        <div className="cal-week">
          {WEEK_LABEL.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>

        <div className="cal-grid">
          {cells.map((d, i) => {
            if (!d) return <span key={`e${i}`} className="cal-cell is-empty" />
            const checked = isCheckedIn(days?.[d])
            const cls = [
              'cal-cell',
              checked ? 'is-checkin' : '',
              d === today ? 'is-today' : '',
              d === selected ? 'is-selected' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button key={d} type="button" className={cls} onClick={() => onSelect(d)} title={d}>
                {Number(d.slice(8))}
              </button>
            )
          })}
        </div>

        <div className="cal-stats">
          <span>
            本月 <b>{monthChecked}</b> 天
          </span>
          <span>
            连续 <b>{streak}</b> 天
          </span>
          <span>
            最长 <b>{longest}</b> 天
          </span>
        </div>

        <p className="cal-hint">写了学习总结的那天会点亮</p>
      </div>
    </div>
  )
}
