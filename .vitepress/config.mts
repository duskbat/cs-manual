import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { configureDiagramsPlugin } from "vitepress-plugin-diagrams";
import { generateSidebar } from "vitepress-sidebar";
import { DarkRaw as darculaTheme } from "jetbrains-ide-themes";

// ============================================================
// 侧边栏 & 顶部导航
// ============================================================

/**
 * 自动生成侧边栏配置
 * 使用 vitepress-sidebar 插件自动扫描目录生成，各板块共享同一套扫描规则
 * 文档: https://vitepress-sidebar.cdget.com
 */

/** 板块定义：dir 为 docs 下的扫描目录，title 为侧边栏根标题 */
const sections = [
  { dir: "manual/redis", title: "Redis" },
  { dir: "manual/leetcode/new", title: "leetcode" },
  { dir: "manual/blog", title: "Blog" },
  { dir: "manual/Java", title: "Java" },
  { dir: "manual/MySQL", title: "MySQL" },
  { dir: "manual/static-site", title: "静态站" },
];

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
  })),
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

// ============================================================
// VitePress 配置
// ============================================================

const vitePressConfig = defineConfig({
  /**
   * 站点基础路径
   * 部署到子路径时必须设置，如 GitHub Pages 的项目站点
   */
  base: "/cs-manual/",

  /**
   * 源文件目录
   * .vitepress 位于仓库根目录时，用 srcDir 指回文档目录
   */
  srcDir: "docs",

  title: "CS Manual",
  description: "Computer Science Manual",
  lastUpdated: true, // 显示最后更新时间

  themeConfig: {
    // --------------------------------------------------------
    // 顶部导航栏
    // link 以 / 开头：相对于 docs 目录
    // --------------------------------------------------------
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

    // --------------------------------------------------------
    // 其他主题配置
    // --------------------------------------------------------
    outline: {
      level: "deep", // 显示深层标题大纲
    },
    socialLinks: [{ icon: "github", link: "https://github.com/duskbat" }],
    search: {
      provider: "local", // 本地搜索
    },
  },

  // --------------------------------------------------------
  // Markdown 配置
  // --------------------------------------------------------
  markdown: {
    /**
     * 代码高亮主题
     * 可选主题: https://shiki.style/gallery
     * darculaTheme: JetBrains IntelliJ IDEA Darcula 深色主题（手动加载）
     */
    theme: {
      light: "github-light",
      dark: "dark-plus",
    },
    math: true, // 启用数学公式支持
    config: async (md) => {
      /**
       * 配置图表插件 (PlantUML, Graphviz 等)
       * 通过 Kroki 服务器渲染图表为 SVG
       * 文档: https://github.com/emersonbottero/vitepress-plugin-diagrams
       */
      configureDiagramsPlugin(md, {
        diagramsDir: "docs/public/diagrams", // SVG 文件存储目录
        publicPath: "/cs-manual/diagrams/", // SVG 访问路径（需包含 base）
        krokiServerUrl: "https://kroki.io", // Kroki 渲染服务器
        excludedDiagramTypes: ["mermaid"], // mermaid 由 vitepress-plugin-mermaid 处理
      });
    },
  },
});

// 使用 withMermaid 包装以支持 Mermaid 图表
export default withMermaid(vitePressConfig);
