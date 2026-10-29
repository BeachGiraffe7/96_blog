import { Link } from 'react-router-dom'
import { PageHead } from '../components/Layout'
import { posts, activeSeries, site, stats, timeline, moments } from '../data/posts'
import { Icon } from '../components/Icons'

export default function About() {
  const s = stats()
  return (
    <div className="feed">
      <PageHead title="关于" desc="这里是我的数字书房。" />

      <section className="card about-card">
        <div className="about-top">
          <div className="avatar lg with-photo">
            <img src={site.avatar} alt={site.author} />
          </div>
          <div>
            <h2 className="about-name">{site.author}</h2>
            <p className="about-tagline">{site.tagline}</p>
            <div className="about-social">
              {site.links.map((l) => {
                const Ico = Icon[l.icon]
                return (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" className="about-social-item">
                    <Ico />
                    {l.label}
                  </a>
                )
              })}
            </div>
          </div>
        </div>

        <div className="about-body">
          <p>{site.bio}</p>
          <p>
            这个站点用来放两类东西：一类是学习过程中整理出来的笔记，尽量写清楚"为什么"而不只是"是什么"；
            另一类是日记式的短记录，想到什么写什么，不做修饰。它们混在同一个列表里，按时间倒序排列。
          </p>

          <h3>现在在做</h3>
          <ul className="about-list">
            <li>跟着米醋电子的 TI M0 系列课程做电赛特训，正在调循迹环的参数。</li>
            <li>把每一讲的课程笔记整理进博客，边学边写，顺便逼自己讲清楚。</li>
            <li>在碎碎念里记录每天的心情和零碎想法。</li>
          </ul>

          <h3>学习轨迹</h3>
          <ul className="about-timeline">
            {timeline.map((t) => (
              <li key={t.time}>
                <span className="timeline-time">{t.time}</span>
                <span className="timeline-text">{t.text}</span>
              </li>
            ))}
          </ul>

          <h3>关于这个站</h3>
          <ul className="about-list">
            <li>前端：React + Vite，纯手写 CSS，没有 UI 框架。</li>
            <li>文章：Markdown 源文件直接放进项目（src/content/notes），改完即生效。</li>
            <li>版心 1700px，为 PC 端阅读设计。</li>
            <li>
              除了长文，还有 <Link to="/moments">碎碎念</Link>：不够长、但值得记下来的想法，目前已写了{' '}
              {moments.length} 条。
            </li>
          </ul>

          <div className="about-numbers">
            <div>
              <strong>{s.posts}</strong>
              <span>文章</span>
            </div>
            <div>
              <strong>{s.words.toLocaleString('en-US')}</strong>
              <span>总字数</span>
            </div>
            <div>
              <strong>{s.days}</strong>
              <span>运行天数</span>
            </div>
            <div>
              <strong>{activeSeries().length}</strong>
              <span>系列</span>
            </div>
          </div>

          <p className="about-sign">— 写于每一个想记点什么的晚上</p>
        </div>
      </section>

      <div className="about-cta">
        <Link to="/" className="btn-primary">
          去看看文章
        </Link>
        <span className="about-cta-tip">共 {posts.length} 篇，最近更新 {s.latest}</span>
      </div>
    </div>
  )
}
