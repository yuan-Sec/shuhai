// 构建后脚本：将foliate-js的vendor静态资源复制到dist目录
import { cpSync, mkdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const tasks = [
  {
    from: resolve(root, 'src/foliate/vendor/pdfjs'),
    to: resolve(root, 'dist/foliate/vendor/pdfjs'),
    desc: 'PDF.js vendor文件（cmaps、字体、worker）',
  },
]

for (const { from, to, desc } of tasks) {
  if (existsSync(from)) {
    mkdirSync(resolve(to, '..'), { recursive: true })
    cpSync(from, to, { recursive: true })
    console.log(`✓ 已复制: ${desc}`)
  } else {
    console.warn(`⚠ 跳过（源不存在）: ${desc} -> ${from}`)
  }
}

console.log('构建后处理完成')
