import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BookRecord, ReadingSettings, Bookmark } from '../types'
import { defaultSettings } from '../types'

interface BookDB extends DBSchema {
  books: {
    key: string
    value: BookRecord
    indexes: { 'by-addedAt': number; 'by-lastReadAt': number }
  }
  settings: {
    key: string
    value: ReadingSettings
  }
  bookmarks: {
    key: string
    value: Bookmark
    indexes: { 'by-bookId': string }
  }
  stats: {
    key: string
    value: ReadingStat
  }
}

/** 阅读统计记录 */
export interface ReadingStat {
  date: string // YYYY-MM-DD
  totalMinutes: number
  booksOpened: number
  pagesRead: number
}

let dbInstance: IDBPDatabase<BookDB> | null = null

async function getDB(): Promise<IDBPDatabase<BookDB>> {
  if (dbInstance) return dbInstance
  dbInstance = await openDB<BookDB>('ebook-reader', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        const bookStore = db.createObjectStore('books', { keyPath: 'id' })
        bookStore.createIndex('by-addedAt', 'addedAt')
        bookStore.createIndex('by-lastReadAt', 'lastReadAt')
        db.createObjectStore('settings')
        const bookmarkStore = db.createObjectStore('bookmarks', { keyPath: 'id' })
        bookmarkStore.createIndex('by-bookId', 'bookId')
      }
      if (oldVersion < 2) {
        db.createObjectStore('stats')
      }
    },
  })
  return dbInstance
}

// ========== 书籍操作 ==========

export async function addBook(book: BookRecord): Promise<void> {
  const db = await getDB()
  await db.put('books', book)
}

export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await getDB()
  return db.get('books', id)
}

export async function getAllBooks(): Promise<BookRecord[]> {
  const db = await getDB()
  const books = await db.getAllFromIndex('books', 'by-addedAt')
  return books.reverse() // 最新的在前
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('books', id)
  // 同时删除该书的书签
  const bookmarks = await db.getAllFromIndex('bookmarks', 'by-bookId', id)
  await Promise.all(bookmarks.map(b => db.delete('bookmarks', b.id)))
}

export async function updateBookProgress(
  id: string,
  progress: number,
  cfi?: string,
  sectionIndex?: number,
): Promise<void> {
  const db = await getDB()
  const book = await db.get('books', id)
  if (book) {
    book.progress = progress
    book.lastReadAt = Date.now()
    if (cfi !== undefined) book.cfi = cfi
    if (sectionIndex !== undefined) book.sectionIndex = sectionIndex
    await db.put('books', book)
  }
}

// ========== 设置操作 ==========

export async function getSettings(): Promise<ReadingSettings> {
  const db = await getDB()
  const settings = await db.get('settings', 'reading')
  return settings || { ...defaultSettings }
}

export async function saveSettings(settings: ReadingSettings): Promise<void> {
  const db = await getDB()
  await db.put('settings', settings, 'reading')
}

// ========== 书签操作 ==========

export async function getBookmarks(bookId: string): Promise<Bookmark[]> {
  const db = await getDB()
  return db.getAllFromIndex('bookmarks', 'by-bookId', bookId)
}

export async function addBookmark(bookmark: Bookmark): Promise<void> {
  const db = await getDB()
  await db.put('bookmarks', bookmark)
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('bookmarks', id)
}

// ========== 统计操作 ==========

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function recordReading(minutes: number, pagesRead: number = 0): Promise<void> {
  const db = await getDB()
  const key = todayStr()
  const stat = await db.get('stats', key) || { date: key, totalMinutes: 0, booksOpened: 0, pagesRead: 0 }
  stat.totalMinutes += minutes
  stat.pagesRead += pagesRead
  stat.booksOpened += 1
  await db.put('stats', stat, key)
}

export async function getStats(days: number = 30): Promise<ReadingStat[]> {
  const db = await getDB()
  const stats: ReadingStat[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const stat = await db.get('stats', key)
    if (stat) {
      stats.push(stat)
    } else {
      stats.push({ date: key, totalMinutes: 0, booksOpened: 0, pagesRead: 0 })
    }
  }
  return stats
}

export async function getTotalStats(): Promise<{ totalMinutes: number; totalBooks: number; totalPages: number }> {
  const db = await getDB()
  const allStats = await db.getAll('stats')
  let totalMinutes = 0
  let totalPages = 0
  for (const s of allStats) {
    totalMinutes += s.totalMinutes
    totalPages += s.pagesRead
  }
  const totalBooks = await db.count('books')
  return { totalMinutes, totalBooks, totalPages }
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  await db.clear('books')
  await db.clear('bookmarks')
  await db.clear('stats')
}
