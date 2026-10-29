// 主题与字体：都只改 <html> 上的 data 属性，颜色值全在 CSS 变量里
const THEME_KEY = 'blog_theme'
const FONT_KEY = 'blog_font'
const PALETTE_KEY = 'blog_palette'

export const THEMES = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'auto', label: '跟随系统' },
]

// 浅色配色预设，色值同时用于面板上的小色卡
export const PALETTES = [
  { id: 'cool', label: '冷白', bg: '#eceff4', card: '#ffffff', accent: '#2f628f' },
  { id: 'paper', label: '宣纸', bg: '#f4eee2', card: '#fffdf7', accent: '#96662f' },
  { id: 'celadon', label: '青瓷', bg: '#eaf0ee', card: '#ffffff', accent: '#3a7a6f' },
  { id: 'indigo', label: '靛蓝', bg: '#eeeef6', card: '#ffffff', accent: '#4b4f96' },
  { id: 'terrazzo', label: '砖红', bg: '#f2ede8', card: '#fffdfa', accent: '#a25a45' },
]

export const FONTS = [
  { id: 'sans', label: '无衬线', note: '清晰，默认' },
  { id: 'serif', label: '宋体', note: '像书页' },
  { id: 'kai', label: '楷体', note: '手写感' },
]

const read = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 隐私模式下忽略 */
  }
}

export const getTheme = () => read(THEME_KEY, 'auto')
export const getFont = () => read(FONT_KEY, 'sans')
export const getPalette = () => read(PALETTE_KEY, 'cool')

export const systemDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

export const resolveTheme = (theme) => (theme === 'auto' ? (systemDark() ? 'dark' : 'light') : theme)

export function applyTheme(theme = getTheme(), font = getFont(), palette = getPalette()) {
  const root = document.documentElement
  const mode = resolveTheme(theme)

  if (mode === 'dark') root.dataset.theme = 'dark'
  else root.removeAttribute('data-theme')

  if (palette && palette !== 'cool') root.dataset.palette = palette
  else root.removeAttribute('data-palette')

  if (font && font !== 'sans') root.dataset.font = font
  else root.removeAttribute('data-font')

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const tint = mode === 'dark' ? '#1b1a1e' : PALETTES.find((p) => p.id === palette)?.bg || '#eceff4'
    meta.setAttribute('content', tint)
  }

  return mode
}

export function setTheme(theme) {
  write(THEME_KEY, theme)
  return applyTheme(theme, getFont(), getPalette())
}

export function setFont(font) {
  write(FONT_KEY, font)
  return applyTheme(getTheme(), font, getPalette())
}

export function setPalette(palette) {
  write(PALETTE_KEY, palette)
  return applyTheme(getTheme(), getFont(), palette)
}

// 跟随系统时，系统切换要实时反应
export function watchSystem(onChange) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (getTheme() === 'auto') onChange(applyTheme('auto', getFont(), getPalette()))
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
