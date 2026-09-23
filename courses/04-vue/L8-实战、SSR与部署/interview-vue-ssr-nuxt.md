# vue-ssr-nuxt 面试题精选

> 共 15 题，覆盖 A 动机与流程 / B 水合与数据 / C 纪律与陷阱 / D Nuxt 与选型类。

## 一、动机与流程（A 类）

### 1. 什么情况下你会给一个 Vue 项目上 SSR？收益和代价分别是什么？
收益：首屏更快（HTML 直出）、SEO/分享预览友好（爬虫拿到完整 DOM）、弱网下先见内容。代价：服务器成本与运维、代码要遵循"每请求隔离/两端一致"的心智、构建链路更复杂。内容型/营销型/对首屏和收录敏感的上 SSR；纯内网后台 SPA 往往不值当（呼应 vue-ssr-nuxt 第一、五节）。
**来源**：Nuxt 文档 — 什么是 Nuxt / SSR 动机、web.dev — 渲染模式

### 2. 描述一次 SSR 请求到页面可交互的完整流程。
服务端跑组件 render 生成 HTML 字符串 + 注入初始状态 → 返回 HTML → 浏览器先绘制（有内容但不可交互）→ 下载并执行客户端 JS → `createSSRApp` 对已有 DOM 做 hydration，绑定事件、建立响应式 → 页面可交互（TTI）。
**来源**：Vue.js 官方文档 — SSR 水合、Nuxt 渲染流程

### 3. SSR 之后还需要客户端 JS 吗？为什么？
需要。SSR 只负责把首屏 HTML 直出，交互（点击、路由切换、响应式更新）仍靠客户端 Vue 水合后接管。想彻底无 JS 是另一条路（静态/岛屿架构），别把 SSR 误解成"服务端渲染完就完了"（呼应 vue-ssr-nuxt 第一节）。
**来源**：Vue SSR Guide、Islands Architecture 概念

## 二、水合与数据（B 类）

### 4. hydration mismatch 是什么？怎么产生、怎么排查修复？
客户端首次渲染结果与服务端 HTML 不一致，Vue 报 warning 并可能整体重建该子树。诱因：两端数据/时间/随机不同、条件依赖 `window`、非法 HTML 嵌套被浏览器改写。排查：看 warning 定位节点。修复：确保两端一致——初始状态由服务端序列化下发、客户端读取复用，把浏览器相关逻辑挪到 `onMounted`（呼应 vue-ssr-nuxt 第二、四节）。
**来源**：Vue.js 官方文档 — 水合与 mismatch、Nuxt hydration 指南

### 5. 同构数据获取如何做到"服务端取一次、客户端不重复请求"？
组件的取数在服务端执行后，把结果连同渲染状态序列化进 HTML（如 `window.__NUXT__`/`__INITIAL_STATE__`），客户端水合时优先读这份注入的初始状态而非再发请求。Nuxt 的 `useFetch`/`useAsyncData` 内置此机制并自动按 key 去重（呼应 vue-ssr-nuxt 第三节）。
**来源**：Nuxt 文档 — useFetch / payload 复用、Pinia SSR 状态序列化

### 6. 裸 Vue 里 `onServerPrefetch` 起什么作用？
它是在 SSR 服务端渲染**之前**等待异步数据的钩子：在里面 `await` 把数据灌进 store/组件状态，`renderToString` 时才有数据可渲染。对应水合阶段该状态被序列化下发（呼应 vue-ssr-nuxt 第三节、vue-lifecycle 的 SSR 钩子）。
**来源**：Vue.js 官方文档 — onServerPrefetch

## 三、纪律与陷阱（C 类）

### 7. 为什么 SSR 里模块级单例（顶层 new 的 pinia/app）会造成严重 bug？
服务端进程处理多个并发请求，模块级单例在所有请求间共享，A 请求写入的用户态会泄漏给 B 请求，且水合状态错乱。必须用**每请求工厂**：`createApp()` 函数每次请求 new 一套 app/pinia/router（呼应 vue-ssr-nuxt 第四节、vue-project-architecture 第七节、node 每请求隔离）。
**来源**：Vue SSR Guide — 代码的跨请求状态污染、Node 请求隔离

### 8. `onMounted` 在服务端会执行吗？`setup` 呢？这决定了什么写法？
`setup`（及 `beforeCreate`/`created` 对应阶段）两端都跑，所以别在里面直接碰 `window`；`onMounted`/DOM 相关**只在客户端**跑。要访问浏览器 API 就放 `onMounted` 或 `import.meta.client` 守卫（呼应 vue-ssr-nuxt 第四节、vue-lifecycle SSR 注意）。
**来源**：Vue.js 官方文档 — 生命周期与 SSR、Nuxt 客户端/服务端判断

### 9. 服务端把仅客户端可用（如某些富文本/地图组件）如何处理？
用 Nuxt `<ClientOnly>` 包裹、或动态 `import()`、或在 `onMounted` 里初始化；避免在服务端 render 阶段访问 DOM/浏览器库导致报错。这类"仅客户端"渲染不参与水合首屏（呼应 vue-async-suspense、vue-ssr-nuxt 第四节）。
**来源**：Nuxt 文档 — ClientOnly、Vue 动态组件 SSR

## 四、Nuxt 与选型（D 类）

### 10. Nuxt 3 的约定式路由和自动导入分别省了什么？和裸 Vue 有何差异？
`pages/*.vue` 文件结构即路由（含嵌套/动态），无需手写 routes 数组（呼应 vue-router-basics）；`composables/`、`components/` 目录下的自动全局可用，无需逐个 import（呼应 vue-composables）。裸 Vue 都要显式写、显式 import。
**来源**：Nuxt 文档 — 文件系统集成、自动导入 auto-imports

### 11. SSR、SSG、ISR/混合渲染怎么选？
SSR：每次请求服务器渲染，适合高度动态、个性化。SSG（预渲染）：构建时出静态 HTML，适合内容稳定、极致首屏与低成本。ISR/SWR/混合（Nuxt routeRules prerender/swr）：按路由分别选静态/缓存/实时。选型看内容更新频率与个性化程度（呼应 vue-deploy SPA vs SSG、10-vite-deploy）。
**来源**：Nuxt routeRules / 渲染模式、Jamstack 渲染策略

### 12. Nitro/H3 服务端引擎和 Express 有什么异同？
同：都是 Node 侧 HTTP 中间件模型（请求→handler→响应），能写 REST 接口（呼应 09-express）。异：Nitro 跨平台（Node/edge/静态/Serverless 一份代码多目标），H3 是更轻的 web 框架并带事件/拦截器风格 API，`server/api/*` 文件即路由。概念可迁移，实现与部署目标不同。
**来源**：Nitro 文档、H3 文档、Express vs 现代 Node 框架

---

## 补充（新专题 13-15）

### 13. SSR 的性能账要会算：TTFB 增加、FCP 减少、TTI 变化依赖什么因素？什么业务场景这笔账不划算？

逐项：TTFB += 渲染 耗 时（数据 获取 串 行 度 是 命 门：并 行 预 取 + 边缘 缓 存 可 压 到 与 静 态 接 近；串 行 RPC 则 TTFB 爆炸）；FCP -= （HTML 即 含 内容，无 JS 也 可 见，收 益 与 网 络/机 型 强 相 关，弱 网 低 端 机 收 益 巨 大）；TTI ≈ 不 变 或 略 差（ hydration JS 仍 要 下 载 执 行，且 SSR HTML 更 大 解 析 也 花 时 间）——这 是 「SSR 不 是 银 弹」的 定量 表 达；进 一 步 的 最 优 解 常 是 **静 态 化 优先**（能 SSG/ISR 的 绝 不 实 时 SSR，个 性 化 信 息 边 缘 ESI/客 户 端 补）与 流 式（SSR streaming/渐进 渲 染 把 TTFB 变 「首 字节 即 回」、大 页 面 FCP 更 早）。不 划 算 场 景：登 录 后 重 应 用（无 SEO 诉 求、操 作 密 度 集 中 在 TTI 之 后）、团 队 无 服 务 端 运维 经 验（故 障 面 扩 到 进 程/内 存/缓存 一致 性，本包 部署 关 进 程 题 的 风 险 侧）、流 量 绝 大 部 分 已 装 过 首 页（缓 存 HTML 复 访 收 益 归 零）。决 策 输 出 形 式：按 页 面 渲 染 模 式 分 级（营 销 页 SSG/详情 页 ISR/应 用 CSR 壳），而 不 是 全 站 一 刀 切——「混 合 渲 染 是 组 织 决策 而 非 技 术 决策」（Nuxt route rules 就 是 这 个 决 策 的 配 置 化 形 态）。

**来源**：web.dev SSR 性能权衡数据与 streaming SSR 实践；Nuxt route rules（hybrid rendering）文档。

### 14. SSR 状态注水的完整链路：从 Pinia server 端初始化到客户端接管，哪些环节会漏？漏了各是什么症状？

链路 四 环：① 每 请求 新 pinia（createNuxtApp 包 治 了，裸 SSR 业 主 负 责）+ action 在 服务 端 await（onServerPrefetch/useAsyncData）；② 序 列 化：`pinia.state.value` 进 payload —— 漏 点 1：state 里 有 不 可 序 列 化 物（Date/Map/函 数/第 三 方 实例，本包 advanced 持 久 化 序 列 化 同 款 考 点，症 状=丢 数 或 payload 爆 炸）；③ HTML 注 入（`window.__INITIAL_STATE__`/Nuxt payload script）—— 漏 点 2：XSS（序 列 化 内 容 未 转 义，注 入 script 块 的 `</script>` 逃 逸 是 固 定 工 程 题）；④ 客 户 端 hydrate：新 pinia 先 创 再 填——漏 点 3：填 充 前 有 组件 已 读 store（守 卫 抢 跑，本包 pinia 组件 外 翻 车 三 的 SSR 版，症 状=闪 现 未 登录 态）；漏 点 4：填 充 后 又 触 发 首 次 请 求（缺 key 缓 存/`pending` 复 用 判 定，症 状=两 次 重 复 请 求 事 件 同 时 出 现 在 Network）。检 查 手 段：生 产 HTML 搜 payload 大 小、Network 面 板 数 首 屏 业 务 请求 数、hydration 后 第 一 帧 录 屏 看 状 态 闪 现。

**来源**：Pinia SSR 状态水合官方流程图；Nuxt payload/seroval 序列化与 XSS 转义实践。

### 15. Nuxt 的服务端能力边界在哪里？什么情况下应该把「放在 Nuxt server」的功能拆回独立后端？

合 适 留 在 Nitro：BFF 聚合（裁 剪 多 后 端 服务 响 应 给 前 端，减 往 返 与 字段 面）、密 钥 代 持（第 三 方 API secret 的 中转，本包 部署 关 密 钥 题 的 Nuxt 答 案）、轻 状态（Cookie 解析/页 面 级 缓存/简 单  webhook 适 配 器）、ISR/预 渲 染 的 数据 供 给 方。该 拆 走 的 信 号：① 写 主 数 据（事 务/并 发 控制/审 计 属 于 专 业 后 端，Node 边 缘 实例 不 适 合 长 事 务）；② 复 杂 权 限 模 型（越 来 越 多 业 务 判 断 在 server/api 与 主 后 端 双 处 维 护 = 腐 化 开 始）；③ 被 其 他 客 户 端 复 用（App/小 程 序 也 要 的 接 口 不 该 寄 生 在 web 框 架 里）；④ 资 源 模 型 不 匹 配（CPU 密 集/长 连接 与 SSR 的 状 态 无 亲 性 部 署 混 在 一 起 相 互 挤 压）。判 据 总 结：Nitro 是 「这 个 web 应 用 的 专 属 服务 端」（BFF/渲 染 属 主 权 ），不 是 「你 的 后 台」；把 这 条 线 画 住，Nuxt 全 栈 的 便 利 与 混 乱 只 隔 一 个 界 定 问 句：「这 段 服务 端 代 码 离 开 这 个 页 面 还 相 关 吗？」

**来源**：Nuxt 文档 server engine 定位与 BFF 模式；全栈框架职责边界社区讨论。
