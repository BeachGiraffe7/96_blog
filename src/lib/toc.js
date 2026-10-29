// 标题锚点 ID 与目录提取：Markdown 渲染和右侧目录共用同一套规则，否则锚点对不上

export const headingId = (text) =>
  String(text)
    .replace(/[`*_~[\]()]/g, '')
    .trim()
    .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'section'

// 同名标题要能区分：第二个「小结」变成 xiaojie-2
export function makeIdGen() {
  const seen = new Map()
  return (text) => {
    const base = headingId(text)
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}-${n}`
  }
}

/**
 * 从 markdown 里抽 h2 / h3 生成目录
 * 跳过代码块内的 # 注释，跳过 h1（那是文章标题，渲染时也会被跳过）
 */
export function buildToc(markdown, maxLevel = 3) {
  if (!markdown) return []
  const nextId = makeIdGen()
  const out = []
  let inCode = false

  for (const raw of markdown.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('```')) {
      inCode = !inCode
      continue
    }
    if (inCode) continue

    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*$/)
    if (!m) continue

    const level = m[1].length
    // h1 会被渲染器跳过，也不占 id
    if (level === 1) continue

    const text = m[2].replace(/[`*_~]/g, '').trim()
    if (!text) continue

    // 关键：h4 虽然不进目录，但渲染器会为它分配 id，这里必须同样消耗计数，
    // 否则「先出现 h4 再出现同名 h2」时，两边算出的 id 会错开一位
    const id = nextId(text)
    if (level > maxLevel) continue

    out.push({ level, text, id })
  }

  return out
}
