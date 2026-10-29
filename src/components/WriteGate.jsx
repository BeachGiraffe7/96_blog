import { useState } from 'react'
import { Icon } from './Icons'
import { unlockWrite } from '../lib/writeAuth'

export default function WriteGate({ onUnlocked }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!pw.trim()) return
    if (unlockWrite(pw)) {
      onUnlocked()
      return
    }
    setErr('口令不对，再想一下')
    setPw('')
  }

  return (
    <div className="write-gate">
      <div className="write-gate-card">
        <div className="write-gate-icon">
          <Icon.lock />
        </div>
        <h1>撰写入口</h1>
        <p className="write-gate-desc">
          撰写功能只有拥有口令的管理员才可进行。
          <br />
          如果你也想投稿内容，可以联系站主，欢迎大家来充实博客。
        </p>

        <form className="write-gate-form" onSubmit={submit}>
          <input
            type="password"
            className="write-input"
            placeholder="输入口令"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            autoComplete="off"
            aria-label="撰写口令"
          />
          <button type="submit" className="write-btn" disabled={!pw.trim()}>
            进入
          </button>
        </form>

        {err && <p className="write-gate-err">{err}</p>}

        <p className="write-gate-tip">口令只在本次浏览有效，关掉标签页后需要重新输入。</p>
      </div>
    </div>
  )
}
