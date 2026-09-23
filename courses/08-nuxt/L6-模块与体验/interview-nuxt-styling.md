# nuxt-styling 面试题（15 题）

## A. 基础认知

### 1. Nuxt 里全局样式应该放哪里？为什么不能放组件里？
**答**：放 `nuxt.config.ts` 的 `css` 数组（可传字符串或 `{ src, prepend, order }` 对象），入口统一注入，SSR 首屏与客户端加载顺序一致。放进不带 scoped 的组件 `<style>` 会有两个问题：该组件若是懒加载路由，样式要到 chunk 加载时才注入（首帧无样式）；组件卸载后样式不会回收（全局污染残留）。组件私有样式一律 `<style scoped>` 或 CSS Modules，需要跨组件复用的抽象成 `assets/css/*` 再由 css 数组引入。

**来源**：《Nuxt 样式分层规范》、《全局 CSS 的正确注入点》

### 2. `<style scoped>` 与 CSS Modules 怎么选？`:deep()` 解决什么？
**答**：scoped 是 Vue SFC 编译期给选择器加 `[data-v-xxx]` 属性、给元素补同名属性，写法贴近原生 CSS、心智轻；CSS Modules（`<style module>` 或 `*.module.css`）通过对象引用类名，天然避免拼写错、便于跨文件复用，但模板里要写 `styles.xxx`。`:deep()` 用于穿透到子组件内部元素——因为子组件的根元素才带父级 scope 属性，内部节点没有，不加 deep 就打不中。SSR 下 scoped 完全安全（属性是编译期确定的，两侧一致），而 CSS Modules 要留意服务端类名与客户端一致（不要动态拼接 module 键名）。

**来源**：《SFC 样式编译原理》、《scoped 与 module 的取舍》

### 3. SCSS/Less 在 Nuxt 里能用吗？路径别名怎么处理？
**答**：能，但预处理器不是内置：需要安装 `sass`/`less`（Vite 把它们当可选依赖，缺失时报"Preprocessor dependency not found"）。别名用 `~/`、`@/`，`@use '~/assets/scss/vars' as *;` 可行；老的 `~package/...` webpack 风格写法已废。第三方包样式导入建议直接 `@use 'package-name/scss/x'`（Vite 会解析 node_modules）。注意 CSS 里 `url()`：指向 `public/` 用绝对路径 `/fonts/x.woff2`（不参与构建），指向 `assets/` 才需要别名并享受哈希与内联。

**来源**：《Vite 预处理器依赖说明》、《Nuxt 中的静态资源分类》

## B. 对比与辨析

### 4. Nuxt 与 Next.js 在 CSS 处理上的最大差别？
**答**：Next 强制"全局 CSS 只能在 `app/globals.css` 等有限入口 import，组件级用 CSS Modules 或 Tailwind，styled-jsx 与 CSS-in-JS 在 App Router 需要 `next/font`/client component 注册表绕行"；Nuxt 更宽松：`css` 数组 + 任意组件 style + 模块注入，并且有一个 Next 没有的开关 `features.inlineStyles`——SSR 时把组件样式内联进 HTML、同时从客户端 bundle 移除对应 CSS 导入。本质差异是：Next 把样式当"必须显式分层的资产"管，Nuxt 把样式当"可以按渲染时机优化的流量项"管。

**来源**：《Next 与 Nuxt 的 CSS 模型》、《CSS-in-JS 在 RSC 下的困境》

### 5. `features.inlineStyles` 打开/关闭分别有什么后果？
**答**：默认内联（SSR/预渲染场景）。收益：首屏 HTML 自带所需组件样式，避免"结构出现但无样式"的闪烁，对 prerender 页面还能省一次 CSS 请求（关键 CSS 天然就位）。代价：HTML 体积增大、相同组件样式在多页重复内联、CDN 上 HTML 缓存命中率下降。关闭（`inlineStyles: false`）后样式回到外部 CSS chunk：HTML 更小、CSS 可长缓存，但懒加载路由首帧可能闪。实践：内容型/预渲染站点保持内联并盯 HTML 体积；重交互后台关掉内联、把全站基础样式放 `css` 数组保证首屏不闪。子选项 `allowAsync` 控制异步组件是否也内联——默认不内联，避免把只在交互后才出现的样式塞进首屏。

**来源**：《内联样式与首屏权衡》、《Nuxt 样式产物结构分析》

## C. 实战场景

### 6. 接入原子化 CSS 后，部分页面在懒加载路由上偶发"样式丢失"，怎么排查？
**答**：按四步。①确认是不是动态拼接类名（构建期文本扫描不到）——在产物 CSS 里搜该完整类名，搜不到即为扫描问题；②确认 content 扫描范围是否覆盖新增目录（如 `layouts/**`、模块内 runtime 模板、layers）；③确认该样式是进了外部 CSS chunk 而被 `inlineStyles` 移除/或反过来：对比 view-source 首屏与 Network 里 CSS 请求；④确认组件是否 `.client` 后缀导致服务端不渲染（样式随组件一起消失，呼应 nuxt-styling 第 3 节）。定位后修的是"类名可静态发现"或"扫描配置"，而不是靠加 `!important`。

**来源**：《原子化 CSS 丢样式排查》、《构建期扫描的边界》

### 7. 后台系统重度依赖一个 UI 库（Element Plus 风格），如何组织其样式与体积？
**答**：分层：①库的 base/theme CSS 走 `css` 数组（全站需要，保证首屏）；②组件级样式交给按需引入（Resolver 配合自动导入，避免整包 CSS），Nuxt 的组件自动注册与 UI 库 resolver 能协作（呼应 nuxt-auto-imports、nuxt-modules 的 addComponentsDir）；③只在少数页面出现的重型组件（表格设计器、富文本）用 `defineAsyncComponent` + `.client.vue` 拆分，其样式随之进入异步 chunk 而非首屏；④主题变量用 CSS 自定义属性 + `app.config`（构建期默认值）/cookie（用户覆盖）双层（呼应 nuxt-runtime-config、nuxt-state）。产物验证看 `nuxt build --analyze` 的 CSS 分布（nuxt-perf 展开）。

**来源**：《大型 UI 库的体积治理》、《按需引入与主题分层》

### 8. 首屏 CSS 请求在慢网络上成为瓶颈，你有什么优化组合拳？
**答**：先量化再打组合拳：①拆关键与非关键——`@media print`、编辑器/地图样式放 `.client.css` 或异步组件内；②合并与长缓存——确保 CSS 文件名带构建哈希且 Nginx 给 `max-age=31536000, immutable`（呼应 next-deploy 第 5 节）；③减少重复内联，必要时关掉部分页面的 `inlineStyles`；④字体用 `@nuxtjs/google-fonts`/自托管 + `font-display: swap` 与子集化，避免 FOIT；⑤预加载首屏关键 CSS（`useHead` 的 `link rel=preload as=style`，但只对确实并行的请求用，别为已内联的资源再预加载）；⑥CDN 开 HTTP/2+ 与压缩（brotli）。所有改动以 Lighthouse 的 Render Blocking 与 CWV 数字为准。

**来源**：《渲染阻塞资源治理》、《首屏 CSS 优化清单》

## D. 深度追问

### 9. 原子化 CSS 在 SSR 应用里有什么独特风险？
**答**：三点。①**产物归属混淆**：原子 CSS 是"按使用生成"的单一文件，`inlineStyles` 移除的是组件 style 的导入，两者互不覆盖，容易误判"为什么这段还在"；②**首屏之外的类**：客户端才出现的元素（toast、portal、动态插入的 HTML 片段如 CMS 富文本）其类名可能不在扫描范围，表现是"只有运行时才丢样式"，最难查——需要把 CMS 输出的类名纳入 safelist；③**样式来源顺序**：原子层的 `@layer` 与 UI 库样式冲突时，cascade layer 优先级低于普通规则，出现"Tailwind 覆盖不了组件库"的怪现象，解法是用 `@layer components`/utilities 显式归层。

**来源**：《原子化 CSS 与 CMS 富文本》、《@layer 与优先级》

### 10. 内联样式（HTML 里塞 CSS）与外链 CSS，从性能与安全各自的评价？
**答**：性能：内联省一次往返、适合关键 CSS 与小型样式，坏处是无法跨页缓存、增大 HTML（HTML 往往还是最不该变大的资源，因为它阻塞渲染且常带 Cookie/不缓存）；外链多一次请求但可 immutable 长缓存，跨页复用。安全：内联样式受 CSP 影响——需要 `style-src 'unsafe-inline'` 或 nonce/hash，为了几 KB 样式放宽内联权限是常见的 CSP 妥协点；外链更容易纳入 `style-src 'self'`。我的默认策略：全站基础与首屏必要样式走外链 + 长缓存 + CDN；确实极小的主题变量/骨架样式可内联，并在 CSP 里用 nonce 而非放开 unsafe-inline。

**来源**：《内联资源的性能与安全》、《CSP 下的样式策略》

### 11. 一个元素在 SSR 有 class、水合后没有，可能有哪些原因？怎么系统防？
**答**：常见四类：①判定变量依赖 `window`/`matchMedia`（两侧初值不同，呼应 nuxt-hydration）；②`v-if` 的内容依赖仅在客户端可得的数据（localStorage、cookie 未透传到服务端）；③CSS Modules 键名运行时拼接（服务端拿不到同一个类名映射）；④第三方脚本在挂载后改写 class，被 Vue 下次 patch 时又覆盖回去。防法：把"只在客户端可知的状态"延迟到 onMounted 后才参与渲染（首帧用中性态）、或用 `.client` 组件、必要时 `<ClientOnly>`；把 class 计算抽成纯函数并在两侧用同一入参（服务端从 event 取 cookie 后放进 payload）；加一条 e2e 断言"水合后首屏关键元素 class 集合与 view-source 一致"（呼应 nuxt-testing）。

**来源**：《水合期样式不一致》、《首帧一致性回归》

### 12. 让大型团队统一样式方案，你会怎么决策并长期守住？
**答**：定三层：①**基础层**——design tokens（CSS 自定义属性）唯一来源，由设计侧产出、构建期注入，禁止组件内写死色值；②**布局与原子层**——Tailwind/UnoCSS 负责间距、排版等高频小样式，配 safelist 与自定义规则收敛"野路子类名"；③**组件层**——UI 库或自研组件承担复杂交互样式，只允许 scoped/module，全站样式禁止散落在页面组件。守的方式不是靠 code style 文档，而是自动化：Stylelint 规则禁 hex 色/禁全局选择器在组件文件中、构建期 diff CSS 体积、Storybook 视觉回归、CR 清单里"新增全局样式必须走 css 数组并说明归属"。技术选型的分歧会随时间变化，**分层与卡口才是长期有效的东西**。

**来源**：《大型前端的样式治理》、《Design Tokens 落地》

---

## 补充（新专题 13-15）

### 13.  CSS 优先级与体积的双重治理：大型项目怎么设计样式加载架构让两者不打架？

优先级侧：全局只有一个优先级模型——声明层顺序（@layer theme<base<components<utilities）写进架构文档，第三方库样式统一归 components 层（入口 import 位置对齐层序），"谁压过谁"从源码考古变成层声明可读；禁止散点 !important（ESLint 规则/grep 门禁），白名单要注释理由。体积侧：全局层（reset+tokens+布局骨架）进首屏关键路径（inlineStyles 或 tiny CSS 外链），组件层靠 scoped/原子类天然按路由分割，UI 库按需引入+主题裁剪（Element 类库的样式全量引入是最常见体积事故）；审计：coverage 工具量"首屏用到多少字节"，未用规则进 dead CSS 报告。协同点：分层不只管优先级也是体积切分依据——base 层可内联、components 层可延迟，层即加载策略的声明。收口句："层=优先级+加载时机"一个机制管两本账，这是 cascade layers 被低估的红利。

**来源**：web.dev 关键 CSS 指南；InfoQ《设计系统三件套：tokens/themes/components》

### 14.  SSR 应用的首屏 CSS：内联关键 CSS、外链、inlineStyles 三种交付方式怎么选？

三形态账：① 全外链 CSS——首屏被 CSS 请求阻塞（render-blocking），慢网络下白屏窗口=RTT+下载；胜在全站复用缓存、HTML 最小；② 全内联——首帧零阻塞，但每页 HTML 背全站样式、不可缓存、复用率越低越亏；③ 关键 CSS 内联+全量外链异步（media=print 交换/onload 加载）——理论最优，工程债在"关键集判定"与防 FOUC 的二次应用闪烁。Nuxt 的 inlineStyles 是 ③ 的组件级自动化：SSR 时把"本次渲染用到的 scoped/组件样式"抽进 HTML style 标签，剩余（全局、懒路由）走外链——自动优于手动的地方是"用到哪些"由渲染结果决定而非人猜。决策参数：页均样式复用率（内容站高→外链+预加载就够、后台/首屏复杂组件多→开）、HTML 体积预算（内联超 14KB 要重估）、HTTP/2+ 下多请求惩罚降低。验证：WebPageTest 看首帧时间线与 FOUC 录像，Lighthouse 的 CSS 交付审计。

**来源**：Nuxt 官方 features.inlineStyles 说明；web.dev render-blocking CSS

### 15.  多品牌（白标）+深色模式的主题体系怎么设计？CSS 变量、构建期、运行时三层各自的活？

三层各司其职：① 构建期（编译进包）：字体、间距/断点等"不随品牌变的设计尺度"进 tokens 文件，多品牌若同结构可用 SCSS @use 变量分叉（品牌少、构建矩阵可控时）；② 运行初（SSR 首帧）：品牌主色/圆角这类"每客户不同但每次部署内稳定"的，走 runtimeConfig.public.brand→服务端注入根元素 CSS 变量（:root style 直出，防品牌色闪烁=水合题的样式版），或按租户构建（客户>50 时构建矩阵爆炸，变量方案完胜）；③ 会话内动态：深色/紧凑模式走 data-theme 属性+CSS 变量重定义（[data-theme=dark]{--bg:...}），持久化进 cookie 保 SSR 正确（主题闪烁标准解）。组件侧纪律：只消费语义变量（--color-brand/--surface），品牌差异零 if 分支——出现 v-if="brand" 即架构失守。验收清单：任意租户×亮暗×首帧三组合截图回归（Playwright 矩阵），"白标改一处色全站对"是这套设计的唯一度量。

**来源**：Nuxt app.config 文档；掘金《一套代码 30 个白标客户的样式架构》
