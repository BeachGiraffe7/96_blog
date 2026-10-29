// 碎碎念文件的解析与修改：列表页和「管理」共用同一套规则，
// 否则两边对同一条记录的判断会不一致（删错条目就是这么来的）

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const normText = (s) => String(s || '').replace(/\s+/g, ' ').trim()

// 把 moments.md 里每个「## 日期 | 心情」区块转成对象
export function parseMoments(raw) {
  const body = String(raw || '').replace(/<!--[\s\S]*?-->/g, '')
  return body
    .split(/^##\s+/m)
    .slice(1)
    .map((block) => {
      const lines = block.split('\n')
      const head = lines.shift().trim()
      const [date, mood] = head.split('|').map((s) => s.trim())
      const text = normText(lines.join(' '))
      return { date, mood: mood || '平静', text }
    })
    .filter((m) => DATE_RE.test(m.date) && m.text)
}

/**
 * 从原文里删掉一条，返回新全文；找不到返回 null（调用方据此报错，避免写坏文件）
 * 匹配用「日期 + 正文」，正文做空白归一化，防止换行差异导致匹配不到
 */
export function removeMomentBlock(raw, target) {
  const parts = String(raw || '').split(/^##\s+/m)
  if (parts.length < 2) return null

  const head = parts[0]
  const blocks = parts.slice(1)
  const want = normText(target.text)

  let hit = -1
  for (let i = 0; i < blocks.length; i += 1) {
    const lines = blocks[i].split('\n')
    const h = lines.shift().trim()
    const [date] = h.split('|').map((s) => s.trim())
    if (date === target.date && normText(lines.join(' ')) === want) {
      hit = i
      break
    }
  }
  if (hit < 0) return null

  blocks.splice(hit, 1)
  // 按原格式拼回去：'## ' + 原区块（区块本身以换行结尾）
  return head + blocks.map((b) => `## ${b}`).join('')
}
