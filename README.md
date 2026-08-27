

# 书海 - 本地电子书阅读器

完全离线、本地运行的 Android 电子书阅读器，数据不上传，隐私安全。

## 功能特性

- **完全离线** - Android 版本不申请联网权限，书籍、进度和偏好均保留在设备中
- **多格式支持** - 支持 EPUB、PDF、MOBI、AZW3、TXT、FB2、CBZ、DOCX、MD、HTML、RTF 等 11+ 种格式
- **现代书库** - 支持网格/列表视图、搜索、排序、阅读状态筛选、收藏和继续阅读
- **专注阅读** - 支持书内搜索、书签、进度恢复、翻页/滚动模式及字体、字号、行距调节
- **阅读统计** - 每日目标、连续阅读、本周趋势和成就系统
- **无障碍** - 高对比度、减少动态效果、清晰焦点状态和触控友好的交互尺寸
- **完整备份** - 图书文件、进度、书签、设置与统计可导出为 JSON，并可在本地恢复
- **内容防护** - 导入 HTML 类内容时移除脚本、嵌入对象、事件处理器与远程资源地址

## 技术栈

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 19 + TypeScript | SPA 架构 |
| 构建工具 | Vite 7 | 开发与打包 |
| 移动端封装 | Capacitor 4 | Android APK 打包 |
| EPUB 渲染 | epubjs 0.3.93 | iframe 方式渲染 |
| PDF 渲染 | pdfjs-dist 5.4.624 | Mozilla 官方 PDF 库 |
| MOBI/AZW3/FB2/CBZ 解析 | foliate-js | 仅解析提取文本 |
| TXT/MD/HTML/DOCX/RTF | 自定义实现 | HTML 渲染 |
| 本地存储 | IndexedDB (idb) | 图书 Blob 与阅读进度 |
| Markdown 解析 | marked | MD 转 HTML |

## 架构设计

采用三阅读器架构，根据文件格式自动选择渲染引擎：

```
用户导入书籍
    │
    ▼
detectFormat() 格式检测
    │
    ├── EPUB ────────→ EpubJSReader (epubjs, iframe 渲染)
    ├── PDF ─────────→ PDFJSReader (pdfjs-dist, canvas 渲染)
    ├── MOBI/AZW3 ───→ foliate-js 解析 → HTMLReader (HTML 渲染)
    ├── FB2/CBZ ─────→ foliate-js 解析 → HTMLReader (HTML 渲染)
    └── TXT/MD/HTML
        /DOCX/RTF ──→ 自定义解析 → HTMLReader (HTML 渲染)
```

## 项目结构

```
ebook-reader/
├── src/
│   ├── components/
│   │   ├── Library.tsx      # 书库页面
│   │   ├── Reader.tsx       # 阅读器页面
│   │   ├── Stats.tsx        # 统计页面
│   │   └── Settings.tsx     # 设置页面
│   ├── lib/
│   │   ├── db.ts            # IndexedDB 封装
│   │   ├── formats.ts       # 格式检测与解析
│   │   └── reader.ts        # 三阅读器引擎
│   ├── foliate/             # foliate-js 源码（仅用于解析）
│   ├── types.ts             # 类型定义
│   ├── App.tsx              # 主应用
│   └── index.css            # 全局样式
├── android/                 # Capacitor Android 项目
├── scripts/postbuild.mjs    # 构建后处理
├── vite.config.ts
├── capacitor.config.ts
└── package.json
```

## 本地开发

需要 Node.js 20.19 或更高版本。

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建 Web 资源
npm run build

# 构建 Web + 同步到 Android
npm run build:full
```

## 构建 APK

需要 JDK 11 和 Android SDK。

```bash
# 设置环境变量
export JAVA_HOME=/path/to/jdk-11
export ANDROID_HOME=/path/to/android-sdk

# 构建 Web + 同步 + 打包 APK
npm run build:full
cd android
./gradlew assembleDebug

# APK 输出
# android/app/build/outputs/apk/debug/app-debug.apk
```

## 已知限制

- MOBI/AZW3 格式仅提取文本内容，不保留原始排版
- CBZ 格式显示图片序列
- 完整备份会把图书文件编码到一个 JSON 中，大型书库的导出文件可能较大
- 此为 Debug 版 APK，未签名发布

## 设计与产品约束

- [PRODUCT.md](./PRODUCT.md) 定义产品定位、用户、无障碍基线与反例
- [DESIGN.md](./DESIGN.md) 定义颜色、排版、层级和组件规范

## License

MIT

