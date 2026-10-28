// 批量把笔记图片压缩成 WebP
// 用法：
//   node scripts/optimize-images.mjs          只转换，保留原图
//   node scripts/optimize-images.mjs --clean  转换后删除原 png/jpg（Git 历史里仍可找回）
import sharp from 'sharp'
import { readdir, stat, unlink, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NOTES = path.join(ROOT, 'public', 'notes')
const EXT = new Set(['.png', '.jpg', '.jpeg'])
const CLEAN = process.argv.includes('--clean')

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(full)))
    else if (EXT.has(path.extname(entry.name).toLowerCase())) out.push(full)
  }
  return out
}

async function toWebp(file, quality = 82) {
  const before = (await stat(file)).size
  const out = file.replace(/\.(png|jpe?g)$/i, '.webp')
  await sharp(file).webp({ quality, effort: 5 }).toFile(out)
  const after = (await stat(out)).size
  return { before, after, out }
}

async function main() {
  const files = existsSync(NOTES) ? await walk(NOTES) : []
  const avatarCandidates = ['avatar.jpg', 'avatar.png']
    .map((f) => path.join(ROOT, 'public', f))
    .filter((f) => existsSync(f))

  const targets = [...files, ...avatarCandidates]
  if (!targets.length) {
    console.log('没有需要转换的图片')
    return
  }

  let totalBefore = 0
  let totalAfter = 0
  const rows = []

  for (const file of targets) {
    const { before, after, out } = await toWebp(file)
    totalBefore += before
    totalAfter += after
    rows.push({
      file: path.relative(ROOT, file).replace(/\\/g, '/'),
      before: kb(before),
      after: kb(after),
      saved: `${Math.round((1 - after / before) * 100)}%`,
    })
  }

  console.table(rows)
  console.log(
    `合计：${(totalBefore / 1024 / 1024).toFixed(2)} MB → ${(totalAfter / 1024 / 1024).toFixed(2)} MB，节省 ${Math.round(
      (1 - totalAfter / totalBefore) * 100,
    )}%`,
  )

  if (!CLEAN) {
    console.log('\n原图已保留。确认无误后加 --clean 再跑一次即可删除原图。')
    return
  }

  // 清理原图 + 修正引用
  for (const file of targets) await unlink(file)

  const mdDir = path.join(ROOT, 'src', 'content', 'notes')
  const mds = (await readdir(mdDir)).filter((f) => f.endsWith('.md'))
  for (const md of mds) {
    const full = path.join(mdDir, md)
    const src = await readFile(full, 'utf8')
    const next = src.replace(/\.(png|jpe?g)(\)|\s|$)/gi, '.webp$2')
    if (next !== src) {
      await writeFile(full, next, 'utf8')
      console.log(`引用已更新：src/content/notes/${md}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
