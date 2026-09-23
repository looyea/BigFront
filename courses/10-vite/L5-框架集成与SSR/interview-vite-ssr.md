# vite-ssr 面试题精选

> 共 15 题，覆盖 **SSR 原理 / Vite SSR API / 双产物 / Environment API / hydration / 流式** 六类。

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

---

## 补充（新专题 13-15）

### 13.  SSR 项目里框架包、路由包、业务共享包对"打包 vs externalize"的诉求分别是什么？noExternal 怎么正确使用？

三类三包三种处理：① 框架/路由包（vue、react-router）——通常 external 给 Node 即可，但同页多实例风险（dev 预打包一份、Node 又加载一份）出现时要保证单一解析源（dedupe 配置管客户端侧，server 侧靠 external 一致性）；② CJS-only 包——external 后 Node ESM 的 CJS 具名导出可能报错（cjs-module-lexer 判定失败），要么包本身兼容要么 noExternal 让 Vite 预打包处理成 ESM；③ 业务 workspace 共享包（ESM 源码直出）——必须 noExternal，否则 Node 按 package exports 找不到可用入口，且改了源码 Node 模块缓存不刷新（dev 期热更失效的经典成因）。noExternal 的代价：命中包被拉进 SSR 构建参与转换（变慢）、其 node_modules 依赖链也要逐个判断（函数形态按包名精确控制是成熟用法）。判断流程：报错先看"是格式问题（noExternal 治）还是双实例问题（external 统一+dedupe 治）"，两类症状都是 undefined/不是同一实例，方向相反。加分句：这题的底层是"同一份代码在浏览器图与 Node 图里的两种生命周期"——把 external 讲成"解析权交给谁"，答案立即清晰。

**来源**：Vite 官方 SSR 文档（ssr.noExternal）；Vite#12342 讨论（双实例）；Node ESM 互操作指南

### 14.  SSR 首屏的"数据注水"完整链路：服务端取的数据如何安全到达客户端并被复用？

链路四段：① 取数——路由级 loader/asyncData 在服务端并行取数（与渲染解耦，先数据后 render）；② 序列化——JSON.stringify 只覆盖纯数据：Date/Map/Set/undefined/BigInt 要编解码协议（devalue 类库）；XSS 红线：注入 <script> 前必须转义 <、>、U+2028/2029（</script> 逃逸与旧引擎语法崩），这是"注水被 XSS"的真实事故面；③ 注入与认领——window.__INITIAL_DATA__ + 渲染期标记版本号，客户端 hydrate 时优先读注水数据、命中则跳过请求（缓存层按"数据 key"设计而不是组件自觉）；④ 失效策略——交互后数据脏了怎么办（局部 refetch 使该 key 的注水作废），水合期间用户已操作表单的冲突（延迟交互启用/事件重放）。跨请求泄漏检查：数据必须挂在请求实例而非模块单例（呼应 deploy/quiz 既有的状态泄漏题）。加分句：能主动讲"注水体积也是 TTFB 成本——首屏数据裁剪与字段白名单是链路第一段该做的事"，说明你做过真 SSR。

**来源**：Vite SSR 指南（状态序列化）；OWAX XSS 注入与 JSON 转义实践；Nuxt payload 机制对照

### 15.  Streaming SSR 为什么需要 Suspense 类原语？它对服务器响应、错误处理、爬虫兼容各提出什么新要求？

动机：字符串 SSR 要等最慢数据源就绪才吐首个字节，TTFB=max(所有取数)；streaming 把"等待"变成"骨架先走、数据块续传"——shell 立即可交互，慢组件 resolve 后以 <template> + 内联脚本注入原位（late-rendered）并自动水合补齐。四个新要求：① 服务器侧必须管道化（Node 的 res 背压处理、不可提前 flush 头、代理层禁用压缩缓冲——nginx 的 gzip on 会吃掉 streaming 收益，要 chunked 友好配置）；② 错误粒度变化——shell 已发出后深层组件出错不能整体 500（错误边界按流内块渲染占位+客户端重试），状态码语义与监控口径要重定义（"首字节 200 但局部错误"如何上报）；③ 爬虫与无 JS 环境——老爬虫可能拿不到异步块（对 SEO 敏感路由保留字符串模式或 UA 分流）；④ 加载顺序与水合竞态——块到达顺序与 DOM 就绪的协调由 Suspense 协议处理，业务侧禁忌是在流式边界外依赖"数据已全部就绪"的假设。性能真相：streaming 不减少总工作量，改善的是 LCP/TTFB 分布——首屏关键内容应在 shell 段，慢内容降级到流尾才有意义（排序是新的架构问题）。加分句：一句话定位——"Suspense 把渲染从一次函数调用变成一段有状态协议"，说得出协议两字就懂它为什么牵一发动全身。

**来源**：React 官方 Streaming 文档（renderToPipeableStream）；Vue 3.5 实验性异步组件/SSR streaming 讨论；web.dev Streaming SSR
