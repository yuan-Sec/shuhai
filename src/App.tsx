import { useState, useCallback } from 'react'
import type { BookRecord } from './types'
import { Library } from './components/Library'
import { Reader } from './components/Reader'
import { Stats } from './components/Stats'
import { Settings } from './components/Settings'
import { recordReading } from './lib/db'

type Tab = 'library' | 'stats' | 'settings'

function App() {
  const [currentBook, setCurrentBook] = useState<BookRecord | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('library')
  const [libraryVersion, setLibraryVersion] = useState(0)

  const handleOpenBook = useCallback((book: BookRecord) => {
    setCurrentBook(book)
    recordReading(1).catch(() => {})
  }, [])

  const handleBack = useCallback(() => {
    setCurrentBook(null)
    setLibraryVersion(v => v + 1)
  }, [])

  // 阅读器全屏覆盖
  if (currentBook) {
    return (
      <Reader book={currentBook} onBack={handleBack} />
    )
  }

  return (
    <div className="app-shell">
      <div className="app-content">
        {activeTab === 'library' && (
          <Library
            key={libraryVersion}
            onOpenBook={handleOpenBook}
          />
        )}
        {activeTab === 'stats' && <Stats />}
        {activeTab === 'settings' && <Settings onThemeChange={() => setLibraryVersion(v => v + 1)} />}
      </div>

      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === 'library' ? 'active' : ''}`}
          onClick={() => setActiveTab('library')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span>书库</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <span>统计</span>
        </button>
        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>设置</span>
        </button>
      </nav>
    </div>
  )
}

export default App
