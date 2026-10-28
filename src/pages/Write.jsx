import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { gh, checkRepo, readFile, writeFile } from '../lib/github'
import { site } from '../data/posts'
import { Icon } from '../components/Icons'

const MOODS = ['平静', '开心', '有点丧', '灵光一现', '放松', '愧疚']

const today = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Write() {
  const [token, setToken] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [saved, setSaved] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [date, setDate] = useState(today())
  const [mood, setMood] = useState('平静')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = '写一条碎碎念 · 海滩长颈鹿'
    const t = gh.getToken()
    if (t) {
      setToken(t)
      setTokenDraft(t)
    }
  }, [])

  const repo = site.repo
  const canSend = useMemo(() => text.trim().length > 0 && !sending, [text, sending])

  const connect = async (e) => {
    e.preventDefault()
    const t = tokenDraft.trim()
    if (!t) return
    setError('')
    setInfo('')
    setChecking(true)
    try {
      const r = await checkRepo({ repo, token: t })
      gh.setToken(t)
      setToken(t)
      setSaved(true)
      setInfo(`已连接 ${r.fullName}${r.private ? '（私有仓库）' : ''}`)
      setTimeout(() => setSaved(false), 2400)
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const logout = () => {
    gh.clearToken()
    setToken('')
    setTokenDraft('')
    setInfo('')
    setError('')
  }

  const publish = async () => {
    if (!canSend) return
    setSending(true)
    setError('')
    try {
      const entry = `\n## ${date} | ${mood}\n${text.trim()}\n`
      const message = `moments: ${date} ${text.trim().slice(0, 18)}`

      let attempt = 0
      // 文件可能刚好被别人（或另一台设备）改过，重试一次即可
      while (attempt < 2) {
        const file = await readFile({
          repo,
          branch: site.branch,
          path: site.momentsPath,
          token,
        })
        if (!file) throw new Error('没找到 moments.md，检查路径是否正确')
        try {
          await writeFile({
            repo,
            branch: site.branch,
            path: site.momentsPath,
            token,
            text: `${file.text.trimEnd()}\n${entry}`,
            sha: file.sha,
            message,
          })
          break
        } catch (err) {
          attempt += 1
          if (attempt >= 2) throw err
        }
      }

      setDone(true)
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="write-page">
      <header className="write-header">
        <Link to="/moments" className="write-back">
          <Icon.arrowLeft />
          碎碎念
        </Link>
        <span className="write-title">写一条</span>
        {token ? (
          <button type="button" className="write-ghost" onClick={logout}>
            断开
          </button>
        ) : (
          <span className="write-ghost placeholder" />
        )}
      </header>

      {error && <div className="write-alert error">{error}</div>}
      {info && <div className="write-alert ok">{info}</div>}

      {!token ? (
        <section className="write-card">
          <h2>先连接你的 GitHub 仓库</h2>
          <p className="write-note">
            这一步只做一次。填写一个只对 <code>{repo}</code> 有写权限的 token，保存在这台设备的浏览器里，
            不会上传到任何服务器（提交时由浏览器直接发给 GitHub）。
          </p>

          <ol className="write-steps">
            <li>
              打开{' '}
              <a
                href="https://github.com/settings/personal-access-tokens/new"
                target="_blank"
                rel="noreferrer"
              >
                GitHub → 新建 Fine-grained token
              </a>
            </li>
            <li>
              仓库访问选 <b>Only select repositories</b>，勾选 <code>96_blog</code>
            </li>
            <li>
              Permissions → Repository permissions → <b>Contents</b> 设为 <b>Read and write</b>
            </li>
            <li>有效期建议 90 天，生成后复制那串 token 粘到下面</li>
          </ol>

          <form onSubmit={connect} className="write-form">
            <input
              type="password"
              className="write-input"
              placeholder="github_pat_..."
              value={tokenDraft}
              onChange={(e) => setTokenDraft(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="write-btn" disabled={checking || !tokenDraft.trim()}>
              {checking ? '验证中…' : '验证并保存'}
            </button>
          </form>
        </section>
      ) : done ? (
        <section className="write-card center">
          <div className="write-done-icon">
            <Icon.spark />
          </div>
          <h2>已提交，正在构建</h2>
          <p className="write-note">
            Cloudflare 会自动重新构建，大约 1–2 分钟后线上就能看到。刷新时记得强制刷新。
          </p>
          <p className="write-hint">
            在电脑上开发时注意：这条记录只提交到了 GitHub，本地文件还没变，先
            <code> git pull</code> 一下再改代码，否则下次推送会冲突。
          </p>
          <div className="write-actions">
            <a
              className="write-btn"
              href={`${site.siteUrl}/moments`}
              target="_blank"
              rel="noreferrer"
            >
              打开线上碎碎念
            </a>
            <button type="button" className="write-btn ghost" onClick={() => setDone(false)}>
              再写一条
            </button>
          </div>
        </section>
      ) : (
        <section className="write-card">
          <div className="write-row">
            <label className="write-label">
              日期
              <input
                type="date"
                className="write-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <div className="write-label">
              心情
              <div className="mood-picker">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={m === mood ? 'mood-btn active' : 'mood-btn'}
                    onClick={() => setMood(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <textarea
            className="write-textarea"
            placeholder="今天想到点什么……（支持换行，多条会合并成一段）"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
          />

          <div className="write-foot">
            <span className="write-count">{text.trim().length} 字</span>
            <button type="button" className="write-btn" onClick={publish} disabled={!canSend}>
              {sending ? '提交中…' : '发布'}
            </button>
          </div>

          <p className="write-hint">
            发布 = 往仓库提交一次改动，站点会自动重新部署。断网或 token 过期时会提示原因。
          </p>
        </section>
      )}
    </div>
  )
}
