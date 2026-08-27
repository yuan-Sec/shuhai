// 电子书阅读器类型定义

/** 支持的电子书格式 */
export type BookFormat =
  | 'epub'
  | 'pdf'
  | 'txt'
  | 'mobi'
  | 'azw3'
  | 'fb2'
  | 'cbz'
  | 'cbr'
  | 'docx'
  | 'md'
  | 'html'
  | 'rtf'
  | 'unknown'

/** 书籍元数据 */
export interface BookMeta {
  title: string
  author: string
  description?: string
  publisher?: string
  language?: string
  cover?: string // base64 data URL
}

/** 书库中的书籍记录 */
export interface BookRecord {
  id: string
  fileName: string
  format: BookFormat
  fileSize: number
  addedAt: number
  lastReadAt?: number
  progress: number // 0-1
  favorite?: boolean
  tags?: string[]
  cfi?: string // foliate-js CFI 位置
  sectionIndex?: number
  meta: BookMeta
  blob: Blob // 原始文件
}

/** 阅读设置 */
export interface ReadingSettings {
  fontSize: number
  fontFamily: string
  lineHeight: number
  paragraphSpacing: number
  margin: number
  theme: 'dark' | 'light' | 'sepia' | 'cream'
  flow: 'paginated' | 'scrolled'
  brightness: number
  readingGoalMinutes: number
  highContrast: boolean
  reduceMotion: boolean
}

/** 目录项 */
export interface TOCItem {
  label: string
  href: string
  subitems?: TOCItem[]
}

/** 书签 */
export interface Bookmark {
  id: string
  bookId: string
  cfi: string
  label: string
  createdAt: number
}

/** 默认阅读设置 */
export const defaultSettings: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'system-ui, "Noto Sans SC", sans-serif',
  lineHeight: 1.8,
  paragraphSpacing: 12,
  margin: 24,
  theme: 'dark',
  flow: 'paginated',
  brightness: 100,
  readingGoalMinutes: 30,
  highContrast: false,
  reduceMotion: false,
}

/** 主题配色 */
export const themeColors = {
  dark: {
    bg: '#101513',
    bgSecondary: '#171e1b',
    text: '#e6edf3',
    textSecondary: '#aab7b1',
    accent: '#79b8a4',
    border: '#35413c',
    surface: '#202925',
  },
  light: {
    bg: '#ffffff',
    bgSecondary: '#f6f8fa',
    text: '#1f2328',
    textSecondary: '#656d76',
    accent: '#2f6f5e',
    border: '#c9d2ce',
    surface: '#f1f5f3',
  },
  sepia: {
    bg: '#f4ecd8',
    bgSecondary: '#e8dcc4',
    text: '#5b4636',
    textSecondary: '#8a7a65',
    accent: '#8b5a2b',
    border: '#d4c4a8',
    surface: '#ede0c8',
  },
  cream: {
    bg: '#fbf6ee',
    bgSecondary: '#f0e8d8',
    text: '#3a352d',
    textSecondary: '#7a7060',
    accent: '#75581e',
    border: '#d8ccb8',
    surface: '#f2eadb',
  },
}

/** 根据文件名检测格式 */
export function detectFormat(fileName: string): BookFormat {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  const map: Record<string, BookFormat> = {
    epub: 'epub',
    pdf: 'pdf',
    txt: 'txt',
    mobi: 'mobi',
    azw: 'azw3',
    azw3: 'azw3',
    kfx: 'azw3',
    fb2: 'fb2',
    cbz: 'cbz',
    cbr: 'cbr',
    cb7: 'cbz',
    cbt: 'cbz',
    docx: 'docx',
    doc: 'docx',
    md: 'md',
    markdown: 'md',
    html: 'html',
    htm: 'html',
    xhtml: 'html',
    rtf: 'rtf',
  }
  return map[ext] || 'unknown'
}

/** 所有支持的格式扩展名 */
export const supportedExtensions = [
  '.epub', '.pdf', '.txt', '.mobi', '.azw', '.azw3', '.kfx',
  '.fb2', '.fbz', '.cbz', '.cbr', '.cb7', '.cbt',
  '.docx', '.doc', '.md', '.markdown', '.html', '.htm', '.xhtml', '.rtf',
]
