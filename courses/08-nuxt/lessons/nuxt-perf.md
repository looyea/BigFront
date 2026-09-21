# 性能工程：把"感觉变快了"变成"数字变了多少"

## 1. 先立度量，再谈优化

性能最大的敌人是"凭感觉改"。Nuxt 应用的耗时分布在**服务端渲染**与**客户端加载**两段，必须分开看：

| 阶段 | 指标 | 在哪看 |
|---|---|---|
| 服务端 | 渲染耗时、DB 查询数 | Nitro 日志 / APM / `server-timing` 头 |
| 网络 | TTFB（含 SSR）、资源数与体积 | DevTools Network、Lighthouse |
| 首屏体验 | **LCP**（最大内容绘制） | CrUX（真实用户）、Lighthouse |
| 交互 | **INP**（上代是 FID）、键盘到响应 | CrUX |
| 稳定性 | **CLS**（布局位移） | Lighthouse / 现场 |
| 脚本 | 主线程阻塞、hydration 时长 | Performance 火焰图 |

三大 Core Web Vitals（LCP ≤2.5s、INP ≤200ms、CLS ≤0.1）是 Google 的门槛，也是产品该盯的北极星。**开发机上"快"没有意义，用 CrUX 的真实 75 分位做基线**，每次改动对比这一条线（呼应 nuxt-seo-meta 第 10 题的量化思路）。

## 2. 服务端：SSR 时间就是 TTFB

SSR 每请求现场建 app、跑数据、渲染 HTML（呼应 nuxt-lifecycle 第 3 节），所以**页面快慢 = 最慢那条数据链**。四把杠杆：

**① 用对缓存，别让每个请求都打 DB。** route rules 是声明式的总闸（呼应 nuxt-render-modes）：

```ts
routeRules: {
  '/':            { prerender: true },             // 构建期出 HTML，零运行时成本
  '/docs/**':     { swr: 3600 },                   // 陈旧即回源，命中即秒回
  '/blog/[id]':   { isr: 86400 },                  // CDN 增量静态再生
  '/api/**':      {},                              // 交给 handler 级缓存
  '/app/**':      { headers: { 'Cache-Control': 'private, no-store' } }, // 私有页禁缓存
}
```

**② handler 级缓存**用 `defineCachedEventHandler`（呼应 nuxt-server-routes），把热点接口结果放 Redis/unstorage，多实例共享。

**③ 并行而非串行取数**：`await Promise.all([...])` 或用 `useFetch` 的多个 key 并发，别把三个独立请求写成三条顺序 `await`。

**④ 数据瘦身**：SSR 只取首屏必需字段（`useFetch` 的 `pick`，呼应 nuxt-usefetch），慢查询加索引/分页——服务端省 100ms，等于全站每个请求都省 100ms。

## 3. 传输层：payload 与 HTML 是 SSR 应用的隐形税

SSR 把数据序列化成 `window.__NUXT__`（呼应 nuxt-hydration 第 2 节），**它塞在 HTML 里，直接拉大 TTFB 与 LCP**。常见超支：

- 列表页把整个对象数组塞进 payload（其实只要 id + 标题）→ 用 `pick`/`transform` 裁；
- Pinia 无脑全量导出 state（字典、全量列表）→ 别把缓存数据放 store（呼应 nuxt-state 第 5 题）；
- 内联样式 + 大 DOM → `features.inlineStyles` 要基于实测决定（呼应 nuxt-styling 第 5 节）；
- 富文本 HTML 字符串直接进 payload → 改客户端按需拉或懒渲染。

量法：`view-source:` 看 HTML 字节、对比 `__NUXT__` 体积；`nuxt build --analyze` 看 JS/CSS 分布（rollup-visualizer，呼应 vite-splitting）。**目标不是"最小"，而是"首屏每字节都有回报"。**

## 4. 客户端：加载与执行

**代码分包**：路由天然按 pages 分包（懒加载），把重型、低频组件（编辑器、图表、地图）用 `defineAsyncComponent` 或 `.client.vue` 拆出去（呼应 nuxt-styling 第 3 节）；第三方 UI 库按需引入（呼应 nuxt-styling 第 7 题）。

**预取**：`<NuxtLink>` 进入视口会自动预取目标路由的 JS/数据（呼应 nuxt-routing），让"点了才加载"变成" hover 时就绪"；但别给冷门页滥用 `prefetch`，会抢首屏带宽。

**水合成本**：DOM 越大、组件越多，hydration 越长（INP 变差）。超长列表虚拟化、非首屏 `<ClientOnly>`/懒挂载，把 hydration 工作量挪出关键路径。

**图片**：`<NuxtImg>` 出多尺寸 + WebP/AVIF + `sizes`，配 `preload` 给 LCP 主图、其余 `loading="lazy"`（呼应 nuxt-modules 第 5 节、next-fonts-images）。**LCP 元素是图片时，给主图 `preload` / `fetchpriority="high"`，千万别 `<ClientOnly>` 包它**（呼应 nuxt-hydration 的 ClientOnly 与 LCP 禁令）。

## 5. 一条可复用的优化流程

```
1. 建基线：CrUX/Lighthouse 跑关键路由，记录 LCP/INP/CLS/HTML 体积/JS 体积
2. 归因：慢在 TTFB(服务端) 还是 资源加载(传输) 还是 hydration(执行)？
   - TTFB 高 → 第 2 节；HTML 巨大 → 第 3 节；主线程长 → 第 4 节
3. 单点改动 → 复测 → 数字没动的回滚
4. 固化进 CI：预算（budget）卡 JS/HTML 体积、Lighthouse CI 卡分
```

**性能是"预算"不是"运动"**：给每个关键页设 `resource budget`（如首屏 JS ≤150KB gzipped、HTML ≤60KB），超标 CI 直接红——这样退化在合入前就被拦，而不是上线后救火。

## 6. Nuxt ↔ Next 性能对照

| 维度 | Nuxt | Next.js |
|---|---|---|
| 缓存声明 | routeRules + defineCachedEventHandler | route segment config + Full Route Cache |
| 增量静态 | isr | ISR（同源概念） |
| 数据税 | payload（__NUXT__） | RSC payload / flight |
| 分包 | pages 自动 + 异步组件 | 按路由 + `next/dynamic` |
| 图片 | `<NuxtImg>` provider | `next/image` |
| 服务端可选运行时 | Nitro 多 preset | Node / Edge |

概念高度对称，学透一个另一个基本会读（这正是本包与 07 包对照学习的收益）。

## 7. 自检清单

- [ ] 有 CrUX/Lighthouse 基线数字，优化前后各留档？
- [ ] 热点页是否用了 prerender/swr/isr 而非每请求现算？
- [ ] 私有/带身份页是否明确 no-store（性能不能以缓存泄露为代价）？
- [ ] payload 是否只含首屏必需（无全量列表/字典）？
- [ ] LCP 主图是否 preload、且未被 ClientOnly/懒加载推迟？
- [ ] 重型组件是否异步/`.client` 拆包？
- [ ] CI 是否有体积预算与 Lighthouse 卡点？
- [ ] 慢查询/分页是否处理（服务端不是黑箱）？

## 8. 🚀 部署预告

快是体验，稳是底线。下一关 **nuxt-error-debug**：`createError` 的统一错误契约、`error.vue` 兜底页、服务端 error 中间件与 SSR 阶段异常的关系，以及"500 页里不能泄露堆栈"的安全红线（呼应 exp-security、next-error-loading）。
