import { useContext, useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import {
  posts,
  categories,
  postsInSeries,
  formatNumber,
  readingTime,
  site,
} from "../data/posts";
import { loadBody } from "../data/bodies";
import { Icon } from "../components/Icons";
import Markdown from "../components/Markdown";
import { TocContext } from "../components/tocContext";
import { buildToc } from "../lib/toc";
import PublishedArticle from "../components/article/PublishedArticle";

export default function PostDetail() {
  const { slug } = useParams();
  const idx = posts.findIndex((p) => p.slug === slug);
  const post = posts[idx];

  // 正文单独按需加载（每篇 md 是一个独立 chunk）
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const setToc = useContext(TocContext);

  useEffect(() => {
    if (!post?.hasBody || post.contentType === "article-v1") {
      setBody("");
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    loadBody(post.slug).then((text) => {
      if (!alive) return;
      setBody(text || "");
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [post?.slug, post?.hasBody]);

  const setArticleToc = useCallback(
    (items) => {
      setLocalToc(items);
      setToc(items.length ? items : null);
    },
    [setToc],
  );

  // 目录：宽屏交给右栏卡片，窄屏用正文上方这块折叠目录（同一份数据）
  const [toc, setLocalToc] = useState([]);

  useEffect(() => {
    if (post?.contentType === "article-v1") return undefined;
    if (!body) {
      setLocalToc([]);
      setToc(null);
      return undefined;
    }
    const items = buildToc(body);
    setLocalToc(items);
    setToc(items);
    return () => setToc(null);
  }, [body, setToc, post?.contentType]);

  if (!post) {
    return (
      <div className="empty big">
        <p>这篇文章不存在</p>
        <Link to="/" className="empty-link">
          回到主页
        </Link>
      </div>
    );
  }

  const cat = categories.find((c) => c.name === post.category);
  // 属于某个系列时，底部导航走系列内顺序（第 N 讲 → 第 N+1 讲），
  // 否则按全站时间线走
  const siblings = post.series ? postsInSeries(post.series) : [];
  const inSeries = siblings.findIndex((p) => p.slug === post.slug);
  const useSeries = inSeries >= 0 && siblings.length > 1;
  const prev = useSeries ? siblings[inSeries - 1] : posts[idx + 1];
  const next = useSeries ? siblings[inSeries + 1] : posts[idx - 1];

  return (
    <article className="article">
      <Link to="/" className="article-back">
        <Icon.arrowLeft />
        返回列表
      </Link>

      <div className="card article-card">
        <div className="post-head">
          <span className="cat-badge" style={{ background: cat?.color }}>
            {cat?.letter}
          </span>
          <Link
            to={`/category/${encodeURIComponent(post.category)}`}
            className="cat-name"
          >
            {post.category}
          </Link>
          {post.series && (
            <Link
              to={`/series/${encodeURIComponent(post.series)}`}
              className="post-series"
            >
              <Icon.layers />
              {post.series}
            </Link>
          )}
        </div>

        <h1 className="article-title">{post.title}</h1>

        <div className="post-meta article-meta">
          <span>
            <Icon.calendar />
            {post.date}
          </span>
          <span>
            <Icon.eye />
            {formatNumber(post.views)} 次阅读
          </span>
          <span>
            <Icon.text />
            {formatNumber(post.words)} 字
          </span>
          <span>
            <Icon.clock />约 {readingTime(post.words)} 分钟
          </span>
        </div>

        <div className="article-divider" />

        {/* 窄屏（右栏隐藏时）用的折叠目录 */}
        {toc.length > 1 && (
          <details className="toc-inline">
            <summary>
              <Icon.text />
              本页目录 · {toc.length} 节
            </summary>
            <nav className="toc-inline-nav">
              {toc.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`toc-link level-${item.level}`}
                  title={item.text}
                >
                  {item.text}
                </a>
              ))}
            </nav>
          </details>
        )}

        <div className="article-content">
          {post.contentType === "article-v1" ? (
            <PublishedArticle slug={post.slug} onToc={setArticleToc} />
          ) : post.hasBody ? (
            loading ? (
              <p className="article-loading">正在加载正文…</p>
            ) : body ? (
              <Markdown source={body} />
            ) : (
              <p className="article-loading">正文加载失败，刷新试试。</p>
            )
          ) : (
            post.content.map((b, i) => {
              if (b.type === "h2") return <h2 key={i}>{b.text}</h2>;
              if (b.type === "quote")
                return <blockquote key={i}>{b.text}</blockquote>;
              return <p key={i}>{b.text}</p>;
            })
          )}
        </div>

        <div className="article-foot">
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
          <span className="article-author">
            作者 {site.author} · 转载请注明出处
          </span>
        </div>
      </div>

      <nav className="article-nav">
        {prev ? (
          <Link to={`/post/${prev.slug}`} className="article-nav-item">
            <span className="article-nav-label">
              {useSeries ? "← 系列上一篇" : "← 上一篇"}
            </span>
            <span className="article-nav-title">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/post/${next.slug}`} className="article-nav-item right">
            <span className="article-nav-label">
              {useSeries ? "系列下一篇 →" : "下一篇 →"}
            </span>
            <span className="article-nav-title">{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
