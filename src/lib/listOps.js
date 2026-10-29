// 对 JSON 数组文本的增删：没有依赖，方便单独跑测试
// 返回 null 表示「没什么可改的」，调用方据此报错而不是写一个空文件回去

export function removeLiveEntry(raw, slug) {
  const list = JSON.parse(raw || '[]')
  const next = list.filter((p) => p.slug !== slug)
  if (next.length === list.length) return null
  return `${JSON.stringify(next, null, 2)}\n`
}

export function addHidden(raw, slug) {
  const list = JSON.parse(raw || '[]')
  if (list.includes(slug)) return null
  return `${JSON.stringify([...list, slug], null, 2)}\n`
}

export function removeHidden(raw, slug) {
  const list = JSON.parse(raw || '[]')
  const next = list.filter((s) => s !== slug)
  if (next.length === list.length) return null
  return `${JSON.stringify(next, null, 2)}\n`
}
