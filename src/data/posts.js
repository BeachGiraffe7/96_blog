// 笔记源文件（Markdown，Vite ?raw 直接打包进产物）
import lecture00 from '../content/notes/lecture-00.md?raw'
import lecture01 from '../content/notes/lecture-01-clock-gpio.md?raw'
import lecture02 from '../content/notes/lecture-02-uart-dma.md?raw'
import lecture03 from '../content/notes/lecture-03-timer-adc-dac.md?raw'
import lecture04 from '../content/notes/lecture-04-gray.md?raw'
import lecture05 from '../content/notes/lecture-05-pwm-motor.md?raw'
import lecture06 from '../content/notes/lecture-06-pid.md?raw'
import gitGuide from '../content/notes/git-github-desktop.md?raw'
import momentsRaw from '../content/moments.md?raw'

// 解析碎碎念：把 moments.md 里每个「## 日期 | 心情」区块转成对象
const parseMoments = (raw) => {
  const body = raw.replace(/<!--[\s\S]*?-->/g, '')
  return body
    .split(/^##\s+/m)
    .slice(1)
    .map((block) => {
      const lines = block.split('\n')
      const head = lines.shift().trim()
      const [date, mood] = head.split('|').map((s) => s.trim())
      const text = lines.join(' ').replace(/\s+/g, ' ').trim()
      return { date, mood: mood || '平静', text }
    })
    .filter((m) => /^\d{4}-\d{2}-\d{2}$/.test(m.date) && m.text)
}

// 站点信息
export const site = {
  name: '海滩长颈鹿',
  tagline: '失之东隅，收之桑榆',
  author: '海滩长颈鹿',
  bio: '分享学习日常，还有记录我的心情。主攻嵌入式，偶尔写点有的没的。',
  avatar: '/avatar.webp',
  since: '2025-06-01',
  links: [
    { icon: 'github', href: 'https://github.com', label: 'GitHub' },
    { icon: 'douyin', href: 'https://www.douyin.com', label: '抖音' },
    { icon: 'mail', href: 'mailto:hi@example.com', label: 'Email' },
  ],
}

// 分类
export const categories = [
  { name: '嵌入式', letter: '嵌', color: '#7cc7b2' },
  { name: '技术', letter: '技', color: '#a9b8f0' },
  { name: '阅读', letter: '阅', color: '#c9aee8' },
  { name: '生活随记', letter: '生', color: '#f0a7a7' },
]

export const series = [
  { name: 'TI M0 课程笔记', desc: '电赛特训：米醋电子 TI M0 系列课程', icon: 'code' },
]

// 碎碎念：内容写在 src/content/moments.md，格式是「## 日期 | 心情」+ 正文
// 这里只负责解析，加新的一条不用改代码
export const moments = parseMoments(momentsRaw)

// 学习轨迹（关于页时间线）
export const timeline = [
  { time: '2026-10', text: '博客加上碎碎念页面，短想法有了固定的去处' },
  { time: '2026-08', text: '串级 PID 调通，小车终于能自己循着线跑了' },
  { time: '2026-07', text: '电赛特训进入正题，TI M0 课程笔记陆续更新' },
  { time: '2026-06', text: '博客重构：迁到 React + Vite，重新排版' },
  { time: '2026-05', text: '第一块电控板到手，开始 MSPM0G3507 的学习' },
  { time: '2025-06', text: '站点上线，写下第一篇博客' },
]

// 文章
const countMdWords = (md) => md.replace(/\s+/g, '').length

export const posts = [
  // ============ TI M0 课程笔记系列 ============
  {
    slug: 'lecture-00',
    title: '【电赛】第零讲：耗材说明与芯片解锁',
    category: '嵌入式',
    date: '2026-06-20',
    views: 312,
    tags: ['TI M0', '电赛', 'BSL'],
    series: 'TI M0 课程笔记',
    markdown: lecture00,
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
    series: 'TI M0 课程笔记',
    markdown: lecture01,
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
    series: 'TI M0 课程笔记',
    markdown: lecture02,
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
    series: 'TI M0 课程笔记',
    markdown: lecture03,
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
    series: 'TI M0 课程笔记',
    markdown: lecture04,
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
    series: 'TI M0 课程笔记',
    markdown: lecture05,
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
    series: 'TI M0 课程笔记',
    markdown: lecture06,
    cover: 'aurora',
    excerpt:
      '系列收尾：先接入 JY901S 陀螺仪，搞定相对零点和 0~360° 转换，然后从位置式 PID 出发，一路搭到速度环、角度环、循迹环。',
  },

  // ============ 技术杂谈 ============
  {
    slug: 'git-github-desktop',
    title: '【教程】Git、GitHub、GitHub Desktop 到底谁是谁',
    category: '技术',
    date: '2026-10-28',
    views: 96,
    tags: ['Git', 'GitHub', '部署', '教程'],
    markdown: gitGuide,
    cover: 'aurora',
    excerpt:
      '本地改完 → Commit 存档 → Push 上传 → Cloudflare 自动构建。这篇文章把 Git、GitHub、GitHub Desktop 三者的关系和完整部署流程讲清楚，末尾还有一次真实的 404 排查记录。',
  },
  {
    slug: 'ai-coding',
    title: '【观点】正确使用 AI Coding',
    category: '技术',
    date: '2026-10-25',
    views: 3242,
    words: 1032,
    tags: ['AI', '工程'],
    excerpt:
      '最近一周有点萎靡不振：要么就是完成的任务远远不及我的预期，要么是评估这件事的复杂度我判断错了没有动手。说实话是我高估了自己的执行力，或者说我根本就不会用 AI Coding。',
    content: [
      { type: 'p', text: '最近一周有点萎靡不振。要么是完成的任务远远不及预期，要么是评估某件事的复杂度时判断错了方向，干脆就没有动手。说实话，是我高估了自己的执行力——或者说，我根本就不会用 AI Coding。' },
      { type: 'h2', text: '问题不在工具，在流程' },
      { type: 'p', text: '我一开始把它当成一个更快的手。给它一段需求，等它还我一段代码。结果就是：它给我的东西我并不能完全读懂，改一处就崩一片，最后花在调试上的时间比我自己写还多。' },
      { type: 'p', text: '后来我把用法换了一种：先自己把边界、数据结构和失败情况写清楚，再让它填。它更像一个不会累的、记忆力极好的实习生，而不是一个能替我做决定的同事。' },
      { type: 'h2', text: '三个我踩过的坑' },
      { type: 'p', text: '第一，需求描述里塞了太多"感觉"，比如"做得好看一点"。模型只能猜，猜出来的东西自然不可控。第二，一次要求改十个地方。出错之后你不知道是哪一个改动引起的。第三，不给它看现有代码的风格，于是项目里出现了两套命名习惯。' },
      { type: 'p', text: '现在我基本固定下来一个节奏：小步提交、每次只让它动一个模块、改完立刻在本地跑一次。慢一点，但其实快很多。' },
      { type: 'quote', text: '工具的上限不是它能写多少代码，而是你能审查多少代码。' },
    ],
  },
  {
    slug: 'vite-speed',
    title: '【技术】把本地热更新从 3 秒压到 0.3 秒',
    category: '技术',
    date: '2026-08-15',
    views: 2210,
    words: 1240,
    tags: ['Vite', '工程'],
    excerpt:
      '项目变大之后热更新慢得让人不想改代码。排查下来不是 Vite 的问题，而是我把一个巨大的工具函数文件在几十个模块里反复 import，每次改动都触发了大范围的重新转换。',
    content: [
      { type: 'p', text: '项目变大之后热更新慢得让人不想改代码。排查下来不是 Vite 的问题，而是我把一个巨大的工具函数文件在几十个模块里反复 import，每次改动都触发了大范围的重新转换。' },
      { type: 'h2', text: '怎么定位' },
      { type: 'p', text: '先把 vite 的 debug 日志打开，看每次 HMR 到底失效了哪些模块。列表如果长到需要滚动，那基本可以确定是模块边界没划好。' },
      { type: 'h2', text: '怎么改' },
      { type: 'p', text: '把那个大文件按领域拆成几个小文件，业务代码只依赖自己需要的那个。副作用是目录结构清楚了很多，算是意外收获。' },
    ],
  },
  {
    slug: 'rss-note',
    title: '【技术】给博客接上 RSS 的半小时',
    category: '技术',
    date: '2026-04-28',
    views: 412,
    words: 720,
    tags: ['RSS', '工程'],
    excerpt:
      '本来以为要引个库，结果手写一个 XML 模板半小时就搞定了。RSS 没死，它只是不热闹。',
    content: [
      { type: 'p', text: '本来以为要引个库，结果手写一个 XML 模板半小时就搞定了。RSS 没死，它只是不热闹。' },
      { type: 'p', text: '要点只有三个：全量输出正文而不是摘要、正确转义 XML 特殊字符、带上 pubDate 的标准格式。剩下的都是装饰。' },
    ],
  },

  // ============ 阅读 ============
  {
    slug: 'clean-code-reread',
    title: '【阅读】《代码整洁之道》重读：十年后再看',
    category: '阅读',
    date: '2026-03-20',
    views: 601,
    words: 1130,
    tags: ['Reading', '工程'],
    excerpt:
      '学生时代觉得这是一本教人 beautify 代码的书。重读才发现它真正在讲的是责任：你写的代码会活着比你久。',
    content: [
      { type: 'p', text: '学生时代觉得这是一本教人 beautify 代码的书，重点是命名和函数长度。重读才发现它真正在讲的是责任：你写的代码会活得比你久。' },
      { type: 'h2', text: '现在最认同的三条' },
      { type: 'p', text: '一，函数只做一件事，这件事应该小到函数名就是全部说明。二，注释是失败——最好的代码不需要翻译。三，测试代码和生产代码一样值得认真写。' },
      { type: 'p', text: '不完全认同的也记一笔：把小函数拆到极端，有时候反而让调用链变成寻宝游戏。整洁是手段，不是目的。' },
    ],
  },

  // ============ 生活随记 ============
  {
    slug: '3am-bug',
    title: '【随记】凌晨三点的 bug 和一杯凉掉的咖啡',
    category: '生活随记',
    date: '2026-08-21',
    views: 389,
    words: 540,
    tags: ['Journal', 'Debug'],
    excerpt:
      '板子每次上电都死在初始化的第三步。查了两个晚上，最后发现是把 TX 和 RX 接反了。解决问题的从来不是天赋，是睡眠。',
    content: [
      { type: 'p', text: '板子每次上电都死在初始化的第三步。查了两个晚上：重看了一遍数据手册、换了两根杜邦线、甚至怀疑过晶振没起振。最后发现，是自己把两根线的 TX 和 RX 接反了。' },
      { type: 'p', text: '最有讽刺意味的是，答案就躺在我自己两天前写下的一行注释里："TODO: 这两个引脚回头确认一下"。' },
      { type: 'p', text: '把咖啡倒掉去睡觉。解决问题的从来不是天赋，是睡眠。' },
    ],
  },
  {
    slug: 'october-note',
    title: '【随记】十月：把时间花在能积累的事情上',
    category: '生活随记',
    date: '2026-08-02',
    views: 341,
    words: 726,
    tags: ['Journal'],
    excerpt:
      '这个月做的最对的一件事，是把"每天学一点"的量压到了很小。小到不可能失败的程度之后，反而连续坚持了二十多天。',
    content: [
      { type: 'p', text: '这个月做的最对的一件事，是把"每天学一点"的量压到了很小。小到不可能失败的程度之后，反而连续坚持了二十多天。' },
      { type: 'p', text: '以前总想着一个周末啃完一章，结果周末被别的事情占掉，进度条就一直停在那里，停久了就不想再碰。' },
      { type: 'p', text: '现在改成每天半小时，看不完就算了。奇怪的是，往往看不完的时候第二天会更想接着看。' },
    ],
  },
  {
    slug: 'why-blog',
    title: '【随记】为什么我要开始写博客',
    category: '生活随记',
    date: '2026-02-26',
    views: 468,
    words: 880,
    tags: ['Journal', 'Meta'],
    cover: 'photon',
    excerpt:
      '学了三年，笔记散落在五个软件里。写博客不是分享，是强迫自己把"看懂了"和"能讲清楚"分开。这个站就是那道分界线。',
    content: [
      { type: 'p', text: '学了三年，笔记散落在五个软件里：两个云笔记、一个本地 Markdown 文件夹、若干聊天记录，还有一个再也不打开的语雀。' },
      { type: 'p', text: '写博客不是分享，是强迫自己把"看懂了"和"能讲清楚"分开。讲不清楚的地方，就是没懂的地方。这个站就是那道分界线。' },
      { type: 'p', text: '至于读者——先把自己当成读者。三年后回来看，希望我能认出这些句子背后的自己。' },
    ],
  },
].map((p) => (p.markdown && !p.words ? { ...p, words: countMdWords(p.markdown) } : p))

// 派生数据
export const categoryCount = (name) => posts.filter((p) => p.category === name).length

export const seriesCount = (name) => posts.filter((p) => p.series === name).length

export const allTags = () => {
  const map = new Map()
  posts.forEach((p) => p.tags.forEach((t) => map.set(t, (map.get(t) || 0) + 1)))
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

export const stats = () => {
  const totalWords = posts.reduce((s, p) => s + p.words, 0)
  const totalViews = posts.reduce((s, p) => s + p.views, 0)
  const days = Math.max(
    1,
    Math.round((Date.now() - new Date(site.since).getTime()) / 86400000),
  )
  const latest = posts.reduce((a, p) => (p.date > a ? p.date : a), posts[0].date)
  return {
    posts: posts.length,
    categories: categories.length,
    tags: allTags().length,
    series: series.length,
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
