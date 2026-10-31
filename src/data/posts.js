// 文章正文不在这里导入：见 src/data/bodies.js，按路由按需加载
import momentsRaw from '../content/moments.md?raw'
import livePostsRaw from './livePosts.json'
import hiddenRaw from './hidden.json'
// 碎碎念的解析规则放在 lib/moments.js：管理页要用同一套规则才能删对条目
import { parseMoments } from '../lib/moments'

// 站点信息
export const site = {
  name: '海滩长颈鹿',
  tagline: '失之东隅，收之桑榆',
  author: '海滩长颈鹿',
  bio: '学习笔记、零碎想法，还有每天一点点的积累。',
  avatar: '/avatar.webp',
  since: '2026-10-28',
  // 写作页（/write）用这些信息直接提交到 GitHub
  repo: 'BeachGiraffe7/96_blog',
  branch: 'main',
  momentsPath: 'src/content/moments.md',
  livePostsPath: 'src/data/livePosts.json',
  hiddenPath: 'src/data/hidden.json',
  siteUrl: 'https://beachgiraffe.pages.dev',
  github: 'https://github.com/BeachGiraffe7',
  email: '1502765800@qq.com',
  wechat: 'Dec21_Hello',
  links: [],
}

// 分类
export const categories = [
  {
    name: '编程基础',
    letter: '码',
    color: '#a9b8f0',
    desc: '语言、工具链与工程习惯',
  },
  {
    name: '嵌入式',
    letter: '嵌',
    color: '#7cc7b2',
    desc: '单片机、RTOS 与电赛',
  },
  {
    name: '机器人',
    letter: '机',
    color: '#e8b07a',
    desc: '运动学、ROS 2、仿真与感知',
  },
  {
    name: '智能算法',
    letter: '智',
    color: '#c9aee8',
    desc: '从机器学习到 VLA',
  },
  { name: '记录', letter: '记', color: '#f0a7a7', desc: '碎碎念、复盘与心得' },
]

export const series = [
  // 编程基础
  {
    name: 'C 语言基础',
    category: '编程基础',
    desc: '语法、流程、数组与函数',
    icon: 'code',
  },
  {
    name: 'C 语言高级',
    category: '编程基础',
    desc: '指针、内存与结构体',
    icon: 'code',
  },
  {
    name: 'Python',
    category: '编程基础',
    desc: '脚本、数据处理与自动化',
    icon: 'code',
  },
  {
    name: 'Linux 与命令行',
    category: '编程基础',
    desc: '每天都要用的那些命令',
    icon: 'target',
  },
  {
    name: '工具与工程',
    category: '编程基础',
    desc: 'Git、构建、部署这些杂事',
    icon: 'folder',
  },
  {
    name: '读书笔记',
    category: '编程基础',
    desc: '读完一本记一篇',
    icon: 'book',
  },

  // 嵌入式
  {
    name: 'STM32 裸机',
    category: '嵌入式',
    desc: '寄存器、外设与调试',
    icon: 'code',
  },
  {
    name: '电赛·TI M0',
    category: '嵌入式',
    desc: '米醋电子 TI M0 系列课程',
    icon: 'layers',
  },
  {
    name: 'FreeRTOS',
    category: '嵌入式',
    desc: '任务、队列与调度',
    icon: 'clock',
  },

  // 机器人
  {
    name: '机器人学',
    category: '机器人',
    desc: '变换、运动学与轨迹规划',
    icon: 'target',
  },
  {
    name: 'ROS 2',
    category: '机器人',
    desc: '节点、话题、服务与 Action',
    icon: 'layers',
  },
  {
    name: '机器人仿真',
    category: '机器人',
    desc: 'MuJoCo 与 Isaac',
    icon: 'chart',
  },
  {
    name: '机械臂',
    category: '机器人',
    desc: '正逆解、抓取与力控',
    icon: 'code',
  },
  {
    name: '机器视觉',
    category: '机器人',
    desc: '标定、检测与位姿估计',
    icon: 'eye',
  },

  // 智能算法
  {
    name: '机器学习',
    category: '智能算法',
    desc: '基础概念与经典模型',
    icon: 'chart',
  },
  {
    name: '深度学习',
    category: '智能算法',
    desc: 'Transformer 与扩散模型',
    icon: 'chart',
  },
  {
    name: '强化学习',
    category: '智能算法',
    desc: 'PPO、SAC 与 Sim2Real',
    icon: 'target',
  },
  {
    name: '模仿学习与 VLA',
    category: '智能算法',
    desc: 'ACT、Diffusion Policy、OpenVLA',
    icon: 'spark',
  },

  // 记录
  {
    name: '周复盘',
    category: '记录',
    desc: '一周一次的自查',
    icon: 'calendar',
  },
  {
    name: '项目复盘',
    category: '记录',
    desc: '做完一个东西之后的总结',
    icon: 'book',
  },
]

// 碎碎念：内容写在 src/content/moments.md，格式是「## 日期 | 心情」+ 正文
// 这里只负责解析，加新的一条不用改代码
export const moments = parseMoments(momentsRaw)

// 文章

const staticPosts = [
  // ============ TI M0 课程笔记系列 ============
  {
    slug: 'lecture-00',
    title: '【电赛】第零讲：耗材说明与芯片解锁',
    category: '嵌入式',
    date: '2026-06-20',
    views: 312,
    tags: ['TI M0', '电赛', 'BSL'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 1278,
    cover: 'grid',
    excerpt:
      '电赛开跑前的准备工作：耗材选型建议用天猛星 + 米醋电控板 V2，再用重构过的 BSL 烧录工具给 MSPM0G3507 解锁芯片、烧录固件。',
  },
  {
    slug: 'lecture-01-clock-gpio',
    title: '【电赛】第一讲：时钟、调度器与 GPIO',
    category: '嵌入式',
    date: '2026-07-05',
    views: 486,
    tags: ['TI M0', 'DL库', 'GPIO', '时钟'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 9365,
    cover: 'grid',
    excerpt:
      '从 DL 库和 HAL 库的区别讲起，对比 STM32F4 与 MSPM0G3507 的产品定位，再拆解 TI 时钟系统的"发电机"与"用电网络"，最后落到调度器和 GPIO。',
  },
  {
    slug: 'lecture-02-uart-dma',
    title: '【电赛】第二讲：串口、超时中断与 DMA + Ringbuffer',
    category: '嵌入式',
    date: '2026-07-12',
    views: 521,
    tags: ['TI M0', 'UART', 'DMA', 'Ringbuffer'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 11527,
    excerpt:
      '串口是调嵌入式时最常用的窗口。这一讲从"单车道 vs 高速公路"讲起，把波特率、数据位、校验位、停止位一次讲透，再进入超时中断和 DMA + Ringbuffer 的组合拳。',
  },
  {
    slug: 'lecture-03-timer-adc-dac',
    title: '【电赛】第三讲：TIMER 计数、ADC、DAC 与 DMA',
    category: '嵌入式',
    date: '2026-07-14',
    views: 468,
    tags: ['TI M0', 'ADC', 'DAC', 'Timer'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 24384,
    cover: 'wave',
    excerpt:
      'ADC 把"斜坡"变成"楼梯"，DAC 用积木拼出平滑曲线。这一讲是配置最重的一讲：从 SysConfig 里 ADC 的时钟源、采样模式，到 TIMER 计数与 DAC 输出，逐项过一遍。',
  },
  {
    slug: 'lecture-04-gray',
    title: '【电赛】第四讲：感为无 MCU 灰度传感器',
    category: '嵌入式',
    date: '2026-07-18',
    views: 394,
    tags: ['TI M0', '传感器', 'ADC', '灰度'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 5161,
    excerpt:
      '感为无 MCU 灰度传感器不用单片机也能输出数字量。这一讲拆解它的硬件架构与多路复用电路、接线方式，以及 TrackN 位图的解析和处理流程。',
  },
  {
    slug: 'lecture-05-pwm-motor',
    title: '【电赛】第五讲：PWM、外部中断与电机驱动',
    category: '嵌入式',
    date: '2026-07-25',
    views: 437,
    tags: ['TI M0', 'PWM', '电机', 'DRV8871'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 11073,
    excerpt:
      '电机驱动的另一条路：DRV8871 与 TB6612 的关键差异、快衰减控制逻辑，以及为什么每路电机需要两个 CC 通道——PWM 调速和外部中断在这一讲汇合。',
  },
  {
    slug: 'lecture-06-pid',
    title: '【电赛】第六讲：串级 PID 与三环控制',
    category: '嵌入式',
    date: '2026-08-02',
    views: 562,
    tags: ['TI M0', 'PID', '控制', 'JY901S'],
    series: '电赛·TI M0',
    hasBody: true,
    words: 4441,
    cover: 'aurora',
    excerpt:
      '系列收尾：先接入 JY901S 陀螺仪，搞定相对零点和 0~360° 转换，然后从位置式 PID 出发，一路搭到速度环、角度环、循迹环。',
  },

  // ============ 技术杂谈 ============
  {
    slug: 'git-github-desktop',
    title: '【教程】Git、GitHub、GitHub Desktop 到底谁是谁',
    category: '编程基础',
    series: '工具与工程',
    date: '2026-10-28',
    views: 96,
    tags: ['Git', 'GitHub', '部署', '教程'],
    hasBody: true,
    words: 6660,
    cover: 'aurora',
    excerpt:
      '本地改完 → Commit 存档 → Push 上传 → Cloudflare 自动构建。这篇文章把 Git、GitHub、GitHub Desktop 三者的关系和完整部署流程讲清楚，末尾还有一次真实的 404 排查记录。',
  },

  // ============ 阅读 ============

  // ============ 生活随记 ============
]

// 写作页发布的新文章：元信息在 livePosts.json，正文在 src/content/notes/<slug>.md
export const livePosts = Array.isArray(livePostsRaw) ? livePostsRaw : []

// 已下线的文章（写作页「管理」里下线仓库里的文章时写入这里）。
// 正文文件不删，只从站点隐藏，所以随时能恢复。
export const hiddenSlugs = Array.isArray(hiddenRaw) ? hiddenRaw : []

// 不过滤的全集：管理页要能按 slug 找到已下线文章的信息
export const allPosts = [...staticPosts, ...livePosts].sort((a, b) =>
  a.date < b.date ? 1 : -1,
)

export const posts = allPosts.filter((p) => !hiddenSlugs.includes(p.slug))

// 派生数据
export const categoryCount = (name) =>
  posts.filter((p) => p.category === name).length

export const seriesCount = (name) =>
  posts.filter((p) => p.series === name).length

// 只列有文章的系列：计划里的空系列不进导航，否则一开始就是一排 0
export const activeSeries = () => series.filter((s) => seriesCount(s.name) > 0)

// 某个分类下、已有文章的系列
export const seriesInCategory = (cat) =>
  series.filter((s) => s.category === cat && seriesCount(s.name) > 0)

export const seriesMeta = (name) => series.find((s) => s.name === name)

// 系列内的文章，按时间正序（课程是第一讲 → 第 N 讲，倒序读会乱）
export const postsInSeries = (name) =>
  posts
    .filter((p) => p.series === name)
    .sort((a, b) => a.date.localeCompare(b.date))

export const allTags = () => {
  const map = new Map()
  posts.forEach((p) => p.tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1)))
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export const stats = () => {
  const totalWords = posts.reduce((s, p) => s + p.words, 0)
  const totalViews = posts.reduce((s, p) => s + p.views, 0)
  const days = Math.max(
    1,
    Math.round((Date.now() - new Date(site.since).getTime()) / 86400000),
  )
  const latest = posts.reduce(
    (a, p) => (p.date > a ? p.date : a),
    posts[0].date,
  )
  return {
    posts: posts.length,
    categories: categories.length,
    tags: allTags().length,
    series: activeSeries().length,
    words: totalWords,
    views: totalViews,
    days,
    latest,
  }
}

export const formatNumber = (n) => n.toLocaleString('en-US')

export const daysAgo = (date) => {
  const diff = Math.round((Date.now() - new Date(date).getTime()) / 86400000)
  if (diff <= 0) return '今天'
  if (diff === 1) return '昨天'
  return `${diff} 天前`
}

export const readingTime = (words) => Math.max(1, Math.round(words / 400))
