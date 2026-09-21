import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { configureDiagramsPlugin } from "vitepress-plugin-diagrams";
import { generateSidebar } from "vitepress-sidebar";
import { DarkRaw as darculaTheme } from "jetbrains-ide-themes";

// ---------- 侧边栏 & 顶部导航 ----------

/** 板块定义：dir 为 docs 下的扫描目录，title 为侧边栏根标题 */
const sections = [
  { dir: "manual/redis", title: "Redis" },
  { dir: "manual/leetcode/new", title: "leetcode" },
  { dir: "manual/blog", title: "Blog" },
  { dir: "manual/Java", title: "Java" },
  { dir: "manual/MySQL", title: "MySQL" },
  { dir: "manual/static-site", title: "静态站" },
];

/** 侧边栏：由 vitepress-sidebar 扫描目录生成（文档: https://vitepress-sidebar.cdget.com） */
const sidebar = generateSidebar(
  sections.map(({ dir, title }) => ({
    documentRootPath: "docs",
    useTitleFromFileHeading: true, // 标题取自文件的一级标题
    useFolderTitleFromIndexFile: true, // 文件夹名取自目录下 index.md 的标题
    useFolderLinkFromIndexFile: true, // 点击文件夹时跳转到目录下的 index.md
    collapsed: false, // 默认展开
    scanStartPath: dir, // 扫描 docs/<dir>
    resolvePath: `/${dir}/`, // 匹配 /<dir>/ 开头的路由
    rootGroupText: title,
    rootGroupCollapsed: false, // 根目录默认展开，可点击折叠
  }))
);

/**
 * 顶导项：activeMatch 省略时取 link 所在目录（尾随 /），
 * 板块内任一页面都保持高亮；单文件入口需显式传入自身路径
 */
const navItem = (text: string, link: string, activeMatch?: string) => ({
  text,
  link,
  activeMatch: activeMatch ?? link.slice(0, link.lastIndexOf("/") + 1),
});

// ---------- VitePress 配置 ----------

const vitePressConfig = defineConfig({
  base: "/cs-manual/", // 部署到子路径（GitHub Pages 项目站点）
  srcDir: "docs", // 文档源码目录

  title: "CS Manual",
  description: "Computer Science Manual",
  lastUpdated: true, // 页面显示最后更新时间

  themeConfig: {
    // link 以 / 开头，对应 docs/ 下的页面路径
    nav: [
      navItem("blog", "/manual/blog/blog"),
      navItem("静态站", "/manual/static-site/syntax-highlight-overview"),
      navItem("算法", "/manual/leetcode/new/leetcode"),
      navItem("Java", "/manual/Java/Java发展史"),
      navItem("Redis", "/manual/redis/redis-mindmap"),
      navItem("MySQL", "/manual/MySQL/MySQL-mindmap"),
      navItem("Tomcat", "/manual/Tomcat", "/manual/Tomcat"),
    ],

    sidebar,

    outline: {
      level: "deep", // 大纲显示深层标题
    },
    socialLinks: [{ icon: "github", link: "https://github.com/duskbat" }],
    search: {
      provider: "local", // 本地搜索
    },
  },

  markdown: {
    // 代码高亮主题，可选主题见 https://shiki.style/gallery
    // darculaTheme 为手动加载的 Darcula 主题，当前未使用
    theme: {
      light: "github-light",
      dark: "dark-plus",
    },
    math: true, // 数学公式支持
    config: async (md) => {
      // 通过 Kroki 服务器渲染 PlantUML/Graphviz 等图表为 SVG
      configureDiagramsPlugin(md, {
        diagramsDir: "docs/public/diagrams", // SVG 文件存储目录
        publicPath: "/cs-manual/diagrams/", // SVG 访问路径（需包含 base）
        krokiServerUrl: "https://kroki.io",
        excludedDiagramTypes: ["mermaid"], // mermaid 由 vitepress-plugin-mermaid 处理
      });
    },
  },
});

// withMermaid 包装以支持 Mermaid 图表
export default withMermaid(vitePressConfig);
