import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import darcula from "./theme/darcula-theme.json";

// https://vitepress.dev/reference/site-config
export default withMermaid(
    defineConfig({
        base: "/cs-wiki/", // 不能少, url定位
        title: "CS Wiki",
        description: "Computer Science Wiki",
        lastUpdated: true,
        themeConfig: {
            // https://vitepress.dev/reference/default-theme-config
            // 导航栏
            nav: [
                {
                    text: "blog",
                    link: "/blog/blog",
                    activeMatch: "/blog/",
                },
                {
                    text: "静态站",
                    link: "static-web", // 单独md文件, 不配置侧边栏
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
            ],
            // 侧边栏
            sidebar: {
                "/blog/": {
                    base: "/blog/",
                    items: [
                        {
                            text: "blog",
                            collapsed: false,
                            items: [
                                { text: "生物vs计算机", link: "生物vs计算机" },
                            ],
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
                            ],
                        },
                    ],
                },

                "/leetcode/": {
                    base: "/leetcode/new/", // 路径
                    items: [
                        {
                            text: "leetcode",
                            collapsed: false,
                            items: [
                                { text: "栈", link: "栈" },
                                { text: "树", link: "树" },
                                { text: "区间", link: "区间" },
                                { text: "找数", link: "找数" },
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
                                { text: "二分猜答案", link: "二分猜答案" },
                                { text: "多少种不同", link: "多少种不同" },
                                { text: "子数组子串", link: "子数组子串" },
                                { text: "字符串匹配", link: "字符串匹配" },
                                { text: "字符串编辑", link: "字符串编辑" },
                                { text: "最长公共前缀", link: "最长公共前缀" },
                                { text: "集合中的元素", link: "集合中的元素" },
                                {
                                    text: "多步操作最优解",
                                    link: "多步操作最优解",
                                },
                                { text: "图形最大面积", link: "图形最大面积" },
                                { text: "图", link: "图" },
                            ],
                        },
                    ],
                },
            },
            outline: {
                level: "deep",
            },
            socialLinks: [
                { icon: "github", link: "https://github.com/duskbat" },
            ],
            search: {
                provider: "local",
            },
        },
        // markdown
        markdown: {
            // shiki 支持自定义scheme, 可参考文档. 导入: import darcula from './theme/darcula.json'
            theme: {
                light: "github-light",
                dark: darcula,
            },
            math: true,
        },
    })
);
