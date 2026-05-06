import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import { configureDiagramsPlugin } from "vitepress-plugin-diagrams";
import { generateSidebar } from "vitepress-sidebar";

// ============================================================
// 侧边栏配置
// ============================================================

/**
 * 自动生成 redis 目录侧边栏
 * 使用 vitepress-sidebar 插件自动扫描目录生成侧边栏配置
 * 文档: https://github.com/tzking/vitepress-sidebar
 */
const redisSidebarConfig = generateSidebar([
  {
    documentRootPath: "/docs",
    useTitleFromFileHeading: true, // 从文件的一级标题提取侧边栏标题
    useFolderTitleFromIndexFile: true,
    useFolderLinkFromIndexFile: true,
    sortMenusOrderByDescending: false, // 按文件名升序排序
    collapsed: false, // 默认展开
    scanStartPath: "redis", // 扫描 docs/redis 目录
    resolvePath: "/redis/", // 匹配 /redis/ 路径
  },
]);

// ============================================================
// VitePress 配置
// ============================================================

const vitePressConfig = {
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
        activeMatch: "/leetcode/",
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

      "/leetcode/": {
        base: "/leetcode/new/",
        items: [
          {
            text: "leetcode",
            collapsed: false,
            items: [
              { text: "图", link: "图" },
              { text: "栈", link: "栈" },
              { text: "树", link: "树" },
              { text: "区间", link: "区间" },
              { text: "排序", link: "排序" },
              { text: "搜索", link: "搜索" },
              { text: "数组", link: "数组" },
              { text: "数论", link: "数论" },
              { text: "构造", link: "构造" },
              { text: "柱子", link: "柱子" },
              { text: "矩阵", link: "矩阵" },
              { text: "组合", link: "组合" },
              { text: "结构", link: "结构" },
              { text: "链表", link: "链表" },
              { text: "中位数", link: "中位数" },
              { text: "位运算", link: "位运算" },
              { text: "可达性", link: "可达性" },
              { text: "多线程", link: "多线程" },
              { text: "子序列", link: "子序列" },
              { text: "字典序", link: "字典序" },
              { text: "最大序", link: "最大序" },
              { text: "前缀树Trie", link: "前缀树Trie" },
              { text: "二分查找", link: "二分查找" },
              { text: "拓扑排序", link: "拓扑排序" },
              { text: "最长子串", link: "最长子串" },
              { text: "下一个元素", link: "下一个元素" },
              { text: "二分猜答案", link: "二分猜答案" },
              { text: "多少种不同", link: "多少种不同" },
              { text: "子数组子串", link: "子数组子串" },
              { text: "字符串匹配", link: "字符串匹配" },
              { text: "字符串编辑", link: "字符串编辑" },
              { text: "图形最大面积", link: "图形最大面积" },
              { text: "最长公共前缀", link: "最长公共前缀" },
              { text: "集合中的元素", link: "集合中的元素" },
              { text: "多步操作最优解", link: "多步操作最优解" },
            ],
          },
        ],
      },

      // 使用 vitepress-sidebar 自动生成的配置
      "/redis/": (redisSidebarConfig as Record<string, unknown>)["/redis/"],
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

  // Vite 配置（可扩展）
  vite: {
    plugins: [],
  },
};

// 使用 withMermaid 包装以支持 Mermaid 图表
export default withMermaid(vitePressConfig);
