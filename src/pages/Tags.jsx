import { Link } from 'react-router-dom'
import { PageHead } from '../components/Layout'
import { allTags } from '../data/posts'

export default function Tags() {
  const tags = allTags()
  const max = Math.max(...tags.map((t) => t.count))
  const size = (n) => 0.94 + (n / max) * 0.55

  return (
    <div className="feed">
      <PageHead title="标签" desc="零散的记录，靠标签串起来。" count={tags.length} />

      <div className="card tag-page-card">
        <div className="tag-page-cloud">
          {tags.map((t) => (
            <Link
              key={t.name}
              to={`/tag/${encodeURIComponent(t.name)}`}
              className="tag-pill lg"
              style={{ fontSize: `${size(t.count)}rem` }}
            >
              {t.name}
              <span className="tag-pill-count">{t.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
