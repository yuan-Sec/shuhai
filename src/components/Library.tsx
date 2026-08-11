import { useState, useEffect, useCallback, useMemo } from 'react'
import type { BookRecord } from '../types'
import { detectFormat, supportedExtensions } from '../types'
import { getAllBooks, addBook, deleteBook, updateBookProgress } from '../lib/db'
import { loadBook } from '../lib/formats'
import { recordReading } from '../lib/db'

const formatColors: Record<string, string> = {
  epub: '#4CAF50', pdf: '#2196F3', txt: '#9E9E9E', mobi: '#FF9800',
  azw3: '#FF5722', fb2: '#9C27B0', cbz: '#F44336', cbr: '#E91E63',
  docx: '#1976D2', md: '#388E3C', html: '#FFC107', rtf: '#607D8B',
}

interface LibraryProps {
  onOpenBook: (book: BookRecord) => void
}

type SortMode = 'recent' | 'title' | 'progress'

export function Library({ onOpenBook }: LibraryProps) {
  const [books, setBooks] = useState<BookRecord[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const refresh = useCallback(async () => {
    const all = await getAllBooks()
    setBooks(all)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 从 IndexedDB 恢复时可能 blob 丢失，需要重新从 DB 获取最新进度
  useEffect(() => {
    // 合并最新进度
    refresh()
  }, [refresh])

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = supportedExtensions.join(',')

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      setImporting(true)
      const fileArr = Array.from(files)

      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i]
        const format = detectFormat(file.name)
        if (format === 'unknown') continue

        setImportProgress(`正在导入 ${i + 1}/${fileArr.length}: ${file.name}`)

        try {
          const loaded = await loadBook(file, format)
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          const record: BookRecord = {
            id,
            fileName: file.name,
            format,
            fileSize: file.size,
            addedAt: Date.now(),
            progress: 0,
            meta: loaded.meta,
            blob: file,
          }
          await addBook(record)
        } catch (err) {
          console.error(`导入 ${file.name} 失败:`, err)
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
          const record: BookRecord = {
            id,
            fileName: file.name,
            format,
            fileSize: file.size,
            addedAt: Date.now(),
            progress: 0,
            meta: { title: file.name.replace(/\.[^.]+$/, ''), author: '未知作者' },
            blob: file,
          }
          await addBook(record)
        }
      }

      setImporting(false)
      setImportProgress('')
      await refresh()
    }

    input.click()
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('确定要删除这本书吗？')) {
      await deleteBook(id)
      await refresh()
    }
  }

  const handleContinueReading = async (book: BookRecord) => {
    onOpenBook(book)
  }

  const sortedFiltered = useMemo(() => {
    let result = books
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(b =>
        b.meta.title.toLowerCase().includes(q) ||
        b.meta.author.toLowerCase().includes(q)
      )
    }
    switch (sortMode) {
      case 'title':
        result = [...result].sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'zh'))
        break
      case 'progress':
        result = [...result].sort((a, b) => b.progress - a.progress)
        break
      default:
        result = [...result].sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt))
    }
    return result
  }, [books, search, sortMode])

  const continueBooks = useMemo(
    () => books.filter(b => b.progress > 0 && b.progress < 0.99).sort((a, b) => b.progress - a.progress).slice(0, 5),
    [books]
  )

  return (
    <div className="library-page">
      {/* 渐变头部 */}
      <header className="lib-header">
        <div className="lib-header-inner">
          <h1 className="lib-logo">
            <span className="lib-logo-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            <span>书海</span>
          </h1>
          <button className="lib-import-btn" onClick={handleImport} disabled={importing}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>{importing ? '导入中' : '导入'}</span>
          </button>
        </div>
      </header>

      {/* 搜索和排序 */}
      {books.length > 0 && (
        <div className="lib-toolbar">
          <div className="lib-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5, flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="搜索书名或作者"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`lib-sort-btn ${sortMode === 'recent' ? 'active' : ''}`}
            onClick={() => setSortMode(s => s === 'recent' ? 'title' : s === 'title' ? 'progress' : 'recent')}
            title="排序方式"
          >
            {sortMode === 'recent' ? '最近' : sortMode === 'title' ? '书名' : '进度'}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      )}

      <div className="lib-scroll">
        {/* 空状态 */}
        {books.length === 0 && !importing && (
          <div className="lib-empty">
            <div className="lib-empty-illustration">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </div>
            <h2>书库空空如也</h2>
            <p>导入你的电子书开始阅读之旅</p>
            <div className="lib-empty-formats">
              {['EPUB', 'PDF', 'MOBI', 'AZW3', 'TXT', 'FB2', 'CBZ', 'DOCX', 'MD'].map(f => (
                <span key={f} className="format-pill">{f}</span>
              ))}
            </div>
            <button className="lib-empty-cta" onClick={handleImport}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              导入电子书
            </button>
          </div>
        )}

        {/* 继续阅读 */}
        {continueBooks.length > 0 && !search && (
          <section className="lib-section">
            <h3 className="lib-section-title">继续阅读</h3>
            <div className="lib-continue-scroll">
              {continueBooks.map(book => (
                <div key={book.id} className="continue-card" onClick={() => handleContinueReading(book)}>
                  <div className="continue-cover">
                    {book.meta.cover ? (
                      <img src={book.meta.cover} alt="" />
                    ) : (
                      <div className="continue-cover-ph" style={{ background: formatColors[book.format] || '#666' }}>
                        <span>{book.format.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="continue-progress-ring" style={{
                      background: `conic-gradient(var(--accent) ${book.progress * 360}deg, rgba(0,0,0,0.3) 0)`
                    }}>
                      <span>{Math.round(book.progress * 100)}%</span>
                    </div>
                  </div>
                  <div className="continue-info">
                    <div className="continue-title">{book.meta.title}</div>
                    <div className="continue-author">{book.meta.author}</div>
                    <div className="continue-bar">
                      <div className="continue-bar-fill" style={{ width: `${book.progress * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 全部书籍 */}
        {sortedFiltered.length > 0 && (
          <section className="lib-section">
            <h3 className="lib-section-title">
              {search ? `搜索结果 (${sortedFiltered.length})` : `全部书籍 (${sortedFiltered.length})`}
            </h3>
            {viewMode === 'grid' ? (
              <div className="book-grid">
                {sortedFiltered.map(book => (
                  <BookCard key={book.id} book={book} onOpen={onOpenBook} onDelete={handleDelete} />
                ))}
              </div>
            ) : (
              <div className="book-list">
                {sortedFiltered.map(book => (
                  <BookListItem key={book.id} book={book} onOpen={onOpenBook} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </section>
        )}

        {books.length > 0 && sortedFiltered.length === 0 && (
          <div className="lib-empty-search">
            <p>未找到匹配「{search}」的书籍</p>
          </div>
        )}
      </div>

      {/* 浮动导入按钮 */}
      {books.length > 0 && (
        <button className="fab" onClick={handleImport} disabled={importing} title="导入书籍">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      )}

      {/* 导入遮罩 */}
      {importing && (
        <div className="import-overlay">
          <div className="import-card">
            <div className="spinner" />
            <p>{importProgress || '正在导入...'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ========== 书籍卡片组件 ==========
function BookCard({ book, onOpen, onDelete }: {
  book: BookRecord
  onOpen: (b: BookRecord) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const color = formatColors[book.format] || '#666'
  return (
    <div className="book-card" onClick={() => onOpen(book)}>
      <div className="book-cover" style={{ '--cover-color': color } as React.CSSProperties}>
        {book.meta.cover ? (
          <img src={book.meta.cover} alt={book.meta.title} />
        ) : (
          <div className="book-cover-ph">
            <div className="book-cover-spine" style={{ background: color }} />
            <div className="book-cover-text">
              <span className="book-cover-emoji">📖</span>
              <span className="book-cover-title">{book.meta.title}</span>
            </div>
          </div>
        )}
        <span className="book-format-badge" style={{ background: color }}>{book.format}</span>
        {book.progress > 0 && (
          <div className="book-progress-bar">
            <div className="book-progress-bar-fill" style={{ width: `${book.progress * 100}%` }} />
          </div>
        )}
        <button className="book-del-btn" onClick={(e) => onDelete(book.id, e)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div className="book-info">
        <div className="book-title">{book.meta.title}</div>
        <div className="book-author">{book.meta.author}</div>
      </div>
    </div>
  )
}

// ========== 列表项组件 ==========
function BookListItem({ book, onOpen, onDelete }: {
  book: BookRecord
  onOpen: (b: BookRecord) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const color = formatColors[book.format] || '#666'
  return (
    <div className="book-list-item" onClick={() => onOpen(book)}>
      <div className="book-list-cover" style={{ background: color }}>
        {book.meta.cover ? <img src={book.meta.cover} alt="" /> : <span>{book.format.toUpperCase()}</span>}
      </div>
      <div className="book-list-info">
        <div className="book-list-title">{book.meta.title}</div>
        <div className="book-list-author">{book.meta.author}</div>
        <div className="book-list-meta">
          <span>{formatFileSize(book.fileSize)}</span>
          {book.progress > 0 && <span>· 已读 {Math.round(book.progress * 100)}%</span>}
        </div>
      </div>
      <button className="book-list-del" onClick={(e) => onDelete(book.id, e)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
