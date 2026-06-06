import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { configureDiagramsPlugin } from "vitepress-plugin-diagrams";
import { generateSidebar } from "vitepress-sidebar";
import { DarkRaw as darculaTheme } from "jetbrains-ide-themes";

// ============================================================
// 侧边栏配置
// ============================================================

/**
 * 自动生成侧边栏配置
 * 使用 vitepress-sidebar 插件自动扫描目录生成侧边栏配置
 * 文档: https://github.com/tzking/vitepress-sidebar
 */
const sidebarConfig = generateSidebar([
  {
    documentRootPath: "docs",
    useTitleFromFileHeading: true, // 从文件的一级标题提取侧边栏标题
    useFolderTitleFromIndexFile: true, // 使用目录下 index.md 的标题作为文件夹名称
    useFolderLinkFromIndexFile: true, // 点击文件夹时跳转到目录下的 index.md
    sortMenusOrderByDescending: false, // 按文件名升序排序
    collapsed: false, // 默认展开
    scanStartPath: "manual/redis", // 扫描 docs/manual/redis 目录
    resolvePath: "/manual/redis/", // 匹配 /manual/redis/ 路径
    rootGroupText: "Redis", // 侧边栏根目录标题
    rootGroupCollapsed: false, // 根目录默认展开，可点击折叠
  },
  {
    documentRootPath: "docs",
    useTitleFromFileHeading: true,
    useFolderTitleFromIndexFile: true,
    useFolderLinkFromIndexFile: true,
    sortMenusOrderByDescending: false,
    collapsed: false,
    scanStartPath: "manual/leetcode/new", // 扫描 docs/manual/leetcode/new 目录
    resolvePath: "/manual/leetcode/new/", // 匹配 /manual/leetcode/new/ 路径
    rootGroupText: "leetcode",
    rootGroupCollapsed: false,
  },
  {
    documentRootPath: "docs",
    useTitleFromFileHeading: true,
    useFolderTitleFromIndexFile: true,
    useFolderLinkFromIndexFile: true,
    sortMenusOrderByDescending: false,
    collapsed: false,
    scanStartPath: "manual/blog",
    resolvePath: "/manual/blog/",
    rootGroupText: "Blog",
    rootGroupCollapsed: false,
  },
]);

// ============================================================
// VitePress 配置
// ============================================================

const vitePressConfig = defineConfig({
  /**
   * 站点基础路径
   * 部署到子路径时必须设置，如 GitHub Pages 的项目站点
   */
  base: "/cs-manual/",

  title: "CS Manual",
  description: "Computer Science Manual",
  lastUpdated: true, // 显示最后更新时间

  themeConfig: {
    // --------------------------------------------------------
    // 顶部导航栏
    // link 路径说明：
    //   - 以 / 开头：相对于 docs 目录
    //   - 不以 / 开头：相对于 base 路径
    // activeMatch：用于高亮当前激活的导航项（支持正则）
    // --------------------------------------------------------
    nav: [
      {
        text: "blog",
        link: "/manual/blog/blog",
        activeMatch: "/manual/blog/",
      },
      {
        text: "静态站",
        link: "/manual/static-web",
      },
      {
        text: "算法",
        link: "/manual/leetcode/new/leetcode",
        activeMatch: "/manual/leetcode/new/",
      },
      {
        text: "Java",
        link: "/manual/Java/java目录",
        activeMatch: "/manual/Java/",
      },
      {
        text: "Redis",
        link: "/manual/redis/redis",
        activeMatch: "/manual/redis/",
      },
      {
        text: "Tomcat",
        link: "/manual/Tomcat",
        activeMatch: "/manual/Tomcat",
      },
    ],

    // --------------------------------------------------------
    // 侧边栏
    // base：侧边栏的基础路径，link 会拼接 base
    // collapsed：是否默认折叠
    // --------------------------------------------------------
    sidebar: {
      ...sidebarConfig,
      "/manual/Java/": {
        base: "/manual/Java/",
        items: [
          {
            text: "Java",
            collapsed: false,
            items: [
              { text: "JDK下载", link: "JDK下载" },
              { text: "java发展史", link: "java发展史" },
              { text: "HashMap", link: "HashMap" },
              { text: "Map-api", link: "Map-API" },
              { text: "并发", link: "并发" },
              { text: "JVM", link: "JVM" },
            ],
          },
        ],
      },
    },

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
