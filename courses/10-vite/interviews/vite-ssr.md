# vite-ssr 面试题精选

> 共 12 题，覆盖 **SSR 原理 / Vite SSR API / 双产物 / Environment API / hydration / 流式** 六类。

---

## 一、SSR 原理与取舍

### 1. SSR、CSR、SSG、ISR 有什么区别？分别适合什么场景？

- **CSR**：服务器给空壳 + JS，浏览器渲染。适合登录后台等 SEO 不重要的交互应用。
- **SSR**：每次请求在服务器渲染成 HTML 再 hydration。适合内容随请求/用户变化、要 SEO 与首屏的页面。
- **SSG（静态预渲染）**：构建期就把每个页面渲染成静态 HTML。适合博客/文档/营销页等不随请求变的内容，可纯静态托管、最快最省。
- **ISR（增量静态重生）**：SSG 基础上按周期/按需重新生成静态页。适合内容更新频繁但不必实时。
取舍：越静态越快越省、越动态越灵活越贵。

**来源**：Next.js — "SSR/SSG/ISR"; web.dev — "Rendering on the web"; Vue SSR guide

### 2. hydration 到底在做什么？为什么它可能"浪费"？

hydration = 客户端 JS 加载后，框架遍历服务端已渲染的 DOM，绑定事件监听、恢复组件状态、建立虚拟树，使静态 HTML 变为可交互应用。"浪费"在于：为了交互，框架 runtime + 组件逻辑要**再下载执行一遍**，且首屏 HTML 与 client 渲染要一致（否则 mismatch）。优化方向：**部分水合（islands/partial hydration）**、**延迟水合（progressive/hydration on visible）**、甚至**零水合**（纯静态或编译时框架），只给需要的交互岛 hydration。

**来源**：Addy Osmani — "Hydration cost"; PatternFly/Astro — "Islands architecture"; React — "Selective hydration"

---

## 二、Vite SSR API

### 3. 用 Vite 手写一个极简 SSR，需要哪几个关键 API？各自职责？

在 Express（`middlewareMode`）里：① `vite.transformIndexHtml(url, html)`——用插件链处理 HTML（注入脚本等）；② `vite.ssrLoadModule('/entry-server.js')`——在 Node 即时编译并执行 SSR 入口，拿到 `render()`；③ `render(url)` 返回 HTML 字符串 + 可序列化 state，注入模板返回；④ `vite.ssrFixStacktrace(e)`——SSR 报错映射回源码。client 侧 `entry-client.js` 调 `hydrate()`。这四步是 Vite SSR 开发的骨架。

**来源**：Vite — "SSR API / ssrLoadModule"; Vite SSR guide — "setup middleware mode"

### 4. 为什么 `ssrLoadModule` 只用于开发、生产要预构建？

`ssrLoadModule` 走的是**即时编译 + 模块级缓存**，为 DX/HMR 设计：首次编译慢、常驻 dev server 内存与转换开销大、且暴露源码与转换能力（安全面）。生产应 `vite build --ssr` 预先把服务端入口连同依赖打成**优化过的 server bundle**，Node 启动即用，快、可缓存、可打包裁剪。dev 与 prod 是两套机制，别混用。

**来源**：Vite — "SSR build / vite.build() ssr"; Vite — "ssrLoadModule is dev-only"

---

## 三、构建与部署

### 5. SSR 应用的构建为什么需要 client 与 server 两份产物？

因为两端运行环境不同：**client 产物**在浏览器执行 hydration，target 是浏览器、含框架客户端 runtime、要分块/预加载；**server 产物**在 Node 执行 `render()`，target 是 Node（可保留 `require`/external 框架包、不内联浏览器专有 API、资源以字符串引用）。两份构建选项（target/external/注入方式）不同，故分开产出到 `dist/client`、`dist/server`，运行时 Node 服务加载 server、静态托管指向 client。

**来源**：Vite — "SSR Production Build / two builds"; Vue SSR — "server/client bundles"

### 6. SSR 应用的部署形态和纯静态 SPA 有什么不同？

纯 SPA：`dist` 静态文件扔 CDN/Nginx 即可，无常驻进程。SSR：需要**常驻 Node 服务**（或边缘运行时）来执行每请求渲染，还要：多进程/横向扩（呼应 Express L8 cluster/Docker）、健康检查、优雅关闭、把 client 静态资源交 CDN、`trust proxy`、缓存策略（HTML 少缓存或边缘缓存、静态长缓存）。运维复杂度显著高于静态托管。

**来源**：Vite — "SSR deploy / custom server"; Express — "production deployment"; Node SSR — "PM2/Docker"

---

## 四、Environment API

### 7. Vite 6 的 Environment API 解决了什么痛点？

旧 Vite 把"客户端"当默认、"SSR"当一个 `isSSR` 布尔特例，插件里到处 `if (ssr)`、API（`ssrLoadModule`/`ssrTransform`/`ssrStart`）割裂，且难以表达"第三种环境"（边缘运行时、浏览器测试、小程序…）。Environment API 抽象出**命名环境集合**（client、ssr、自定义），每个环境有自己的配置/模块执行/条件，插件用 `applyToEnvironment` 按环境声明行为。让 Vite 成为"面向任意 JS 运行时的统一编译平台"，SSR/测试/边缘一套机制表达。

**来源**：Vite 6 — "Environment API"; Vite blog — "Towards v6 / environments"; Vitest — "environment API"

### 8. 对插件作者来说 Environment API 意味着什么改动？

从"判断 `info.ssr`/`isSSR`"转向"针对 environment 注册行为"：`applyToEnvironment(environment)` 控制插件在哪些环境生效；`buildStart`/`resolveId`/`load`/`transform` 现在带 environment 上下文，可按 `environment.name` 分流；`this.environment` 访问当前环境、`environment.deps`、`environment.options`。好处是一个插件能干净地同时定义 client 与 ssr（甚至 edge）下的不同行为，而不用堆布尔分支。写新插件应尽量拥抱该抽象、少用 legacy 标志。

**来源**：Vite — "Plugin environment API / applyToEnvironment"; Vite 6 migration — "environment changes"

---

## 五、hydration 与数据

### 9. SSR 里怎么把服务端取到的数据传给客户端复用，避免重复请求？

服务端渲染时取数并写入应用状态（如 Pinia/Redux），把它 `JSON.stringify` 后内联到 HTML（`<script>window.__INITIAL_STATE__=...</script>` 或框架提供的序列化标签）。client hydration 前，框架从该全局恢复 store，首个渲染与服务端一致，组件识别"数据已在"便不再重复请求。注意：① 只放可序列化数据（日期/Map/函数要转换）；② 内联前**转义** `<`、`/`、`</script>` 等防 XSS 逃逸；③ 大 state 会拖慢解析，考虑裁剪/分块。

**来源**：Vue SSR — "State Serialization / Hydration"; Redux — "preloadedState"; OWASP — "XSS in JSON embedding"

### 10. 什么是 hydration mismatch？如何排查和避免？

服务端渲染出的 DOM 与客户端首次渲染结果不一致，框架会警告并可能整体重渲染（丢 SSR 收益、闪烁）。常见诱因：渲染中使用了**两端不同**的值——`Date.now()`/`Math.random()`、读 `window`/`localStorage`、UA 判断、依赖客户端才有的 store 初值、组件里直接操作 DOM、非确定性列表顺序。排查：看框架 mismatch 警告定位节点。避免：把"仅客户端"的逻辑放到 `onMounted`/effect 之后再更新，用 `<ClientOnly>`/`suppressHydrationWarning`，保证初始 state 两端一致。

**来源**：React — "Hydration mismatch"; Vue — "hydration / SSR caveats"; Next — "suppressHydrationWarning"

---

## 六、进阶与框架封装

### 11. Streaming SSR 相比传统字符串 SSR 好在哪？

字符串 `renderToString` 要等**整棵树**渲染完才能发第一个字节，页面里最慢的数据源会拖高 TTFB。**流式渲染**（React `renderToPipeableStream`/`renderToReadableStream` + Suspense；Vue Stream）把 HTML 分块：先 flush 外壳与已就绪内容（浏览器立刻开始解析/绘制），慢组件用占位、数据到了再流式补入并触发局部 hydration。带来更早首屏、更好感知性能、更快可交互。代价：服务端要管理流与错误回退、代码更复杂。

**来源**：React — "renderToPipeableStream / Streaming SSR"; Vue — "Streaming"; web.dev — "TTFB / streaming"

### 12. 有了 Nuxt/Next，还需要懂 Vite 原生 SSR 吗？为什么？

需要。Nuxt（基于 Vite）/框架帮你封装了双产物构建、路由级取数、hydration、流式、缓存、server 服务——日常开发直接用它们即可。但理解 Vite 原生 SSR（`createServer`+`ssrLoadModule`+`transformIndexHtml`+Environment API）能：① 看懂框架在做什么、排查 SSR 报错/水合不匹配/构建产物异常；② 定制（自研 meta 框架、边缘部署、非常规环境）；③ 判断 SSR vs SSG vs islands 的选型；④ 升级 Vite 大版本时不被 Environment API 变化打个措手不及。框架是杠杆，底层是底气。

**来源**：Nuxt — "how Nuxt uses Vite"; Vite — "SSR guide (framework authors)"; Laravel/Analog — "Vite SSR"
