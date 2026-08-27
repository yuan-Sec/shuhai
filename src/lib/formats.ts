// 电子书格式解析引擎 v2
// EPUB → epubjs | PDF → pdfjs-dist | MOBI/AZW3/FB2/CBZ → 文本提取 | TXT/MD/DOCX/HTML/RTF → 自定义
// 不再依赖 foliate-js 渲染

import type { BookFormat, BookMeta, TOCItem } from '../types'

/** 加载结果 */
export interface LoadedBook {
  format: BookFormat
  /** epubjs Book 对象（仅 EPUB 格式） */
  epubBook?: any
  /** PDF.js Document 对象（仅 PDF 格式） */
  pdfDoc?: any
  /** 用于所有文本类格式的 HTML 内容 */
  htmlContent?: string
  toc: TOCItem[]
  meta: BookMeta
  totalSections: number
  isFixedLayout: boolean
  isImageBased: boolean
}

// ============ 工具函数 ============

function escapeHTML(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 电子书内容来自用户文件，渲染前必须移除脚本、事件处理器和远程资源。
 * 允许 data:image、blob 与包内相对路径，保证阅读过程不会主动联网。
 */
export function sanitizeBookHTML(input: string): string {
  const documentNode = new DOMParser().parseFromString(input, 'text/html')
  documentNode.querySelectorAll('script, iframe, object, embed, form, input, button, meta, base, link').forEach(node => node.remove())

  documentNode.querySelectorAll('*').forEach(node => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase()
      const value = attr.value.trim()
      if (name.startsWith('on') || name === 'srcdoc') {
        node.removeAttribute(attr.name)
        continue
      }
      if (name === 'style' && /(?:url\s*\(|expression\s*\()/i.test(value)) {
        node.removeAttribute(attr.name)
        continue
      }
      if (name === 'href') {
        if (/^(?:javascript|data):/i.test(value) || /^(?:https?:)?\/\//i.test(value)) {
          node.removeAttribute(attr.name)
        }
        continue
      }
      if (name === 'src' || name === 'poster' || name === 'xlink:href') {
        const isSafeImageData = /^data:image\//i.test(value)
        const isLocal = /^(?:blob:|\.\.?\/|#)/i.test(value) || (!/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('//'))
        if (!isSafeImageData && !isLocal) node.removeAttribute(attr.name)
      }
    }
  })

  return documentNode.body.innerHTML
}

function extractFileName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '')
}

// ============ EPUB (epubjs) ============

async function loadEPUB(file: File): Promise<LoadedBook> {
  const ePub = (await import('epubjs')).default
  const arrayBuffer = await file.arrayBuffer()
  const book = ePub(arrayBuffer)

  await book.ready

  const meta: BookMeta = {
    title: book.packaging?.metadata?.title || extractFileName(file),
    author: book.packaging?.metadata?.creator || '未知作者',
    description: book.packaging?.metadata?.description || '',
    publisher: book.packaging?.metadata?.publisher || '',
    language: book.packaging?.metadata?.language || '',
  }

  const toc: TOCItem[] = (book.navigation?.toc || []).map((item: any) => ({
    label: item.label?.trim() || item.href,
    href: item.href,
    subitems: item.subitems?.map((sub: any) => ({
      label: sub.label?.trim() || sub.href,
      href: sub.href,
    })),
  }))

  return {
    format: 'epub',
    epubBook: book,
    toc,
    meta,
    totalSections: book.packaging?.spine?.length || 1,
    isFixedLayout: book.packaging?.metadata?.layout === 'pre-paginated',
    isImageBased: false,
  }
}

// ============ PDF (pdfjs-dist) ============

async function loadPDF(file: File): Promise<LoadedBook> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise

  const toc: TOCItem[] = []
  const outline = await pdfDoc.getOutline().catch(() => null)
  if (outline) {
    for (const item of outline) {
      toc.push({ label: item.title, href: String(item.dest || '') })
    }
  }

  return {
    format: 'pdf',
    pdfDoc,
    toc,
    meta: { title: extractFileName(file), author: '未知作者' },
    totalSections: pdfDoc.numPages,
    isFixedLayout: true,
    isImageBased: false,
  }
}

// ============ MOBI/AZW3 (foliate-js 解析 + 文本提取) ============

async function loadMOBI(file: File, format: BookFormat): Promise<LoadedBook> {
  try {
    const foliateView = await import('../foliate/view.js')
    const { makeBook } = foliateView
    const book: any = await makeBook(file)
    if (book && book.sections) {
      const htmlParts: string[] = []
      for (const section of book.sections) {
        if (!section || section.linear === 'no') continue
        try {
          const result = await section.load?.()
          if (typeof result === 'string') htmlParts.push(result)
          else if (result instanceof Blob) htmlParts.push(await result.text())
        } catch { /* skip */ }
      }
      if (htmlParts.length > 0) {
        const htmlContent = htmlParts.join('\n<hr class="chapter-divider">\n')
        const toc: TOCItem[] = (book.toc || []).slice(0, 50).map((t: any) => ({ label: t.label, href: t.href }))
        return {
          format,
          htmlContent,
          toc,
          meta: {
            title: book.metadata?.title
              ? (typeof book.metadata.title === 'string' ? book.metadata.title : String(book.metadata.title))
              : extractFileName(file),
            author: book.metadata?.author ? String(book.metadata.author) : '未知作者',
          },
          totalSections: htmlParts.length,
          isFixedLayout: false,
          isImageBased: false,
        }
      }
    }
  } catch (err) {
    console.warn('foliate-js MOBI 解析失败，回退到文本:', err)
  }
  return await loadAsTextFallback(file, format)
}

// ============ FB2 ============

async function loadFB2(file: File): Promise<LoadedBook> {
  try {
    const foliateView = await import('../foliate/view.js')
    const { makeBook } = foliateView
    const book: any = await makeBook(file)
    if (book && book.sections) {
      const htmlParts: string[] = []
      for (const section of book.sections) {
        if (!section) continue
        try {
          const result = await section.load?.()
          if (typeof result === 'string') htmlParts.push(result)
          else if (result instanceof Blob) htmlParts.push(await result.text())
        } catch { /* skip */ }
      }
      if (htmlParts.length > 0) {
        const htmlContent = htmlParts.join('\n<hr class="chapter-divider">\n')
        return {
          format: 'fb2',
          htmlContent,
          toc: (book.toc || []).slice(0, 50).map((t: any) => ({ label: t.label, href: t.href })),
          meta: {
            title: book.metadata?.title ? String(book.metadata.title) : extractFileName(file),
            author: book.metadata?.author ? String(book.metadata.author) : '未知作者',
          },
          totalSections: htmlParts.length,
          isFixedLayout: false,
          isImageBased: false,
        }
      }
    }
  } catch (err) {
    console.warn('foliate-js FB2 解析失败，回退到文本:', err)
  }
  return await loadAsTextFallback(file, 'fb2')
}

// ============ CBZ (漫画) ============

async function loadCBZ(file: File): Promise<LoadedBook> {
  try {
    const foliateView = await import('../foliate/view.js')
    const { makeBook } = foliateView
    const book: any = await makeBook(file)
    if (book && book.sections) {
      const htmlParts: string[] = []
      for (const section of book.sections) {
        if (!section) continue
        try {
          const result = await section.load?.()
          if (typeof result === 'string' && result.startsWith('data:')) {
            htmlParts.push(`<img src="${result}" style="max-width:100%;height:auto;" />`)
          } else if (result instanceof Blob) {
            const url = URL.createObjectURL(result)
            htmlParts.push(`<img src="${url}" style="max-width:100%;height:auto;" />`)
          }
        } catch { /* skip */ }
      }
      if (htmlParts.length > 0) {
        return {
          format: 'cbz',
          htmlContent: htmlParts.join('\n'),
          toc: [],
          meta: { title: extractFileName(file), author: '未知作者' },
          totalSections: htmlParts.length,
          isFixedLayout: true,
          isImageBased: true,
        }
      }
    }
  } catch (err) {
    console.warn('foliate-js CBZ 解析失败:', err)
  }
  return await loadAsTextFallback(file, 'cbz')
}

// ============ 文本类格式 ============

async function loadTXT(file: File): Promise<string> {
  const text = await file.text()
  const chapters = splitTXTChapters(text)
  if (chapters.length > 1) {
    return chapters.map(ch =>
      `<h2 class="txt-chapter-title">${escapeHTML(ch.title)}</h2>\n<div class="txt-content">${escapeHTML(ch.content).replace(/\n/g, '<br>')}</div>`
    ).join('\n<hr class="chapter-divider">\n')
  }
  return `<div class="txt-content">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`
}

function splitTXTChapters(text: string): { title: string; content: string }[] {
  const patterns = [
    /^第[一二三四五六七八九十百千零\d]+[章节回卷]/m,
    /^Chapter\s+\d+/im,
    /^[【[]?.{1,20}[】\]]$/m,
  ]
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      const lines = text.split('\n')
      const chapters: { title: string; content: string }[] = []
      let currentTitle = '开始'
      let currentContent: string[] = []
      for (const line of lines) {
        if (pattern.test(line) && line.trim().length < 30) {
          if (currentContent.length > 0) {
            chapters.push({ title: currentTitle, content: currentContent.join('\n') })
          }
          currentTitle = line.trim()
          currentContent = []
        } else {
          currentContent.push(line)
        }
      }
      if (currentContent.length > 0) {
        chapters.push({ title: currentTitle, content: currentContent.join('\n') })
      }
      if (chapters.length > 1) return chapters
    }
  }
  return [{ title: '全文', content: text }]
}

async function loadMarkdown(file: File): Promise<string> {
  const { marked } = await import('marked')
  const text = await file.text()
  return await marked.parse(text)
}

async function loadDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth')
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return result.value
}

async function loadRTF(file: File): Promise<string> {
  const text = await file.text()
  const plainText = text
    .replace(/\\par[d]?/g, '\n')
    .replace(/\\'[0-9a-f]{2}/g, '')
    .replace(/\\[a-z]+-?\d+ ?/g, '')
    .replace(/[{}]/g, '')
    .replace(/\\\*\\[a-z]+/g, '')
    .trim()
  return `<div class="txt-content">${escapeHTML(plainText).replace(/\n/g, '<br>')}</div>`
}

// ============ 通用文本回退 ============

async function loadAsTextFallback(file: File, format: BookFormat): Promise<LoadedBook> {
  const text = await file.text()
  let htmlContent: string
  if (text.trimStart().startsWith('<')) {
    htmlContent = text
  } else {
    htmlContent = `<div class="txt-content">${escapeHTML(text).replace(/\n/g, '<br>')}</div>`
  }
  const headings = htmlContent.match(/<h[1-3][^>]*>(.+?)<\/h[1-3]>/g)
  const toc: TOCItem[] = headings
    ? headings.slice(0, 50).map((h, i) => ({ label: h.replace(/<[^>]+>/g, '').slice(0, 40), href: `heading-${i}` }))
    : []
  return {
    format,
    htmlContent,
    toc,
    meta: { title: extractFileName(file), author: '未知作者' },
    totalSections: toc.length || 1,
    isFixedLayout: false,
    isImageBased: false,
  }
}

// ============ 主入口 ============

export async function loadBook(file: File, format: BookFormat): Promise<LoadedBook> {
  switch (format) {
    case 'epub':
      return await loadEPUB(file)
    case 'pdf':
      return await loadPDF(file)
    case 'mobi':
    case 'azw3':
      return await loadMOBI(file, format)
    case 'fb2':
      return await loadFB2(file)
    case 'cbz':
      return await loadCBZ(file)
    case 'txt': {
      const html = await loadTXT(file)
      const titles = html.match(/<h2 class="txt-chapter-title">(.+?)<\/h2>/g)
      const toc: TOCItem[] = titles?.map((t, i) => ({ label: t.replace(/<[^>]+>/g, ''), href: `chapter-${i}` })) || []
      return { format: 'txt', htmlContent: html, toc, meta: { title: extractFileName(file), author: '未知作者' }, totalSections: toc.length || 1, isFixedLayout: false, isImageBased: false }
    }
    case 'md': {
      const html = await loadMarkdown(file)
      const headings = html.match(/<h[1-3][^>]*>(.+?)<\/h[1-3]>/g)
      const toc: TOCItem[] = headings?.map((h, i) => ({ label: h.replace(/<[^>]+>/g, '').slice(0, 40), href: `heading-${i}` })) || []
      return { format: 'md', htmlContent: html, toc, meta: { title: extractFileName(file), author: '未知作者' }, totalSections: toc.length || 1, isFixedLayout: false, isImageBased: false }
    }
    case 'docx': {
      const html = await loadDOCX(file)
      return { format: 'docx', htmlContent: html, toc: [], meta: { title: extractFileName(file), author: '未知作者' }, totalSections: 1, isFixedLayout: false, isImageBased: false }
    }
    case 'html': {
      const html = await file.text()
      return { format: 'html', htmlContent: html, toc: [], meta: { title: extractFileName(file), author: '未知作者' }, totalSections: 1, isFixedLayout: false, isImageBased: false }
    }
    case 'rtf': {
      const html = await loadRTF(file)
      return { format: 'rtf', htmlContent: html, toc: [], meta: { title: extractFileName(file), author: '未知作者' }, totalSections: 1, isFixedLayout: false, isImageBased: false }
    }
    default:
      return await loadAsTextFallback(file, format)
  }
}
