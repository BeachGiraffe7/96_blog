import { useEffect, useRef, useState } from 'react'
import { categories, site } from '../data/posts'
import { readFile, writeFile } from '../lib/github'
import { htmlToMarkdown, looksRich } from '../lib/htmlToMarkdown'
import Markdown from './Markdown'
import { Icon } from './Icons'

const p2 = (n) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
}

const autoSlug = (title) => {
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (ascii.length >= 3) return ascii.slice(0, 60)
  const d = new Date()
  return `post-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}`
}

const autoExcerpt = (md) =>
  md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)

// 导入 .md 时如果带 frontmatter，顺手填进表单
const splitFrontMatter = (text) => {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!m) return { meta: null, body: text }
  const meta = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z]+)\s*:\s*(.*)$/)
    if (!kv) continue
    meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
  }
  return { meta, body: text.slice(m[0].length) }
}

export default function PostEditor({ token, onPublished }) {
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [category, setCategory] = useState(categories[0]?.name || '技术')
  const [tagText, setTagText] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const areaRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!slugEdited && title.trim()) setSlug(autoSlug(title))
  }, [title, slugEdited])

  const tags = tagText
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)

  const words = body.replace(/\s/g, '').length
  const ready = title.trim() && body.trim() && slug.trim() && !publishing

  const insert = (text) => {
    const el = areaRef.current
    if (!el) {
      setBody((b) => `${b}${text}`)
      return
    }
    const start = el.selectionStart ?? body.length
    const end = el.selectionEnd ?? body.length
    const next = body.slice(0, start) + text + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + text.length
      el.setSelectionRange(pos, pos)
    })
  }

  // 从飞书/网页复制的内容带 HTML，自动转成 Markdown
  const onPaste = (e) => {
    const html = e.clipboardData?.getData('text/html')
    if (html && looksRich(html)) {
      e.preventDefault()
      const md = htmlToMarkdown(html)
      if (md) {
        insert(md)
        setNotice('已把粘贴的富文本转成 Markdown，检查一下标题层级和图片')
        setTimeout(() => setNotice(''), 6000)
      }
    }
  }

  const onImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const raw = String(reader.result || '')
      const { meta, body: content } = splitFrontMatter(raw)
      setBody(content.trim())
      if (meta?.title) setTitle(meta.title)
      if (meta?.date) setNotice(`导入完成（frontmatter 里的日期是 ${meta.date}）`)
      else setNotice(`已导入 ${file.name}`)
      if (meta?.category) setCategory(meta.category)
      if (meta?.tags) setTagText(meta.tags.replace(/^\[|\]$/g, '').replace(/["']/g, ''))
      if (meta?.excerpt || meta?.description) setExcerpt(meta.excerpt || meta.description)
      setTimeout(() => setNotice(''), 5000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const publish = async () => {
    if (!ready) return
    setPublishing(true)
    setError('')
    setNotice('')
    const path = `src/content/notes/${slug}.md`
    try {
      // 1) 正文
      const exist = await readFile({ repo: site.repo, branch: site.branch, path, token })
      await writeFile({
        repo: site.repo,
        branch: site.branch,
        path,
        token,
        text: body.trimEnd() + '\n',
        sha: exist?.sha,
        message: `post: ${title.trim()}`,
      })

      // 2) 元信息
      const entry = {
        slug,
        title: title.trim(),
        category,
        date: today(),
        views: 0,
        words,
        tags,
        excerpt: excerpt.trim() || autoExcerpt(body),
        hasBody: true,
        cover: '',
      }
      let attempt = 0
      while (attempt < 2) {
        const f = await readFile({
          repo: site.repo,
          branch: site.branch,
          path: 'src/data/livePosts.json',
          token,
        })
        const list = f ? JSON.parse(f.text || '[]') : []
        const next = [entry, ...list.filter((p) => p.slug !== slug)]
        try {
          await writeFile({
            repo: site.repo,
            branch: site.branch,
            path: 'src/data/livePosts.json',
            token,
            text: `${JSON.stringify(next, null, 2)}\n`,
            sha: f?.sha,
            message: `post: ${title.trim()}`,
          })
          break
        } catch (err) {
          attempt += 1
          if (attempt >= 2) throw err
        }
      }

      onPublished({ slug, title: title.trim() })
    } catch (err) {
      setError(err.message || '发布失败')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <>
      {error && <div className="write-alert error">{error}</div>}
      {notice && <div className="write-alert ok">{notice}</div>}

      <section className="write-card">
        <div className="pe-meta">
          <label className="write-label">
            标题
            <input
              className="write-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="这篇文章叫什么"
            />
          </label>

          <div className="write-row">
            <label className="write-label">
              分类
              <select
                className="write-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="write-label">
              网址尾段
              <input
                className="write-input"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.replace(/[^\w-]/g, '-').toLowerCase())
                  setSlugEdited(true)
                }}
                placeholder="post-20261029"
              />
            </label>
          </div>

          <label className="write-label">
            标签（逗号分隔）
            <input
              className="write-input"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              placeholder="嵌入式, MSPM0, 笔记"
            />
          </label>

          <label className="write-label">
            摘要（留空自动取正文开头）
            <input
              className="write-input"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="列表页显示的那一两句"
            />
          </label>
        </div>

        <div className="pe-toolbar">
          <span className="pe-tool-label">正文</span>
          <div className="pe-tools">
            <button type="button" className="pe-tool" onClick={() => fileRef.current?.click()}>
              <Icon.arrowUp /> 导入 .md
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt"
              onChange={onImport}
              hidden
            />
            <button
              type="button"
              className={preview ? 'pe-tool active' : 'pe-tool'}
              onClick={() => setPreview((v) => !v)}
              disabled={!body.trim()}
            >
              {preview ? '继续写' : '预览'}
            </button>
          </div>
        </div>

        {preview ? (
          <div className="pe-preview article-content">
            <Markdown source={body} />
          </div>
        ) : (
          <textarea
            ref={areaRef}
            className="write-textarea pe-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onPaste={onPaste}
            placeholder={
              '直接从飞书复制正文粘进来，会自动转成 Markdown。\n\n也可以拖一个 .md 文件进来（点上面的「导入 .md」）。'
            }
            rows={18}
          />
        )}

        <div className="write-foot">
          <span className="write-count">
            {words} 字
            {tags.length > 0 && ` · ${tags.length} 个标签`}
          </span>
          <button type="button" className="write-btn" onClick={publish} disabled={!ready}>
            {publishing ? '发布中…' : '发布文章'}
          </button>
        </div>

        <p className="write-hint">
          发布会往仓库写两个文件：<code>src/content/notes/{slug || '…'}.md</code> 和{' '}
          <code>src/data/livePosts.json</code>，然后站点自动重新构建。
        </p>
      </section>
    </>
  )
}
