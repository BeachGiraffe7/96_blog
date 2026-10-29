import sharp from 'sharp'
const files = ['cf-01-create-app','cf-02-connect-github','cf-03-import-repo','cf-04-select-repo','cf-05-build-config']
for (const f of files) {
  const p = `public/notes/git-github-desktop/image/${f}.webp`
  const m0 = await sharp(p).metadata()
  if (m0.width <= 1500) { console.log(f, 'already', m0.width); continue }
  const buf = await sharp(p).resize({ width: 1500, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toBuffer()
  await sharp(buf).toFile(p)
  const m = await sharp(p).metadata()
  console.log(f, m.width + 'x' + m.height, (m.size/1024).toFixed(0) + 'KB')
}
