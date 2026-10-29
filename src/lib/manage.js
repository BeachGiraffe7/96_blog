// 删除 / 下线 / 恢复：全部通过 GitHub API 提交，没有后端
//
// 三种内容，处理方式不同，是因为「能不能恢复」的代价不同：
//   · 碎碎念   → 真删（改 moments.md），恢复靠 git 历史
//   · 网页发布的文章 → 真删（livePosts.json 去掉条目 + 删掉正文 md）
//   · 仓库里的笔记   → 只下线（写进 hidden.json），正文保留，随时可恢复
//     这类是手写并纳入版本管理的原始笔记，误删代价太高，所以不给「删除」按钮

import { site, livePosts } from '../data/posts'
import { readFile, deleteFile, updateText } from './github'
import { removeMomentBlock, normText } from './moments'
import { removeLiveEntry, addHidden, removeHidden } from './listOps'

export const isLivePost = (slug) => livePosts.some((p) => p.slug === slug)

// ---------- 碎碎念 ----------

export async function deleteMoment({ token, moment }) {
  return updateText({
    repo: site.repo,
    branch: site.branch,
    path: site.momentsPath,
    token,
    message: `moments: 删除 ${moment.date} ${normText(moment.text).slice(0, 16)}`,
    update: (raw) => removeMomentBlock(raw, moment),
  })
}

// ---------- 网页发布的文章：先摘掉条目，再删正文 ----------
// 顺序不能反：先删正文、后改 json 的话，中间那几秒读者会看到一篇空文章

export async function deleteLivePost({ token, post }) {
  await updateText({
    repo: site.repo,
    branch: site.branch,
    path: site.livePostsPath,
    token,
    message: `post: 删除 ${post.title}`,
    update: (raw) => removeLiveEntry(raw, post.slug),
  })

  // 正文删除失败不影响「已从站点消失」，只是仓库里留个孤儿文件
  const path = `src/content/notes/${post.slug}.md`
  try {
    const file = await readFile({ repo: site.repo, branch: site.branch, path, token })
    if (file) {
      await deleteFile({
        repo: site.repo,
        branch: site.branch,
        path,
        token,
        sha: file.sha,
        message: `post: 删除正文 ${post.slug}`,
      })
    }
  } catch {
    /* 忽略：条目已移除，文章已不可见 */
  }
}

// ---------- 仓库里的笔记：只下线 ----------

export async function hidePost({ token, post }) {
  return updateText({
    repo: site.repo,
    branch: site.branch,
    path: site.hiddenPath,
    token,
    message: `post: 下线 ${post.title}`,
    update: (raw) => addHidden(raw, post.slug),
  })
}

export async function unhidePost({ token, post }) {
  return updateText({
    repo: site.repo,
    branch: site.branch,
    path: site.hiddenPath,
    token,
    message: `post: 恢复 ${post.title}`,
    update: (raw) => removeHidden(raw, post.slug),
  })
}
