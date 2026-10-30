import { useEffect, useState } from "react";
import ArticleReader from "./ArticleReader";
import { loadPublicArticle } from "../../lib/article/load";
import { articleToc } from "../../lib/article/toc";
import "../../styles/article.css";
export default function PublishedArticle({ slug, onToc }) {
  const [content, setContent] = useState(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setContent(null);
    setError("");
    onToc([]);
    loadPublicArticle(slug, c.signal)
      .then((r) => {
        if (c.signal.aborted) return;
        setContent(r);
        onToc(articleToc(r.doc));
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message || "文章读取失败。");
      });
    return () => {
      c.abort();
      onToc([]);
    };
  }, [slug, retry, onToc]);
  if (error)
    return (
      <div className="write-alert error article-components-error" role="alert">
        <p>{error} 可能仍在部署，请稍后重试。</p>
        <button
          className="write-btn ghost"
          onClick={() => setRetry((n) => n + 1)}
        >
          重新加载文章
        </button>
      </div>
    );
  if (!content)
    return (
      <p className="article-loading" role="status">
        正在加载正文与附件…
      </p>
    );
  return (
    <div className="article-components">
      <ArticleReader
        doc={content.doc}
        assets={content.assets}
        showHeader={false}
      />
    </div>
  );
}
