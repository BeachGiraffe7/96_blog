import { Link } from 'react-router-dom'
import { Icon } from './Icons'
import { categories, formatNumber, readingTime } from '../data/posts'

const catMeta = (name) =>
  categories.find((c) => c.name === name) || { letter: '•', color: '#f2a3bd' }

export default function PostCard({ post, compact = false, showTags = true }) {
  const cat = catMeta(post.category)
  return (
    <article className={compact ? 'post-card compact' : 'post-card'}>
      <div className="post-body">
        <div className="post-head">
          <span className="cat-badge" style={{ background: cat.color }}>
            {cat.letter}
          </span>
          <Link
            to={`/category/${encodeURIComponent(post.category)}`}
            className="cat-name"
          >
            {post.category}
          </Link>
          {post.series && (
            <span className="post-series">
              <Icon.layers />
              {post.series}
            </span>
          )}
        </div>

        <h2 className="post-title">
          <Link to={`/post/${post.slug}`}>{post.title}</Link>
        </h2>

        <div className="post-meta">
          <span>
            <Icon.calendar />
            {post.date}
          </span>
          <span>
            <Icon.eye />
            {formatNumber(post.views)}
          </span>
          <span>
            <Icon.text />
            {formatNumber(post.words)} 字
          </span>
          <span>
            <Icon.clock />
            {readingTime(post.words)} 分钟
          </span>
        </div>

        {!compact && <p className="post-excerpt">{post.excerpt}</p>}

        {showTags && (
          <div className="post-tags">
            {post.tags.map((t) => (
              <Link
                key={t}
                to={`/tag/${encodeURIComponent(t)}`}
                className="post-tag"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}
      </div>

      {post.cover && !compact && (
        <Link
          to={`/post/${post.slug}`}
          className={`post-cover cover-${post.cover}`}
          aria-hidden="true"
        >
          <span className="cover-glow" />
          <span className="cover-grain" />
        </Link>
      )}

      <Link
        to={`/post/${post.slug}`}
        className="post-arrow"
        aria-label="阅读全文"
      >
        <Icon.chevron />
      </Link>
    </article>
  )
}
