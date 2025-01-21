import DefaultTheme from "vitepress/theme";
import "./my-fonts.css";

export default DefaultTheme;

/*
不要试图从 jb 导出 color scheme, jb 的设计是默认大于配置，导出的 xml 里面只有自定义的 color, 搞不到其 token 的默认 color.
试图通过别的 scheme 中转 token 也对应不上。
为此已浪费了数小时。

最顺的方式是按 vs-code 的插件开发。

从别的 color scheme 往 jb 导入倒是有现成的工具。

少折腾 color scheme.
*/
