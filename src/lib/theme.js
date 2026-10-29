// 主题与字体：都只改 <html> 上的 data 属性，颜色值全在 CSS 变量里
const THEME_KEY = 'blog_theme'
const FONT_KEY = 'blog_font'

export const THEMES = [
  { id: 'light', label: '浅色' },
  { id: 'dark', label: '深色' },
  { id: 'auto', label: '跟随系统' },
]

export const FONTS = [
  { id: 'sans', label: '无衬线', note: '清晰，默认' },
  { id: 'serif', label: '衬线', note: '像书页' },
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

export const systemDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

export const resolveTheme = (theme) => (theme === 'auto' ? (systemDark() ? 'dark' : 'light') : theme)

export function applyTheme(theme = getTheme(), font = getFont()) {
  const root = document.documentElement
  const mode = resolveTheme(theme)

  if (mode === 'dark') root.dataset.theme = 'dark'
  else root.removeAttribute('data-theme')

  if (font && font !== 'sans') root.dataset.font = font
  else root.removeAttribute('data-font')

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', mode === 'dark' ? '#1b1a1e' : '#f4f6f8')

  return mode
}

export function setTheme(theme) {
  write(THEME_KEY, theme)
  return applyTheme(theme, getFont())
}

export function setFont(font) {
  write(FONT_KEY, font)
  return applyTheme(getTheme(), font)
}

// 跟随系统时，系统切换要实时反应
export function watchSystem(onChange) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => {
    if (getTheme() === 'auto') onChange(applyTheme('auto', getFont()))
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
