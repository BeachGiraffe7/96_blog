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
  {
    id: 'cool',
    label: '冷白',
    bg: '#eceff4',
    card: '#ffffff',
    accent: '#2f628f',
  },
  {
    id: 'paper',
    label: '宣纸',
    bg: '#f4eee2',
    card: '#fffdf7',
    accent: '#96662f',
  },
  {
    id: 'celadon',
    label: '青瓷',
    bg: '#eaf0ee',
    card: '#ffffff',
    accent: '#3a7a6f',
  },
  {
    id: 'blush',
    label: '粉白',
    bg: '#f8f3f5',
    card: '#fffdfe',
    accent: '#c4667f',
  },
  {
    id: 'sage',
    label: '灰绿',
    bg: '#f4f5f2',
    card: '#ffffff',
    accent: '#315f4b',
  },
]

export const FONTS = [
  { id: 'sans', label: '无衬线', note: '系统字体，最快' },
  { id: 'wenkai', label: '文楷', note: '手写楷，需下载' },
  { id: 'kai', label: '楷体', note: '系统楷体' },
]

// 手写体走 CDN，按需插入 <link>：不选就不请求
const WEBFONTS = {
  wenkai:
    'https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/lxgwwenkai-regular.css',
}

const loadedFonts = new Set()

export function loadWebFont(id) {
  const href = WEBFONTS[id]
  if (!href || loadedFonts.has(id) || typeof document === 'undefined')
    return false
  if (document.querySelector(`link[data-webfont="${id}"]`)) {
    loadedFonts.add(id)
    return true
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.webfont = id
  document.head.appendChild(link)
  loadedFonts.add(id)
  return true
}

export const needsWebFont = (id) => Boolean(WEBFONTS[id])

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
export const getPalette = () => {
  const value = read(PALETTE_KEY, 'cool')
  return value === 'plain' ? 'sage' : value
}

export const systemDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches

export const resolveTheme = (theme) =>
  theme === 'auto' ? (systemDark() ? 'dark' : 'light') : theme

export function applyTheme(
  theme = getTheme(),
  font = getFont(),
  palette = getPalette(),
) {
  const root = document.documentElement
  const mode = resolveTheme(theme)

  if (mode === 'dark') root.dataset.theme = 'dark'
  else root.removeAttribute('data-theme')

  // 旧版本可能存着已删除的配色，回退到默认
  const migratedPalette = palette === 'plain' ? 'sage' : palette
  const safePalette = PALETTES.some((p) => p.id === migratedPalette)
    ? migratedPalette
    : 'cool'
  if (safePalette !== 'cool') root.dataset.palette = safePalette
  else root.removeAttribute('data-palette')

  if (font && font !== 'sans') root.dataset.font = font
  else root.removeAttribute('data-font')

  if (font) loadWebFont(font)

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    const tint =
      mode === 'dark'
        ? '#1b1a1e'
        : PALETTES.find((p) => p.id === safePalette)?.bg || '#eceff4'
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
    if (getTheme() === 'auto')
      onChange(applyTheme('auto', getFont(), getPalette()))
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
