import { Link, useParams, useSearchParams } from 'react-router-dom'
import PostCard from '../components/PostCard'
import { posts, categories, seriesInCategory, seriesCount } from '../data/posts'
import { Icon } from '../components/Icons'

// mode: 'all' 首页 | 'category' 分类 | 'tag' 标签
export default function Home({ mode = 'all' }) {
  const { name } = useParams()
  const [sp] = useSearchParams()
  const q = (sp.get('q') || '').trim().toLowerCase()

  let list = [...posts].sort((a, b) => b.date.localeCompare(a.date))
  if (mode === 'category' && name) list = list.filter((p) => p.category === name)
  if (mode === 'tag' && name) list = list.filter((p) => p.tags.includes(name))
  if (q)
    list = list.filter((p) =>
      [p.title, p.excerpt, p.category, ...p.tags].join(' ').toLowerCase().includes(q),
    )

  const filtered = Boolean((name && mode !== 'all') || q)
  const cat = mode === 'category' && name ? categories.find((c) => c.name === name) : null
  // 分类页顶部列出这个方向下的系列，等于「分类 → 系列」的第二层入口
  const subs = mode === 'category' && name ? seriesInCategory(name) : []

  const label = cat
    ? `分类：${cat.name}`
    : mode === 'tag' && name
      ? `标签：#${name}`
      : `搜索：“${sp.get('q')}”`

  return (
    <div className="feed">
      {filtered ? (
        <div className="filter-banner">
          <div className="filter-banner-main">
            {cat && (
              <span className="cat-badge" style={{ background: cat.color }}>
                {cat.letter}
              </span>
            )}
            <span className="filter-banner-text">{label}</span>
            <span className="filter-banner-count">{list.length} 篇</span>
          </div>
          <Link to="/" className="filter-clear">
            清除筛选
          </Link>
        </div>
      ) : (
        <div className="list-head">
          <span className="side-card-bar" />
          <h2>最新文章</h2>
          <span className="list-head-count">共 {posts.length} 篇</span>
        </div>
      )}

      {subs.length > 0 && (
        <div className="series-strip">
          <span className="series-strip-label">系列</span>
          {subs.map((s) => (
            <Link
              key={s.name}
              to={`/series/${encodeURIComponent(s.name)}`}
              className="series-chip"
            >
              <Icon.layers />
              {s.name}
              <span className="series-chip-count">{seriesCount(s.name)}</span>
            </Link>
          ))}
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <Icon.search />
          <p>{mode === 'tag' ? '这个标签下还没有文章' : '没有找到相关的文章'}</p>
          <Link to="/" className="empty-link">
            回到全部文章
          </Link>
        </div>
      ) : (
        <div className="post-list">
          {list.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      )}
    </div>
  )
}
