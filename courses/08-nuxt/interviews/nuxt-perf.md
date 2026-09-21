# nuxt-perf 面试题（12 题）

## A. 基础认知

### 1. SSR 应用的性能和纯 SPA 有何不同？该盯哪些指标？
**答**：SSR 把一部分工作从客户端挪到服务端，所以首屏由"TTFB + HTML 渲染"主导，而非"下载 JS + 执行 + 首次渲染"。典型收益是 LCP/FCP 更早、SEO 更好；典型代价是每个请求都耗服务端算力、HTML 里带 payload 变大。指标分两层：现场用 CrUX 的 Core Web Vitals（LCP/INP/CLS，75 分位），实验室用 Lighthouse 定位问题；服务端另看 SSR 渲染耗时与 DB 查询数（可打 server-timing 头）。不要把实验室分当线上结论。

**来源**：《SSR 性能模型》、《Core Web Vitals 实战》

### 2. payload（__NUXT__）为什么是 SSR 的隐形税？怎么治？
**答**：SSR 把服务端取到的数据序列化内联进 HTML 供客户端水合复用，它同时计入 HTML 体积——越大 TTFB 越高、解析越久、还随每页重复。治理：`useFetch` 用 `pick`/`transform` 只留首屏字段；列表别把整对象数组塞进去；Pinia 只放当前页真正需要的 state（缓存类数据下沉到服务端 storage）；富文本 HTML 改客户端按需拉。度量用 view-source 看 HTML 字节与 `__NUXT__` 大小，做进 CI 预算。

**来源**：《Nuxt payload 优化》、《SSR 数据裁剪》

## B. 对比与辨析

### 3. prerender / swr / isr / 纯 SSR 四种取法，性能上怎么选？
**答**：能构建期确定的用 prerender（零运行时、全球 CDN，最快但更新要重发）；内容量大且能容忍短暂陈旧用 swr（命中即回、后台再验证）或 isr（CDN 增量再生，配 purge 主动失效）；实时性要求高或按身份分支的走动态 SSR + 接口级缓存（defineCachedEventHandler）。私有/带 cookie 页面绝不进共享 HTML 缓存（安全线优先于性能）。判据是"这个页面的内容对所有人相同吗 + 能忍多久旧"。与 Next 的 ○●ƒ 概念几乎一一对应。

**来源**：《混合渲染的性能取舍》、《缓存策略与新鲜度》

### 4. 代码分包在 Nuxt 里默认做到什么程度？还要做什么？
**答**：pages 下每个路由天然懒加载分包，公共依赖被提取到共享 chunk；组件不会自动按使用切分。要进一步优化：低频重组件（编辑器/图表/地图）用 `defineAsyncComponent` 或 `.client.vue` 拆出主包；第三方 UI 库走按需引入；把只在交互后出现的模块 dynamic import。反面是过度分包导致瀑布式请求与体积碎片，用 `--analyze` 看产物结构再决定粒度（呼应 vite-splitting）。

**来源**：《Nuxt 打包产物分析》、《合理分包的边界》

## C. 实战场景

### 5. 首页 Lighthouse 从 90 掉到 60，如何系统定位是哪一段退化？
**答**：先分段归因：①TTFB 变高 → 服务端，查 SSR 时间线（新增了串行取数？慢查询？route rule 从 swr 掉回动态？）；②HTML 体积暴涨 → payload 或内联样式，view-source 对比 diff；③主线程变长 → JS，`--analyze` 看新依赖/是否把懒加载组件提到了首屏；④布局跳动 → 图片无尺寸/字体回流导致 CLS。对每次可疑 PR 跑 Lighthouse CI 对比分数与预算，把归因固化成流程而非临时救火。

**来源**：《性能回归定位法》、《Lighthouse CI 落地》

### 6. 一个电商详情页要做性能优化，给出你的组合拳。
**答**：分层。传输：主图 `<NuxtImg>` 合适尺寸+WebP/AVIF+`fetchpriority=high`+preload，其余图 lazy；详情内容走 isr 或 swr（价格/库存这类实时项单独接口动态取，别整体 no-cache，呼应 nuxt-usefetch）。服务端：首屏必需字段用 `pick`，评价分页客户端懒加载不进 payload。客户端：规格选择器/推荐位异步组件。缓存：`/api/price` 秒级、`/api/stock` 5s、营销文案 prerender。度量：把"详情 LCP、INP、HTML 体积"设预算进 CI。要点是**把"快"和"实时"分开处理，而不是一刀切 no-store 拖垮全站**。

**来源**：《电商详情页性能实战》、《实时性与缓存的分离》

### 7. 字体与图片常拖慢首屏，Nuxt 里怎么处理？
**答**：字体用 `@nuxtjs/google-fonts` 或自托管，`font-display: swap`（或 optional）避免 FOIT，做子集化减体积，关键正文字体可 preload（呼应 nuxt-styling 第 8 题）。图片走 `<NuxtImg>` 出多尺寸与 `sizes`、现代格式，LCP 主图 preload + 高优先级、其余 lazy，务必给宽高避免 CLS。第三方嵌入（视频/广告/社交）延迟到交互后或用占位固定高度，防止它挤在关键路径。

**来源**：《字体加载策略》、《图片与 CLS 治理》

## D. 深度追问

### 8. "首屏尽量 SSR、之后尽量轻"矛盾吗？你怎么平衡 SSR 成本与客户端成本？
**答**：不矛盾，是同一目标的两端。SSR 成本在服务端算力与 HTML 体积，客户端成本在 JS 下载/执行/hydration。平衡点：首屏必需内容 SSR 出（利于 LCP/SEO），但把交互逻辑与非首屏组件从 hydration 里摘出（异步、`.client`、虚拟化长列表）；用 payload 裁剪控制 HTML；用 INP 监控 hydration 后交互。可量化成一个决策表：每个模块问"首屏可见吗？需要交互吗？"——可见不需交互→纯 SSR 静态片段；需交互→客户端组件；不可见→懒加载。

**来源**：《SSR 与客户端的分工》、《hydration 成本治理》

### 9. route rules 的缓存如果配错，最坏会发生什么安全事故？如何防？
**答**：把带用户身份或私密的页面配成共享缓存（swr/prerender/CDN），会让 A 用户看到的 HTML（含昵称、余额、token）被下发给 B——数据越权泄露，这是安全事故不是性能问题（呼应 nuxt-render-modes 的 HTML 缓存安全线、L3 作业里的"看到别人昵称"）。防线：①带 cookie 的页一律 `private, no-store`；②接口级缓存用 defineCachedEventHandler 时 getKey 必须含用户/租户维度（呼应 nuxt-server-routes）；③上线前对敏感路径做"两个账号交叉访问"回归；④把"禁缓存路由清单"写进评审与 e2e。

**来源**：《缓存投毒与越权》、《私有内容的缓存策略》

### 10. 你如何判断一个优化"值不值得做"？
**答**：用"影响面 × 收益 ÷ 复杂度"打分。影响面：这条路径的流量占比、是不是转化关键环节；收益：预计改善哪个指标多少（要有基线可验证，不能改善数字的默认不做）；复杂度与风险：是否牺牲可维护性、是否引入缓存正确性风险（如第 9 题）。工程上还有一条：**先测再改**——没有 profiling 支撑的优化多半在优化根本不是瓶颈的地方。对已达标且无风险的"顺手改"可做，对高风险高复杂度的边缘优化要克制。

**来源**：《性能优化的投入产出》、《过早优化的陷阱》

## E. 架构视野

### 11. 从架构层面，Nuxt 应用性能治理的长效机制是什么？
**答**：三件事。①**预算进 CI**：关键路由的 JS/HTML/CSS 体积与 Lighthouse 分作为合入门禁，让退化不可合入；②**现场监控**：接 RUM（web-vitals 上报 + Nitro 侧 SSR 耗时打点），用真实分位而非实验室指导优先级；③**渲染与缓存策略集中化**：所有 route rules 收在一处并有 review 规则（带身份=不缓存），避免散配埋雷。把性能从"某次冲刺"变成"持续约束"，才是架构级的解法。

**来源**：《性能左移与持续治理》、《RUM 驱动的优化闭环》

### 12. Nitro 的多运行时（Node/Edge/静态）对性能策略有什么影响？
**答**：Nitro 可按 preset 输出不同运行时（呼应 nuxt-deploy）。冷启动与就近性上，Edge/serverless 冷启动延迟与区域回源会影响 TTFB，Node 常驻进程无冷启动但单点；静态导出没有服务端最快但失去动态能力。因此同一套代码在不同 preset 下要重新评估：内存/文件缓存（defineCachedEventHandler 的默认 storage）在 serverless 下不跨实例共享，需要换成平台 KV（呼应 next-deploy 第 7 题的失效不共享）。**性能结论必须绑定部署形态给出，脱离运行时的优化数字不可迁移。**

**来源**：《运行时形态与性能》、《Serverless 缓存的陷阱》
