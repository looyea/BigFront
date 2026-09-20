# nuxt-usefetch 面试题（12 题）

> 主题：三件套分工、key 与去重、SSR 数据流与缓存语义。

## A. API 分工

### A1. useFetch 和 $fetch 的区别，一句话版和展开版。

**答**：一句话：$fetch 是"增强版 fetch 函数"（命令式、何时可跑），useFetch 是"SSR 感知的取数组合式函数"（声明式、参与服务端渲染与 payload）。展开四点：① 时机——useFetch 在 setup 且要 await（挂 Suspense），$fetch 任何时刻（事件、定时器）；② SSR——useFetch 服务端执行、结果内联 payload、水合复用；$fetch 在 SSR 里跑也不收集；③ 响应性——useFetch 的 URL/参数支持 ref 自动重取并返回 data/pending/error 响应式族；④ 缓存——useFetch 走 key 注册表去重复用，$fetch 零缓存。选错典型：把导航后取数写成 await useFetch 阻塞过渡（该用 lazy 或 $fetch）；把首屏数据用 $fetch 导致水合二次请求闪变（呼应 nuxt-usefetch 第 1 节）。

**来源**：掘金《useFetch 与 $fetch：一张对照表终结混淆》；CSDN《水合闪变背后的取数误用》。

### A2. useAsyncData 什么时候比 useFetch 更合适？

**答**：当"异步源不是 HTTP"时：直连数据库（Prisma/Drizzle）、调用 Nitro 内部函数、读文件/缓存——useAsyncData(key, handler) 只要求 handler 返回可序列化结果，不发请求也不带 baseURL 等 fetch 选项。典型全栈场景：SSR 首屏数据本就在同进程（server/utils 的函数），useFetch 走一圈 /api 反而绕远（序列化+HTTP 开销）；社区争论点：直调函数与走自家 API 的取舍（类型共享 vs 单一入口），大团队常统一走 API 便于缓存与观测（呼应 nuxt-server-routes、next-fullstack-project C1 的同类辩论）。

**来源**：SegmentFault《useAsyncData 直调数据库还是绕 API》；知乎《同进程取数的两种口味》。

### A3. 为什么说"三件套的心智是 VueUse useFetch 的 SSR 增强版"？

**答**：VueUse 的 useFetch 给出形状：data/error/status + 响应式 URL + 重试拦截钩子——Nuxt 三件套 API 设计明显同源（底层正是 ofetch+共享注册表），增量在三件 SSR 事：① setup 内 await 与 Suspense 集成（服务端等它、客户端可懒）；② payload 收集与水合复用（服务端跑的结果不重发）；③ key 注册表的跨组件/跨导航去重。所以从 Vue SPA 转 Nuxt 几乎零学习成本，要补的就是"数据在哪个阶段、被谁消费"的 SSR 时刻表（呼应 nuxt-lifecycle）。加分：Nuxt 客户端状态库（如 @tanstack/vue-query 集成）解决的是"缓存策略与失效"层，与三件套互补——重数据应用常二者并用的场景讨论。

**来源**：CSDN《从 VueUse 到 Nuxt useFetch 的迁移视角》；InfoQ《客户端状态库与框架取数的边界》。

## B. key 与缓存语义

### B1. 描述 key 的完整生命周期：SSR 写入、水合消费、SPA 导航复用、refresh 覆盖。

**答**：① SSR：handler resolve 后，{key: result} 登记进 nuxtApp 的 data 注册表，随 payload 序列化内联 HTML；② 水合：客户端从 payload 复原注册表——useFetch 命中已有 key 直接注入 data，不发请求（首帧零闪变的前提）；③ SPA 导航：新页面组件 setup 再执行，仍命中注册表（内存里）秒回，URL 变了但 key 未变的话——这就是"数据不新鲜"事故门，需 getCachedData 或换 key；④ refresh()：重新执行 handler 并**覆盖**注册表该 key，所有共享该 key 的组件同步更新（响应式同源）。一条链讲完，顺手说出三种失效出口（显式 key 含参/getCachedData/refresh），这题就满分（呼应 nuxt-usefetch 第 2 节）。

**来源**：掘金《key 的一生》；SegmentFault《SPA 回退导航的数据新鲜度》。

### B2. getCachedData 怎么写"30 秒内复用、超时重取"？

**答**：

```ts
const { data } = await useFetch('/api/status', {
  key: 'status',
  getCachedData: (key, nuxtApp) => {
    const hit = nuxtApp.payload.data[key] ?? nuxtApp.static.data[key];
    if (!hit) return;                       // 无缓存 → 取
    if (Date.now() - hit.ts > 30_000) return; // 过期 → 取
    return hit;                              // 命中 → 复用
  },
});
// handler 里给数据打 ts 戳：transform: d => ({ ...d, ts: Date.now() })
```

两个考点：① 时间戳要打在**数据上**（服务端/客户端共用一份），别在 getCachedData 里 new Date 对旧值做端态判断踩 mismatch；② payload（水合值）与 static（跨导航驻留值）是两个源——Nuxt 4 里默认水合期优先 payload，getCachedData 要都查。这题区分"会用 API"与"懂缓存模型"（呼应 nuxt-hydration C2）。

**来源**：CSDN《getCachedData 与 TTL 缓存的自造》；知乎《payload 与 static 双源细节》。

### B3. 水合期 useFetch 会不会重复请求？什么配置会让它"违背直觉"地重发？

**答**：默认不会——这正是 SSR 首屏省请求的核心机制。会重发的四种情况：① 客户端渲染分支（ssr:false 区）服务端没烘 payload，水合就是首取；② key 与服务端登记的不一致（组件复用了不同参数但 key 生成依赖 URL，URL 是模板串带变量时易错）；③ 显式 `getCachedData: () => undefined` 或 `server: false`（跳过 SSR 执行，水合变首取）；④ Nuxt 4 起部分实验配置（checkHydration/payload 内联策略变化）导致 payload 缺该 key——看 DevTools payload 面板核对。排查心法：数据闪变/双请求先看 payload 里有没有那位（呼应 nuxt-lifecycle B2）。

**来源**：SegmentFault《水合后双请求的四条线索》；掘金《payload 面板排障实录》。

## C. 错误与竞态

### C1. 搜索框输入 "abc" 快速发出三次请求，慢的旧响应覆盖新结果，useFetch 怎么防？

**答**：响应式 URL + 内置竞态处理：同一响应式源快速变化时，useFetch 内部按请求序号丢弃过期 resolve（watch 节流 `dedupe: 'defer'/'suppress'` 选项进一步控并发）。再配 debounce 源（`const q = refDebounced(input, 300)`）把请求频率降下来。若用 $fetch 手写则完全没有这层保护——要自己上 AbortController+序号哨兵（React Query 同款问题，呼应 react-data-fetching）。这题考点：框架取数的价值一半在"脏活内置"。

**来源**：知乎《搜索竞态：框架内建 vs 手工挡》；CSDN《debounce + watch 取数组合拳》。

### C2. SSR 接口超时导致首屏 Suspense 挂 10 秒，给三层防御。

**答**：① 请求层：useFetch 的 `signal` 或 server timeout（$fetch 底层 AbortSignal），超时上限=可接受 TTFB 预算（如 2s）；② 结构层：非关键数据下推 `<Suspense>` 子边界——外壳先出、慢块流式补（Nuxt 的异步组件/懒 useFetch 组合，呼应 next-context-streaming）；③ 策略层：该路由 routeRules 配 swr（旧缓存先顶）或直接 ssr:false（放弃该页 SSR）。原则：SSR 页面的 TTFB 预算要显式设计，await 链里每个成员都要有 deadline（呼应 next-perf 第 3 节取数瀑布）。

**来源**：掘金《SSR 超时预算的三层防线》；InfoQ《首屏挂起的根因分析清单》。

### C3. error 态要区分"网络错/业务错/鉴权失效"三类，怎么设计？

**答**：分层归一：① 网络层——useFetch 的 error（AppError：cause 里有 status/errno），判 `!error.value.status` 为网络错，展示重试；② 业务层——后端约定 { code, message } 放 data 里（200 里的业务失败），或 createError({ statusCode: 4xx, data }) 让 H3 传状态码；③ 鉴权层——onResponseError 捕 401 → navigateTo('/login')（带 redirect 回跳参数）。统一出口写进插件：$fetch 拦截器（onRequest/onResponse 钩子挂全局）把三类打标签，组件只消费语义化 error.kind。反面教材：满屏 `if (error) toast('fail')` 把三类糊成一团（呼应 exp-rest 契约、nuxt-error-debug）。

**来源**：CSDN《前端错误分类学》；SegmentFault《401 全局处置的钩子位置》。

## D. 体系与对照

### D1. Nuxt 把"数据缓存"做得比 Next 简单，是缺点还是优点？

**答**：两面。优点：认知负担小——没有构建期/请求期多层缓存自动行为，"数据何时新鲜"基本由 key+refresh 显式控制，事故面小、调试路径短（Next 用户转来第一感受常是"终于不发旧数据了"）。缺点：能力缺口——跨请求/CDN 级的 HTML 缓存要自己组合 routeRules+Nitro 缓存，平台集成（缓存共享、边缘失效）不如 Next 于 Vercel 深。判断：对内容大站，Nuxt 的"简单"会转化为"自建成本"；对应用型站点，Next 的"强大"会转化为"误用风险"。架构师答题要给出场景权重而不是站队（呼应 nuxt-render-modes A2、next-fetch-cache）。

**来源**：知乎《简单与强大的兑换率》；InfoQ《数据缓存：两个框架的两种债》。

### D2. payload 收集让 HTML 变大，Nuxt 有没有"按需水合/按需烘数据"的出路？

**答**：有且分三层：① 单页 `payloadExtraction: false`/单请求 `lazy` 减少烘入；② 路由级 routeRules ssr:false 让该页零 payload；③ 组件级——`<NuxtIsland>`（实验）拉服务端片段不占主 payload、`.client.vue` 组件数据自然不 SSR。更系统的是"数据分区"纪律：首屏可见才 useFetch，非首屏一律客户端取（骨架屏标准，呼应 nuxt-hydration C1 五刀）。Nuxt 未走 RSC 式"渲染结果外置"路线，所以 payload 是它唯一的数据通道——通道要窄，内容要挑。

**来源**：掘金《payload 分区策略》；CSDN《NuxtIsland 试点报告》。

### D3. 由你给团队定《取数规范》，写五条硬规则。

**答**：① 首屏/SSR 路由数据只准 useFetch/useAsyncData，key 必须含全部变量参数（lint 校验模板串）；② 事件驱动的变更+重取：$fetch 写 + refresh 读，禁止手写两套 loading 态；③ 每个 useFetch 必须有 `pick/transform`（payload 预算 ≤ 每页 50KB，CI 测 HTML 体积）；④ 错误三分法（网络/业务/401）经全局拦截器归一，组件只看 error.kind；⑤ 动态路由页取数必须响应式 URL 或显式 key+refresh 二选一，禁 watch+location.reload 核弹。每条背后都是本关的某次事故原型——规范的本质是把踩过的坑焊进管道（呼应 next-testing D3 的门禁思路、nuxt-fullstack-project）。

**来源**：SegmentFault《我们团队的 Nuxt 取数军规》；知乎《规范怎么写才不被绕开》。
