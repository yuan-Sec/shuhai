import { useState, useEffect } from 'react'
import type { ReadingSettings } from '../types'
import { defaultSettings, themeColors } from '../types'
import { getSettings, saveSettings, clearAllData, getAllBooks } from '../lib/db'

interface SettingsProps {
  onThemeChange?: () => void
}

export function Settings({ onThemeChange }: SettingsProps) {
  const [settings, setSettings] = useState<ReadingSettings>(defaultSettings)
  const [bookCount, setBookCount] = useState(0)

  useEffect(() => {
    (async () => {
      const s = await getSettings()
      setSettings(s)
      const books = await getAllBooks()
      setBookCount(books.length)
    })()
  }, [])

  const update = async (partial: Partial<ReadingSettings>) => {
    const ns = { ...settings, ...partial }
    setSettings(ns)
    await saveSettings(ns)
    if (partial.theme) {
      applyTheme(partial.theme)
      onThemeChange?.()
    }
  }

  const applyTheme = (theme: keyof typeof themeColors) => {
    const colors = themeColors[theme]
    const root = document.documentElement
    root.style.setProperty('--bg', colors.bg)
    root.style.setProperty('--bg-secondary', colors.bgSecondary)
    root.style.setProperty('--bg-surface', colors.surface)
    root.style.setProperty('--text', colors.text)
    root.style.setProperty('--text-secondary', colors.textSecondary)
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--border', colors.border)
  }

  const handleClearData = async () => {
    if (confirm(`确定要清空所有数据吗？这将删除 ${bookCount} 本书和所有阅读记录，且不可恢复。`)) {
      await clearAllData()
      alert('数据已清空')
      setBookCount(0)
    }
  }

  const themes: { key: keyof typeof themeColors; label: string; desc: string }[] = [
    { key: 'dark', label: '深色', desc: '护眼夜间' },
    { key: 'light', label: '浅色', desc: '日间明亮' },
    { key: 'sepia', label: '护眼', desc: '复古暖色' },
    { key: 'cream', label: '米色', desc: '柔和舒适' },
  ]

  const fonts = [
    { label: '系统默认', value: 'system-ui, "Noto Sans SC", sans-serif' },
    { label: '衬线体', value: '"Noto Serif SC", "Source Han Serif SC", serif' },
    { label: '等宽体', value: '"JetBrains Mono", "Cascadia Code", monospace' },
    { label: '圆体', value: '"Noto Sans SC", "PingFang SC", sans-serif' },
  ]

  return (
    <div className="settings-page">
      <header className="page-header">
        <h1>设置</h1>
      </header>

      <div className="settings-scroll">
        {/* 主题选择 */}
        <section className="settings-section">
          <h2 className="settings-section-title">应用主题</h2>
          <div className="theme-grid">
            {themes.map(t => (
              <button
                key={t.key}
                className={`theme-card ${settings.theme === t.key ? 'active' : ''}`}
                style={{ background: themeColors[t.key].bg, color: themeColors[t.key].text, borderColor: themeColors[t.key].border }}
                onClick={() => update({ theme: t.key })}
              >
                <div className="theme-card-preview" style={{ background: themeColors[t.key].surface, borderColor: themeColors[t.key].border }}>
                  <div className="theme-card-dot" style={{ background: themeColors[t.key].accent }} />
                  <div className="theme-card-lines">
                    <div style={{ background: themeColors[t.key].textSecondary, width: '60%' }} />
                    <div style={{ background: themeColors[t.key].textSecondary, width: '85%' }} />
                    <div style={{ background: themeColors[t.key].textSecondary, width: '40%' }} />
                  </div>
                </div>
                <span className="theme-card-label">{t.label}</span>
                <span className="theme-card-desc">{t.desc}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 阅读设置 */}
        <section className="settings-section">
          <h2 className="settings-section-title">阅读偏好</h2>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-row-label">默认字体</span>
            </div>
            <select
              className="setting-select"
              value={settings.fontFamily}
              onChange={(e) => update({ fontFamily: e.target.value })}
            >
              {fonts.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-row-label">默认字号</span>
              <span className="setting-row-value">{settings.fontSize}px</span>
            </div>
            <input
              type="range"
              className="setting-row-slider"
              min="12" max="32" step="1"
              value={settings.fontSize}
              onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
            />
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-row-label">默认行距</span>
              <span className="setting-row-value">{settings.lineHeight.toFixed(1)}</span>
            </div>
            <input
              type="range"
              className="setting-row-slider"
              min="1.2" max="3" step="0.1"
              value={settings.lineHeight}
              onChange={(e) => update({ lineHeight: parseFloat(e.target.value) })}
            />
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-row-label">阅读模式</span>
            </div>
            <div className="setting-row-toggle">
              <button
                className={`toggle-btn ${settings.flow === 'paginated' ? 'active' : ''}`}
                onClick={() => update({ flow: 'paginated' })}
              >翻页</button>
              <button
                className={`toggle-btn ${settings.flow === 'scrolled' ? 'active' : ''}`}
                onClick={() => update({ flow: 'scrolled' })}
              >滚动</button>
            </div>
          </div>
        </section>

        {/* 数据管理 */}
        <section className="settings-section">
          <h2 className="settings-section-title">数据管理</h2>
          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-row-label">书库数量</span>
            </div>
            <span className="setting-row-value">{bookCount} 本</span>
          </div>
          <button className="settings-danger-btn" onClick={handleClearData}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            清空所有数据
          </button>
        </section>

        {/* 关于 */}
        <section className="settings-section">
          <h2 className="settings-section-title">关于</h2>
          <div className="about-card">
            <div className="about-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <div className="about-info">
              <div className="about-name">书海</div>
              <div className="about-version">版本 1.0.0</div>
            </div>
          </div>
          <div className="about-features">
            <div className="about-feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              <span>完全离线，数据不上传</span>
            </div>
            <div className="about-feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              <span>支持 11+ 种电子书格式</span>
            </div>
            <div className="about-feature">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              <span>本地存储，隐私安全</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
