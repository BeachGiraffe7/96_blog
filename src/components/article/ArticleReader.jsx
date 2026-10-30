/** Reusable reader for schemaVersion=1 articles. No editor or publishing API required. */
import { useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";
import { PDFBlock, HTMLBlock } from "./AssetBlocks";
export default function ArticleReader({
  doc,
  assets,
  urls: providedURLs,
  onPageChange,
  onNavigate,
  showHeader = true,
}) {
  const [ownURLs, setOwnURLs] = useState({}),
    [pages, setPages] = useState({});
  const refs = useRef({});
  useEffect(() => {
    if (providedURLs) return;
    const next = {};
    for (const a of Object.values(assets))
      next[a.id] = URL.createObjectURL(new Blob([a.bytes], { type: a.mime }));
    setOwnURLs(next);
    return () => Object.values(next).forEach(URL.revokeObjectURL);
  }, [assets, providedURLs]);
  const urls = providedURLs || ownURLs;
  const change = (id, page) => {
    setPages((s) => ({ ...s, [id]: page }));
    onPageChange?.(id, page);
  };
  const navigate = (assetId, page) => {
    if (onNavigate) {
      onNavigate(assetId, page);
      return;
    }
    const b = doc.blocks.find((b) => b.assetId === assetId);
    if (!b) return;
    if (b.type === "pdf") change(b.id, page);
    refs.current[b.id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const words = doc.blocks
    .filter((b) => b.type === "markdown")
    .reduce((n, b) => n + b.text.replace(/\s/g, "").length, 0);
  return (
    <article className="article-reader">
      {showHeader && (
        <header>
          <span className="reader-category">
            {doc.meta.category}
            {doc.meta.series ? " / " + doc.meta.series : ""}
          </span>
          <h1>{doc.meta.title || "尚未命名的文章"}</h1>
          {doc.meta.excerpt && (
            <p className="reader-excerpt">{doc.meta.excerpt}</p>
          )}
          <p className="reader-meta">
            {words}字正文 ·{" "}
            {doc.blocks.filter((b) => b.type !== "markdown").length}个附件模块
          </p>
        </header>
      )}
      {doc.blocks.map((b) => {
        const a = assets[b.assetId];
        return (
          <section
            key={b.id}
            ref={(el) => (refs.current[b.id] = el)}
            id={`block-${b.id}`}
            className={`reader-block reader-${b.type}`}
          >
            {b.type !== "markdown" && b.title && (
              <h2 className="block-display-title">{b.title}</h2>
            )}
            {b.type === "markdown" ? (
              <Markdown source={b.text} idPrefix={b.id + "-"} />
            ) : !a ? (
              <p role="alert">附件缺失，请联系作者。</p>
            ) : b.type === "pdf" ? (
              <PDFBlock
                asset={a}
                page={onPageChange ? b.page : pages[b.id] || b.page || 1}
                onPageChange={(p) => change(b.id, p)}
              />
            ) : b.type === "html" ? (
              <HTMLBlock
                asset={a}
                assets={assets}
                urls={urls}
                onNavigate={navigate}
              />
            ) : (
              <figure>
                <img
                  className="article-image"
                  src={urls[a.id]}
                  alt={b.alt || a.name}
                />
                {b.alt && <figcaption>{b.alt}</figcaption>}
              </figure>
            )}
          </section>
        );
      })}
    </article>
  );
}
