# nuxt-state 面试题（15 题）

## A. 基础认知

### 1. Nuxt 里管理状态有哪几种选择？怎么选？
**答**：四层。组件局部用 ref/reactive；页面或跨组件的轻量共享用 useState（同构、进 payload、不持久）；有业务逻辑、需要 action/getter 与 devtools 的用 Pinia；要跨会话存活的是持久态，用 useCookie 或 localStorage。判定口诀：刷新后要不要在、有没有逻辑要复用、能不能序列化。选错层级最常见的后果是把本该持久化的登录态放进 useState（刷新即丢），或把 UI 开关塞进 Pinia（徒增 payload）。

**来源**：《Nuxt 状态管理分层》、《useState 与 Pinia 的边界》

### 2. useState 的机制是什么？它和 ref 的区别？
**答**：useState(key, init) 在 Nuxt 上下文里维护一张 key→ref 的注册表，服务端首访执行 init 并把值序列化进 payload，客户端水合时取回同一个 ref。与裸 ref 的区别有三：一是可跨组件按 key 共享（同 key 即同一份）；二是能跨过 SSR→CSR 边界存活；三是受序列化约束，init 只能返回 JSON 往返无损的值。它不做持久化，强刷新回到 init。

**来源**：《Nuxt 组合式 API 全解》、《payload 中的 state 结构》

### 3. Nuxt 的 Pinia 模块为 SSR 做了什么？
**答**：三件事。①在 vue:setup 时机为每个请求的 Nuxt app createPinia 并 use 上去，保证实例请求级隔离；②服务端渲染结束后把 pinia.state.value 全量写入 payload；③客户端启动时自动 hydrate 回 store。因此默认不需要 persist 插件即可水合，devtools 也能看到水合记录。副作用是 state 里放不可序列化对象会污染 payload，与 useFetch 的数据约束同源。

**来源**：《Pinia Nuxt 模块原理》、《SSR 状态水合实践》

## B. 对比与辨析

### 4. 为什么 Nuxt 下 Pinia 不会串用户数据，而在自建 SSR 里会？
**答**：因为 Nuxt 每个请求都重新 createApp、重新 createPinia，状态树的生命周期等于一次请求。手写 SSR（例如自己用 vue-server-renderer 或全局挂载 store）常把 pinia 实例提到模块作用域复用，那是进程级单例，A 请求写入的值 B 请求读得到——经典越权事故。同样的坑在 Nitro 侧也存在：server/api 里的普通对象是进程共享的，要缓存必须走 useStorage 并带用户维度 key。

**来源**：《SSR 状态泄露事故复盘》、《每请求新建实例的重要性》

### 5. useState 和 Pinia 都进 payload，性能上怎么权衡？
**答**：进 payload 就是成本——它直接增大 HTML 体积并延长 TTFB（呼应 nuxt-perf 的 payload 瘦身）。useState 一般只放标量与浅对象，影响可控；Pinia 会把所有已使用 store 的 state 全量导出，包括只是被 import 但当前页面没用到的字段，因此要警惕"顺手 cache 全量字典/列表"。做法：字典类数据放服务端缓存（defineCachedEventHandler）或按页 useFetch 精确取，别塞进 store；调试时对比 view-source 里 __NUXT__.state 的字节数。

**来源**：《Nuxt payload 体积优化》、《状态设计中的数据下沉》

### 6. 取数放组件 setup、放 store action、放插件，各自优劣？
**答**：setup 顶层 await useFetch 最直观、key 自动、SSR 可见，缺点是组件变厚、逻辑复用靠 composable；store action 里取数能把"数据+派生+动作"收在一处，跨页复用最好，前提仍是调用方在 setup 里 await action（否则 SSR 不等它）；插件里预取适合真正全站的数据（用户信息、站点配置），风险是变成无差别全量拉取、且此时路由数据未必就绪。推荐 store 为主、setup 为辅，慎用插件取业务数据。

**来源**：《Nuxt 数据获取分层模式》、《顶层 await 与 Suspense》

## C. 实战场景

### 7. 购物车要在 SSR 首屏就显示数量和总价，怎么实现？
**答**：cart store 提供 load()，内部 await useFetch('/api/cart', { key: 'cart', pick: ['items'] })，服务端从 cookie 识别用户（或临时购物车 id）后返回数据；在需要它的布局/头部组件 setup 里 await store.load()，总价用 computed 派生。注意三点：一是 useFetch 的 key 保证全站一次请求（呼应 nuxt-usefetch 去重）；二是 items 必须可序列化；三是未登录时也要能落临时 id，否则服务端返回空、客户端补拉会闪烁。

**来源**：《电商 SSR 购物车方案》、《BFF 聚合与首屏数据》

### 8. 页面切换后 store 里的旧数据残留导致闪现错值，怎么处理？
**答**：三类手段：①页面级数据不要放全局 store，留在 setup 的 useFetch 里，随组件销毁自然消失；②必须放 store 的，用 definePageMeta 的 key 或在 route 中间件（page:transition:finish / 路由守卫）里 reset；③用 useFetch 的 watch/default 保证参数变化即重新取（呼应 nuxt-dynamic 的参数变化实例复用大坑）。别指望"组件卸载自动清 store"，Pinia 实例是 app 级的，只随请求或整页刷新重建。

**来源**：《SPA 式路由切换的状态残留》、《Nuxt 页面级状态设计》

### 9. 要把用户主题偏好持久化，同时 SSR 首屏就得正确，选什么方案？
**答**：首选 useCookie：它能被服务端读到（渲染时直接应用）也能在客户端双向写，天然同构（下一关详述）。写 localStorage 的方案在 SSR 阶段读不到值，必然出现"先默认后纠正"的闪烁，需要配合在 <head> 注入一段同步脚本提前打类名。若偏好属于"全站 UI 配置"，还要与 app.config（构建期默认值）配合：默认在 app.config，用户覆盖在 cookie，优先级合并（呼应 nuxt-runtime-config 的时机矩阵）。

**来源**：《主题偏好的同构持久化》、《避免首屏主题闪烁》

## D. 深度追问

### 10. 为什么 useState 不接受函数或 class 实例作为值？
**答**：因为它跨的是"序列化边界"而不是"引用边界"。服务端算出的值必须 JSON 化进 HTML payload，客户端再反序列化——函数、Map/Set、class 实例的方法与原型链都不可恢复。框架选择"静默丢失结构"而不是抛错，是为了不把 dev 与 prod 行为差异扩大。工程上应当把它当成 API 约束：需要行为就写在 composable 里，值只放数据。校验办法是对候选值跑一遍 JSON.parse(JSON.stringify(v)) 看是否等价。

**来源**：《Nuxt payload 序列化规则》、《同构状态的隐含约束》

### 11. 如果客户端手动改了 __NUXT__.state，安全吗？框架能防吗？
**答**：不安全且防不住——payload 是浏览器可读可写的公开数据，任何"从状态里读出来就当作事实"的判断都是漏洞（如 isAdmin）。框架层面没有防御手段，责任在服务端：所有权限、价格、库存的判定必须在 Nitro handler 与数据库层重新校验（本套课三层纵深：前端 UI 只是体验，服务端 middleware 是门禁，数据层是底线，呼应 nuxt-middleware-auth 与 next-middleware-auth）。可以在设计上降低风险：把私密字段留在 runtimeConfig 非 public 栏、不进 payload。

**来源**：《SSR 客户端状态篡改风险》、《零信任下的前端鉴权》

### 12. 从架构角度评价 Nuxt 的状态模型，与 Next 相比取舍在哪？
**答**：优点：每请求新建实例把"隔离"变成框架责任；useState 提供零配置的轻量共享，Pinia 官方模块自动水合，心智负担显著低于 React 阵营（后者要为水合、RSC 边界、缓存层分别选型）。代价：payload 全量导出 state，瘦身需要自觉；模型建立在"有一个 Node 长驻进程"之上，纯静态导出（ssr:false + prerender）或 Edge 场景下部分能力退化为客户端；跨请求共享缓存反而要做（要用 storage）。选型上：Vue 团队追求一致体验与交付速度，Nuxt 默认更安全；需要 RSC 细粒度服务端渲染、多租户 Edge 部署时 Next 的空间更大（呼应 nuxt-architect）。

**来源**：《Vue 与 React 服务端形态对比》、《全栈框架的状态设计横评》

---

## 补充（新专题 13-15）

### 13.  Nuxt 的状态序列化（payload）有哪些隐藏成本？大对象/不可序列化值进状态怎么治理？

成本清单：① 体积——payload 内联 HTML，每个可序列化状态都吃首字节与解析时间（大列表缓存进状态=首屏翻倍），要按 key 审计体积（payload 在 devtools/查看源码可见）；② 序列化边界——useState 只收"可 JSON 化"值，Map/Set/class 实例/File/函数进去水合后变形（文档明说），需要 Map 就存数组重建或放客户端专属 ref；③ 水合时机——payload 恢复发生在客户端创建实例时，"服务端写了个时间戳、客户端恢复后和 Date.now() 比对"这类逻辑天然带 mismatch；④ 不该序列化的混进来=泄露通道（服务端内部状态带用户维度，进 payload 给了浏览器）。治理：区分三层容器——进 payload 的（首屏必需、可序列化、无敏感）、客户端专属 ref/onMounted 态（浏览器 API 派生）、服务端专属（event context/useState 的服务端分支）；状态设计评审问"这个值需要跨到浏览器吗"，答不上来就不进 payload。工具链：payload 大小进 Lighthouse CI 预算。

**来源**：Nuxt 官方 useState 限制说明；掘金《一个 Map 进 payload 引发的白屏》

### 14.  Pinia store 的取数逻辑放 action、组件 setup 里 useFetch、还是 Nitro 层聚合？给一套决策框架。

决策三问：① 这份数据几个页面/组件共享且要跨路由存活？是→store action（配 Nuxt 的 useAsyncData 在 action 内取数并 await，SSR 可调用）；否→组件 setup 的 useFetch 足够，store 会胖成垃圾场。② 首屏需要吗？需要→取数必须"服务端可执行"（store action 里 useAsyncData、或页面级 useFetch），客户端 fetch in onMounted 直接淘汰；不需要→lazy/客户端触发，store 只存"用户动作后的乐观态"。③ 多个上游要拼装裁剪吗？要→Nitro 层聚合（一个 /api/x 编排完，客户端拿到的就是视图形状）——把编排放 store 等于把 BFF 逻辑搬进浏览器，SSR 与 CSR 各编排一遍双份债。边界规矩：store 不直接 $fetch 外部 URL（密钥与 CORS 立刻缠上，走自家 server/api）；action 命名带来源（fetchX vs setX）；SSR 入口只有一个（插件或页面 await 填充）避免"两处初始化"竞态。

**来源**：Pinia/Nuxt 官方文档各自立场；InfoQ《取数分层：三种归属的五年演化》

### 15.  "用户登出/切换账号后页面闪现上个账号的数据"，从状态模型层面根治要动哪几处？

先认知：这不只是体验 bug，是客户端状态没随会话清场的安全级缺陷（共享电脑场景=数据泄露）。残留点逐处清：① Pinia——登出 action 里 store.$reset()（state 回到初始化的前提：初始值别从服务端来）或 destroy 后重建 pinia 实例（激进但彻底）；② payload/数据层——clearNuxtData() 把 useFetch 缓存全清，否则下个用户水合命中旧 key；③ useState——没有选择性清除 API 的痛点，约定"状态 key 带用户维度后缀"或登出 location.reload() 一把梭（小站可接受要明说）；④ cookie/useCookie 逐项删（域/路径要和写入时一致否则删不掉，nuxt-cookie-control 类模块帮管清单）；⑤ 内存外——Service Worker 缓存、IndexedDB、keepalive 页面实例（route keepalive 的缓存要按会话键）。根治架构：会话身份进"数据 keys 前缀"（uid-scoped query key/存储路径），切换即天然隔离；登出流程写成单个 composable 清单化执行+e2e 用例锁（A 登录→登出→B 登录→全站断言无 A 数据），这条用例是防回归的唯一屏障。

**来源**：SegmentFault《登出清场不清干净的五处残留》；知乎《SPA 状态残留与 XSS 后的会话劫持》
