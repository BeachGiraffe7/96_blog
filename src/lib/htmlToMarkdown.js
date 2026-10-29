/**
 * 富文本 → Markdown
 * 主要用途：从飞书 / 语雀 / 网页复制内容后直接粘贴进写作页。
 * 只处理常见语义结构，不做像素级还原。
 */

const SKIP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'NOSCRIPT', 'SVG', 'BUTTON', 'INPUT'])

// 只做行内处理的标签：出现在同一段里，不该被拆成块
const INLINE = new Set([
  'A', 'CODE', 'STRONG', 'B', 'EM', 'I', 'SPAN', 'DEL', 'S', 'BR',
  'IMG', 'SUP', 'SUB', 'U', 'MARK', 'SMALL', 'FONT',
])

const clean = (s) => s.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n')

function imageMd(node) {
  const src = node.getAttribute('src') || ''
  const alt = (node.getAttribute('alt') || '').trim()
  if (!src) return ''
  // 飞书图床要登录态，直接贴过来在博客里打不开
  if (/feishu\.cn|feishu\.net|larksuite/.test(src)) {
    return `<!-- 飞书图片，需要在博客里重新上传：${alt || '未命名'} -->\n\n> 这里原有一张飞书图片，需要在博客重新上传。\n`
  }
  return `![${alt}](${src})`
}

function inline(node) {
  if (node.nodeType === 3) return node.textContent.replace(/\s+/g, ' ')
  if (node.nodeType !== 1) return ''
  const tag = node.tagName
  if (SKIP.has(tag)) return ''

  const inner = [...node.childNodes].map(inline).join('')

  switch (tag) {
    case 'STRONG':
    case 'B': {
      const t = inner.trim()
      return t ? `**${t}**` : ''
    }
    case 'EM':
    case 'I': {
      const t = inner.trim()
      return t ? `*${t}*` : ''
    }
    case 'DEL':
    case 'S': {
      const t = inner.trim()
      return t ? `~~${t}~~` : ''
    }
    case 'CODE':
      return `\`${inner}\``
    case 'A': {
      const href = node.getAttribute('href') || ''
      const t = inner.trim() || href
      return href ? `[${t}](${href})` : t
    }
    case 'IMG':
      return imageMd(node)
    case 'BR':
      return '\n'
    case 'SPAN':
      // 飞书用 span 承载行内样式，颜色/字号忽略
      return inner
    default:
      return inner
  }
}

function tableMd(table) {
  const rows = [...table.querySelectorAll('tr')]
  if (!rows.length) return ''
  const grid = rows.map((tr) =>
    [...tr.children].map((cell) => inline(cell).replace(/\n+/g, ' ').trim()),
  )
  const width = Math.max(...grid.map((r) => r.length))
  const pad = (r) => [...r, ...Array(width - r.length).fill('')]
  const head = pad(grid[0])
  const lines = [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...grid.slice(1).map((r) => `| ${pad(r).join(' | ')} |`),
  ]
  return `\n${lines.join('\n')}\n`
}

function listMd(list, depth = 0) {
  const ordered = list.tagName === 'OL'
  const items = [...list.children].filter((c) => c.tagName === 'LI')
  let i = 0
  const out = []
  for (const li of items) {
    i += 1
    // 嵌套列表要单独抽出来
    const nested = [...li.children].filter((c) => c.tagName === 'UL' || c.tagName === 'OL')
    const clone = li.cloneNode(true)
    ;[...clone.children].forEach((c) => {
      if (c.tagName === 'UL' || c.tagName === 'OL') c.remove()
    })
    const text = blockOf(clone).replace(/\n{2,}/g, '\n').trim()
    const indent = '  '.repeat(depth)
    out.push(`${indent}${ordered ? `${i}.` : '-'} ${text}`)
    for (const sub of nested) {
      out.push(listMd(sub, depth + 1).trimEnd())
    }
  }
  return `${out.join('\n')}\n`
}

function blockOf(node) {
  if (node.nodeType === 3) {
    const t = node.textContent.replace(/\s+/g, ' ')
    return t.trim() ? t : ''
  }
  if (node.nodeType !== 1) return ''
  const tag = node.tagName
  if (SKIP.has(tag)) return ''

  switch (tag) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6': {
      const level = Number(tag[1])
      const t = inline(node).trim()
      return t ? `\n${'#'.repeat(level)} ${t}\n` : ''
    }
    case 'P': {
      const t = inline(node).trim()
      return t ? `\n${t}\n` : ''
    }
    case 'UL':
    case 'OL':
      return `\n${listMd(node)}`
    case 'PRE': {
      const code = node.textContent.replace(/\n$/, '')
      const cls = node.querySelector('code')?.className || ''
      const lang = (cls.match(/language-([\w-]+)/) || [])[1] || ''
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n`
    }
    case 'BLOCKQUOTE': {
      const inner = childrenMd(node).trim()
      const quoted = inner
        .split('\n')
        .map((l) => (l.trim() ? `> ${l}` : '>'))
        .join('\n')
      return `\n${quoted}\n`
    }
    case 'HR':
      return '\n---\n'
    case 'TABLE':
      return tableMd(node)
    case 'IMG':
      return `\n${imageMd(node)}\n`
    case 'BR':
      return '\n'
    default:
      return childrenMd(node)
  }
}

function childrenMd(node) {
  const kids = [...node.childNodes].filter(
    (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim()),
  )
  // 子节点全是行内元素（<li>文字 <code>x</code></li>）：整段走 inline，否则会丢格式
  const allInline = kids.every((n) => n.nodeType === 3 || INLINE.has(n.tagName))
  if (allInline) {
    const t = inline(node).trim()
    return t ? `\n${t}\n` : ''
  }

  const parts = []
  for (const child of node.childNodes) {
    const piece = blockOf(child)
    if (piece) parts.push(piece)
  }
  if (!parts.length) {
    const t = inline(node).trim()
    return t ? `\n${t}\n` : ''
  }
  return parts.join('')
}

export function htmlToMarkdown(html) {
  if (!html || typeof window === 'undefined') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const raw = childrenMd(doc.body)
  return clean(raw)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .trimEnd()
}

// 判断粘贴内容是不是"真的富文本"，全选复制普通文字时也会带 html
export function looksRich(html) {
  return /<(h[1-6]|ul|ol|li|table|pre|blockquote|strong|b|em|i|img)\b/i.test(html || '')
}
