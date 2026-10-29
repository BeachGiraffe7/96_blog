import { useCallback, useEffect, useRef, useState } from 'react'
import { site, allPosts, livePosts, hiddenSlugs, moments as bundledMoments } from '../data/posts'
import { readFile } from '../lib/github'
import { parseMoments } from '../lib/moments'
import { deleteMoment, deleteLivePost, hidePost, unhidePost } from '../lib/manage'
import { Icon } from './Icons'

const isLive = (slug) => livePosts.some((p) => p.slug === slug)

export default function ManagePanel({ token }) {
  const [moments, setMoments] = useState(bundledMoments)
  const [live, setLive] = useState(livePosts)
  const [hidden, setHidden] = useState(hiddenSlugs)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [confirmKey, setConfirmKey] = useState('')
  const timer = useRef(0)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError('')
    try {
      const [m, l, h] = await Promise.all([
        readFile({ repo: site.repo, branch: site.branch, path: site.momentsPath, token }),
        readFile({ repo: site.repo, branch: site.branch, path: site.livePostsPath, token }),
        readFile({ repo: site.repo, branch: site.branch, path: site.hiddenPath, token }),
      ])
      setMoments(m ? parseMoments(m.text) : [])
      setLive(l ? JSON.parse(l.text || '[]') : [])
      setHidden(h ? JSON.parse(h.text || '[]') : [])
    } catch (err) {
      // 读不到就退回上次构建时的数据，至少还能看
      setError(`读取仓库失败：${err.message}。下面显示的是上次构建的数据。`)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const flash = (msg) => {
    setInfo(msg)
    window.setTimeout(() => setInfo(''), 6000)
  }

  // 两次点击才真删：第一次把按钮变成「确认删除」，3 秒不点自动还原
  const ask = (key, action) => {
    if (confirmKey === key) {
      setConfirmKey('')
      window.clearTimeout(timer.current)
      action()
      return
    }
    setConfirmKey(key)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setConfirmKey(''), 3000)
  }

  const run = async (key, label, fn) => {
    setBusy(key)
    setError('')
    try {
      await fn()
      flash(`${label}已提交，1–2 分钟后线上生效`)
    } catch (err) {
      setError(err.message || '操作失败')
    } finally {
      setBusy('')
    }
  }

  const removeMoment = (moment) =>
    run(`m:${moment.date}:${moment.text.slice(0, 12)}`, '删除', async () => {
      await deleteMoment({ token, moment })
      setMoments((list) =>
        list.filter((m) => !(m.date === moment.date && m.text === moment.text)),
      )
    })

  const removePost = (post) =>
    run(`p:${post.slug}`, '删除', async () => {
      await deleteLivePost({ token, post })
      setLive((list) => list.filter((p) => p.slug !== post.slug))
    })

  const hide = (post) =>
    run(`h:${post.slug}`, '下线', async () => {
      await hidePost({ token, post })
      setHidden((list) => [...list, post.slug])
    })

  const restore = (post) =>
    run(`r:${post.slug}`, '恢复', async () => {
      await unhidePost({ token, post })
      setHidden((list) => list.filter((s) => s !== post.slug))
    })

  const shownMoments = [...moments].sort((a, b) => (a.date < b.date ? 1 : -1))
  const staticList = allPosts.filter((p) => !isLive(p.slug) && !hidden.includes(p.slug))
  const hiddenList = hidden.map((slug) => allPosts.find((p) => p.slug === slug) || { slug })

  if (loading && !moments.length && !live.length) {
    return (
      <section className="write-card">
        <p className="write-note">正在读取仓库里的内容…</p>
      </section>
    )
  }

  return (
    <section className="write-card manage-card">
      <div className="manage-head">
        <div>
          <h2>管理内容</h2>
          <p className="write-note">
            删除会往仓库提交一次改动，站点自动重新构建。列表直接读仓库，不是本地缓存。
          </p>
        </div>
        <button type="button" className="write-btn ghost sm" onClick={load} disabled={loading}>
          {loading ? '读取中…' : '刷新'}
        </button>
      </div>

      {error && <div className="write-alert error">{error}</div>}
      {info && <div className="write-alert ok">{info}</div>}

      <div className="manage-group">
        <h3>
          碎碎念 <span className="manage-count">{moments.length}</span>
        </h3>
        {moments.length === 0 ? (
          <p className="manage-empty">还没有碎碎念。</p>
        ) : (
          <ul className="manage-list">
            {shownMoments.map((m) => {
              const key = `m:${m.date}:${m.text.slice(0, 12)}`
              return (
                <li key={key} className="manage-item">
                  <div className="manage-main">
                    <span className="manage-meta">
                      {m.date} · {m.mood}
                    </span>
                    <p className="manage-text">{m.text}</p>
                  </div>
                  <button
                    type="button"
                    className={confirmKey === key ? 'manage-btn danger solid' : 'manage-btn danger'}
                    disabled={busy === key}
                    onClick={() => ask(key, () => removeMoment(m))}
                  >
                    {busy === key ? '删除中…' : confirmKey === key ? '确认删除' : '删除'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="manage-group">
        <h3>
          网页发布的文章 <span className="manage-count">{live.length}</span>
        </h3>
        {live.length === 0 ? (
          <p className="manage-empty">还没有通过写作页发布的文章。</p>
        ) : (
          <ul className="manage-list">
            {live.map((p) => (
              <li key={p.slug} className="manage-item">
                <div className="manage-main">
                  <span className="manage-meta">
                    {p.date} · {p.category}
                  </span>
                  <p className="manage-title">{p.title}</p>
                </div>
                <button
                  type="button"
                  className={
                    confirmKey === `p:${p.slug}` ? 'manage-btn danger solid' : 'manage-btn danger'
                  }
                  disabled={busy === `p:${p.slug}`}
                  onClick={() => ask(`p:${p.slug}`, () => removePost(p))}
                >
                  {busy === `p:${p.slug}`
                    ? '删除中…'
                    : confirmKey === `p:${p.slug}`
                      ? '确认删除'
                      : '删除'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="manage-tip">删除会同时移除正文文件，恢复需要到 GitHub 的提交历史里找。</p>
      </div>

      <div className="manage-group">
        <h3>
          仓库里的笔记 <span className="manage-count">{staticList.length}</span>
        </h3>
        <ul className="manage-list">
          {staticList.map((p) => (
            <li key={p.slug} className="manage-item">
              <div className="manage-main">
                <span className="manage-meta">
                  {p.date} · {p.category}
                </span>
                <p className="manage-title">{p.title}</p>
              </div>
              <button
                type="button"
                className={
                  confirmKey === `h:${p.slug}` ? 'manage-btn solid' : 'manage-btn ghost'
                }
                disabled={busy === `h:${p.slug}`}
                onClick={() => ask(`h:${p.slug}`, () => hide(p))}
              >
                {busy === `h:${p.slug}`
                  ? '下线中…'
                  : confirmKey === `h:${p.slug}`
                    ? '确认下线'
                    : '下线'}
              </button>
            </li>
          ))}
        </ul>
        <p className="manage-tip">
          这些是从本地写进仓库的原始笔记，所以只「下线」不删除：正文文件保留，随时能恢复。
        </p>
      </div>

      {hiddenList.length > 0 && (
        <div className="manage-group">
          <h3>
            已下线 <span className="manage-count">{hiddenList.length}</span>
          </h3>
          <ul className="manage-list">
            {hiddenList.map((p) => (
              <li key={p.slug} className="manage-item off">
                <div className="manage-main">
                  <span className="manage-meta">{p.date || '—'}</span>
                  <p className="manage-title">{p.title || p.slug}</p>
                </div>
                <button
                  type="button"
                  className="manage-btn"
                  disabled={busy === `r:${p.slug}`}
                  onClick={() => restore(p)}
                >
                  {busy === `r:${p.slug}` ? '恢复中…' : '恢复'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="write-hint">
        <Icon.trash /> 碎碎念和网页文章是「真删除」，仓库笔记是「下线」。两种都会让站点在 1–2
        分钟后同步，记得强刷。
      </p>
    </section>
  )
}
