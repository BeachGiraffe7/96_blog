import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Gate from '../components/growth/Gate'
import DailyPanel from '../components/growth/DailyPanel'
import WeeklyPanel from '../components/growth/WeeklyPanel'
import CheckinCalendar from '../components/growth/CheckinCalendar'
import { Icon } from '../components/Icons'
import { isUnlocked, tryRestore, loadData, saveData, lock, hasToken } from '../lib/vault'
import { localDate, isoWeek } from '../data/growth'
import '../styles/growth.css'

export default function Growth() {
  const [sp, setSp] = useSearchParams()
  const [booting, setBooting] = useState(true)
  const [ready, setReady] = useState(isUnlocked())
  const [daily, setDaily] = useState(null)
  const [weekly, setWeekly] = useState(null)
  const [err, setErr] = useState('')

  const tab = sp.get('tab') === 'weekly' ? 'weekly' : 'daily'
  const date = sp.get('d') || localDate()
  const week = sp.get('w') || isoWeek(date)
  const canWrite = hasToken()

  // 刷新后尝试用本次会话里的密码自动解锁
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!isUnlocked()) {
        const ok = await tryRestore()
        if (alive && ok) setReady(true)
      }
      if (alive) setBooting(false)
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    let alive = true
    ;(async () => {
      try {
        const [d, w] = await Promise.all([loadData('daily'), loadData('weekly')])
        if (!alive) return
        setDaily(d)
        setWeekly(w)
      } catch (e) {
        if (alive) setErr(e.message || '数据读取失败')
      }
    })()
    return () => {
      alive = false
    }
  }, [ready])

  const setQuery = (patch) => {
    const next = new URLSearchParams(sp)
    Object.entries(patch).forEach(([k, v]) => {
      if (v) next.set(k, v)
      else next.delete(k)
    })
    setSp(next, { replace: true })
  }

  const saveDay = async (entry) => {
    const next = await saveData('daily', (d) => {
      d.days = d.days || {}
      d.days[entry.date] = entry
      return d
    })
    setDaily(next)
  }

  const saveWeek = async (entry) => {
    const next = await saveData('weekly', (w) => {
      w.weeks = w.weeks || {}
      w.weeks[entry.week] = entry
      return w
    })
    setWeekly(next)
  }

  const handleLock = () => {
    lock()
    setReady(false)
    setDaily(null)
    setWeekly(null)
  }

  if (booting) {
    return (
      <div className="growth-page">
        <div className="growth-loading">正在打开…</div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="growth-page">
        <Gate onUnlocked={() => setReady(true)} />
        <p className="growth-back">
          <Link to="/">← 回到博客</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="growth-page">
      <header className="growth-header">
        <div className="growth-title-row">
          <span className="growth-lock">
            <Icon.lock />
          </span>
          <h1>成长专栏</h1>
          <span className="growth-private">私密 · 本地解密</span>
        </div>
        <div className="growth-actions">
          <div className="growth-tabs">
            <button
              type="button"
              className={tab === 'daily' ? 'growth-tab active' : 'growth-tab'}
              onClick={() => setQuery({ tab: 'daily' })}
            >
              今日
            </button>
            <button
              type="button"
              className={tab === 'weekly' ? 'growth-tab active' : 'growth-tab'}
              onClick={() => setQuery({ tab: 'weekly' })}
            >
              每周复盘
            </button>
          </div>
          <button type="button" className="growth-btn ghost sm" onClick={handleLock}>
            锁定
          </button>
        </div>
      </header>

      {err && <div className="growth-alert error">{err}</div>}
      {!canWrite && (
        <div className="growth-alert note">
          未连接 GitHub，当前是只读模式。去 <Link to="/write">/write</Link> 连接 token 后即可编辑保存。
        </div>
      )}

      <div className="growth-shell">
        <main className="growth-main">
          {tab === 'daily' ? (
            <DailyPanel
              date={date}
              day={daily?.days?.[date]}
              onSave={saveDay}
              onSelectDate={(d) => setQuery({ d, tab: 'daily' })}
              canWrite={canWrite}
            />
          ) : (
            <WeeklyPanel
              week={week}
              entry={weekly?.weeks?.[week]}
              days={daily?.days}
              onSave={saveWeek}
              onChangeWeek={(w) => setQuery({ w, tab: 'weekly' })}
              canWrite={canWrite}
            />
          )}
        </main>

        <aside className="growth-side">
          <CheckinCalendar
            days={daily?.days}
            selected={date}
            onSelect={(d) => setQuery({ d, tab: 'daily' })}
          />
          <p className="growth-back">
            <Link to="/">← 回到博客</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
