import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Gate from '../components/growth/Gate'
import Workbench from '../components/growth/Workbench'
import useGrowthVault from '../components/growth/useGrowthVault'
import { isUnlocked, tryRestore, lock, hasToken } from '../lib/vault'
import { applyTheme, watchSystem } from '../lib/theme'
import '../styles/growth.css'
function VaultWorkbench({ onLock }) {
  const [sp] = useSearchParams(),
    canWrite = hasToken()
  const v = useGrowthVault(canWrite)
  const lockNow = async () => {
    try {
      await v.flushDraft()
    } catch {
      if (
        !window.confirm(
          '加密草稿暂存失败。锁定后未保存改动可能丢失，仍要锁定吗？',
        )
      )
        return
    }
    onLock()
  }
  if (!v.data)
    return (
      <div className="growth-page">
        <p className="growth-loading">{v.status}</p>
        {v.error && (
          <div role="alert" className="growth-alert error">
            {v.error}
            <button onClick={() => location.reload()}>重新载入</button>
          </div>
        )}
        <button className="growth-btn" onClick={onLock}>
          锁定
        </button>
      </div>
    )
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get('d') || '')
    ? sp.get('d')
    : undefined
  const week = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/.test(sp.get('w') || '')
    ? sp.get('w')
    : undefined
  const tabs = {
    daily: 'today',
    weekly: 'review',
    projects: 'projects',
    archive: 'archive',
  }
  return (
    <>
      {v.recovery && (
        <div className="growth-alert error gw-recovery" role="alert">
          <strong>发现需要核对的本机加密草稿，尚未覆盖远端。</strong>
          <p>{v.recovery.error}</p>
          <p>
            可先下载草稿备份（若可解密，下载文件包含私密明文，请妥善保管），再选择保留远端记录。
          </p>
          <button className="growth-btn" onClick={v.downloadRecovery}>
            下载本机草稿备份
          </button>
          <button className="growth-btn ghost" onClick={v.dismissRecovery}>
            放弃草稿，保留远端
          </button>
        </div>
      )}
      <Workbench
        data={v.data}
        onChange={v.update}
        previewMode={false}
        canWrite={canWrite && !v.recovery}
        status={v.status}
        error={v.error}
        saving={v.saving}
        onSave={v.persist}
        onLock={lockNow}
        initialDate={date}
        initialTab={tabs[sp.get('tab')] || 'today'}
        initialWeek={week}
      />
    </>
  )
}
export default function Growth() {
  const [booting, setBooting] = useState(true),
    [ready, setReady] = useState(isUnlocked)
  useEffect(() => {
    let alive = true
    applyTheme()
    const unwatch = watchSystem(() => {})
    ;(async () => {
      if (!isUnlocked()) {
        const ok = await tryRestore()
        if (alive && ok) setReady(true)
      }
      if (alive) setBooting(false)
    })()
    return () => {
      alive = false
      unwatch()
    }
  }, [])
  const handleLock = () => {
    lock()
    setReady(false)
  }
  if (booting)
    return (
      <div className="growth-page">
        <p className="growth-loading">正在打开…</p>
      </div>
    )
  if (!ready)
    return (
      <div className="growth-page">
        <Gate onUnlocked={() => setReady(true)} />
        <p className="growth-back">
          <Link to="/">← 回到博客</Link>
        </p>
      </div>
    )
  return <VaultWorkbench onLock={handleLock} />
}
