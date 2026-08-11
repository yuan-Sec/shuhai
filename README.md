---
AIGC:
  ContentProducer: '001191110102MAD55U9H0F10002'
  ContentPropagator: '001191110102MAD55U9H0F10002'
  Label: '1'
  ProduceID: '3e16c9ca-b3ef-42c0-96da-d75fe5c2f1e1'
  PropagateID: '3e16c9ca-b3ef-42c0-96da-d75fe5c2f1e1'
  ReservedCode1: '67ba30dc-bd09-4aa4-9c48-84cb79e1fcbc'
  ReservedCode2: '67ba30dc-bd09-4aa4-9c48-84cb79e1fcbc'
---

# 书海 - 本地电子书阅读器

完全离线、本地运行的 Android 电子书阅读器，数据不上传，隐私安全。

## 功能特性

- **完全离线** - 无需互联网连接，所有数据本地存储
- **多格式支持** - 支持 EPUB、PDF、MOBI、AZW3、TXT、FB2、CBZ、DOCX、MD、HTML、RTF 等 11+ 种格式
- **美观界面** - 深色/浅色/护眼/米色四种主题，可自定义字体、字号、行距
- **阅读统计** - 阅读时长、格式分布、成就系统
- **书库管理** - 搜索、排序、继续阅读、书签
- **隐私安全** - 所有图书数据存储在 IndexedDB，不上传任何信息

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
- 此为 Debug 版 APK，未签名发布

## License

MIT

> AI生成