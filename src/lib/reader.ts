// 阅读器引擎 v2
// EpubJSReader (epubjs) | PDFJSReader (pdfjs-dist) | HTMLReader (自定义)
// 不再依赖 foliate-js 渲染

import type { LoadedBook } from './formats'

/** relocate 回调 */
export interface RelocateDetail {
  fraction: number
  index: number
  sectionLabel?: string
}

type RelocateHandler = (detail: RelocateDetail) => void

// ============ EPUB 阅读器 (epubjs) ============

export class EpubJSReader {
  private container: HTMLElement
  private onRelocate: RelocateHandler
  private rendition: any = null
  private epubBook: any = null

  constructor(container: HTMLElement, onRelocate: RelocateHandler) {
    this.container = container
    this.onRelocate = onRelocate
  }

  async open(loaded: LoadedBook, cfi?: string, fraction?: number) {
    if (!loaded.epubBook) throw new Error('EpubJSReader 需要 epubBook 对象')
    this.epubBook = loaded.epubBook

    this.rendition = this.epubBook.renderTo(this.container, {
      width: '100%',
      height: '100%',
      spread: 'none',
      flow: 'paginated',
    })

    // 应用样式
    this.rendition.themes.default({
      body: { 'padding-top': '0 !important', 'padding-bottom': '0 !important' },
    })

    // 监听位置变化
    this.rendition.on('relocated', (location: any) => {
      const pct = this.rendition?.location?.start?.percentage ?? 0
      const label = location?.start?.label || ''
      this.onRelocate({
        fraction: pct,
        index: location?.start?.index ?? 0,
        sectionLabel: label,
      })
    })

    // 显示内容
    if (cfi) {
      await this.rendition.display(cfi)
    } else {
      await this.rendition.display()
    }
  }

  next() { this.rendition?.next() }
  prev() { this.rendition?.prev() }

  async goToTOCItem(href: string) {
    if (!this.rendition || !href) return
    try {
      await this.rendition.display(href)
    } catch (err) {
      console.warn('goToTOCItem failed:', err)
    }
  }

  async goToFraction(fraction: number) {
    if (!this.epubBook || !this.rendition) return
    try {
      const cfi = await this.epubBook.locations.cfiFromPercentage(fraction)
      await this.rendition.display(cfi)
    } catch { /* ignore */ }
  }

  getCFI(): string | undefined {
    return this.rendition?.location?.start?.cfi
  }

  getFraction(): number {
    return this.rendition?.location?.start?.percentage ?? 0
  }

  setFlow(flow: 'paginated' | 'scrolled') {
    if (!this.rendition) return
    this.rendition.flow(flow === 'scrolled' ? 'scrolled-doc' : 'paginated')
  }

  setMaxInlineSize(_size: number) {
    // epubjs 不直接支持，用 themes 替代
  }

  setGap(_gap: number) {
    // epubjs gap 通过 themes 控制
  }

  close() {
    this.rendition?.destroy?.()
    this.rendition = null
    this.epubBook?.destroy?.()
    this.epubBook = null
  }
}

// ============ PDF 阅读器 (pdfjs-dist) ============

export class PDFJSReader {
  private container: HTMLElement
  private onRelocate: RelocateHandler
  private pdfDoc: any = null
  private currentPage = 1
  private totalPages = 0
  private canvas: HTMLCanvasElement | null = null
  private rendering = false

  constructor(container: HTMLElement, onRelocate: RelocateHandler) {
    this.container = container
    this.onRelocate = onRelocate
  }

  async open(loaded: LoadedBook, fraction?: number) {
    if (!loaded.pdfDoc) throw new Error('PDFJSReader 需要 pdfDoc 对象')
    this.pdfDoc = loaded.pdfDoc
    this.totalPages = this.pdfDoc.numPages

    this.container.innerHTML = ''

    // 创建 canvas
    this.canvas = document.createElement('canvas')
    this.canvas.style.width = '100%'
    this.canvas.style.maxWidth = '100%'
    this.canvas.style.display = 'block'
    this.canvas.style.margin = '0 auto'
    this.container.appendChild(this.canvas)

    // 跳转到指定位置
    const startPage = fraction ? Math.max(1, Math.ceil(fraction * this.totalPages)) : 1
    this.currentPage = startPage

    await this.renderPage(startPage)
  }

  private async renderPage(pageNum: number) {
    if (this.rendering || !this.pdfDoc || !this.canvas) return
    this.rendering = true
    this.currentPage = pageNum

    try {
      const page = await this.pdfDoc.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = this.canvas
      const ctx = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      // 适配容器宽度
      const containerWidth = this.container.clientWidth
      const scale = containerWidth / viewport.width
      canvas.style.width = containerWidth + 'px'
      canvas.style.height = (viewport.height * scale) + 'px'

      await page.render({ canvasContext: ctx, viewport }).promise
    } catch (err) {
      console.error('PDF render error:', err)
    }

    this.rendering = false

    // 通知进度
    this.onRelocate({
      fraction: (this.currentPage - 1) / this.totalPages,
      index: this.currentPage - 1,
      sectionLabel: `第 ${this.currentPage} / ${this.totalPages} 页`,
    })
  }

  next() {
    if (this.currentPage < this.totalPages) {
      this.renderPage(this.currentPage + 1)
    }
  }

  prev() {
    if (this.currentPage > 1) {
      this.renderPage(this.currentPage - 1)
    }
  }

  async goToTOCItem(_href: string) {
    // PDF 目录跳转 — 简化实现
  }

  async goToFraction(fraction: number) {
    const page = Math.max(1, Math.ceil(fraction * this.totalPages))
    await this.renderPage(page)
  }

  getFraction(): number {
    return this.totalPages > 0 ? (this.currentPage - 1) / this.totalPages : 0
  }

  close() {
    this.canvas?.remove()
    this.canvas = null
    this.pdfDoc?.destroy?.()
    this.pdfDoc = null
  }
}

// ============ HTML 阅读器 (用于 TXT/MD/DOCX/HTML/RTF/MOBI/FB2/CBZ) ============

export class HTMLReader {
  private container: HTMLElement
  private contentEl: HTMLElement | null = null
  private onRelocate: RelocateHandler
  private html: string = ''
  private toc: { label: string; href: string }[] = []
  private currentSection = 0
  private sectionContents: string[] = []
  private settings: {
    fontSize: number
    fontFamily: string
    lineHeight: number
    margin: number
    theme: string
  } | null = null

  constructor(container: HTMLElement, onRelocate: RelocateHandler) {
    this.container = container
    this.onRelocate = onRelocate
  }

  open(book: LoadedBook, fraction?: number) {
    if (!book.htmlContent) throw new Error('HTMLReader 需要 htmlContent')

    this.html = book.htmlContent
    this.toc = book.toc

    // 按 <hr class="chapter-divider"> 分段
    this.sectionContents = this.html.split(/<hr class="chapter-divider">/).filter(s => s.trim())
    if (this.sectionContents.length === 0) {
      this.sectionContents = [this.html]
    }

    this.container.innerHTML = ''
    this.currentSection = 0

    if (fraction && this.sectionContents.length > 1) {
      this.currentSection = Math.floor(fraction * this.sectionContents.length)
      if (this.currentSection >= this.sectionContents.length) {
        this.currentSection = this.sectionContents.length - 1
      }
    }

    this.renderSection()
  }

  private renderSection() {
    this.container.innerHTML = ''

    const wrapper = document.createElement('div')
    wrapper.className = 'html-reader-wrapper'
    wrapper.innerHTML = this.sectionContents[this.currentSection] || ''

    // 图片懒加载
    wrapper.querySelectorAll('img').forEach(img => {
      img.loading = 'lazy'
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
    })

    if (this.settings) {
      wrapper.style.fontSize = `${this.settings.fontSize}px`
      wrapper.style.fontFamily = this.settings.fontFamily
      wrapper.style.lineHeight = String(this.settings.lineHeight)
      wrapper.style.padding = `0 ${this.settings.margin}px`
    }

    this.container.appendChild(wrapper)
    this.contentEl = wrapper

    const fraction = this.sectionContents.length > 1
      ? (this.currentSection + 0.5) / this.sectionContents.length
      : 0
    this.onRelocate({
      fraction,
      index: this.currentSection,
      sectionLabel: this.toc[this.currentSection]?.label,
    })
  }

  next() {
    const el = this.contentEl
    if (!el) return
    const scrollAmount = this.container.clientHeight * 0.85
    const atBottom = this.container.scrollTop + this.container.clientHeight >= el.scrollHeight - 10
    if (atBottom) {
      if (this.currentSection < this.sectionContents.length - 1) {
        this.currentSection++
        this.renderSection()
        this.container.scrollTop = 0
      }
    } else {
      this.container.scrollTop += scrollAmount
    }
  }

  prev() {
    const el = this.contentEl
    if (!el) return
    const scrollAmount = this.container.clientHeight * 0.85
    const atTop = this.container.scrollTop <= 10
    if (atTop) {
      if (this.currentSection > 0) {
        this.currentSection--
        this.renderSection()
        this.container.scrollTop = this.container.scrollHeight
      }
    } else {
      this.container.scrollTop -= scrollAmount
    }
  }

  goToSection(index: number) {
    if (index >= 0 && index < this.sectionContents.length) {
      this.currentSection = index
      this.renderSection()
      this.container.scrollTop = 0
    }
  }

  goToFraction(fraction: number) {
    if (this.sectionContents.length > 0) {
      this.currentSection = Math.floor(fraction * this.sectionContents.length)
      this.renderSection()
      this.container.scrollTop = 0
    }
  }

  setSettings(settings: {
    fontSize: number
    fontFamily: string
    lineHeight: number
    margin: number
    theme: string
  }) {
    this.settings = settings
    if (this.contentEl) {
      this.contentEl.style.fontSize = `${settings.fontSize}px`
      this.contentEl.style.fontFamily = settings.fontFamily
      this.contentEl.style.lineHeight = String(settings.lineHeight)
      this.contentEl.style.padding = `0 ${settings.margin}px`
    }
  }

  close() {
    this.container.innerHTML = ''
    this.contentEl = null
  }
}
