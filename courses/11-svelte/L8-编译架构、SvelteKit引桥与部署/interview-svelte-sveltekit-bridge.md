# svelte-sveltekit-bridge 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与 Kit 官方叙事的高频主题转述。

---

### 1. (A) "Svelte 是框架，SvelteKit 是应用框架"——用职责清单解释这句话，各列 4 条。

**来源**：Kit 官方文档定位段 — 三框架同款叙事（Next/Nuxt）的转述

Svelte 管：组件语法（runes/snippet）、编译器与产物、响应式运行时、a11y 检查。SvelteKit 管：文件路由与嵌套布局、渲染模式编排（SSR/CSR/预渲染）、load 数据契约与服务端边界（*.server.ts）、构建产物到部署平台的 adapter。类比：React≠Next、Vue≠Nuxt 的同款分层——面试听到混用就说明候选人没拆过职责，可主动展开加分（呼应 react-nextjs、vue-ssr-nuxt 开场题）。

### 2. (A) 讲清 +page.ts 与 +page.server.ts 两种 load 的执行端与数据流向；secret 放错会怎样？

**来源**：Kit 文档 load 章 — 服务端边界高频题

`+page.server.ts` 只在服务端跑（SSR 时执行一次，结果序列化给客户端；纯 CSR 场景由 server fetch 取得），代码不进浏览器 bundle；`+page.ts` 在导航时**客户端也会执行**（首屏 SSR 除外）。secret 写进 `+page.ts` = 打进公开 JS，等于把数据库密码贴在首页。防御口径：`.env` 私密变量只有 server 文件可读；返回数据必须可 JSON 序列化（函数/类实例会被砍）（呼应 next 的 server-only 包策略、nuxt nitro 同款边界）。

### 3. (A) Kit 的 form actions 说自己是"渐进增强"，从 HTML 表单原生行为出发解释这句话的技术含义。

**来源**：Kit 表单教程三件套 — enhance 机制原理题

原生 `<form action={submit} method="POST">` 不写一行 JS 也能提交并整页刷新——这是基线；挂载 `use:enhance`（Kit 版，非 L5 那个 svelte action 但同源思想）后升级为 fetch 提交+局部更新+自动 reset 策略，失败仍可退回。对比"必须 JS 才能用"的 SPA 表单方案：无 JS 环境（爬虫/无障碍/网络故障降级）仍可完成业务——**增强的是体验，不是功能本身**（呼应 07-next server actions 与 L5 表单课的无 JS 基线讨论）。

### 4. (B) 老项目从早期 Kit 升级，路由目录被 codemod 大改（__layout → +layout 一族）。说说这次重构解决了什么历史问题，团队升级该注意什么？

**来源**：Kit 路由重构（route manifest 时代）社区复盘的转述

旧版 `__layout/__error/$slug` 前缀约定有歧义（文件与目录职责混排、私有目录规则含糊）；`+` 前缀把"框架消费的特殊文件"与"你的组件文件"一眼分开，同时 `*` 通配/匹配器（matchers）语义统一。升级注意：`sv migrate routes`（旧 kit migrate）跑完后全量回归链接、`$app/*` 模块 API 换代（stores→navigation 函数）、预渲染配置搬家 svelte.config——**跨大版本升级按'生成物 diff 全读'纪律**（呼应 svelte-tooling 版本联动代价、L10 迁移课方法论）。

### 5. (B) 同事问："我 Kit 项目里组件不写 runes 会失效吗？为什么我的 store 在 +page.svelte 里 $ 前缀报错？" 用本包分工知识回答。

**来源**：社区答疑精选 — 框架层与语言层困惑交叉高频题

Kit 不改变 Svelte 编译规则：runes/legacy 探测在组件层照常生效（compilerOptions.runes 在 svelte.config 管）。store 的 `$` 自动订阅前缀是 legacy 语法——在 runes 钉死的工程里 store 不能 `$` 展开（那是编译器管的，不是框架管的），要用 `get()`/`store.get()` 或改造为 runes 单例（呼应 svelte-global-state 的雷区清单）。结论：**Kit 是宿主，语言规范永远看 svelte 版本与编译档位**。

### 6. (C) Next/Nuxt/Kit 三家的"数据加载"抽象各是什么？给一张对照表并说各自取舍。

**来源**：跨框架全栈对比高频题（三家文档叙事互译练习）

| | Next.js | Nuxt | SvelteKit |
|---|---|---|---|
| 抽象 | Server Component 直接 async + RSC 载荷 | `useAsyncData/useFetch` + server routes | `+page(.server).ts` 的 load 函数 |
| 边界表达 | 指令/文件约定混合 | nitro 服务端目录 | 文件名 `.server.ts` 物理隔离 |
| 数据去向 | RSC 序列化流 | payload 注入（nuxt payload） | `data` prop 注进组件 + 导航期可复用 |
| 心智负担 | RSC/客户端双世界最重 | 模块生态最繁 | 概念面最小但自己写更多胶水 |

取舍主线：Kit 押注"web 标准+显式契约"（load 就是个返回可序列化对象的函数），Next 押注组件即数据层，Nuxt 押注生态自动化（呼应 next-data-fetching、nuxt-server-routes 同款横题）。

### 7. (C) adapter 谱系（static/node/平台适配器）相比 Next 的 deploy 模型差异在哪？什么场景这个差异变成决定性优势？

**来源**：部署可移植性议题 — 私有化交付项目面经变体

Next 深度绑平台能力（image/ISR/middleware 在自建环境常打折扣）；Kit 的 adapter 把"产物形态"做成显式选择：`adapter-static` 出纯 SPA/SSG 进桶、`adapter-node` 出标准 Node 服务进容器/内网机、平台 adapter 出 serverless bundle。决定性场景：**政企内网离线交付**（只能 docker 跑 node 服务）与**静态分销**（CDN 桶 + 无算力）——同一仓库换 adapter 不动业务代码（呼应 svelte-deploy、nuxt-deploy 的私有化章）。

### 8. (D) 场景题：产品是"公开营销站（SEO 重）+ 登录后台（交互重）"，选纯 Svelte、Kit、还是混合？给方案与理由。

**来源**：架构选型综合题（全栈岗位收官轮变体）

推荐 **Kit 一仓双策略**：营销页 prerender（`export const prerender = true`，产物即静态 HTML，吃 SEO 与 CDN）；后台路由 `ssr=false`（纯 SPA 化，登录态页面没 SEO 诉求，省服务端渲染成本）——同一框架两种渲染档位，运维一套。纯 Svelte 方案要自建 SSR+路由，只有"零服务端"或"已有 Node 中台"时才划算；混合双仓则支付两栈成本。加分：给 CI 两条预算线（营销页 Lighthouse、后台 bundle size），呼应 vite-ci-perf（评分点：**按路由分档渲染策略**这个 Kit 特色是否想到）。

### 9. (D) 给一个 React+Next 团队做"转 Svelte+Kit"的试点提案，限定 6 周。列里程碑与风险闸门。

**来源**：技术转型推动类场景题（管理轮/资损权衡考察）

W1-2：纯 Svelte 组件层培训（本包 L1–L5）+ 一个内部小工具试点；W2 末闸门=runes 心智通过测试（lint 零绕过、代码评审标准达成）；W3-4：Kit 单页迁移（把 Next 里一个独立路由迁到 Kit，含 load 对照表）；W4 闸门=性能与工程指标持平（bundle/INP/CI 时长，呼应 vite-ci-perf 度量观）；W5：adapter 部署演练（内网 node 版 + CDN 静态版各一）；W6：复盘与推广边界（明确哪些业务域**不迁**：重 React 生态依赖的模块）。风险闸门哲学：每步可回退、用数字说话、不做全仓大跃进。

### 10. (A) 为什么说"用 Kit 之后你写的 .svelte 文件'天生双端执行'"？这对编码纪律提出什么要求（举 3 个会炸的位置）？

**来源**：Kit 文档 SSR 章节的编码纪律转述（Nuxt 同题换皮）

同一组件：SSR 时在 Node 里执行产出 HTML，浏览器里再执行接管（水合）。炸点：①顶层直接读 `window/document`（SSR 端 ReferenceError——挪进 `$effect`/事件回调，或 `import { browser } from '$app/environment'` 守卫）；②渲染期取 `localStorage` 初始化 `$state`（双端不一致→水合错位）；③`Date.now()`/随机数直接进模板（同上）。这套纪律与 08-nuxt 的 SSR 安全编码、next hydration mismatch 三框架完全同构（呼应 svelte-ssr-hydration 的 mismatch 章）。

### 11. (C) "纯 Svelte 也能做 SSR（render API），那 Kit 的 SSR 多给了什么？" 列出至少 4 件编排层的活。

**来源**：对 L10 手搓 SSR 关的反向铺垫题（社区高频混淆）

手搓只有"渲染字符串"这一步；Kit 编排的是：路由匹配后自动选 SSR/预渲染/CSR、load 并行调度与数据序列化注水、`<head>` 元素收集进 HTML、错误处理（handleError）与 `+error.svelte` 渲染、streaming（await 边界分块吐出）、CSP/nonce 透传、水合引导脚本注入、每路由缓存指令（`prerender/ssr/csr` 导出）。一句话：**render() 是发动机，Kit 是整车**——本课手搓清单与 L10 实现互相印证。

### 12. (D) 终题：面试官质疑"SvelteKit 生态比 Next 小多了，你的公司凭什么选它？" 给一段 3 分钟的正面回答。

**来源**：技术选型辩护综合题（价值观与工程判断双考）

框架三层：组件语言层（本包，生态需求=小部件，缺口可用 runes 自补且体积小）；应用框架层（Kit 覆盖 80% 通用需求：路由/load/表单/adapter，缺的多是'Next 平台增值'而非必需品）；生态层（真正缺的是垂直 SaaS 集成——评估这些集成本来就该在 BFF/服务端做，不必进前端栈）。再用事实压秤：Vite/Rollup 同源基建的工程质量、小团队维护节奏与 LTS 化承诺、性能默认值（无 VDOM+小基数）。最后交回前提：**选型赢在匹配度**——弱网卡+全栈团队小+内网交付多则 Kit 加分，重 React 垂直生态则诚实留在 Next；把"凭什么"翻译成"我们的约束是什么"（呼应全课程的反宗教战争立场）。

---

## 补充（新专题 13-15）

### 13.  为什么说 Svelte 是 UI 框架、SvelteKit 是应用框架？两者边界与协作点具体是什么？

边界：Svelte 管"组件如何编译成 UI + 响应式"（render/mount/信号），不提供路由/数据获取/服务端/构建默认；Kit 建在其上加"应用级"能力——文件系统路由（+page/+layout/+server）、数据加载（load + 服务端/客户端模块边界）、SSR/预渲染/adapter 部署、form actions、渐进增强、代码分割与预取、$app/* 运行时 store。协作点：Kit 里你写的仍是标准 .svelte 组件（runes/props 全适用，"用了 Kit 后 .svelte 写法不变"，对应既有题）；Kit 通过 vite-plugin-svelte + 自己的 Vite 插件把组件接进路由/SSR 管线。选不选：需要"多页面 + 服务端 + SEO + 部署"→Kit；纯组件库/嵌入小部件/极简单页→纯 Svelte 足够（对应 quiz 组件包题）。加分句：最准的类比是"Svelte : SvelteKit ≈ React : Next（或 Vue : Nuxt）"，但 Kit 更"约定即默认全功能"（自带路由/SSR/adapter 而非可选叠加）；讲清这个边界能避免"用 Kit 做一个组件"或"用纯 Svelte 硬搓一个全站应用"两种错配（呼应 sveltekit-bridge 整组选型题）。

**来源**：Svelte vs SvelteKit 定位；Kit 能力清单；既有"Svelte 框架 Kit 应用框架"深化

### 14.  讲清 +page.ts、+page.svelte、+page.server.ts、+layout.ts、+server.ts 各自职责与执行时机。

执行时机与位置：① +page.svelte——页面组件（渲染，client+ssr）；② +page.ts（universal load）——通用 load，SSR 时服务端跑一次、客户端导航时在浏览器跑（同构，返回 data 给组件 $page.data/props）；③ +page.server.ts——服务端专属 load，只在 Node 跑（secret 在这，对应 quiz），客户端导航不重跑而是通过 endpoint 拿；④ +layout.ts/.server.ts——布局级 load，为一段路由树共享数据（嵌套布局、跨页常驻）；⑤ +server.ts——纯 API endpoint（返回 JSON/处理 HTTP 方法，非页面）。数据流：server load → universal load → 组件 props（每层可 depends/invalidation 控制重取）。加分句：判据"这段逻辑要不要浏览器也跑（同构数据用 +page.ts）/能不能进浏览器（secret/DB 用 +page.server.ts）/是页面还是接口（接口用 +server.ts）"——把文件后缀当"执行环境声明"来读，就不会把 secret 写进通用 load 泄露、也不会纠结某段取数放哪层（对应"三家用不同抽象做数据加载"对照题的 Kit 侧）。

**来源**：SvelteKit 文件约定；load 执行模型（universal vs server）；既有"+page.ts 与 +page.server.ts 讲清"深化

### 15.  Kit 的 adapter 谱系（static/node/平台适配器）说明了什么架构取舍？预渲染 vs SSR vs 按需在哪切？

adapter 体现"同一套应用代码适配多种部署形态"：① adapter-static——构建时全预渲染成静态 HTML/资源（可托管到任意静态站/CDN，无运行时 Node），适合内容站/营销页；配 fallback 可做 SPA 模式；② adapter-node/auto——保留常驻 Node 服务端做运行时 SSR/endpoint，适合动态数据/私有化；③ 平台 adapter（vercel/cloudflare/netlify）——映射到 serverless edge/node 运行时。切分粒度在页级 prerender/ssr/csr 开关（对应 deploy 关"什么信号不该上 SSR"题）：能预渲染的静态内容 prerender=true、每请求动态 SSR、纯交互后台 csr/SPA 模式。取舍：静态=最快最省最稳但无运行时动态、SSR=动态但要有服务端算力、CSR=首屏慢但部署像静态。加分句：adapter 层的价值是"把部署决策从代码里解耦出来"——同一份 Kit 代码，改 adapter + 页级 prerender 开关就能从"全静态 CDN"切到"运行时 SSR"而不重写业务；能讲出"我按内容动静比例决定 adapter 与每页 prerender/ssr 档位"就体现了部署架构的成本意识（呼应 deploy 关三套系统选型终题）。

**来源**：SvelteKit adapters 文档；prerender/ssr 页级开关；jamstack 取舍；既有 adapter 谱系题深化
