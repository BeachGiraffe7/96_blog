// 文章正文按需加载：每篇 md 会被单独打成一个 chunk，
// 只有打开对应文章时才下载，避免全部正文塞进主包。
const sources = import.meta.glob('../content/notes/*.md', {
  query: '?raw',
  import: 'default',
})

const cache = new Map()

export function loadBody(slug) {
  if (cache.has(slug)) return Promise.resolve(cache.get(slug))
  const key = `../content/notes/${slug}.md`
  const loader = sources[key]
  if (!loader) return Promise.resolve(null)
  return loader().then((text) => {
    cache.set(slug, text)
    return text
  })
}

export const hasBodies = Object.keys(sources).length
