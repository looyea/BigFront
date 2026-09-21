# svelte-ssr-hydration 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

---

### 1. (A) 从零讲清 Svelte 5 SSR 的完整管线：服务端到客户端各有哪些环节？

**来源**：手搓 SSR 全链路白板题（svelte/server 文档转述）

五环节：①服务端以 `generate: 'server'` 编译的组件跑 `render(App, { props, context })`（从 `'svelte/server'` 导入）；②拿到 `{ head, body }`——head 是 `<svelte:head>` 收集串、body 是组件 HTML（内含水合锚点注释）；③拼 HTML 模板：head 进 `<head>`、body 进容器、首屏数据转义后内联；④浏览器渲染 HTML（SSR 的秒开/SEO 收益在此兑现）；⑤客户端 bundle 调 `hydrate(App, { target, props: 反序列化数据 })` 认领 DOM 补交互。加分点：缺任何一环都举不出"Kit 替你做了什么"的对照（L8 引桥闭环）。

### 2. (A) `render()` 返回的 RenderOutput 为什么是 `SyncRenderOutput & PromiseLike<SyncRenderOutput>`？

**来源**：v5 异步渲染类型设计题

v5 支持组件顶层 await 后，"渲染何时完成"不再确定：整棵树无异步→内容立即可用（当同步对象解构 body/head）；含异步组件→必须 `await` 拿最终态。PromiseLike 交叉类型让两种用法共享同一返回值而不分裂成两个 API（React 的 renderToString/renderToStringAsync 分裂正是对照反例）。追问"await 之前直接读 body 会怎样"：得到不完整输出——纪律是"链路里有 await 可能性就统一 await"。

### 3. (A) hydrate 是"不重新渲染"的，那它怎么知道哪个 DOM 节点对应模板的哪个位置？

**来源**：水合锚点机制题（v5 hydration 注释标记讨论转述）

SSR 输出内嵌注释节点锚点：if 块的分支身份、each 块的项边界、相邻文本节点的切分点（v4 的 ${} 文本混合在 v5 用显式标记定位）。hydrate 顺着模板结构与锚点双指针走查，把状态/事件/effect 绑定到对位节点，全程零创建。工程推论两条：body 输出不可"美化"（注释是功能件）；`each` 无 key 时水合后客户端 diff 同样吃暗亏——锚点纪律与 L6  keyed diff 是同一枚硬币两面。

### 4. (B) 上线后首页"每次都会闪一下"，dev 环境却复现不出来。给出排查路径与水合侧的根因假设。

**来源**：hydration mismatch 生产静默修补实录

根因假设：prod 水合不匹配不抛错只就地打补丁，闪动是补丁的视觉证据；dev 复现不出多半因为触发条件是环境差异（UA/时区/`import.meta.env` 分支渲染了不同内容）。排查三步：①本地起 prod 构建对生产 HTML 跑一次（或 dev 里强制 mock 生产数据）；②比对 SSR HTML 与首帧客户端渲染快照，定位错位节点；③顺模板找"只有浏览器才有值"的表达式，推到 onMount/browser 之后。加分：序列化失真（Date 变字符串再渲染格式不同）是第四常见病因。

### 5. (B) `window.__DATA__` 注入为什么必须 `.replace(/</g, '\\u003c')`？只做 HTML 实体转义行不行？

**来源**：内联脚本安全题

风险模型：数据含 `</script>` 即提前闭合脚本块，后续内容按 HTML 解析——存储型 XSS 直达。实体转义（`&lt;`）在 `<script>` 内部**不生效**——脚本内容不是 HTML 文本，`&lt;` 会原样进 JS 造成语法错误或语义污染；`\u003c` 是 JS 字符串层的合法转义、解析器眼里无标签含义，两头都对。延伸：这就是"注入上下文决定转义策略"——HTML 文本/属性/脚本/URL 四上下文四套规则；Kit 用 devalue + 独立 script type="application/json" 容器，把这条纪律工程化了。

### 6. (B) 同事手搓 SSR 后坚持"路由在 Express、数据在 load 函数、渲染在 render()"，结果每个页面都要维护三份映射。这管线缺了什么？何时该止损上 Kit？

**来源**：手搓 SSR 工程化成本复盘题

缺的是"编排层"：路由参数→props 的注入、数据加载与渲染的时序、head 的页面级差异、预取与代码分割——Express 时代全靠人肉对齐三份映射，漏一处就是 prod 事故。止损判据：当样板代码的变更频率≥业务代码（每加一页动三处）、或需要流式/并行数据加载（自己接 render 的 PromiseLike 到 HTTP 流是另一个工程），说明已重写了一个没有 CLI 的 Kit——迁移成本只会随功能涨。呼应 svelte-sveltekit-bridge 代价清单：手搓的自由度花在编排上，就不叫自由度了。

### 7. (C) 同一个 `<script>` 里的 `console.log(window.innerWidth)`，SSR 时报错、CSR 时正常。Svelte 的官方解法模式是什么？React/Vue 呢？

**来源**：三框架 SSR 环境差异横向题

Svelte：模块顶层 import 即执行是病灶——浏览器依赖推到 `onMount`（只跑客户端）或 `$app/environment` 的 browser 判断（Kit 内）；纯 Svelte 手搓场景用 `typeof window !== 'undefined'` 守卫但只救表达式不救顶层副作用。React：`useEffect` 天然客户端专属，同构困境同款；Vue：`onMounted` 对位 onMount。收束：三家的解在同一个物理事实上——SSR 端没有 window，代码必须显式声明"我属于哪一侧"；Svelte 的 onMount 是三家中最接近"生命周期即环境边界"的表达。

### 8. (C) Next.js 的 renderToPipeableStream、Nuxt 的 payload 水合协议与 Svelte 的 render() PromiseLike，三代 SSR API 各自解决什么？

**来源**：跨框架流式 SSR 对比题（07/08 包联动高频题）

共同演进线：字符串→感知异步→流式。Svelte render 的 PromiseLike 解决"知道何时齐了"（await 到完整字符串，但首字节时间=最慢组件）；Next 的 pipeable stream 解决"边到边发"（壳先出、 suspense 边界内异步补写，TTFB 与完整度解耦）；Nuxt 3 的 payload/钩子层解决"数据与渲染解耦后的水合协议一致性"。SvelteKit 的流式（+page 的 await 组件 + 分块输出）建立在 render PromiseLike 之上——面试答到"发动机与整车"分层即到位。

### 9. (C) 水合不匹配 vs 运行时渲染错误 vs boundary 捕获的异常，三套机制的管辖范围怎么划？

**来源**：错误域三分题（L9 boundary 地图补完）

按"错误发生的流水线阶段"划：①SSR 渲染中抛错——render() reject（可配 transformError 加工），是服务端 500 的素材；②CSR 渲染中抛错——祖先 svelte:boundary 的 failed 接管（事件 handler/定时器/setTimeout 不在管辖，L9 捕获范围表）；③水合不匹配——不是异常是"两次渲染结果 diff"，dev 抛错只是它唯一的异常外衣，prod 走静默修补，两套错误体系都不接管。混用典型案例：在 boundary 里等 hydration 报错=缘木求鱼。

### 10. (D) 老 Java 服务端渲染的门户要嵌入 Svelte 5 搜索组件，JS/CSS/数据怎么走？设计交付物。

**来源**：遗留系统 SSR 集成场景题

交付三件：①服务端渲染服务独立部署（Node 侧 Express + generate:'server' 编译产物，门户后端 HTTP 子请求拿 body/head，拼进既有模板）——门户不感知 Svelte 只感知 HTML；②客户端 bundle 单独发布 CDN，按 container id 约定 hydrate，props 走服务端已渲染 DOM 上的 data 属性或内联 JSON（转义纪律照旧）；③CSS 账：server 编译目标输出样式提取策略与 v5 运行时注入二选一并写进集成文档（L8 编译产物关的债在此还）。追问"能不能干脆 CSR 免掉 SSR 服务"：搜索首屏是 SEO 资产——不行，这正是 SSR 判据的标准答案。

### 11. (D) 产品页要求：SSR 秒开 + 表单全交互 + 每分钟个性化刷新区块。用 render/hydrate 体系设计，指出两处机制冲突与解法。

**来源**：SSR 边界场景设计题

冲突一：个性化每分钟刷新 vs SSR 缓存——整页 render 结果无法 CDN 长缓存。解：壳 SSR（可缓存），个性化区块标记为异步组件（render 的 PromiseLike 天然支持"慢部分单独 await"）或干脆水合后客户端拉取——后者最简单。冲突二：hydrate 契约要求首帧与服务端一致 vs 个性化数据在变。解：服务端渲染占位/骨架进 HTML，真实内容 onMount 后 fetch 填充（等价 Kit 的 `ssr=false` 局部降级）——"不匹配"的正确姿势是让它发生在约定为 CSR 的边界内而不是全局。加分：给出监控方案（水合错误上报采样）。

### 12. (D) 面试官追问："这些 Kit 全做了，你手搓一遍的意义是什么？"给出 90 秒回答框架。

**来源**：元问题——学习路径辩护题（L8 引桥题 11 的收官版）

三段式：①排障能力分层——Kit 报 hydration mismatch 时，懂锚点/序列化/环境边界三层机制的人定位到表达式，不懂的人在搜索引擎碰运气；②架构决策有据——"上不上 Kit"的本质是"编排层的成本与自由度权衡"，手搓过的人才报得出这个价（样板清单：head 安置、数据协议、CSS 提取、路由映射）；③边界资产——render() 可嵌入任意后端（本关 D 类场景题），Kit 覆盖的是"新建全栈应用"这个主路径，两者不是竞争是包含。收尾金句：框架会替你编排，但事故永远发生在你看不见的编排层——手搓 SSR 的意义就是把看不见的层变成说得出的模型。
