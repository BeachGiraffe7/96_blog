# Git、GitHub、GitHub Desktop 到底谁是谁：把「网站怎么更新」一次讲清

这篇文章写给和我一样，第一次碰版本控制就想关掉页面的人。

起因很简单：我把自己的博客部署到了 `beachgiraffe.pages.dev`，然后产生了一个疑问——我以后是在本地改代码，用 GitHub Desktop 更新仓库，网站就会自动更新吗？答案是的，但中间有几个环节值得搞清楚，否则一旦出错就完全不知道该看哪里。

## 一句话结论

本地改文件 → **Commit（存档）** → **Push（上传到 GitHub）** → Cloudflare 自动构建 → 网站更新。

你每天真正要做的只有前两步，后面全是自动的。但前提是：你得知道这两步各自在做什么。

![](/notes/git-github-desktop/image/flow.svg)

*（示意图较宽，手机上可左右滑动查看）*

## 一、三个东西分别是什么

先把这三个名字拆开。它们经常被混着叫，但职责完全不同。

| 名称 | 是什么 | 装在哪 | 类比 |
| --- | --- | --- | --- |
| **Git** | 版本控制工具，负责记录文件的每一次变化 | 你电脑上（命令行工具） | 游戏的存档系统 |
| **GitHub** | 网站，用来托管 Git 仓库，让别人也能看到、协作 | 云端（github.com） | 存档的云备份 + 展示柜 |
| **GitHub Desktop** | Git 的图形界面客户端，用鼠标代替命令 | 你电脑上（桌面软件） | 存档系统的遥控器 |

### Git：给文件夹装一个「时光机」

Git 会盯着你项目里的文件，每次你说「存一下」，它就把当时所有文件的快照记下来。于是你可以：

- 知道某一行代码是什么时候、被谁改的
- 改坏了退回上一个版本
- 开一条「分支」随便折腾，不满意直接丢掉，不影响主线

它完全在你本地工作，**不需要联网**也能提交。

### GitHub：放 Git 仓库的网站

Git 只管本地。如果电脑坏了，存档就没了；如果想让 Cloudflare 拿到你的代码，也得有个双方都能访问的地方。GitHub 就是这个「公共存放点」。

你的项目在 GitHub 上的地址是 `github.com/BeachGiraffe7/96_blog`，这就是你的**远程仓库**。

### GitHub Desktop：不敲命令的 Git

Git 本身是命令行工具，`.git` 目录里那些操作要用 `git commit`、`git push` 这样的命令。GitHub Desktop 把这些操作做成了按钮和面板：

- 左边 `Changes` 面板：看到你改了哪些文件，红绿行就是具体改动
- 左下角 `Summary` 输入框：写这次改动是干什么的
- 中间 `Commit to main` 按钮：存档
- 右上角 `Push origin`：上传

**它只是 Git 的外壳，不是另一个 Git。** 换句话说：GitHub Desktop 做的每一步，都能用命令完成；你在它里面提交的东西，和命令行提交的是同一套东西。

## 二、最容易混淆的四组概念

### 1. Git ≠ GitHub

Git 是工具，GitHub 是网站。没有 GitHub，Git 照样能用；没有 Git，GitHub 就没有存在的意义。国内还有 Gitee、GitLab 等同类网站，都是「放 Git 仓库的地方」。

### 2. GitHub Desktop ≠ GitHub

Desktop 是你电脑上的软件，负责操作本地仓库；GitHub 是云端的服务器。Desktop 里点 Push，本质上是在跟 GitHub 网站通信。

### 3. Commit ≠ Push

这是新手最容易糊掉的地方：

| 动作 | 中文 | 作用 | 在哪生效 |
| --- | --- | --- | --- |
| Commit | 提交 / 存档 | 把当前改动记进本地历史 | 只在你电脑上 |
| Push | 推送 / 上传 | 把本地的新提交传到 GitHub | 云端 |
| Pull | 拉取 / 下载 | 把 GitHub 上的新内容取回本地 | 你电脑上 |

**只 Commit 不 Push，线上什么都不会变。** 这个坑我踩过：提交完就关掉软件，以为上线了，结果刷了半天还是旧页面。

### 4. 分支 main 是什么

仓库默认有一条主线，叫 `main`。你的所有提交都在这条线上，Cloudflare 也只监听这条线。所以日常不需要管分支，看到 `main` 就对了。

还有两个词顺手记一下：

- **工作区**：你正在编辑的那些文件
- **远程（origin）**：指 GitHub 上的那个仓库，`origin` 只是它的默认别名

## 三、你的博客现在是怎么更新的

这是本文的核心。把上面的概念套到你自己的项目上：

1. 我在 `D:\07_WorkProject\96_blog` 里改代码或写文章
2. 本地跑 `npm run dev`，在 `localhost:5173` 看效果
3. 确认没问题，用 GitHub Desktop 提交并推送
4. GitHub 上的 `BeachGiraffe7/96_blog` 收到新提交
5. Cloudflare Pages 检测到变化，自动执行 `npm run build`
6. 构建产物上传到 CDN，`beachgiraffe.pages.dev` 变成新版本

所以你的理解是对的，**只需要记住一件事：本地改完必须 Push**。

顺带解释一个常被问的问题：为什么仓库里没有 `dist` 文件夹？因为那是构建产物，Cloudflare 会自己生成。源文件和成品分开，这是工程上的常规做法。

## 四、演示 A：从零把网站部署上线

这是你昨天走过的路，我按步骤复述一遍，方便以后换台电脑重来。

### 第 0 步：准备

- 装好 Node.js（版本 18 以上）
- 注册 GitHub 账号
- 装 GitHub Desktop，登录同一个账号

### 第 1 步：本地能跑起来

打开终端，进入项目目录：

```bash
cd D:\07_WorkProject\96_blog
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`，能看到页面就说明本地环境没问题。

### 第 2 步：用 GitHub Desktop 发布仓库

1. 打开 GitHub Desktop，菜单 `File` → `Add Local Repository`
2. 选择 `D:\07_WorkProject\96_blog`
3. 如果提示这不是一个仓库，点 `create a repository` 创建
4. 左下角填一句 Summary（比如 `first commit`），点 `Commit to main`
5. 右上角点 `Publish repository`
6. 弹窗里可以取消勾选 `Keep this code private`（公开仓库免费，私有也能部署）

完成后，代码就出现在 `github.com/你的用户名/96_blog` 了。

### 第 3 步：在 Cloudflare 上接上仓库

这一步是我实际操作时截图记下来的，界面文字按 2026 年的中文控制台写的。如果你看到的是英文界面，意思一一对应。

**① 进入 Workers & Pages，点「创建应用程序」**

登录 `dash.cloudflare.com`，左侧栏「计算」分组里点 `Workers & Pages`，然后点右上角的蓝色按钮。

![](/notes/git-github-desktop/image/cf-01-workers-pages.webp)

**② 选择「Continue with GitHub」**

弹出「创建新项目」面板后，选第一个 `Continue with GitHub`（用 GitLab 就选右边那个）。

注意面板底部还有一行小字「需要使用旧版 Pages 工作流？继续前往 Pages」——两种入口都能到达 Pages，走 GitHub 这个更顺。

**③ 在「开始使用 Pages」页选「导入现有 Git 存储库」**

这里有两个选项：`导入现有 Git 存储库` 和 `拖放文件`。我们已经有仓库了，选第一个，点右侧的「开始使用」。

（`拖放文件` 是直接把 `dist` 文件夹拖上去，适合没有仓库的情况，但那样每次更新都得手动重传。）

![](/notes/git-github-desktop/image/cf-03-import-git.webp)

**④ 选中仓库**

页面上方会出现步骤条：`1 选择存储库 → 2 设置构建和部署 → 3 部署站点`。

- GitHub 帐户：选你自己的账号
- 选择一个存储库：点 `96_blog`

选中后点右下角 `开始设置`。

![](/notes/git-github-desktop/image/cf-04-select-repo.webp)

**⑤ 填构建配置**

- 生产分支：`main`
- 框架预设：选 **`React (Vite)`**（列表里还有纯 `Vite` 和 `VitePress`，别选错）

选完预设，构建命令和输出目录会自动填好：

| 配置项 | 自动填入的值 |
| --- | --- |
| 构建命令 | `npm run build` |
| 部署目录 | `dist` |
| 根目录 | 留空 |

![](/notes/git-github-desktop/image/cf-05-build-config.webp)

点 `保存并部署`。它会开始拉代码、装依赖、跑构建，一两分钟后给出一个 `xxx.pages.dev` 地址。

### 第 4 步：验证

拿到域名后，别只看首页。要专门验证这两件事：

- 点开任意一篇文章，能正常打开
- 复制文章链接（形如 `/post/lecture-06-pid`），在新标签页直接粘贴访问，能打开

第二条是在测「前端路由回退」。这正好是本文最后一节要讲的真实 bug。

### 第 5 步（可选）：换个好记的域名

`96-blog.pages.dev` 这种地址自己都记不住，更别说发给别人。不用花钱也能改：**项目名就是子域名**。

1. 进入这个 Pages 项目 → `Settings`
2. 找到 `Project name`（项目名称），点改名
3. 保存后回到 `Deployments`，对最新一次部署点 `⋯` → `重试部署`

新地址立刻生效，例如把 `96-blog` 改成 `beachgiraffe`，网址就变成 `beachgiraffe.pages.dev`。

⚠️ 代价是**旧地址会失效，而且没法做 301 跳转**（子域名会被释放）。所以：

- 只在刚上线、还没到处发链接的时候改名
- 改完记得同步代码里的地址（本站是 `src/data/posts.js` 里的 `siteUrl`），以及 sitemap、RSS 里的旧链接

如果链接已经撒出去了，改用零停机的做法：新建一个项目连同一个仓库，在新地址验证通过后再删旧项目。

## 五、演示 B：日常改一次网站

假设你想把首页的标语改掉。

1. 在 `src/data/posts.js` 里改 `tagline` 这一行
2. `npm run dev` 看效果，不满意继续改
3. 打开 GitHub Desktop，左边 `Changes` 面板会列出 `src/data/posts.js`
4. 点这个文件，右侧能看到红绿 diff：红色是删掉的行，绿色是新加的行
5. 左下角 Summary 写 `更新首页标语`，点 `Commit to main`
6. 右上角出现 `Push origin`，点它
7. 等 1～2 分钟，刷新 `beachgiraffe.pages.dev`（按 `Ctrl + F5` 强制刷新）

站点就更新了。整个过程里，你不需要碰命令行。

### 为什么我改了、线上却没变？

按这个顺序查，九成问题在前两条：

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| Desktop 里还有未提交的改动 | 只改了文件，没 Commit | 写 Summary → Commit |
| 提交了但没推送 | 忘了点 Push origin | 点右上角 Push |
| 推送了但页面没变 | Cloudflare 还在构建 / 浏览器缓存 | 等 2 分钟，Ctrl+F5 |
| Cloudflare 显示构建失败 | 代码有语法错误，本地能跑但线上编译失败 | 去 Deployments 点开那条红色记录看日志 |
| 打开是旧版本 | 看的是缓存或另一个部署环境 | 确认访问的是 `xxx.pages.dev` 主域名 |

## 六、演示 C：一次真实的排错（建议你跟着做）

写这篇文章时，我发现一个真实存在的问题：**文章详情页直接访问返回 404**，但首页正常。

原因是这样的：我为了让站点也能部署到 GitHub Pages，在构建后额外生成了一份 `dist/404.html`。而 Cloudflare Pages 的判断逻辑是——**如果项目里有 404.html，就用它响应所有找不到的路径，状态码 404**；如果没有，才会自动回退到 `index.html`，返回 200。

结果就是页面能显示，但状态码是 404，搜索引擎和分享卡片都会认为这个链接不存在。

修法只有几行：在 Cloudflare 的构建环境里跳过这个文件。代码里用环境变量判断，Cloudflare 构建时自带 `CF_PAGES=1`，所以：

```javascript
if (process.env.CF_PAGES === '1') {
  console.log('Cloudflare 构建，跳过 404.html')
} else {
  copyFileSync(from, to)
}
```

这个修复当时已经推送上线了。验证的方法很简单——直接把文章链接粘到浏览器地址栏：

`https://beachgiraffe.pages.dev/post/lecture-01-clock-gpio`

修好之前，页面能显示正文，但开发者工具里的状态码是 404；修好之后是正常的 200。

顺带记一个排查习惯：分享到微信后卡片显示"页面不存在"、但自己点开明明有内容，八成就是状态码不对这种「看起来正常、其实不正常」的问题。

## 七、改坏了怎么救

Git 最大的价值不是「上传」，是「能退回去」。三个最常用的操作，都在 GitHub Desktop 里：

- **丢掉还没提交的改动**：`Changes` 面板里右键文件 → `Discard changes`，回到上次提交的状态
- **撤销某次已提交的改动**：`History` 面板里右键那条提交 → `Revert changes in commit`，它会生成一条反向提交，再次 Push 就恢复了
- **想回到很早以前的版本看看**：在 GitHub 网页上找到对应提交，点 `Browse files`，代码可以下载，不会影响线上

有一条原则：**不要手动删 `.git` 文件夹**。删了等于把整本历史书烧掉，仓库和提交记录全部消失。

## 八、每天照着做就行

1. 改东西之前，先在 GitHub Desktop 点一次 `Fetch origin`，确认本地是最新的
2. 改完先本地预览：`npm run dev`
3. Changes 面板里逐个看 diff，别把调试代码提交上去
4. Summary 写清楚改了什么，比如「新增第六讲笔记」「修首页标语错字」
5. Commit → Push → 等 1 分钟 → Ctrl+F5 验证

关于提交信息，有个小建议：写「做了什么」，不要写「update」「修改」。三个月后回看，只有前者有用。

## 九、名词速查

| 名词 | 一句话解释 |
| --- | --- |
| 仓库 repository | 一个被 Git 管理的项目文件夹 |
| 提交 commit | 一次存档，带说明和时间 |
| 推送 push | 把本地存档上传到 GitHub |
| 拉取 pull | 把 GitHub 上的更新下载到本地 |
| 分支 branch | 平行的开发线，默认叫 main |
| 远程 remote | GitHub 上的仓库，别名 origin |
| diff | 两个版本之间的差异，红删绿增 |
| 冲突 conflict | 两边改了同一行，Git 不敢替你决定 |
| 构建 build | 把源码编译成可上线的静态文件 |
| 部署 deploy | 把构建产物发布到服务器 / CDN |

## 最后

Git 的概念确实多，但你日常只需要两个动作：**Commit 存档，Push 上传**。剩下的分支、冲突、rebase，等真的遇到了再学，那时候带着具体问题去看，比现在硬背有效得多。

真要说的话，这套东西最大的好处不是「部署方便」，而是让你敢于改。知道随时能退回去，动手的顾虑就少了一大半。
