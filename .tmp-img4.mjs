import sharp from 'sharp'
import path from 'node:path'

const SRC = 'src/content/notes/git-github-desktop.assets'
const OUT = 'public/notes/git-github-desktop/image'

const jobs = [
  { src: 'image-20261029125706110.png', out: 'cf-01-create-app.webp' },
  { src: 'image-20261029125818715.png', out: 'cf-02-connect-github.webp' },
  { src: 'image-20261029125858720.png', out: 'cf-03-import-repo.webp' },
  { src: 'image-20261029125920966.png', out: 'cf-04-select-repo.webp' },
  { src: 'image-20261029130048907.png', out: 'cf-05-build-config.webp' },
]

for (const job of jobs) {
  const file = path.join(SRC, job.src)
  const { width: W, height: H } = await sharp(file).metadata()

  // 1) 裁掉右侧「使用情况 / 账户详细信息」面板
  const keepW = Math.round(W * 0.79)

  // 2) 在左侧栏的邮箱行、左上角账号处盖色块（比模糊更可靠）
  const bars = [
    { x: 0, y: 0, w: Math.round(W * 0.16), h: Math.round(H * 0.042) },            // 左上账号切换
    { x: Math.round(W * 0.012), y: Math.round(H * 0.188), w: Math.round(W * 0.1), h: Math.round(H * 0.032) }, // 侧栏邮箱
  ]
  const svgBars = bars
    .map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="3" fill="#e8e2e6"/>`)
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${svgBars}</svg>`

  const info = await sharp(file)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .extract({ left: 0, top: 0, width: keepW, height: H })
    .resize({ width: 1500, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(path.join(OUT, job.out))

  console.log(job.out, `${info.width}x${info.height}`, `${(info.size / 1024).toFixed(0)} KB`)
}
