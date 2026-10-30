import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { site, categories, series, allPosts } from "../data/posts";
import { readFile } from "../lib/github";
import { publishArticle, manifestPath } from "../lib/article/publish";
import { hydrateManifest, readLimited } from "../lib/article/load";
import PostComposer from "./article/PostComposer";
import "../styles/article.css";
export default function PostEditor({ token, onPublished }) {
  const [params] = useSearchParams(),
    editSlug = params.get("edit") || "";
  const loadPublished = useCallback(async () => {
    if (!token) throw Error("编辑已发布文章需要先连接GitHub。");
    if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(editSlug))
      throw Error("文章网址不合法。");
    const f = await readFile({
      repo: site.repo,
      branch: site.branch,
      path: manifestPath(editSlug),
      token,
    });
    if (!f) throw Error("未找到已发布的组合文章。");
    const m = JSON.parse(f.text),
      result = await hydrateManifest(m, async (path, size) => {
        const p = `public/articles/${editSlug}/${path}`
          .split("/")
          .map(encodeURIComponent)
          .join("/");
        return readLimited(
          await fetch(
            `https://api.github.com/repos/${site.repo}/contents/${p}?ref=${encodeURIComponent(site.branch)}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.raw+json",
              },
              signal: AbortSignal.timeout(90000),
            },
          ),
          size,
        );
      });
    result.doc.origin = { slug: editSlug, manifestSha: f.sha };
    return result;
  }, [editSlug, token]);
  const publish = useCallback(
    async (doc, assets, onProgress) => {
      if (editSlug && doc.origin?.slug !== editSlug)
        throw Error("还未正确读取原文章，请刷新后再编辑，不能覆盖现有内容。");
      if (!categories.some((c) => c.name === doc.meta.category))
        throw Error("请选择网站现有分类。");
      if (
        doc.meta.series &&
        !series.some(
          (s) => s.name === doc.meta.series && s.category === doc.meta.category,
        )
      )
        throw Error("系列不属于当前分类，请重新选择。");
      const result = await publishArticle({
        repo: site.repo,
        branch: site.branch,
        token,
        doc,
        assets,
        knownPosts: allPosts,
        onProgress,
      });
      return result;
    },
    [token, onPublished, editSlug],
  );
  return (
    <div className="article-components">
      <PostComposer
        key={editSlug}
        onPublish={token ? publish : null}
        onPublished={onPublished}
        publishTarget={`${site.repo} / ${site.branch}`}
        categoryOptions={categories}
        seriesOptions={series}
        draftKey={editSlug ? "edit:" + editSlug : "new"}
        loadPublished={editSlug ? loadPublished : null}
      />
    </div>
  );
}
