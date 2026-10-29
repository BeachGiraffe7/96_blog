// 成长专栏的常量与日期工具（不含任何密文，可被任意端安全引入）
import { site } from './posts'

export const GROWTH = {
  // 密文放在 public/ 下：浏览器能按 URL 取到，GitHub API 也能按仓库路径更新
  files: {
    daily: { path: 'public/growth/daily.enc.json', url: '/growth/daily.enc.json', aad: 'growth:daily:v1' },
    weekly: { path: 'public/growth/weekly.enc.json', url: '/growth/weekly.enc.json', aad: 'growth:weekly:v1' },
  },
  repo: site.repo,
  branch: site.branch,
  iter: 600000,
  v: 1,
}

export const MOODS = ['平静', '开心', '有点丧', '灵光一现', '放松', '愧疚']

// 本地时间拼日期：绝不用 toISOString，否则晚 8 点后的记录会掉到前一天
export const localDate = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const shiftDate = (ds, n) => {
  const d = new Date(`${ds}T00:00:00`)
  d.setDate(d.getDate() + n)
  return localDate(d)
}

// ISO 周（周一起算），形如 2026-W44
export const isoWeek = (ds) => {
  const d = new Date(`${ds}T00:00:00`)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day) // 本周一
  const thursday = new Date(d)
  thursday.setDate(d.getDate() + 3)
  const year = thursday.getFullYear()
  const jan1 = new Date(`${year}-01-01T00:00:00`)
  const week = Math.floor((thursday - jan1) / 864e5 / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

export const weekRange = (weekKey) => {
  const [y, w] = weekKey.split('-W').map(Number)
  const jan4 = new Date(`${y}-01-04T00:00:00`)
  const jan4Day = (jan4.getDay() + 6) % 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - jan4Day + (w - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: localDate(monday), end: localDate(sunday) }
}

export const shiftWeek = (weekKey, n) => {
  const { start } = weekRange(weekKey)
  return isoWeek(shiftDate(start, n * 7))
}

// 打卡 = 当天写了学习总结（与任务勾选无关）
export const isCheckedIn = (day) => Boolean(day?.summary && day.summary.trim())

export const countCheckins = (days) => Object.keys(days || {}).filter((k) => isCheckedIn(days[k])).length

export function streakOf(days) {
  const checked = new Set(Object.keys(days || {}).filter((k) => isCheckedIn(days[k])))
  let cur = localDate()
  if (!checked.has(cur)) cur = shiftDate(cur, -1) // 今天还没写，从昨天起算
  let n = 0
  while (checked.has(cur)) {
    n += 1
    cur = shiftDate(cur, -1)
  }
  return n
}

export function longestStreak(days) {
  const list = Object.keys(days || {})
    .filter((k) => isCheckedIn(days[k]))
    .sort()
  let best = 0
  let run = 0
  let prev = ''
  for (const d of list) {
    run = prev && shiftDate(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}
