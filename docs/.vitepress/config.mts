import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { configureDiagramsPlugin } from "vitepress-plugin-diagrams";
import { generateSidebar } from "vitepress-sidebar";

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
    documentRootPath: "/docs",
    useTitleFromFileHeading: true, // 从文件的一级标题提取侧边栏标题
    useFolderTitleFromIndexFile: true, // 使用目录下 index.md 的标题作为文件夹名称
    useFolderLinkFromIndexFile: true, // 点击文件夹时跳转到目录下的 index.md
    sortMenusOrderByDescending: false, // 按文件名升序排序
    collapsed: false, // 默认展开
    scanStartPath: "redis", // 扫描 docs/redis 目录
    resolvePath: "/redis/", // 匹配 /redis/ 路径
    rootGroupText: "Redis", // 侧边栏根目录标题
    rootGroupCollapsed: false, // 根目录默认展开，可点击折叠
  },
  {
    documentRootPath: "/docs",
    useTitleFromFileHeading: true,
    useFolderTitleFromIndexFile: true, // 使用目录下 index.md 的标题作为文件夹名称
    useFolderLinkFromIndexFile: true, // 点击文件夹时跳转到目录下的 index.md
    sortMenusOrderByDescending: false,
    collapsed: false,
    scanStartPath: "leetcode/new", // 扫描 docs/leetcode/new 目录
    resolvePath: "/leetcode/new/", // 匹配 /leetcode/new/ 路径
    rootGroupText: "leetcode", // 侧边栏根目录标题
    rootGroupCollapsed: false, // 根目录默认展开，可点击折叠
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
        link: "/blog/blog",
        activeMatch: "/blog/",
      },
      {
        text: "静态站",
        link: "/static-web",
      },
      {
        text: "算法",
        link: "/leetcode/new/leetcode",
        activeMatch: "/leetcode/new/",
      },
      {
        text: "Java",
        link: "/java/java目录",
        activeMatch: "/java/",
      },
      {
        text: "Redis",
        link: "/redis/redis",
        activeMatch: "/redis/",
      },
      {
        text: "Tomcat",
        link: "/Tomcat",
        activeMatch: "/Tomcat",
      },
    ],

    // --------------------------------------------------------
    // 侧边栏
    // base：侧边栏的基础路径，link 会拼接 base
    // collapsed：是否默认折叠
    // --------------------------------------------------------
    sidebar: {
      "/blog/": {
        base: "/blog/",
        items: [
          {
            text: "blog",
            collapsed: false,
            items: [{ text: "生物vs计算机", link: "生物vs计算机" }],
          },
        ],
      },

      "/java/": {
        base: "/java/",
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

      // 使用 vitepress-sidebar 自动生成的配置
      // generateSidebar 扫描 docs/leetcode/new 目录，自动生成 sidebar items
      "/leetcode/new/": (sidebarConfig as Record<string, unknown>)["/leetcode/new/"] as {
        base: string;
        items: never[];
      },

      // generateSidebar 扫描 docs/redis 目录
      "/redis/": (sidebarConfig as Record<string, unknown>)["/redis/"] as {
        base: string;
        items: never[];
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
