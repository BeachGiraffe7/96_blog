import { readFile, gitSnapshot, commitFiles } from "../github.js";
import { validateManifest } from "./load.js";
import {
  assetPath,
  articleManifest,
  validateArticle,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from "./article.js";
export const manifestPath = (slug) => `public/articles/${slug}/article.json`;
const day = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const cleanSlug = (s) => {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(s)) throw Error("文章网址不合法。");
  return s;
};
export function markdownFallback(doc, assets) {
  return (
    doc.blocks
      .map((b) =>
        b.type === "markdown"
          ? b.text
          : `[${b.title || assets[b.assetId]?.name || "附件"}](/articles/${doc.meta.slug}/${assets[b.assetId] ? assetPath(assets[b.assetId]) : ""})`,
      )
      .join("\n\n") + "\n"
  );
}
export async function publishArticle({
  repo,
  branch,
  token,
  doc,
  assets,
  knownPosts = [],
  onProgress,
}) {
  if (!token) throw Error("发布前请连接GitHub；正文与附件仍保存在本机草稿。");
  const problems = validateArticle(doc, assets);
  if (problems.length) throw Error(problems.join(" "));
  const slug = cleanSlug(doc.meta.slug),
    all = Object.values(assets);
  if (
    all.some((a) => a.size > MAX_FILE_BYTES) ||
    all.reduce((n, a) => n + a.size, 0) > MAX_TOTAL_BYTES
  )
    throw Error("附件超过允许大小。");
  const manifest = articleManifest(doc, assets);
  delete manifest.origin;
  validateManifest(manifest);
  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  if (new TextEncoder().encode(manifestText).byteLength > 2 * 1024 * 1024)
    throw Error("文章清单超过2MB，请拆分文字内容。");
  const snapshot = await gitSnapshot({ repo, branch, token });
  const liveFile = await readFile({
    repo,
    branch: snapshot.head,
    token,
    path: "src/data/livePosts.json",
  });
  const live = JSON.parse(liveFile?.text || "[]");
  if (!Array.isArray(live)) throw Error("文章目录格式不正确。");
  const current = await readFile({
    repo,
    branch: snapshot.head,
    token,
    path: manifestPath(slug),
  });
  const body = await readFile({
    repo,
    branch: snapshot.head,
    token,
    path: `src/content/notes/${slug}.md`,
  });
  const previous = live.find((p) => p.slug === slug);
  if (doc.origin?.manifestSha) {
    if (
      doc.origin.slug !== slug ||
      current?.sha !== doc.origin.manifestSha ||
      previous?.contentType !== "article-v1"
    )
      throw Error("这篇文章已变更或网址已修改，请从管理页重新打开后编辑。");
  } else if (
    current ||
    body ||
    previous ||
    knownPosts.some((p) => p.slug === slug)
  )
    throw Error(
      "这个网址已有文章，请换一个网址；编辑已发布组合文章请从管理页进入，避免意外覆盖。",
    );
  const tags = [...new Set(doc.meta.tags.split(/[,，\s]+/).filter(Boolean))];
  const words = doc.blocks
    .filter((b) => b.type === "markdown")
    .reduce((n, b) => n + b.text.replace(/\s/g, "").length, 0);
  const entry = {
    slug,
    title: doc.meta.title.trim(),
    category: doc.meta.category,
    ...(doc.meta.series ? { series: doc.meta.series } : {}),
    date: previous?.date || day(),
    views: previous?.views || 0,
    words,
    tags,
    excerpt:
      doc.meta.excerpt.trim() ||
      doc.blocks
        .filter((b) => b.type === "markdown")
        .map((b) => b.text)
        .join(" ")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/[#*`>]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90),
    hasBody: true,
    cover: previous?.cover || "",
    contentType: "article-v1",
    articlePath: `/articles/${slug}/article.json`,
  };
  const files = [
    ...all.map((a) => ({
      path: `public/articles/${slug}/${assetPath(a)}`,
      bytes: a.bytes,
    })),
    { path: manifestPath(slug), text: manifestText },
    {
      path: `src/content/notes/${slug}.md`,
      text: markdownFallback(doc, assets),
    },
    {
      path: "src/data/livePosts.json",
      text:
        JSON.stringify(
          [entry, ...live.filter((p) => p.slug !== slug)],
          null,
          2,
        ) + "\n",
    },
  ];
  const result = await commitFiles({
    repo,
    branch,
    token,
    snapshot,
    files,
    message: `post: ${doc.meta.title.trim()}`,
    onProgress,
  });
  return { ...result, slug, title: entry.title };
}
