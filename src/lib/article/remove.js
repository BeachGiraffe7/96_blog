import { readFile, gitSnapshot, commitFiles, githubJSON } from "../github.js";
// Remove all current article files and the index entry in one commit. Git history remains.
export async function removeArticle({ repo, branch, token, slug }) {
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) throw Error("文章网址不合法。");
  const snapshot = await gitSnapshot({ repo, branch, token }),
    f = await readFile({
      repo,
      branch: snapshot.head,
      token,
      path: "src/data/livePosts.json",
    });
  const entries = JSON.parse(f?.text || "[]");
  if (!entries.some((p) => p.slug === slug))
    throw Error("文章已移除，请刷新管理列表。");
  const current = entries.find((p) => p.slug === slug);
  const files = [
    {
      path: "src/data/livePosts.json",
      text:
        JSON.stringify(
          entries.filter((p) => p.slug !== slug),
          null,
          2,
        ) + "\n",
    },
  ];
  const body = await readFile({
    repo,
    branch: snapshot.head,
    token,
    path: `src/content/notes/${slug}.md`,
  });
  if (body) files.push({ path: `src/content/notes/${slug}.md`, delete: true });
  if (current.contentType === "article-v1") {
    let treeSha = snapshot.tree;
    for (const part of ["public", "articles", slug]) {
      const tree = await githubJSON({
        repo,
        token,
        path: `git/trees/${treeSha}`,
      });
      const found = tree.tree.find((x) => x.path === part && x.type === "tree");
      if (!found) throw Error("文章附件目录不完整，未执行删除，请先检查仓库。");
      treeSha = found.sha;
    }
    const tree = await githubJSON({
      repo,
      token,
      path: `git/trees/${treeSha}?recursive=1`,
    });
    if (tree.truncated) throw Error("附件目录过大，未执行删除。");
    for (const item of tree.tree)
      if (item.type === "blob")
        files.push({
          path: `public/articles/${slug}/${item.path}`,
          delete: true,
        });
  }
  return commitFiles({
    repo,
    branch,
    token,
    snapshot,
    files,
    message: `post: 删除 ${slug}`,
  });
}
