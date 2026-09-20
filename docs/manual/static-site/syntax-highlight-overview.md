# Syntax Highlight 方案概览

## 1. 方案清单

### 1.1 浏览器运行时方案（客户端 JS 高亮）

| 方案                                                        | Stars  | 语言支持 | 特点                                                                                            |
| ----------------------------------------------------------- | ------ | -------- | ----------------------------------------------------------------------------------------------- |
| [highlight.js](https://github.com/highlightjs/highlight.js) | 24,994 | 190+     | 老牌方案，核心优势是**语言自动检测**（不知道语言时也能猜）；发版活跃（11.12.0，2026-08）        |
| [Prism.js](https://github.com/PrismJS/prism)                | 13,038 | 290+     | 轻量、插件生态丰富（行高亮、复制按钮等），Docusaurus 等文档站默认；发版放缓（v1.30 为 2025-03） |

### 1.2 构建期方案（SSG / Markdown 生态，当前主流方向）

| 方案                                      | Stars  | 特点                                                                                                                                                                             |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Shiki](https://github.com/shikijs/shiki) | 13,819 | **现代文档站事实标准**：复用 VS Code 的 TextMate 语法 + 主题，构建期生成静态 HTML/CSS，运行时零 JS；VitePress、Astro、Nuxt、Starlight、Rspress 内置。发版活跃（v4.4.3，2026-08） |

### 1.3 编辑器级方案（不止高亮，完整编辑体验）

| 方案                                                        | Stars  | 特点                                                             |
| ----------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| [Monaco Editor](https://github.com/microsoft/monaco-editor) | 46,781 | VS Code 同款编辑器，重量级，适合在线 IDE                         |
| [CodeMirror 6](https://github.com/codemirror/dev)           |        | 模块化、移动端友好，适合可编辑代码块                             |
| [tree-sitter](https://github.com/tree-sitter/tree-sitter)   | 27,000 | 增量解析框架，真语法树而非正则，Neovim/Zed/GitHub 代码浏览都在用 |

\* codemirror/dev 是开发 monorepo，入口包为 npm 的 `codemirror`（6.x）。

### 1.4 非 JS 生态

| 方案                                             | Stars | 生态                           |
| ------------------------------------------------ | ----- | ------------------------------ |
| [Chroma](https://github.com/alecthomas/chroma)   | 5,038 | Go，Hugo 默认                  |
| [Rouge](https://github.com/jneen/rouge)          | 3,450 | Ruby，Jekyll/GitHub Pages 默认 |
| [Pygments](https://github.com/pygments/pygments) | 2,208 | Python，Sphinx/MkDocs 默认     |

## 2. Shiki 官方 integrations 与 SSG 的对应关系

Shiki 文档列出的 integrations
大多是插件/工具库（markdown-it、rehype、Monaco、Twoslash、transformers、colorized-brackets、magic-move、stream、codegen、CLI），其中能对应到
jamstack.org/generators 收录的**站点生成器**只有 4 个：

| Shiki 集成（shiki.style） | jamstack.org 显示 Stars | 语言                  |
| ------------------------- | ----------------------- | --------------------- |
| Next                      | 133,884                 | JavaScript            |
| Nuxt                      | 57,969                  | JavaScript            |
| Astro                     | 52,942                  | JavaScript/TypeScript |
| VitePress                 | 15,553                  | JavaScript            |

补充（用了 Shiki 但不在 Shiki 官方 integrations 列表中的 SSG）：

- **Starlight**（7,018 ⭐，基于 Astro，内置 Shiki）
- **rspress**（1,879 ⭐，jamstack 页面标注为 Rust，实际是 MDX 生态）

## 3. 背景概念：SSG

SSG = Static Site Generator（静态站点生成器）。在**构建时**把所有页面预渲染成纯 HTML/CSS/JS 静态文件，浏览器直接拿到现成
HTML；相对的 SSR 是每次请求时服务器动态渲染，CSR 是浏览器下载 JS 后客户端渲染。

语法高亮中的"构建期方案"即指高亮发生在 SSG 生成静态 HTML 阶段：

```
Markdown 源文件
   ↓  SSG 构建（VitePress 等）
高亮发生在这一步：Shiki 在构建时把代码块染成带 <span style> 的静态 HTML
   ↓
输出纯静态 HTML → 用户浏览器直接展示，运行时 0 JS、0 高亮计算
```

SSG + Shiki 比"页面加载后浏览器再跑 highlight.js/Prism"性能好得多（无闪烁、无运行时开销），这是它成为文档站主流方案的原因。jamstack.org/generators
是收录各种 SSG 的目录。
