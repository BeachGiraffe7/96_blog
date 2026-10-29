// 把照片 / 截图导入到站点的正确位置，并转成 webp
//
// 用法：
//   node scripts/add-photo.mjs raw/1.png --slug git-github-desktop
//        → public/notes/git-github-desktop/image/1.webp，并打印可粘贴的 markdown
//
//   node scripts/add-photo.mjs raw/ --slug lecture-07 --name cc-01
//        → 目录里每张图依次命名 cc-01.webp、cc-02.webp……
//
//   node scripts/add-photo.mjs 微信图片.jpg --photos
//        → public/photos/2026-10/微信图片.webp（独立照片、相册用）
//
// 可选参数：--width 1500（默认）、--quality 82（默认）、--name <前缀>
import sharp from 'sharp'
import { readdir, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

const EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'])

const argv = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback
}
const has = (name) => argv.includes(`--${name}`)

const source = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'))
const slug = flag('slug', '')
const width = Number(flag('width', 1500))
const quality = Number(flag('quality', 82))
const namePrefix = flag('name', '')

if (!source) {
  console.log(`用法：
  node scripts/add-photo.mjs <文件或目录> --slug <文章slug>   # 文章配图
  node scripts/add-photo.mjs <文件或目录> --photos            # 独立照片
可选：--name 前缀  --width 1500  --quality 82`)
  process.exit(0)
}

const now = new Date()
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

let targetDir
let urlPrefix
if (has('photos')) {
  targetDir = path.join('public', 'photos', month)
  urlPrefix = `/photos/${month}`
} else {
  if (!slug) {
    console.error('文章配图必须指定 --slug（例：--slug git-github-desktop）')
    process.exit(1)
  }
  targetDir = path.join('public', 'notes', slug, 'image')
  urlPrefix = `/notes/${slug}/image`
}

const cleanName = (file) =>
  path
    .basename(file, path.extname(file))
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .toLowerCase()

const collect = async (p) => {
  const s = await stat(p)
  if (!s.isDirectory()) return [p]
  const out = []
  for (const e of await readdir(p, { withFileTypes: true })) {
    if (e.isDirectory()) continue
    if (EXT.has(path.extname(e.name).toLowerCase())) out.push(path.join(p, e.name))
  }
  return out.sort()
}

const files = await collect(source)
if (!files.length) {
  console.error('没找到可用的图片')
  process.exit(1)
}

await mkdir(targetDir, { recursive: true })

let before = 0
let after = 0
const refs = []

for (let i = 0; i < files.length; i++) {
  const f = files[i]
  const base = namePrefix
    ? `${namePrefix}${files.length > 1 ? '-' + String(i + 1).padStart(2, '0') : ''}`
    : cleanName(f)
  const out = path.join(targetDir, `${base}.webp`)

  const info = await sharp(f)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 5 })
    .toFile(out)

  const srcSize = (await stat(f)).size
  before += srcSize
  after += info.size
  refs.push(`![](${urlPrefix}/${base}.webp)`)
  console.log(
    `${path.basename(f)} → ${out}  ${info.width}x${info.height}  ${(srcSize / 1024).toFixed(0)}KB → ${(
      info.size / 1024
    ).toFixed(0)}KB`,
  )
}

console.log(`\n合计 ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB\n`)
console.log('复制到文章里（记得把 alt 换成一句说明）：\n')
console.log(refs.join('\n\n'))
