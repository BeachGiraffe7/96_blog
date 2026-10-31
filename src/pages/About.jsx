import { Link } from 'react-router-dom'
import { site } from '../data/posts'
import { Icon } from '../components/Icons'
import '../styles/about.css'

const entries = [
  {
    to: '/archive',
    number: '01',
    title: '学习笔记',
    detail: '整理学过的知识、做过的尝试，让零散的内容有个可以回看的地方。',
    action: '浏览文章',
  },
  {
    to: '/moments',
    number: '02',
    title: '碎碎念',
    detail: '不一定要写成长文。一段想法、一个问题，也可以先记下来。',
    action: '看看短记录',
  },
  {
    to: '/growth',
    number: '03',
    title: '成长手记',
    detail: '记录每日学习与长期计划，导出一周记录，再借助 AI 整理复盘。',
    action: '进入私密专栏',
    private: true,
  },
]

export default function About() {
  return (
    <div className="about-journal">
      <div className="about-breadcrumb">
        <span>ABOUT / 关于</span>
        <Link to="/">返回主页 ↗</Link>
      </div>
      <section className="about-intro" aria-labelledby="about-title">
        <div className="about-intro-copy">
          <p className="about-kicker">你好，这里是{site.author}。</p>
          <h1 id="about-title">
            记录学过的，
            <br />
            也留下还没想明白的。
          </h1>
          <p className="about-lead">
            学习笔记、零碎想法，还有每天一点点的积累。
            <br className="about-desktop-break" />
            这个站点，把它们放在一起。
          </p>
        </div>
        <figure className="about-portrait">
          <img
            src={site.avatar}
            alt="海滩长颈鹿的站点头像：戴草帽的玩偶，身后是海"
            width="240"
            height="240"
          />
          <figcaption>
            <span>{site.author}</span>
            <span>{site.tagline}</span>
          </figcaption>
        </figure>
      </section>
      <section className="about-start" aria-labelledby="about-start-title">
        <div className="about-start-date">
          <span>站点正式上线</span>
          <time dateTime={site.since}>2026.10.28</time>
        </div>
        <div>
          <h2 id="about-start-title">从这一天开始，有了自己的记录空间。</h2>
          <p>
            这里的上线日期从 10 月 28
            日算起。笔记可以写于更早的时候，但那不代表站点已经运行了那么久。
          </p>
        </div>
      </section>
      <section
        className="about-contents"
        aria-labelledby="about-contents-title"
      >
        <div className="about-section-heading">
          <p className="about-kicker">在这里，可以看到什么</p>
          <h2 id="about-contents-title">长一点，短一点，都有去处。</h2>
        </div>
        <div className="about-entry-list">
          {entries.map((entry) => (
            <Link to={entry.to} key={entry.to} className="about-entry">
              <span className="about-entry-number">{entry.number}</span>
              <div>
                <h3>
                  {entry.title}
                  {entry.private && (
                    <span className="about-private">
                      <Icon.lock />
                      私密
                    </span>
                  )}
                </h3>
                <p>{entry.detail}</p>
              </div>
              <span className="about-entry-action">
                {entry.action}
                <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="about-closing" aria-labelledby="about-closing-title">
        <p className="about-kicker">写在最后</p>
        <h2 id="about-closing-title">不急着把“关于我”写完整。</h2>
        <p>
          先让笔记和记录慢慢补上。比起一份完整的自我介绍，更希望以后回到这里时，还能看见当时学了什么、卡在哪里，又往前走了哪一步。
        </p>
        <div className="about-closing-links">
          <Link to="/">
            从最近的文章开始 <span aria-hidden="true">→</span>
          </Link>
          <a
            href={`https://github.com/${site.repo}`}
            target="_blank"
            rel="noreferrer"
          >
            站点源码 ↗
          </a>
        </div>
      </section>
    </div>
  )
}
