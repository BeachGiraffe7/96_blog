import { useCallback, useEffect, useRef, useState } from 'react'
import {
  loadData,
  saveData,
  sealLocalDraft,
  openLocalDraft,
} from '../../lib/vault'
import {
  vaultState,
  same,
  applyStateChanges,
  stateChanged,
  pendingState,
  patchVaultDocument,
} from '../../lib/growthState'
const DRAFT_KEY = 'growth_workbench_draft_encrypted_v1'
export default function useGrowthVault(canWrite) {
  const [data, setData] = useState(null),
    [status, setStatus] = useState('正在解密记录…'),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false),
    [recovery, setRecovery] = useState(null),
    [loaded, setLoaded] = useState(false)
  const current = useRef(null),
    base = useRef(null),
    docs = useRef(null),
    busy = useRef(false),
    alive = useRef(true),
    revision = useRef(0),
    failed = useRef(false),
    legacy = useRef([]),
    draftQueue = useRef(Promise.resolve())
  const flushDraft = useCallback(() => {
    const snapshot = current.current,
      baseline = base.current,
      stamp = revision.current
    if (!snapshot || !baseline || recovery) return draftQueue.current
    const task = draftQueue.current
      .catch(() => {})
      .then(async () => {
        if (stamp !== revision.current) return
        if (!pendingState(baseline, snapshot)) {
          localStorage.removeItem(DRAFT_KEY)
          return
        }
        const envelope = await sealLocalDraft({ baseline, data: snapshot })
        if (stamp !== revision.current) return
        localStorage.setItem(DRAFT_KEY, JSON.stringify(envelope))
        for (const item of legacy.current)
          if (localStorage.getItem(item.key) === item.raw)
            localStorage.removeItem(item.key)
        legacy.current = []
      })
    draftQueue.current = task
    return task
  }, [recovery])
  useEffect(() => {
    let cancelled = false
    alive.current = true
    ;(async () => {
      try {
        const [daily, weekly] = await Promise.all([
          loadData('daily'),
          loadData('weekly'),
        ])
        if (!alive.current || cancelled) return
        docs.current = { daily, weekly }
        const remote = vaultState(daily, weekly)
        let working = remote
        let note = '已解密载入；修改会自动加密保存。'
        base.current = remote
        let raw = ''
        try {
          raw = localStorage.getItem(DRAFT_KEY) || ''
        } catch {}
        if (raw) {
          try {
            const draft = await openLocalDraft(JSON.parse(raw))
            working = applyStateChanges(remote, draft.baseline, draft.data)
            note = '已恢复本机加密草稿，正在核对并保存。'
          } catch (e) {
            setRecovery({ raw, error: e.message || '本机草稿无法解密' })
            note = '本机有草稿需要核对，暂未覆盖远端记录。'
          }
        } else {
          // Read the original DailyPanel draft format only after successful unlock.
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (!/^growth_draft_\d{4}-\d{2}-\d{2}$/.test(key || '')) continue
              const raw = localStorage.getItem(key)
              let d
              try {
                d = JSON.parse(raw)
              } catch {
                continue
              }
              const date = key.slice('growth_draft_'.length)
              if (
                d?.at >
                  Date.parse(remote.days[date]?.updatedAt || '1970-01-01') &&
                (d.tasks?.length || Object.values(d.parts || {}).some(Boolean))
              ) {
                working = {
                  ...working,
                  days: {
                    ...working.days,
                    [date]: {
                      ...working.days[date],
                      tasks: d.tasks || [],
                      ...d.parts,
                      mood: d.mood || '平静',
                    },
                  },
                }
                legacy.current.push({ key, raw })
                note = '已恢复旧版未保存的每日草稿，将改用加密暂存。'
              }
            }
          } catch {}
        }
        if (!alive.current || cancelled) return
        current.current = working
        setData(working)
        setStatus(note)
        setLoaded(true)
      } catch (e) {
        if (alive.current) {
          setError(e.message || '读取失败，请重新载入')
          setStatus('读取失败，未开放编辑以避免覆盖记录。')
        }
      }
    })()
    return () => {
      cancelled = true
      alive.current = false
    }
  }, [])
  const update = useCallback(
    (next) => {
      if (!canWrite || recovery) return
      current.current = next
      revision.current++
      failed.current = false
      setData(next)
      setError('')
      setStatus('改动待加密保存…')
    },
    [canWrite, recovery],
  )
  const persist = useCallback(async () => {
    if (!canWrite || busy.current || !current.current || recovery) return
    busy.current = true
    setSaving(true)
    setError('')
    const snapshot = current.current,
      before = base.current
    try {
      try {
        await flushDraft()
      } catch {
        setError('本机草稿暂存不可用，正在尝试直接加密同步。')
      }
      for (const kind of ['daily', 'weekly'])
        if (stateChanged(before, snapshot, kind)) {
          const result = await saveData(kind, (raw) =>
            patchVaultDocument(raw, kind, before, snapshot),
          )
          docs.current[kind] = result
          // Advance this document's baseline even if the following file fails.
          const received = vaultState(docs.current.daily, docs.current.weekly)
          base.current = {
            ...base.current,
            ...(kind === 'daily'
              ? {
                  days: received.days,
                  projects: received.projects,
                  wins: received.wins,
                  energy: received.energy,
                }
              : { weekly: received.weekly }),
          }
          const rebased = applyStateChanges(
            received,
            snapshot,
            current.current,
            { check: false },
          )
          current.current = {
            ...current.current,
            ...(kind === 'daily'
              ? {
                  days: rebased.days,
                  projects: rebased.projects,
                  wins: rebased.wins,
                  energy: rebased.energy,
                }
              : { weekly: rebased.weekly }),
          }
          if (alive.current) setData(current.current)
        }
      // Each successfully saved document was already rebased above. Re-applying
      // the old full snapshot would turn unrelated remote additions into edits.
      const merged = current.current
      if (alive.current) {
        current.current = merged
        revision.current++
        setData(merged)
        setStatus(
          Object.keys(merged.reviewDrafts).length
            ? '记录已加密保存；周复盘草稿仅在本机加密暂存，点击保存后同步。'
            : '已加密保存到 GitHub，跨设备可读取。',
        )
      }
      try {
        await flushDraft()
      } catch {
        if (alive.current)
          setError('云端记录已保存，但本机加密草稿暂存不可用。')
      }
    } catch (e) {
      failed.current = true
      if (alive.current) setData(current.current)
      if (alive.current) {
        setError(e.message || '加密保存失败')
        setStatus('未保存成功，请保留页面并重试；不会覆盖其他修改。')
      }
      try {
        await flushDraft()
      } catch {
        if (alive.current)
          setError('本机加密草稿也未能写入；请勿关闭页面，检查存储权限后重试。')
      }
    } finally {
      busy.current = false
      if (alive.current) setSaving(false)
    }
  }, [canWrite, recovery, flushDraft])
  useEffect(() => {
    if (!data || !loaded || recovery) return
    flushDraft()
      .then(() => {
        if (
          alive.current &&
          Object.keys(current.current.reviewDrafts || {}).length &&
          !stateChanged(base.current, current.current, 'daily') &&
          !stateChanged(base.current, current.current, 'weekly')
        )
          setStatus('周复盘草稿已在本机加密暂存；点击保存本周复盘后同步。')
      })
      .catch(() => {
        if (alive.current)
          setError('本机加密草稿写入失败，请尽快保存且不要关闭页面。')
      })
    if (!canWrite || failed.current) return
    if (
      !stateChanged(base.current, data, 'daily') &&
      !stateChanged(base.current, data, 'weekly')
    )
      return
    const id = setTimeout(() => {
      if (!failed.current) persist()
    }, 1800)
    return () => clearTimeout(id)
  }, [data, loaded, canWrite, recovery, flushDraft, persist])
  useEffect(() => {
    const guard = (e) => {
      if (
        current.current &&
        base.current &&
        pendingState(base.current, current.current)
      ) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [])
  const dismissRecovery = () => {
    if (
      !window.confirm(
        '确认放弃这份本机草稿，保留远端记录？建议先下载草稿备份。',
      )
    )
      return
    try {
      localStorage.removeItem(DRAFT_KEY)
      setRecovery(null)
      setStatus('已保留远端记录，可以继续编辑。')
    } catch {
      setError('无法清除草稿，请检查浏览器存储权限')
    }
  }
  const downloadRecovery = async () => {
    try {
      const value = await openLocalDraft(JSON.parse(recovery.raw))
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value.data, null, 2)], {
          type: 'application/json',
        }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = '成长记录-本机草稿备份-请妥善保管.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      const url = URL.createObjectURL(
        new Blob([recovery.raw], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = '成长记录-加密草稿备份.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
  return {
    data,
    update,
    status,
    error,
    saving,
    persist,
    flushDraft,
    recovery,
    dismissRecovery,
    downloadRecovery,
    dirty:
      data &&
      base.current &&
      (stateChanged(base.current, data, 'daily') ||
        stateChanged(base.current, data, 'weekly')),
  }
}
