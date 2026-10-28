import { Link } from 'react-router-dom'
import { PageHead } from '../components/Layout'
import { moments, stats } from '../data/posts'
import { Icon } from '../components/Icons'

const moodColor = {
  开心: '#5aab7f',
  平静: '#7f98c9',
  有点丧: '#9d959f',
  灵光一现: '#c98ab0',
  放松: '#5fa89b',
  愧疚: '#b3829d',
}

export default function Moments() {
  const list = [...moments].sort((a, b) => b.date.localeCompare(a.date))
  const s = stats()

  return (
    <div className="feed">
      <PageHead
        title="碎碎念"
        desc="不够长、但值得记下来的想法都在这里。"
        count={moments.length}
        action={
          <Link to="/write" className="page-action">
            <Icon.spark />
            写一条
          </Link>
        }
      />

      <div className="card moments-card">
        <div className="moments-summary">
          <span>
            <Icon.spark />
            已记录 {moments.length} 条想法
          </span>
          <span>最近一条 {list[0]?.date}</span>
        </div>

        <div className="moments-timeline">
          {list.map((m) => {
            const color = moodColor[m.mood] || '#b3829d'
            return (
              <div key={m.date} className="moment-item">
                <span className="moment-date">{m.date.slice(5)}</span>
                <div className="moment-body">
                  <div className="moment-head">
                    <span className="mood-chip" style={{ color, background: `${color}1c` }}>
                      {m.mood}
                    </span>
                  </div>
                  <p className="moment-text">{m.text}</p>
                </div>
              </div>
            )
          })}
        </div>

        <p className="moments-note">
          共 {moments.length} 条 · 全站 {s.posts} 篇文章 ·{' '}
          <Link to="/" className="moments-home-link">
            回到文章列表
          </Link>
        </p>
      </div>
    </div>
  )
}
