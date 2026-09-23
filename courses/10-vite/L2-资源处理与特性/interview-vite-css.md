# vite-css 面试题精选

> 共 15 题，覆盖 **CSS Modules / 预处理器 / PostCSS / Tailwind / 生产提取 / 开发注入** 六类。

---

## 一、CSS Modules

### 1. CSS Modules 的类名 hash 规则是什么？能自定义吗？

默认开发时 `[name]__[local]--[hash:base64:5]`，生产时 `[hash:base64:8]`。可通过 `css.modules.generateScopedName` 自定义。`localsConvention` 控制导出的 key 是原名还是 camelCase。

**来源**：Vite css.modules docs; css-loader — "modules.exportLocalsConvention"

### 2. composes 和 @extend（SCSS）有什么区别？

`composes` 是 CSS Modules 规范——运行时合并 class（HTML 上出现两个 class）：`class="Base_hash Primary_hash"`。`@extend` 是 SCSS 编译时——选择器合并成组（CSS 体积更小但可能产生意外级联）。composes 更安全（不改变 specificity）。

**来源**：CSS Modules spec — "composes"; Sass — "@extend vs @use"

---

## 二、预处理器

### 3. Sass 1.77+ 的 modern-compiler API 和 legacy API 有什么区别？

| 维度 | legacy | modern-compiler |
| --- | --- | --- |
| import 解析 | `@import`（已 deprecated） | `@use` / `@forward`（模块化） |
| 性能 | 每次编译完整 context | 增量编译 + 共享编译对象 |
| Vite 配置 | `api: 'legacy'` | `api: 'modern-compiler'`（推荐） |

Vite 5.4+ 默认切 modern-compiler。legacy 在 Dart Sass 3.0 将移除。

**来源**：Dart Sass changelog — "Modern JS API"; Vite — "Sass API"

### 4. additionalData 注入的代码对 HMR 有影响吗？

有——修改 additionalData 引用的文件（如 `vars.scss`）→ Vite 需要**重新编译所有引用了 vars 的 .scss 文件** → 大量文件重编 → HMR 延迟。缓解：减少全局变量体积 / 用 CSS Custom Properties 替代部分 SCSS 变量。

**来源**：Vite — "additionalData"; Sass — "@use" performance

---

## 三、PostCSS

### 5. Vite 内置 PostCSS 的工作位置是什么？

Vite CSS 管线：**预处理器**（sass/less）→ **PostCSS**（postcss.config.js 里插件链）→ **CSS Modules transform** → 最终 JS/CSS 输出。PostCSS 是**中间层**——在预处理器后、modules 前执行。autoprefixer / tailwind 都在这步。

**来源**：Vite — "CSS Pipeline" 文档；PostCSS docs

### 6. 如何只在特定文件上应用 PostCSS 插件？

PostCSS 插件本身接收 `Rule` / `Declaration` 上下文 → 在插件内部按 `rule.selector` 或文件路径判断。或用 `css.postcss` 配置多个 PostCSS 实例对应不同目录。也可在 Vite 插件 `transform` 钩子里按 `id` 条件跳过。

**来源**：PostCSS — "Writing a plugin"; Vite css.postcss docs

---

## 四、Tailwind

### 7. Tailwind JIT 模式在 Vite 里是怎么工作的？

Tailwind 3 的 JIT 引擎作为 PostCSS 插件运行：每次 CSS 文件变化 → PostCSS pipeline 触发 → tailwind 扫描 `content` 配置的源文件 → 按需生成用到的 utility class → 输出极小 CSS。Vite 的 HMR 触发 CSS 重编 → JIT 增量重新生成 → 毫秒级。

**来源**：Tailwind CSS — "JIT engine"; Tailwind + Vite guide

---

## 五、生产提取

### 8. build.cssCodeSplit 默认 true 意味着什么？对性能有什么影响？

每个异步 JS chunk 关联的 CSS 被提取成**同名 .css 文件** → 路由切换时 `<link>` 动态注入 → 按需加载 CSS。好处：首屏 CSS 更小。坏处：路由切换多一次 CSS 请求（通常被 `<link rel="modulepreload">` 一起 preloaded）。

**来源**：Vite build.cssCodeSplit docs

### 9. Vite 用什么做 CSS minify？可以换吗？

Vite 4+ 默认 **Lightning CSS**（Rust 实现，比 cssnano 快 100x+）。`build.cssMinify` 可自定义函数或用 `esbuild`（esbuild 内置 CSS minify 但功能少）。Lightning CSS 还能做 nesting 降级 + vendor prefixing。

**来源**：Vite build.cssMinify docs; Lightning CSS GitHub README

---

## 六、开发时行为

### 10. Vite dev 时为什么不用 <link> 加载 CSS？

Vite 把所有资源当 JS 模块处理 → CSS 被编译成 JS 模块 → 执行时创建 `<style>` 插入 `<head>`。好处：① 天然支持 HMR（替换 style 内容）；② 异步 chunk 加载时 CSS 自动注入（无需额外 link 标签管理）。build 时再提取回 `<link>`。

**来源**：Vite — "CSS in Dev vs Build"; vite source — `client/code/injectStyles.ts`

### 11. CSS 里的 @font-face url 在 Vite 中走什么管线？

`url('./font.woff2')` → Vite CSS 插件解析 → 当 import 处理 → 走 asset pipeline → 构建后替换为 hash URL。如果字体 < `assetsInlineLimit`（罕见）→ base64 内联到 CSS。通常 woff2 > 4KB → 独立文件。

**来源**：Vite — "CSS url() handling"

### 12. :has() 选择器需要 PostCSS 降级吗？

2024 年 Chrome 105+ / Safari 15.4+ / Firefox 121+ 全部原生支持。如果 `browserslist` 不要求更老浏览器 → **不需要降级**（直接写原生 :has()）。若需兼容老 Firefox → `postcss-has-pseudo`（但只能降级部分场景——有功能性限制）。

**来源**：MDN — ":has()"; web.dev — "CSS :has() browser support"

---

## 补充（新专题 13-15）

### 13.  PostCSS、预处理器、Lightning CSS、原生特性四套 CSS 工具链在 Vite 里的分工与你团队的选型建议。

先画管线序：源码(.scss) → 预处理器编译 → PostCSS（插件链）→ Vite 内置 CSS transform（构建 target 相关降级/lightningcss 替换此段）→ minify。选型分维：① 预处理器——2026 年的诚实答案是"嵌套/@use 等大半需求原生 CSS 已接住，Sass 剩余价值在逻辑与 mixin 体系"，新项目评估"原生嵌套+自定义属性"能否满足再决定；② PostCSS 的定位从"所有现代特性的编译器"收缩到"特定插件载体"（icss 类、构建期报告），autoprefixer 在 lightningcss 接管 target 降级后也可退场；③ Lightning CSS——编译与 minify 同引擎的提速选项（大 CSS 项目 build 明显受益），代价是部分 PostCSS 生态不兼容、降级策略与 browserslist 的 target 表达差异；④ 渐进增强策略变化：特性查询 @supports + :has()/容器查询原生可用，"编译期 polyfill CSS"多数场景不再必要。团队建议模板：存量 Sass 项目维持（迁移收益不抵风险），新项目从"原生+自定义属性设计令牌"起步，构建提速专项时才评估 lightningcss（用指标说话不用口号）。加分句：CSS 工具链的演进方向是"编译器职责还给浏览器，构建期只做确定性转换"——能讲这个趋势比会背配置项高一档。

**来源**：Vite 官方 CSS 文档（Feature Support 矩阵）；Lightning CSS 文档；web.dev 现代 CSS 特性支持

### 14.  组件作用域样式（SFC scoped / CSS Modules / Svelte style）三家实现原理对比，以及穿透全局样式的正确姿势。

机制对比：Vue——编译期给模板节点加 data-v-hash 属性、选择器尾部加属性限定，运行时零成本但选择器权重被抬高（特异性膨胀是覆盖难根因）；CSS Modules——类名映射为局部作用符（哈希），纯命名层隔离（结构/全局选择器仍可泄漏，:global 显式开口）；Svelte——编译期选择器重写加 s-哈希类，且带未使用规则清理（独有红利）。三者共性：隔离都是"编译期约定"而非真运行时沙箱（Shadow DOM 才是），所以穿透都是内置逃生口：:deep()/ :global()/ :global() 各自语法，方向性差异（Vue 用 :deep 往下钻、Svelte 用 :global 声明全局再自组合）。穿透的治理：第三方库样式定制集中到单一 override 文件（命名空间注释：这是库样式非业务样式）、禁止散点 :deep 滥用（特异性军备竞赛的起点）、设计令牌优先（能走 CSS 变量注入的定制绝不用选择器覆盖——主题层与覆盖层的本质区别）。加分维度：动态类名（绑定三元）在 CSS Modules 的类型支持（styles 的 keyof 检查）与运行时差异；SSR 的样式收集各家管线（Vue 的 scoped 关键帧处理、Svelte 的按用提取）为 styling 与 ssr 两关共同埋的点。收口句：三家解决的是"作用域"、@layer 解决的是"层叠秩序"——两个正交维度的病别用同一把锤子。

**来源**：Vue scoped 实现（属性选择器）；CSS Modules spec；Svelte 编译器样式作用域文档

### 15.  设计系统的"主题切换（暗色/品牌皮肤）"在 Vite+组件框架下怎么做才不闪不重？

令牌先行：颜色/圆角/间距收进 CSS 自定义属性（:root 与 [data-theme] 两层定义），组件只消费 var()——主题切换=换根属性集，零重渲染零 JS 样式循环。三难点：① 首帧闪烁（SSR 无用户偏好、客户端 JS 后注入 data-theme 则先白后暗一闪）——解法是预置内联脚本在 <head>（读 localStorage/cookie 的偏好立即设属性，框架 SSR 的 transformEarly/head 注入机制），偏好要双写 cookie（SSR 可读，服务端出正确主题首帧）；② 跟随系统（matchMedia change 监听 + "偏好=system/亮/暗"三态建模，别做布尔）；③ 组件库内硬编码色的清退（color-mix(in oklch) 做派生色减少令牌数量、CI 检查新增十六进制色进组件源码）。Vite 侧注意：主题 CSS 的产物形态（单文件全量 vs 按主题分包——令牌文件极小全量即可）、暗色图片/插画资产（prefers-color-scheme 媒体查询资源或 CSS 变量 url() 切换）。进阶：多品牌（同组件库供 N 个客户皮肤）——令牌包化（每品牌一个 CSS 产物构建期选定）vs 运行时 data-scope 全量（体积换灵活），按发布节奏选。加分句：主题的成熟度看"新增一个暗色变体要改几处代码"——答案是零（只加令牌文件）才算体系建成。

**来源**：MDN prefers-color-scheme 与 color-scheme；theme-ui/Design Tokens 实践；web.dev 避免主题闪烁
