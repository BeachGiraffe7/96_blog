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

// 每日记录的三段结构。旧的单段 summary 会自动落到“今天学了什么”，不会丢内容
export const DAY_PARTS = [
  { key: 'learned', label: '今天学了什么', placeholder: '新搞懂的概念、验证过的结论、看懂的代码……' },
  { key: 'stuck', label: '卡在哪', placeholder: '没搞懂的、走弯路的、配置半天不对的……' },
  { key: 'next', label: '明天接着做什么', placeholder: '下一步要动手的事，越具体越好……' },
]

export function readDay(day) {
  const parts = {
    learned: day?.learned || '',
    stuck: day?.stuck || '',
    next: day?.next || '',
  }
  const empty = !parts.learned && !parts.stuck && !parts.next
  if (empty && day?.summary) parts.learned = day.summary
  return {
    tasks: day?.tasks || [],
    ...parts,
    mood: day?.mood || '平静',
  }
}

// 保存时顺手写一份聚合文本，方便旧读者/外部工具按一段话取用
export const joinDayParts = (parts) =>
  DAY_PARTS.map((p) => (parts[p.key] || '').trim())
    .filter(Boolean)
    .join('\n\n')

// 打卡 = 当天写了三段里的任意一段（与任务勾选无关）
export const isCheckedIn = (day) => {
  const d = readDay(day)
  return Boolean(d.learned.trim() || d.stuck.trim() || d.next.trim())
}

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

const WEEK_LABEL = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

// 把一周 7 天的记录拼成一段可直接交给外部 AI 的文本（含复盘要求）
export function weekDigest(days, week) {
  const { start, end } = weekRange(week)
  const [y, w] = week.split('-W').map(Number)
  const blocks = []
  let filled = 0
  let taskDone = 0
  let taskTotal = 0

  for (let i = 0; i < 7; i += 1) {
    const date = shiftDate(start, i)
    const raw = days?.[date]
    const day = readDay(raw)
    const weekday = WEEK_LABEL[new Date(`${date}T00:00:00`).getDay()]
    const tasks = day.tasks || []
    const has = isCheckedIn(raw)
    if (has) filled += 1
    taskTotal += tasks.length
    taskDone += tasks.filter((t) => t.done).length

    const lines = [`## ${date} ${weekday}`]
    if (!has && !tasks.length) {
      lines.push('（这天没有记录）')
      blocks.push(lines.join('\n'))
      continue
    }
    lines.push(`心情：${day.mood}`)
    if (tasks.length) {
      lines.push('任务：', ...tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.text}`))
    }
    DAY_PARTS.forEach((p) => {
      const v = (day[p.key] || '').trim()
      if (v) lines.push('', `${p.label}：`, v)
    })
    blocks.push(lines.join('\n'))
  }

  const head = [
    `# ${y} 年第 ${w} 周 · 学习记录`,
    '',
    `范围：${start} ~ ${end}`,
    `有记录：${filled}/7 天　任务完成：${taskDone}/${taskTotal}`,
    '',
    '请基于下面的每日记录帮我做一次周复盘，要求：',
    '',
    '1. 用 3–5 句概括这周的主线：在推进什么、走到哪一步',
    '2. 找出「卡在哪」里反复出现的模式，指明同类问题出现了几次',
    '3. 对照每天的「明天接着做什么」和第二天实际在做的事，判断计划落地情况，指出偏移最大的地方',
    '4. 给出下周 3 条具体调整，要能直接执行，不要「多练习」「多总结」这类空话',
    '5. 最后用一句话评价这周的状态',
    '',
    '---',
    '',
  ]

  return `${head.join('\n')}${blocks.join('\n\n')}\n`
}
