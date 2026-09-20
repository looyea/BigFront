# vite-css 面试题精选

> 共 12 题，覆盖 **CSS Modules / 预处理器 / PostCSS / Tailwind / 生产提取 / 开发注入** 六类。

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
