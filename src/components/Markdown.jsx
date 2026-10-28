/**
 * 轻量 Markdown 渲染器（不引第三方库）
 * 支持：标题(#~####)、段落、无序/有序列表、引用、代码块(带语言标签)、
 *       表格、图片、分隔线、行内代码、加粗、斜体、链接
 */

function renderInline(text, keyPrefix) {
  // 顺序：行内代码 -> 链接/图片在块级处理，这里只处理强调和行内代码
  const nodes = []
  let rest = text
  let key = 0

  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m

  while ((m = pattern.exec(rest)) !== null) {
    if (m.index > last) nodes.push(rest.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('`')) {
      nodes.push(<code key={`${keyPrefix}-c${key++}`}>{token.slice(1, -1)}</code>)
    } else if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b${key++}`}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('[')) {
      const mm = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      nodes.push(
        <a key={`${keyPrefix}-a${key++}`} href={mm[2]} target="_blank" rel="noreferrer">
          {mm[1]}
        </a>,
      )
    } else {
      nodes.push(<em key={`${keyPrefix}-i${key++}`}>{token.slice(1, -1)}</em>)
    }
    last = m.index + token.length
  }
  if (last < rest.length) nodes.push(rest.slice(last))
  return nodes
}

function CodeBlock({ lang, lines }) {
  return (
    <div className="md-code">
      {lang && <span className="md-code-lang">{lang}</span>}
      <pre>
        <code>{lines.join('\n')}</code>
      </pre>
    </div>
  )
}

function Table({ rows }) {
  const cells = rows.map((r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
  const [head, , ...body] = cells
  return (
    <div className="md-table-wrap">
      <table className="md-table">
        <thead>
          <tr>{head.map((c, i) => <th key={i}>{renderInline(c, `th${i}`)}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>{row.map((c, ci) => <td key={ci}>{renderInline(c, `td${ri}-${ci}`)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Markdown({ source, skipH1 = true }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let key = 0

  const flushList = (ordered) => {
    const items = []
    while (i < lines.length && /^\s*(\d+\.|[-*+])\s+/.test(lines[i])) {
      items.push(lines[i].replace(/^\s*(\d+\.|[-*+])\s+/, ''))
      i++
    }
    const Tag = ordered ? 'ol' : 'ul'
    out.push(
      <Tag key={`l${key++}`}>
        {items.map((it, idx) => (
          <li key={idx}>{renderInline(it, `li${idx}`)}</li>
        ))}
      </Tag>,
    )
  }

  while (i < lines.length) {
    const line = lines[i]

    // 空行
    if (!line.trim()) {
      i++
      continue
    }

    // 代码块
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      i++
      const buf = []
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++
      out.push(<CodeBlock key={`k${key++}`} lang={lang} lines={buf} />)
      continue
    }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const text = h[2].replace(/\s*#*\s*$/, '')
      if (level === 1 && skipH1) {
        // 文档首行大标题通常与文章标题重复，默认跳过
        i++
        continue
      }
      const content = renderInline(text, `h${key}`)
      if (level === 1) out.push(<h1 key={`k${key++}`}>{content}</h1>)
      else if (level === 2) out.push(<h2 key={`k${key++}`}>{content}</h2>)
      else if (level === 3) out.push(<h3 key={`k${key++}`}>{content}</h3>)
      else out.push(<h4 key={`k${key++}`}>{content}</h4>)
      i++
      continue
    }

    // 分隔线
    if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/.test(line)) {
      out.push(<hr key={`k${key++}`} />)
      i++
      continue
    }

    // 引用
    if (line.trim().startsWith('>')) {
      const buf = []
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''))
        i++
      }
      out.push(
        <blockquote key={`k${key++}`}>
          {buf.map((b, idx) => (
            <p key={idx}>{renderInline(b, `q${idx}`)}</p>
          ))}
        </blockquote>,
      )
      continue
    }

    // 表格
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const rows = []
      while (i < lines.length && lines[i].includes('|')) {
        rows.push(lines[i])
        i++
      }
      out.push(<Table key={`k${key++}`} rows={rows} />)
      continue
    }

    // 图片（独立行）
    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/)
    if (img) {
      out.push(
        <figure key={`k${key++}`} className="md-figure">
          <img src={img[2]} alt={img[1]} loading="lazy" />
          {img[1] && <figcaption>{img[1]}</figcaption>}
        </figure>,
      )
      i++
      continue
    }

    // 列表
    if (/^\s*[-*+]\s+/.test(line)) {
      flushList(false)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      flushList(true)
      continue
    }

    // 普通段落（合并连续非空行）
    const buf = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|```|>|\s*[-*+]\s|\s*\d+\.\s|!\[)/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|/.test(lines[i + 1]))
    ) {
      buf.push(lines[i])
      i++
    }
    out.push(<p key={`k${key++}`}>{renderInline(buf.join(' '), `p${key}`)}</p>)
  }

  return <div className="md">{out}</div>
}
