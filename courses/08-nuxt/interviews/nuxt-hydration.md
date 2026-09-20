# nuxt-hydration 面试题（12 题）

> 主题：水合机制、同构陷阱、payload 工程与渲染一致性。

## A. 机制理解

### A1. 描述 Vue SSR 的水合过程，它和"再渲染一遍"的区别？

**答**：水合是"认领"不是"重建"：Vue 以已有 DOM 为初始真实状态，按组件树逐一对号入座——事件绑定、ref、响应式系统建立，但**不重新创建 DOM 节点**（除非 mismatch 回退）。与再渲染的区别：再渲染要销毁重建整棵 DOM（闪白、滚动位置丢、输入焦点丢），水合保住了服务端 HTML 的一切。代价是组件的 setup/render 仍要双端各执行一次（第二次为产出"预期 DOM 描述"以对账）——所以水合消耗的是 CPU 而非网络，这就是 INP 高峰期常在首屏水合窗口的原因（呼应 next-render-modes 第 3 节、nuxt-perf）。

**来源**：掘金《水合：认领而非重建》；知乎《为什么 SSR 后还要跑一遍 JS》。

### A2. 水合期间发生用户交互（点击已渲染的按钮）会怎样？

**答**：HTML 早已可看，但事件监听要等水合建立——水合前点击是"丢进虚空"（无响应），这是所有 SSR 框架的共性窗口期。工程缓解：① 水合窗口压缩（payload 瘦身、延迟非关键 JS、岛屿化思路）；② 表单类渐进增强：原生 form submit 不依赖 JS 也能走 GET/POST（Nuxt 可配 server route 兜底，呼应 next-forms-mutations 的渐进增强）；③ 埋点区分"HTML 可见"与"可交互"两个时刻（INP 真实数据要等水合完成才有意义）。面试能把"看得见≠点得动"说清即过线。

**来源**：SegmentFault《水合窗口期的交互黑洞》；InfoQ《可看与可点的时差》。

### A3. Nuxt 的 payload 和 Next 的 RSC Payload 是同一个词吗？

**答**：不是。Nuxt payload：服务端渲染期收集的**数据快照**（useFetch 结果、部分状态），序列化为内联 JSON，仅供客户端水合复用——组件树本身两端各渲染一次，payload 不含 UI 结构。Next RSC Payload：服务端渲染出的**组件树序列化格式**（含 UI 结构与"已执行服务端代码"的结果），客户端不重渲染直接渲染该树（配合 Hydration 对账交互岛）。共同使命：把服务端算出的东西交给浏览器、避免重复计算与重复请求；差异在"传数据"与"传渲染结果"。这题答好，两个框架的渲染模型就都通了（呼应 next-server-client 第 3 节、nuxt-usefetch）。

**来源**：CSDN《两种 Payload 的名词陷阱》；知乎《传数据还是传 UI：同构与 RSC 的分野》。

## B. 陷阱实战

### B1. 页面用了 `new Date()` 显示"最后更新"，水合报 mismatch。给三种改法并比较。

**答**：① onMounted 后赋值（ref 初始渲染占位"更新中…"）：两端首帧一致，代价是文案晚一帧——最通用；② 数据侧解决：服务端把时间戳烘进 payload（useFetch 返回），客户端显示同一值——语义正确（"最后更新"本就该是服务端时间），推荐；③ `<ClientOnly>` 包裹：能治标，但元素进不了服务端 HTML——若它在视口上方还伤 LCP/CLS（占位没给对就抖）。比较维度：语义正确性（②>①>③）、体验（②无闪变）、成本（①最低）。面试加分句：选方案前问一句"这个值的真相在哪一侧"。

**来源**：掘金《一个时间戳的水合三重解》；SegmentFault《端态值的真相归属问题》。

### B2. 第三方组件（地图）SSR 必炸，除了 ClientOnly 还有什么？

**答**：分层方案：① `.client.vue` 文件约定（同义但代码整洁，组件注册即声明边界）；② 动态 import + onMounted 初始化（组件模板是壳，库在挂载后 new——地图类标准姿势，可配骨架占位防 CLS）；③ 服务端 stub：模块条件导出（import.meta.server 分支导出 noop 类），让 SSR 构建"看得见但不动作"；④ Nuxt 插件封装 + lazy（仅客户端 route 用，配合 routeRules ssr:false 区）。选择看依赖方式：库在渲染期碰 window 选①②，库在 import 时就碰 window 必须先解决 import 时机（③或动态 import）。

**来源**：CSDN《地图组件上 SSR 的四条路》；InfoQ《import 期副作用是 SSR 第一杀手》。

### B3. 密码管理器自动填表单导致水合失败，可能吗？怎么防？

**答**：可能——浏览器扩展在水合完成前改写 input.value/DOM 结构，Vue 认领时发现 DOM 与预期描述对不上，轻则该表单子树回退 CSR（输入值被清、用户正在输的没了），重则结构错位。防御：① 敏感区（登录表单）保持组件简单，避免双向绑定与服务端 value 输出（value 不预填即无对账冲突）；② autofill 相关容器标 `data-n-head="true"` 之类非惯例做法不推荐，正解是接受回退但保证回退后逻辑自洽；③ E2E 带真实浏览器跑 autofill 场景（Playwright 可模拟，呼应 nuxt-testing）。此题展示"环境不可控"的工程观：不追求消灭差异，追求差异发生时的正确降级。

**来源**：知乎《被 1Password 弄坏的水合》；SegmentFault《扩展改写 DOM 的防御性渲染》。

## C. payload 工程

### C1. payload 太大拖慢 TTFB，给出系统化瘦身清单。

**答**：五刀：① 入口收口：useFetch 配 `pick`/`transform` 只留渲染所需字段（默认全量内联是原罪）；② 列表分页：预渲染页只带首屏条数，加载更多走客户端；③ 二进制转换：日期/Decimal 等对象在接口层输出紧凑格式（序列化膨胀常见源）；④ 大块内容外置：富文本正文改客户端拉或 CDN 直链（SSR 首屏要渲染才留在 payload，权衡 LCP）；⑤ 检查重复：同接口多组件不同 key 各存一份（key 设计去重，nuxt-usefetch）。度量：构建日志与 DevTools payload 面板对比前后 HTML 字节数——2MB 砍到 200KB 的案例都出自这五刀（呼应 next-perf 第 3 节、nuxt-hydration 第 4 节）。

**来源**：掘金《payload 瘦身五连刀》；CSDN《HTML 里塞了一整个数据库的惨案》。

### C2. "SSR 烘的数据水合后已过期"，Nuxt 给了哪些官方出口？

**答**：三出口：① 水合后主动 `refresh()`（点击刷新/可见性变化时调用，配 `shouldRefresh`（Nuxt 4）或 watch 时机）；② `getCachedData` 自定义复用策略——返回 undefined 强制重取（如 per-key TTL 短于导航间隔），默认行为是 payload 有效期内不重发；③ 路由级策略：isr/swr 窗口缩短源头过期，或干脆 ssr:false 让数据永远现拉（后台区默认姿势，呼应 nuxt-render-modes）。判断树：数据"错 5 分钟能否接受"→ 能则 swr 短窗省事，不能则 SSR 只给壳、数据客户端拉。诚实告诉面试官 payload 复用是**性能与新鲜度的显式交易**，不是免费。

**来源**：知乎《useFetch 的缓存语义再设计》；InfoQ《SSR 数据新鲜度光谱》。

### C3. 哪些状态值得进 payload，哪些不该？给原则。

**答**：原则一句话：**"服务端已经知道、且首屏渲染要用"的才进**。该进：首屏内容数据（文章、商品）、影响 HTML 结构的标志位（登录态决定导航渲染）。不该进：纯客户端派生态（hover、滚动位置）、敏感数据（payload 是明文内联 HTML——用户信息与 token 进 payload=发给任何拿到 HTML 的中间层/共享缓存，安全红线，呼应 exp-security）、大二进制/富文本（体积）、设备端态（UA 衍生的展示差异，本就该客户端判定）。Pinia 的 SSR 转移默认把 store 全量序列化，更要有"敏感字段不落 store"的纪律（nuxt-state 专讲水合边界）。

**来源**：CSDN《payload 里的明文事故》；掘金《状态该不该烘进 HTML》。

## D. 体系化思考

### D1. 团队如何把"水合纪律"固化下来（而不是靠 code review 吼）？

**答**：四件套：① Lint 规则：禁 SSR 路径直碰 window/document（eslint-plugin-unicorn 的 no-null + 自定义 vue/no-ssr-unsafe 思路）、模板表达式含 Date.now()/Math.random() 报警；② 约定模板：端态值一律"ref + onMounted"、.client.vue 后缀放组件目录级；③ CI 冒烟：Nuxt 4 checkHydration hygiene 模式跑关键页 E2E，diff 报告非零退出；④ 复盘归档：每起 mismatch 写三行案例入知识库（症状/根因/正解）——把"玄学"变成"病例库"。体系比自觉可靠，这条对所有双端框架通用（React 侧同款，呼应 next-render-modes）。

**来源**：SegmentFault《水合纪律的自动化》；知乎《把 Code Review 经验变成 Lint 规则》。

### D2.  islands（孤岛）架构与 Nuxt 当前模型的关系？

**答**：孤岛=页面拆静态壳与交互岛，只有岛水合、静态部分零 JS（Astro 的招牌，Qwik 的极致）。Nuxt 未原生走这条路（全站同构模型），但方向上有等价碎片：routeRules 的 ssr:false 区是"运行时孤岛"、异步组件与 .client.vue 是"组件级孤岛"、Nuxt 4 的 islands 实验特性（`<NuxtIsland>` 组件级服务端片段）可局部使用。趋势判断：RSC（Next）与 Islands（Astro）都在削"全量水合"的成本，Nuxt 的应对是渐进吸收而非革命——面试讨论到这层的加分点是：**水合成本与框架模型绑定，模型不动、优化只能局部**（呼应 nuxt-architect 的路线对比）。

**来源**：InfoQ《Islands、RSC 与全量水合的三角》；掘金《从 Astro 回望 Nuxt》。

### D3. 如果页面同时存在"翻译插件改写 DOM + 自家水合"的冲突，产品与工程如何权衡？

**答**：先分级影响：翻译插件只动文本节点 → Vue 文本对账失败触发局部回退，功能不丢，体验可接受；改写结构（注入按钮、包 div）→ 子树错位，回退范围扩大。工程侧：水合根节点加 `v-cloak` 风格容错设计（回退后样式仍正确）、交互关键组件（支付按钮）独立小根 + 延迟水合（结构错位波及面最小）。产品侧：海外市场站点把"机翻友好"纳入验收（文本节点纯净、不依赖 DOM 序号定位），必要时提供官方语言版本分流（routeRules 按 Accept-Language rewrite）。结论：不假设环境纯净，为污染设计降级路径——这是前端鲁棒性的日常一课（呼应 B3）。

**来源**：CSDN《翻译插件与 SSR 的共存实验》；知乎《为不可控环境写防御性前端》。
