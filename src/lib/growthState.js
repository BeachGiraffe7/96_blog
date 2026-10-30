// Shared vault model. Does not create samples or import browser preview storage.
import { readDay, joinDayParts } from '../data/growth'
const clone = (v) =>
  v === undefined ? undefined : JSON.parse(JSON.stringify(v))
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
export const reviewText = (e) =>
  e?.text ?? [e?.done, e?.stuck, e?.next].filter(Boolean).join('\n\n')
export function vaultState(daily = {}, weekly = {}) {
  return {
    projects: clone(daily.projects || []),
    days: clone(daily.days || {}),
    wins: clone(daily.wins || []),
    energy: daily.energy || '平稳',
    weekly: Object.fromEntries(
      Object.entries(weekly.weeks || {}).map(([k, e]) => [
        k,
        { ...clone(e), text: reviewText(e) },
      ]),
    ),
    reviewDrafts: {},
  }
}
const keys = (...o) => [...new Set(o.flatMap((v) => Object.keys(v || {})))]
function setChecked(target, key, before, after, label, check) {
  if (same(before, after)) return
  if (check && !same(target[key], before) && !same(target[key], after))
    throw new Error(
      `${label}在其他设备更新，未覆盖远端；本机改动仍在加密草稿中，请重新载入后核对。`,
    )
  if (after === undefined) delete target[key]
  else target[key] = clone(after)
}
// Field-level patches preserve unrelated days/weeks and unknown legacy fields.
export function applyStateChanges(
  remote,
  before,
  after,
  { check = true } = {},
) {
  const out = clone(remote)
  for (const k of ['projects', 'wins', 'energy'])
    setChecked(
      out,
      k,
      before[k],
      after[k],
      k === 'projects' ? '长期项目' : k === 'wins' ? '成果记录' : '状态',
      check,
    )
  for (const section of ['days', 'weekly']) {
    out[section] ||= {}
    for (const id of keys(before[section], after[section])) {
      const old = before[section]?.[id],
        next = after[section]?.[id]
      const meaningful = keys(old, next).filter(
        (k) => k !== 'updatedAt' && !(section === 'days' && k === 'summary'),
      )
      if (
        same(old, next) ||
        (old && next && meaningful.every((k) => same(old[k], next[k])))
      )
        continue
      if (next === undefined) {
        setChecked(out[section], id, old, undefined, id, check)
        continue
      }
      const current = { ...(out[section][id] || {}) }
      for (const k of keys(old, next)) {
        if (k === 'updatedAt' || (section === 'days' && k === 'summary'))
          continue
        setChecked(
          current,
          k,
          old?.[k],
          next[k],
          `${id} 的${k === 'tasks' ? '任务列表' : k === 'text' ? '复盘' : '记录'}`,
          check,
        )
      }
      if (section === 'days') {
        current.date = id
        current.summary = joinDayParts(readDay(current))
      }
      current.updatedAt = new Date().toISOString()
      out[section][id] = current
    }
  }
  out.reviewDrafts = clone(after.reviewDrafts || {})
  return out
}
export function stateChanged(a, b, kind) {
  return kind === 'daily'
    ? !same(
        [a.days, a.projects, a.wins, a.energy],
        [b.days, b.projects, b.wins, b.energy],
      )
    : !same(a.weekly, b.weekly)
}
export const pendingState = (a, b) =>
  stateChanged(a, b, 'daily') ||
  stateChanged(a, b, 'weekly') ||
  Object.keys(b.reviewDrafts || {}).length > 0
export function patchVaultDocument(raw, kind, before, after) {
  const remote = vaultState(
    kind === 'daily' ? raw : {},
    kind === 'weekly' ? raw : {},
  )
  // Only compare the document currently being written.
  const base = {
    ...remote,
    ...(kind === 'daily'
      ? {
          days: before.days,
          projects: before.projects,
          wins: before.wins,
          energy: before.energy,
        }
      : { weekly: before.weekly }),
  }
  const next = {
    ...base,
    ...(kind === 'daily'
      ? {
          days: after.days,
          projects: after.projects,
          wins: after.wins,
          energy: after.energy,
        }
      : { weekly: after.weekly }),
  }
  const merged = applyStateChanges(remote, base, next)
  return kind === 'daily'
    ? {
        ...raw,
        days: merged.days,
        projects: merged.projects,
        wins: merged.wins,
        energy: merged.energy,
      }
    : { ...raw, weeks: merged.weekly }
}
