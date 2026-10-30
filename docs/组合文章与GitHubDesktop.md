# 组合文章：正文 + PDF + 交互 HTML

这次修改直接接入原网站 `/write?type=post` 与 `/post/:slug`，不是另一个演示网站。
旧 Markdown 文章、碎碎念、成长页继续走原有路径，不自动转换旧文章。

## 写一篇文章

1. 进入“文章”，无需连接 GitHub 也能本地写作。
2. 填写标题、网址、网站现有分类与可选系列。自己的理解写在“文字段落”中，支持 Markdown 工具栏。
3. “插入文件”可一次选择 PDF、HTML 和图片。默认保留原件，不强制提取文字。
4. 用上下箭头编排成：导读 → PDF → 你的说明 → HTML 实验 → 结论。可以插入多段自己的文字。
5. 使用“分栏预览”或“读者视图”检查。PDF 可以翻页/放大/下载；HTML 由读者点击后才启动。
6. 同时导入 HTML 引用的 PDF/图片，保留原始文件名。文件改名时，在附件中填写“网页引用别名”。无法唯一匹配的引用会提示，不猜测关联。
7. 点“导出文章包”备份；以后直接选择该 ZIP 恢复，无需先解压。
8. 真正发布时，连接 GitHub，检查公开内容，再确认“提交发布”。提交成功不等于 Cloudflare 已完成部署。

“仅提取可编辑文字”是可选的旧式导入，不保留复杂排版或 HTML 脚本；扫描 PDF 不会自动 OCR。

## GitHub Desktop 如何配合

**本次功能代码先在 `feat/composite-article-editor` 分支审阅，不能直接把试验代码部署到 main。**

收到 PR 后：Desktop `Fetch origin` → 切换该分支 → `Pull origin`，检查并本地运行。确认后再合并 PR。

功能合并上线之后，通过网页发文章会直接在 `site.branch`（当前为 `main`）产生一次完整 commit。
之后在 Desktop：

1. `Fetch origin`。
2. `Pull origin` 拉取网页刚发布的正文、清单和附件。
3. 再提交电脑上的代码。不要在 Desktop 仍落后时强推覆盖远程。

网页与 Desktop 同时提交时，网页拒绝非快进更新，不 force，不自动覆盖。保留/导出草稿，拉取最新版本后再检查。
如果网络恰好在最后提交时中断，先查看 GitHub commit 记录，确定是否已成功，避免盲目重复发布。

## 连接凭据

网站建议使用 **Fine-grained PAT**：只选 `BeachGiraffe7/96_blog`，`Contents: Read and write`，短有效期。
不要给网站管理员权限、工作流管理或其他仓库权限；不要把 PAT 写入正文、仓库或截图。

网站 token 仅存在当前会话存储/内存，不再长期留在 localStorage。浏览器关闭、凭据到期后需要重新连接。
这仍是纯前端直连 GitHub 的方案，不是服务端保管密钥；前端写作口令只是界面门槛，不是真正的授权边界。
后续可升级 GitHub App/服务端鉴权，但需要单独配置部署服务和权限。

## 数据位置与安全边界

每篇新组合文章：

```text
public/articles/<slug>/article.json
public/articles/<slug>/assets/<id>-<原文件名>
src/content/notes/<slug>.md            # 兼容搜索/旧读取路径的文本与附件链接
src/data/livePosts.json               # contentType: article-v1
```

原始 HTML 存成 `.html.txt`，不作为站点同源页面直接执行。阅读器取回原始字节，再放进无同源权限的 sandbox iframe。
CSP 限制外部脚本、网络请求、框架、表单；允许内联脚本与下载。HTML 无法读取主页面 PAT/DOM，PDF 引用通过受限消息桥跳转。
**这不是任意恶意网页的全面安全审计。只导入可信、尽量自包含的 HTML。** 依赖 CDN、联网 API、模块脚本或跨页面跳转的网页不保证可用。
隔离框架内 localStorage 可能不可用；实验记录应导出，不承诺跨刷新永久保留。

正文、附件、索引通过 Git blob/tree/commit 构造，再一次非强制更新分支引用。中间上传失败不让半篇文章进入公开分支。
新建网址不能覆盖现有文章；管理页编辑组合文章时校验原清单 SHA，拒绝覆盖已经改变的版本。
删除组合文章在一次提交中移除目录、兼容正文与当前所有附件；**Git 历史仍保留旧文件**，不适合“删除已泄露密钥”。

## 限制与后续优化

- 单附件 20 MiB，全部附件 80 MiB；清单 2 MiB；200 内容块、100 附件上限。
- 为保护部署体积，限制低于 Cloudflare 单文件上限。大视频/大 PDF 应另用对象存储，不能无限堆进 Git。
- 草稿在当前浏览器 IndexedDB，不上传，不跨设备同步。存储清除/额度不足会丢失，应导出 ZIP。
- 编辑页可保留新建草稿及按网址区分的编辑草稿；目前没有多草稿管理界面。
- 读取时会下载该文章附件，较大文章首开仍有成本；后续可按模块懒加载、附件去重及编辑时清理不再引用的旧资源。
- 旧版 Markdown 搜索/SEO 兼容保留，但不会自动索引 PDF 内文字或 HTML 内交互结果；预渲染完整正文、全文搜索另行优化。
- 发布成功只确认 GitHub commit；未接 Cloudflare 部署状态回调。
- 历史纯 Markdown 文章不提供无损组合编辑的自动迁移；先备份再逐篇迁移。

## 验证

```sh
npm ci
npm test
npm run build
npm run dev
```

18 项 Node 测试覆盖原子提交、冲突、无凭据、新建防覆盖、编辑 SHA、删除、ZIP CRC/路径、限额与旧导入接口。

浏览器测试需要 Playwright（开发机可 `npm install --no-save --package-lock=false playwright`，并 `npx playwright install chromium`）。保持 Vite 运行，再依次：

```sh
node tests/browser/writer.mjs
node tests/browser/reader.mjs
```

可通过 `QA_BASE_URL`、`QA_OUTPUT_DIR`、`PLAYWRIGHT_MODULE`、`CHROMIUM_PATH` 设置测试地址、截图目录和本机工具路径。
所有 GitHub API 均被测试拦截，使用假 token，不向远程写入。`reader` 使用 `writer` 生成的测试 ZIP。
测试覆盖桌面/390px 手机、PDF/HTML 跳页、连接时不丢正文、模拟发布、旧 Markdown、阅读错误恢复、既有文章编辑。
