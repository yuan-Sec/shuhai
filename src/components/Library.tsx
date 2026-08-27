import { useCallback, useEffect, useMemo, useState } from 'react'
import type { BookRecord } from '../types'
import { detectFormat, supportedExtensions } from '../types'
import { addBook, deleteBook, getAllBooks, setBookFavorite } from '../lib/db'
import { loadBook } from '../lib/formats'

const formatColors: Record<string, string> = {
  epub: '#2f7d62', pdf: '#b94b44', txt: '#607080', mobi: '#a96322',
  azw3: '#985236', fb2: '#715b96', cbz: '#b03e5b', cbr: '#9a456d',
  docx: '#3568a8', md: '#427a4d', html: '#9b742c', rtf: '#65717b',
}

interface LibraryProps {
  onOpenBook: (book: BookRecord) => void
}

type SortMode = 'recent' | 'title' | 'progress'
type ShelfFilter = 'all' | 'reading' | 'favorite' | 'finished'

export function Library({ onOpenBook }: LibraryProps) {
  const [books, setBooks] = useState<BookRecord[]>([])
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('recent')
  const [filter, setFilter] = useState<ShelfFilter>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const refresh = useCallback(async () => setBooks(await getAllBooks()), [])
  useEffect(() => { refresh() }, [refresh])

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = supportedExtensions.join(',')
    input.onchange = async event => {
      const files = Array.from((event.target as HTMLInputElement).files || [])
      if (!files.length) return
      setImporting(true)
      for (let index = 0; index < files.length; index++) {
        const file = files[index]
        const format = detectFormat(file.name)
        if (format === 'unknown') continue
        setImportProgress(`正在整理 ${index + 1}/${files.length} · ${file.name}`)
        let meta = { title: file.name.replace(/\.[^.]+$/, ''), author: '未知作者' }
        try {
          meta = (await loadBook(file, format)).meta
        } catch (error) {
          console.warn(`无法读取 ${file.name} 的元数据`, error)
        }
        await addBook({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          fileName: file.name,
          format,
          fileSize: file.size,
          addedAt: Date.now(),
          progress: 0,
          favorite: false,
          meta,
          blob: file,
        })
      }
      setImporting(false)
      setImportProgress('')
      await refresh()
    }
    input.click()
  }

  const handleDelete = async (book: BookRecord) => {
    if (!confirm(`从书库删除《${book.meta.title}》？\n原始文件不会从设备文件夹中删除。`)) return
    await deleteBook(book.id)
    await refresh()
  }

  const handleFavorite = async (book: BookRecord) => {
    await setBookFavorite(book.id, !book.favorite)
    setBooks(current => current.map(item => item.id === book.id ? { ...item, favorite: !item.favorite } : item))
  }

  const visibleBooks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    let result = books.filter(book => {
      if (filter === 'reading' && !(book.progress > 0 && book.progress < 0.99)) return false
      if (filter === 'favorite' && !book.favorite) return false
      if (filter === 'finished' && book.progress < 0.99) return false
      if (!query) return true
      return `${book.meta.title} ${book.meta.author} ${book.fileName}`.toLocaleLowerCase().includes(query)
    })
    if (sortMode === 'title') result = [...result].sort((a, b) => a.meta.title.localeCompare(b.meta.title, 'zh'))
    else if (sortMode === 'progress') result = [...result].sort((a, b) => b.progress - a.progress)
    else result = [...result].sort((a, b) => (b.lastReadAt || b.addedAt) - (a.lastReadAt || a.addedAt))
    return result
  }, [books, filter, search, sortMode])

  const continueBook = useMemo(() => (
    books
      .filter(book => book.progress > 0 && book.progress < 0.99)
      .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))[0]
  ), [books])

  const readingCount = books.filter(book => book.progress > 0 && book.progress < 0.99).length
  const finishedCount = books.filter(book => book.progress >= 0.99).length

  return (
    <main className="library-page">
      <header className="library-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11a2 2 0 0 1 2 2v15a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v17a2.5 2.5 0 0 1 2.5-2.5H20z"/></svg>
          </span>
          <div>
            <h1>书海</h1>
            <p>你的离线阅读空间</p>
          </div>
        </div>
        <button className="btn btn-primary import-button" onClick={handleImport}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0-12 4 4m-4-4L8 7M5 14v5h14v-5"/></svg>
          导入图书
        </button>
      </header>

      <div className="library-scroll">
        {continueBook && !search && filter === 'all' && (
          <section className="continue-strip" aria-label="继续阅读">
            <BookCover book={continueBook} compact />
            <div className="continue-copy">
              <span className="section-label">继续阅读</span>
              <h2>{continueBook.meta.title}</h2>
              <p>{continueBook.meta.author}</p>
              <div className="continue-progress-row">
                <div className="progress-track"><span style={{ width: `${Math.max(2, continueBook.progress * 100)}%` }} /></div>
                <span>{Math.round(continueBook.progress * 100)}%</span>
              </div>
            </div>
            <button className="continue-action" onClick={() => onOpenBook(continueBook)} aria-label={`继续阅读 ${continueBook.meta.title}`}>
              继续
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </section>
        )}

        <section className="library-toolbar" aria-label="书库筛选">
          <label className="search-box">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索书名、作者或文件名" />
            {search && <button onClick={() => setSearch('')} aria-label="清空搜索">×</button>}
          </label>
          <div className="toolbar-actions">
            <select value={sortMode} onChange={event => setSortMode(event.target.value as SortMode)} aria-label="排序方式">
              <option value="recent">最近阅读</option>
              <option value="title">书名排序</option>
              <option value="progress">阅读进度</option>
            </select>
            <div className="view-toggle" aria-label="视图方式">
              <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="网格视图">
                <svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/></svg>
              </button>
              <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="列表视图">
                <svg viewBox="0 0 24 24"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
              </button>
            </div>
          </div>
        </section>

        {books.length > 0 && (
          <div className="shelf-summary">
            <span><strong>{books.length}</strong> 本藏书</span>
            <span><strong>{readingCount}</strong> 本阅读中</span>
            <span><strong>{finishedCount}</strong> 本已读完</span>
          </div>
        )}

        <nav className="filter-tabs" aria-label="书架分类">
          {([
            ['all', '全部'], ['reading', '阅读中'], ['favorite', '收藏'], ['finished', '已读完'],
          ] as Array<[ShelfFilter, string]>).map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </nav>

        {visibleBooks.length > 0 ? (
          <section className={viewMode === 'grid' ? 'book-grid' : 'book-list'} aria-label="图书列表">
            {visibleBooks.map(book => (
              <BookItem
                key={book.id}
                book={book}
                mode={viewMode}
                onOpen={() => onOpenBook(book)}
                onFavorite={() => handleFavorite(book)}
                onDelete={() => handleDelete(book)}
              />
            ))}
          </section>
        ) : (
          <EmptyLibrary hasBooks={books.length > 0} onImport={handleImport} onReset={() => { setSearch(''); setFilter('all') }} />
        )}
      </div>

      {importing && (
        <div className="import-overlay" role="status" aria-live="polite">
          <div className="import-card">
            <div className="book-loader" aria-hidden="true"><span/><span/><span/></div>
            <strong>正在加入书库</strong>
            <p>{importProgress}</p>
            <small>图书只保存在当前设备</small>
          </div>
        </div>
      )}
    </main>
  )
}

function BookItem({ book, mode, onOpen, onFavorite, onDelete }: {
  book: BookRecord
  mode: 'grid' | 'list'
  onOpen: () => void
  onFavorite: () => void
  onDelete: () => void
}) {
  return (
    <article className={`book-item ${mode}`}>
      <button className="book-open" onClick={onOpen} aria-label={`打开 ${book.meta.title}`}>
        <BookCover book={book} compact={mode === 'list'} />
        <div className="book-info">
          <h2>{book.meta.title}</h2>
          <p>{book.meta.author || '未知作者'}</p>
          <div className="book-meta-line">
            <span>{book.format.toUpperCase()}</span>
            <span>{formatFileSize(book.fileSize)}</span>
          </div>
          <div className="book-progress" aria-label={`阅读进度 ${Math.round(book.progress * 100)}%`}>
            <span style={{ width: `${book.progress * 100}%` }} />
          </div>
          <small>{book.progress >= 0.99 ? '已读完' : book.progress > 0 ? `已读 ${Math.round(book.progress * 100)}%` : '尚未开始'}</small>
        </div>
      </button>
      <div className="book-item-actions">
        <button className={book.favorite ? 'favorite active' : 'favorite'} onClick={onFavorite} aria-label={book.favorite ? '取消收藏' : '收藏'} title={book.favorite ? '取消收藏' : '收藏'}>
          <svg viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/></svg>
        </button>
        <button onClick={onDelete} aria-label="从书库删除" title="从书库删除">
          <svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"/></svg>
        </button>
      </div>
    </article>
  )
}

function BookCover({ book, compact = false }: { book: BookRecord; compact?: boolean }) {
  const title = book.meta.title.trim() || book.fileName
  return (
    <div className={`book-cover ${compact ? 'compact' : ''}`} style={{ backgroundColor: formatColors[book.format] || '#52606d' }}>
      {book.meta.cover ? <img src={book.meta.cover} alt="" /> : (
        <>
          <span className="cover-title">{title.slice(0, 18)}</span>
          <span className="cover-author">{book.meta.author || '未知作者'}</span>
          <span className="cover-format">{book.format.toUpperCase()}</span>
        </>
      )}
    </div>
  )
}

function EmptyLibrary({ hasBooks, onImport, onReset }: { hasBooks: boolean; onImport: () => void; onReset: () => void }) {
  return (
    <section className="empty-library">
      <div className="empty-book" aria-hidden="true"><span/><span/><span/></div>
      <h2>{hasBooks ? '没有找到符合条件的图书' : '从一本书开始'}</h2>
      <p>{hasBooks ? '换个关键词或清除筛选条件。' : '导入设备中的电子书。无需账号，文件和阅读记录都留在本地。'}</p>
      <button className="btn btn-primary" onClick={hasBooks ? onReset : onImport}>{hasBooks ? '清除筛选' : '选择电子书'}</button>
      {!hasBooks && <small>支持 EPUB、PDF、MOBI、AZW3、TXT、FB2、CBZ、DOCX 等格式</small>}
    </section>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
