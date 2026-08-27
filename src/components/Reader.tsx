import { useState, useRef, useEffect, useCallback } from 'react'
import type { BookRecord, ReadingSettings, TOCItem, Bookmark } from '../types'
import { themeColors, defaultSettings } from '../types'
import { loadBook, type LoadedBook } from '../lib/formats'
import { EpubJSReader, PDFJSReader, HTMLReader, type RelocateDetail, type SearchResult } from '../lib/reader'
import { getSettings, saveSettings, updateBookProgress, getBookmarks, addBookmark, deleteBookmark, recordReading } from '../lib/db'

interface ReaderProps {
  book: BookRecord
  onBack: () => void
}

export function Reader({ book, onBack }: ReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const epubReaderRef = useRef<EpubJSReader | null>(null)
  const pdfReaderRef = useRef<PDFJSReader | null>(null)
  const htmlReaderRef = useRef<HTMLReader | null>(null)
  const loadedBookRef = useRef<LoadedBook | null>(null)
  const settingsRef = useRef<ReadingSettings>(defaultSettings)
  const barHideTimerRef = useRef<number | null>(null)
  const locationIndexRef = useRef(book.sectionIndex || 0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBars, setShowBars] = useState(true)
  const [showToc, setShowToc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [toc, setToc] = useState<TOCItem[]>([])
  const [currentTocIndex, setCurrentTocIndex] = useState(-1)
  const [progress, setProgress] = useState(book.progress)
  const [sectionLabel, setSectionLabel] = useState<string>('')
  const [settings, setSettings] = useState<ReadingSettings>(defaultSettings)
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const timer = window.setInterval(() => recordReading(1).catch(() => {}), 60_000)
    return () => window.clearInterval(timer)
  }, [book.id])

  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        if (!book.blob) throw new Error('文件数据丢失，请重新导入此书')

        const s = await getSettings()
        if (cancelled) return
        setSettings(s)
        settingsRef.current = s
        applyTheme(s.theme)

        const file = new File([book.blob], book.fileName)
        const loaded = await loadBook(file, book.format)
        if (cancelled) return

        loadedBookRef.current = loaded
        setToc(loaded.toc)

        const bms = await getBookmarks(book.id)
        if (cancelled) return
        setBookmarks(bms)

        const container = containerRef.current!

        if (loaded.epubBook) {
          const reader = new EpubJSReader(container, (detail: RelocateDetail) => {
            if (cancelled) return
            setProgress(detail.fraction)
            setSectionLabel(detail.sectionLabel || '')
            locationIndexRef.current = detail.index
            const cfi = epubReaderRef.current?.getCFI()
            updateBookProgress(book.id, detail.fraction, cfi, detail.index)
          })
          epubReaderRef.current = reader
          await reader.open(loaded, book.cfi, book.progress)
        } else if (loaded.pdfDoc) {
          const reader = new PDFJSReader(container, (detail: RelocateDetail) => {
            if (cancelled) return
            setProgress(detail.fraction)
            setSectionLabel(detail.sectionLabel || '')
            locationIndexRef.current = detail.index
            updateBookProgress(book.id, detail.fraction, undefined, detail.index)
          })
          pdfReaderRef.current = reader
          await reader.open(loaded, book.progress)
        } else if (loaded.htmlContent) {
          const reader = new HTMLReader(container, (detail: RelocateDetail) => {
            if (cancelled) return
            setProgress(detail.fraction)
            setSectionLabel(detail.sectionLabel || '')
            locationIndexRef.current = detail.index
            updateBookProgress(book.id, detail.fraction, undefined, detail.index)
          })
          htmlReaderRef.current = reader
          reader.open(loaded, book.progress)
          reader.setSettings({
            fontSize: s.fontSize,
            fontFamily: s.fontFamily,
            lineHeight: s.lineHeight,
            margin: s.margin,
            theme: s.theme,
          })
        } else {
          throw new Error('不支持的书籍格式')
        }

        if (!cancelled) setLoading(false)
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setError(`打开失败: ${err instanceof Error ? err.message : String(err)}`)
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      epubReaderRef.current?.close()
      pdfReaderRef.current?.close()
      htmlReaderRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, retryCount])

  const applyTheme = (theme: string) => {
    const colors = themeColors[theme as keyof typeof themeColors] || themeColors.dark
    const root = document.documentElement
    root.style.setProperty('--bg', colors.bg)
    root.style.setProperty('--bg-secondary', colors.bgSecondary)
    root.style.setProperty('--bg-surface', colors.surface)
    root.style.setProperty('--text', colors.text)
    root.style.setProperty('--text-secondary', colors.textSecondary)
    root.style.setProperty('--accent', colors.accent)
    root.style.setProperty('--border', colors.border)
    root.style.setProperty('--reader-bg', colors.bg)
    root.style.setProperty('--reader-text', colors.text)
  }

  const applyReaderSettings = useCallback(() => {
    const s = settingsRef.current
    document.documentElement.style.setProperty('--reader-brightness', String(s.brightness / 100))
    if (epubReaderRef.current) {
      epubReaderRef.current.setFlow(s.flow)
    }
    if (htmlReaderRef.current) {
      htmlReaderRef.current.setSettings({
        fontSize: s.fontSize, fontFamily: s.fontFamily,
        lineHeight: s.lineHeight, margin: s.margin, theme: s.theme,
      })
    }
  }, [])

  const handleNext = useCallback(() => {
    epubReaderRef.current?.next()
    pdfReaderRef.current?.next()
    htmlReaderRef.current?.next()
  }, [])

  const handlePrev = useCallback(() => {
    epubReaderRef.current?.prev()
    pdfReaderRef.current?.prev()
    htmlReaderRef.current?.prev()
  }, [])

  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width * 0.3) handlePrev()
    else if (x > rect.width * 0.7) handleNext()
    else toggleBars()
  }

  const toggleBars = () => {
    setShowBars((v) => {
      const nv = !v
      if (!nv) { setShowToc(false); setShowSettings(false); setShowBookmarks(false); setShowSearch(false) }
      return nv
    })
  }

  const resetBarHideTimer = () => {
    if (barHideTimerRef.current) clearTimeout(barHideTimerRef.current)
    if (showBars) {
      barHideTimerRef.current = window.setTimeout(() => {
        setShowBars(false); setShowToc(false); setShowSettings(false); setShowBookmarks(false); setShowSearch(false)
      }, 5000)
    }
  }

  useEffect(() => { resetBarHideTimer() }, [showBars]) // eslint-disable-line

  const handleTocClick = (item: TOCItem, index: number) => {
    setCurrentTocIndex(index)
    if (epubReaderRef.current) epubReaderRef.current.goToTOCItem(item.href)
    else if (pdfReaderRef.current) pdfReaderRef.current.goToTOCItem(item.href)
    else if (htmlReaderRef.current) htmlReaderRef.current.goToSection(index)
    setShowToc(false)
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const frac = parseFloat(e.target.value) / 100
    setProgress(frac)
    if (epubReaderRef.current) epubReaderRef.current.goToFraction(frac)
    else if (pdfReaderRef.current) pdfReaderRef.current.goToFraction(frac)
    else if (htmlReaderRef.current) htmlReaderRef.current.goToFraction(frac)
  }

  const handleSettingChange = (partial: Partial<ReadingSettings>) => {
    const ns = { ...settingsRef.current, ...partial }
    settingsRef.current = ns
    setSettings(ns)
    saveSettings(ns)
    if (partial.theme) applyTheme(partial.theme)
    applyReaderSettings()
  }

  const handleAddBookmark = async () => {
    const cfi = epubReaderRef.current?.getCFI() || `section-${locationIndexRef.current}`
    const label = sectionLabel || `${Math.round(progress * 100)}%`
    const bm: Bookmark = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, bookId: book.id, cfi, label, createdAt: Date.now() }
    await addBookmark(bm)
    setBookmarks(await getBookmarks(book.id))
    showToast('书签已添加')
  }

  const handleDeleteBookmark = async (id: string) => {
    await deleteBookmark(id)
    setBookmarks(await getBookmarks(book.id))
  }

  const handleBookmarkClick = (bm: Bookmark) => {
    if (epubReaderRef.current && bm.cfi && !bm.cfi.startsWith('section-')) epubReaderRef.current.goToTOCItem(bm.cfi)
    else if (bm.cfi.startsWith('section-')) {
      const index = Number(bm.cfi.slice('section-'.length))
      if (htmlReaderRef.current) htmlReaderRef.current.goToSection(index)
      if (pdfReaderRef.current) pdfReaderRef.current.goToPage(index + 1)
    }
    setShowBookmarks(false)
  }

  const handleSearch = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!searchQuery.trim()) { setSearchResults([]); return }
    setSearching(true)
    try {
      if (epubReaderRef.current) setSearchResults(await epubReaderRef.current.search(searchQuery))
      else if (pdfReaderRef.current) setSearchResults(await pdfReaderRef.current.search(searchQuery))
      else if (htmlReaderRef.current) setSearchResults(htmlReaderRef.current.search(searchQuery))
    } finally {
      setSearching(false)
    }
  }

  const handleSearchResult = (result: SearchResult) => {
    if (epubReaderRef.current && typeof result.target === 'string') epubReaderRef.current.goToTOCItem(result.target)
    else if (pdfReaderRef.current && typeof result.target === 'number') pdfReaderRef.current.goToPage(result.target)
    else if (htmlReaderRef.current && typeof result.target === 'number') htmlReaderRef.current.goToSection(result.target)
    setShowSearch(false)
  }

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2300) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (loading) return
      switch (e.key) {
        case 'ArrowRight': case ' ': handleNext(); break
        case 'ArrowLeft': handlePrev(); break
        case 'Escape':
          if (showToc || showSettings || showBookmarks || showSearch) { setShowToc(false); setShowSettings(false); setShowBookmarks(false); setShowSearch(false) }
          else onBack()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loading, showToc, showSettings, showBookmarks, showSearch]) // eslint-disable-line

  const renderTOC = (items: TOCItem[], level = 0) => {
    return items.map((item, i) => {
      const idx = level * 1000 + i
      return (
        <div key={`toc-${idx}`}>
          <button className={`toc-item ${currentTocIndex === idx ? 'active' : ''}`}
            onClick={() => handleTocClick(item, idx)} style={{ paddingLeft: 12 + level * 20 }}>
            {item.label}
          </button>
          {item.subitems && item.subitems.length > 0 && renderTOC(item.subitems, level + 1)}
        </div>
      )
    })
  }

  return (
    <div className="reader-page">
      <div className={`reader-topbar ${showBars ? '' : 'hidden'}`}>
        <button onClick={onBack} className="reader-icon-btn" title="返回">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div className="reader-topbar-title">{book.meta.title}</div>
        <button onClick={() => setShowSearch(true)} className="reader-icon-btn" title="书内搜索" aria-label="书内搜索">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        </button>
        <button onClick={handleAddBookmark} className="reader-icon-btn" title="添加书签">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      <div className="reader-content">
        <div className="reader-container" ref={containerRef} />
        {loading && (
          <div className="reader-loading"><div className="spinner" /><p>正在打开《{book.meta.title}》...</p></div>
        )}
        {error && (
          <div className="reader-error">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.4 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={{ fontSize: 16, fontWeight: 600, marginTop: 16 }}>打开失败</p>
            <p className="text-secondary text-sm" style={{ marginTop: 4, maxWidth: 300, textAlign: 'center', wordBreak: 'break-word' }}>{error}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button className="btn" onClick={() => { setError(null); setLoading(true); setRetryCount(c => c + 1) }} style={{ minWidth: 100 }}>重试</button>
              <button className="btn btn-primary" onClick={onBack} style={{ minWidth: 100 }}>返回书库</button>
            </div>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="tap-zone tap-zone-left" onClick={handlePrev} />
            <div className="tap-zone tap-zone-center" onClick={handleTap} />
            <div className="tap-zone tap-zone-right" onClick={handleNext} />
          </>
        )}
      </div>

      <div className={`reader-bottombar ${showBars ? '' : 'hidden'}`}>
        <button onClick={() => setShowToc(true)} className="reader-icon-btn" title="目录">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="15" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/><line x1="19" y1="6" x2="21" y2="6"/><line x1="19" y1="12" x2="21" y2="12"/><line x1="19" y1="18" x2="21" y2="18"/></svg>
        </button>
        <div className="reader-progress">
          <span>{Math.round(progress * 100)}%</span>
          <input type="range" className="progress-slider" min="0" max="100" step="0.1" value={progress * 100} onChange={handleProgressChange} />
        </div>
        <button onClick={() => setShowBookmarks(true)} className="reader-icon-btn" title="书签">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
        <button onClick={() => setShowSettings(true)} className="reader-icon-btn" title="设置">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>

      {sectionLabel && showBars && (
        <div style={{ position: 'fixed', bottom: 52, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'var(--text-secondary)', padding: '2px 12px', borderRadius: 4, fontSize: 11, zIndex: 99, pointerEvents: 'none' }}>{sectionLabel}</div>
      )}

      {showToc && (
        <>
          <div className="drawer-overlay visible" onClick={() => setShowToc(false)} />
          <div className="drawer drawer-left visible">
            <div className="drawer-header"><span>目录</span><button onClick={() => setShowToc(false)} style={{ minHeight: 'auto', padding: 4 }}>✕</button></div>
            <div className="drawer-body">
              {toc.length > 0 ? renderTOC(toc) : <p className="text-secondary text-sm" style={{ textAlign: 'center', padding: 20 }}>本书没有目录</p>}
            </div>
          </div>
        </>
      )}

      {showSearch && (
        <>
          <div className="drawer-overlay visible" onClick={() => setShowSearch(false)} />
          <aside className="drawer drawer-left visible" aria-label="书内搜索">
            <div className="drawer-header"><span>书内搜索</span><button onClick={() => setShowSearch(false)} aria-label="关闭">✕</button></div>
            <div className="drawer-body search-drawer-body">
              <form className="reader-search" onSubmit={handleSearch}>
                <input autoFocus value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="输入要查找的文字" />
                <button className="btn btn-primary" disabled={searching}>{searching ? '查找中' : '查找'}</button>
              </form>
              {searchResults.length > 0 ? (
                <div className="reader-search-results">
                  <p>找到 {searchResults.length} 处结果</p>
                  {searchResults.map((result, index) => (
                    <button key={`${String(result.target)}-${index}`} onClick={() => handleSearchResult(result)}>
                      <strong>{result.label}</strong>
                      <span>{result.excerpt}</span>
                    </button>
                  ))}
                </div>
              ) : searchQuery && !searching ? <p className="drawer-empty">没有找到相关内容</p> : <p className="drawer-hint">搜索在设备本地完成，不会上传书籍内容。</p>}
            </div>
          </aside>
        </>
      )}

      {showBookmarks && (
        <>
          <div className="drawer-overlay visible" onClick={() => setShowBookmarks(false)} />
          <div className="drawer drawer-right visible">
            <div className="drawer-header"><span>书签</span><button onClick={() => setShowBookmarks(false)} style={{ minHeight: 'auto', padding: 4 }}>✕</button></div>
            <div className="drawer-body">
              {bookmarks.length > 0 ? bookmarks.map((bm) => (
                <div key={bm.id} className="bookmark-item" onClick={() => handleBookmarkClick(bm)}>
                  <span style={{ fontSize: 16 }}>🔖</span>
                  <div className="bookmark-text">{bm.label}</div>
                  <button className="bookmark-delete" onClick={(e) => { e.stopPropagation(); handleDeleteBookmark(bm.id) }}>✕</button>
                </div>
              )) : <p className="text-secondary text-sm" style={{ textAlign: 'center', padding: 20 }}>暂无书签，点击顶部 🔖 添加</p>}
            </div>
          </div>
        </>
      )}

      {showSettings && (
        <>
          <div className="drawer-overlay visible" onClick={() => setShowSettings(false)} />
          <div className="drawer drawer-right visible">
            <div className="drawer-header"><span>阅读设置</span><button onClick={() => setShowSettings(false)} style={{ minHeight: 'auto', padding: 4 }}>✕</button></div>
            <div className="drawer-body">
              <div className="setting-group"><div className="setting-label">主题</div>
                <div className="theme-options">{(['dark', 'light', 'sepia', 'cream'] as const).map((t) => (
                  <div key={t} className={`theme-option ${settings.theme === t ? 'active' : ''}`}
                    style={{ background: themeColors[t].bg, color: themeColors[t].text }}
                    onClick={() => handleSettingChange({ theme: t })}>
                    {t === 'dark' ? '深色' : t === 'light' ? '白色' : t === 'sepia' ? '护眼' : '米色'}
                  </div>
                ))}</div>
              </div>
              <div className="setting-group"><div className="setting-label">阅读模式</div>
                <div style={{ display: 'flex', gap: 8 }}>{(['paginated', 'scrolled'] as const).map((f) => (
                  <button key={f} className={`btn ${settings.flow === f ? 'btn-primary' : ''}`}
                    style={{ flex: 1 }} onClick={() => handleSettingChange({ flow: f })}>
                    {f === 'paginated' ? '翻页模式' : '滚动模式'}
                  </button>
                ))}</div>
              </div>
              <div className="setting-group"><div className="setting-label"><span>字号</span><span className="setting-value">{settings.fontSize}px</span></div>
                <input type="range" className="setting-slider" min="12" max="32" step="1" value={settings.fontSize} onChange={(e) => handleSettingChange({ fontSize: parseInt(e.target.value) })} /></div>
              <div className="setting-group"><div className="setting-label"><span>行距</span><span className="setting-value">{settings.lineHeight.toFixed(1)}</span></div>
                <input type="range" className="setting-slider" min="1.2" max="3" step="0.1" value={settings.lineHeight} onChange={(e) => handleSettingChange({ lineHeight: parseFloat(e.target.value) })} /></div>
              <div className="setting-group"><div className="setting-label"><span>段间距</span><span className="setting-value">{settings.paragraphSpacing}px</span></div>
                <input type="range" className="setting-slider" min="0" max="32" step="2" value={settings.paragraphSpacing} onChange={(e) => handleSettingChange({ paragraphSpacing: parseInt(e.target.value) })} /></div>
              <div className="setting-group"><div className="setting-label"><span>页边距</span><span className="setting-value">{settings.margin}px</span></div>
                <input type="range" className="setting-slider" min="0" max="80" step="4" value={settings.margin} onChange={(e) => handleSettingChange({ margin: parseInt(e.target.value) })} /></div>
              <div className="setting-group"><div className="setting-label"><span>亮度</span><span className="setting-value">{settings.brightness}%</span></div>
                <input type="range" className="setting-slider" min="30" max="100" step="5" value={settings.brightness} onChange={(e) => handleSettingChange({ brightness: parseInt(e.target.value) })} /></div>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
