import { useState } from 'react'
import { Icon } from '../Icons'
import { unlock } from '../../lib/vault'

export default function Gate({ onUnlocked }) {
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!pw || busy) return
    setBusy(true)
    setErr('')
    try {
      await unlock(pw)
      onUnlocked()
    } catch (e2) {
      setErr(e2?.message || '密码不对，或文件已损坏')
      setPw('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="growth-gate">
      <div className="growth-gate-card">
        <div className="growth-gate-icon">
          <Icon.lock />
        </div>
        <h1>成长专栏</h1>
        <p className="growth-gate-desc">
          这里是私密记录。内容在仓库里是加密的，只有输入正确密码才能解开。
        </p>

        <form onSubmit={submit} className="growth-gate-form">
          <input
            type="password"
            className="growth-input"
            placeholder="密码"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            autoComplete="current-password"
          />
          <button type="submit" className="growth-btn" disabled={busy || !pw}>
            {busy ? '解锁中…' : '解锁'}
          </button>
        </form>

        {err && <div className="growth-alert error">{err}</div>}

        <p className="growth-gate-tip">
          密码丢失无法找回（没有后门）。建议在密码管理器里存一份，并把明文备份留在本机
          <code>raw/growth/</code>。
        </p>
      </div>
    </div>
  )
}
