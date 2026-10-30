import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icons'
import {
  THEMES,
  FONTS,
  PALETTES,
  getTheme,
  getFont,
  getPalette,
  setTheme,
  setFont,
  setPalette,
  resolveTheme,
} from '../lib/theme'

const THEME_ICON = {
  light: Icon.sun,
  dark: Icon.moon,
  auto: Icon.refresh,
}

export default function ThemePanel({ onClose }) {
  const [theme, setThemeState] = useState(getTheme())
  const [font, setFontState] = useState(getFont())
  const [palette, setPaletteState] = useState(getPalette())
  const ref = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('.theme-toggle')) {
        onClose()
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const isDark = resolveTheme(theme) === 'dark'

  return (
    <div className="theme-panel" ref={ref} role="dialog" aria-label="外观设置">
      <div className="theme-group">
        <p className="theme-label">外观</p>
        <div className="theme-options">
          {THEMES.map((t) => {
            const Glyph = THEME_ICON[t.id]
            const active = theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                className={active ? 'theme-opt active' : 'theme-opt'}
                aria-pressed={active}
                onClick={() => {
                  setThemeState(t.id)
                  setTheme(t.id)
                }}
              >
                <Glyph />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="theme-group">
        <p className="theme-label">
          浅色配色{isDark && <span className="theme-inline-note">（深色下不生效）</span>}
        </p>
        <div className="palette-grid">
          {PALETTES.map((p) => {
            const active = palette === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={active ? 'palette-opt active' : 'palette-opt'}
                style={{ background: p.bg }}
                aria-pressed={active}
                title={p.label}
                onClick={() => { setPalette(p.id); setPaletteState(p.id) }}
              >
                <span className="palette-band" style={{ background: p.accent }}>
                  {p.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="theme-group">
        <p className="theme-label">正文字体</p>
        <div className="theme-options">
          {FONTS.map((f) => {
            const active = font === f.id
            return (
              <button
                key={f.id}
                type="button"
                className={active ? 'theme-opt font-opt active' : 'theme-opt font-opt'}
                title={f.note}
                aria-pressed={active}
                onClick={() => setFontState(setFont(f.id))}
              >
                <span className="font-sample" style={{ fontFamily: `var(--font-${f.id})` }}>
                  永 Aa
                </span>
                <span className="font-name">{f.label}</span>
              </button>
            )
          })}
        </div>
        <p className="theme-note">
          字体只作用于文章正文。文楷、小赖是网络字体，首次选中需下载 1–2 MB，之后走缓存。
        </p>
      </div>
    </div>
  )
}
