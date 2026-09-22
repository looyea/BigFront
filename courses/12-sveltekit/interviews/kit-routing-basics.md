# kit-routing-basics 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

---

### 1. (A) +page.svelte / +page.ts / +page.server.ts 三文件的执行者与执行时机矩阵，默写级回答。

**来源**：+ 文件族契约开场题

+page.svelte：渲染组件，SSR 期在服务端跑一遍 render、客户端水合后随状态更新；+page.ts（universal load）：SSR 时服务端跑一次（随 HTML 交付数据），此后**每次客户端导航进入该路由都在浏览器跑**；+page.server.ts：只在服务端跑（初始请求与表单提交），产物经序列化传给 universal/页面。组合规则：同目录 .ts 与 .server.ts **可共存**——server 先跑，返回作为 universal 的 event.data 接力（文档原文级契约）。追加分：三文件跑在哪 ≠ 代码能碰什么——只有 .server.ts 与 +server.ts 能安全持有密钥。

### 2. (A) 为什么 universal load "两栖执行"不构成 bug 温床？它对写 load 的人提出了什么纪律？

**来源**：同构执行模型题

同一份 load 代码可能跑在 Node（SSR）也可能跑在浏览器（导航），环境差异 API（window/document/process）直接摸就是水合时炸/服务端炸。纪律：①load 里只做"环境无关计算+fetch"；②需要浏览器专属的事推到组件生命周期（onMount 只客户端跑，11 包 SSR 环境题同款解）；③要服务端专属数据→挪进 .server.ts。加分对照：Next 用文件边界切两栖（RSC 默认服务端），Nuxt 的 useFetch 在 SSR/客户端都跑同款问题同款解法（app.js vs server 插件）。

### 3. (A) layout 的 load 什么时候重跑？给出"公共祖先不重跑"的完整判定规则与一个反直觉案例。

**来源**：增量 load 机制题（新手最大迷惑 TOP1）

规则：每次导航比较新旧两条路由的**段级深度**，从根往下第一个发生差异的层开始重跑，其祖先层的 load 全部跳过（数据保留）。反直觉案例：`/blog/a → /blog/b` 时 blog 层的 +layout.ts 不跑——但若 URL 的 **query 参与了你依赖的判定**（url.searchParams），universal load 默认也不因 query 变化重跑（query 不算路由段！），需要靠 $derived($page.url) 在组件层响应或 invalidate 手动触发。延伸：$page 的 params 变了但路由没变（同组件动态段）时的行为边界，L3 失效协议给正规解法。

### 4. (B) 同事的根 +layout.svelte 里写了 {@render children()} 但套在 {#if data.user} 里，结果未登录用户白屏、登录页也进不去。解释塌方链与两种修法。

**来源**：children 出口条件渲染事故

塌方链：children 被 {#if false} 挡住→所有子路由（包括登录页本身）无一能渲染——**登录页也在 children 之下**，形成"要登录才能到登录页"的死锁。修法一：把登录墙从布局挪进 load——server load 里判断 session，未登录 `redirect(307, '/login')`（拦截发生在渲染前，无 UI 死锁）；修法二：布局内对 children 无条件渲染、未登录时只裁剪导航 UI。教训金句：**布局的 children 是路由系统的出口，不是业务组件**——条件渲染出口等于拔自己网线（对照 11 包 boundary：都在"渲染树结构"层，一个管错误兜底一个管导航存活）。

### 5. (B) data 的 key 级遮蔽机制在什么场景会咬人？给一个"父 nav 子也返回 nav"导致的典型事故与防御。

**来源**：数据合并阴影坑题

事故：根 layout 返回 `{ nav }` 渲染顶部导航，某子页面也返回 `{ nav: 本页面包屑数据 }`——该路由下导航栏读到的 data.nav 已是子页面的，头部塌了；且这 bug 只在特定路由出现，全局导航组件单测全绿。防御三件套：①load 返回字段**按层加前缀/命名空间**（`{ primaryNav }` vs `{ breadcrumb }`）；②团队规范：根 layout 保留字段清单化，code review 查重名；③TS 生成类型会把两侧 shape 都并进 data——同名不同 shape 时编译期直接冲突报错，types 纪律（L8）就是防_shadow 的自动化_。

### 6. (B) 页面既有 +page.svelte 又有 +server.ts，产品经理的"给页面加个 POST /page 的 webhook"上线后 405。读 Kit 的路由分工找原因。

**来源**：page/server 共存边界题

+server.ts 只导出 GET 之外的方法也**不会接管页面的 GET**，但反向陷阱在这里：GET 由页面渲染路径处理时，**+page.svelte 所在目录的 POST 落 +server.ts 是合法的**——405 的真实原因九成是 +server.ts 里没导出 `POST`（只写了 GET 或 import 名字拼错：方法导出必须精确匹配 HTTP 动词大写），或请求路径被前置 redirect/trailingSlash 改写丢了 body。排障序：①看 +server 导出清单；②Network 里看是否 3xx 后降级成 GET（301/302 重定向丢 body 的浏览器行为，307/308 才保方法——L4 redirect 关回收这条）。

### 7. (C) 对照 Next.js 的 app 目录文件族（page/layout/route/error/loading/not-found），Kit 的族谱缺哪几口、多哪几口？

**来源**：两框架文件族横向题（结构相似度高分题）

共有：page/layout/error + API 文件（route.ts≈+server.ts）。Next 多：`loading.tsx`（Suspense 骨架内置位——Kit 无独立文件，用 `{#await}`/流式 data Promise 表达，L3 展开）、`not-found.tsx`（专用 404 文件——Kit 用根 +error.svelte + status 判断表达）、`template.tsx`（重置边界——Kit 靠重新导航语义天然处理）、`route.md` 等元数据。Kit 多：`.server.ts` 后缀体系（同文件名的环境切分，Next 无此维度——它的环境靠指令）、`+layout@`/`+page@` 布局重排语法、matcher 文件目录（src/params）。收束：两家的收敛点（文件即路由+布局嵌套+错误就近）说明 App Router 设计确实借鉴了 Kit 谱系——考点是给"结构相似、环境切分哲学相反"的洞察。

### 8. (C) prerender/csr/ssr 三开关组合出哪些合法形态？"prerender=true + ssr=false"为什么是矛盾的？

**来源**：渲染策略代数题

合法主流形态：默认(SSR+水合)、csr=false(纯服务端 MPA 味)、ssr=false(SPA：壳+水合)、prerender=true(SSG)、prerender+csr=false(纯静态零 JS)、prerender+ssr=false——**后者语义上打架**：prerender 要求构建期出 HTML，ssr=false 要求不渲染直接空壳；Kit 的处理是 prerender 时强制视同 ssr=true（文档明示冲突要避开，别赌实现细节）。记忆锚：三开关各管一段流水线——prerender 管"何时渲（构建期/请求期）"、ssr 管"服不渲"、csr 管"水不合"；csr=false+ssr=true=服务端孤岛页，合法且有真实场景（打印友好页）。

### 9. (C) 同事断定"+page.ts 与 +page.server.ts 二选一"。作为面试官你追问共存时的完整契约，并给出标准答案。

**来源**：load 接力链理解度测试题（共存契约常见误记纠偏）

共存是官方契约（文档明示：If you have load functions in both +page.js and +page.server.js, the return value of the server load is the data property of the universal load's argument）。完整链条：server load 先跑（Node 环境，可直连 DB/密钥）→ 返回值经序列化成为同目录 universal load 的 `event.data` → universal 做最后一道加工后，其返回才是页面组件的 data——**server 的返回不会直达页面**（这个中间跳最常被追问）。典型用途：私有记录进、脱敏/不可序列化物（组件构造器）出；也提醒：多一道接力多一道序列化约束，无加工需求就别为共存而共存。设计意图：环境归属看文件后缀而不是看你想偷偷跑一下——两文件各管一段信任域。

### 10. (D) 设计题：电商站 `/category/[slug]` 与 `/product/[id]` 都要 SSR+SEO，运营还要一个 `/campaign/summer` 纯静态活动页。给出 routes 目录方案与三处开关设置。

**来源**：混合渲染落地题

目录：`routes/(shop)/category/[slug=slug]/+page.svelte`（默认开关：SSR+水合，matcher 防烂 URL——L2 回收）、`product/[id=uuid]/` 同款、`(marketing)/campaign/summer/+page.svelte` 内 `export const prerender = true` 烘成静态。要点账：①活动页若含实时库存/价格组件→拆"静态壳+水合后拉取"两截（prerender 页里该组件 onMount 再取数，SSR 出骨架）；②类目/商品页的 load 全走 server 直连 DB（不经自家 fetch，避免无谓环回——L3 讲 event.fetch 适用位）；③sitemap 生成放构建脚本遍历 prerender 产物+DB slug 清单（L6 静态化关收口）。加分：预算各页 TTFB 差异——动态 SSR 类目页与秒开静态活动页放一起验收，别用一把尺。

### 11. (D) 你的 +layout.svelte 里要展示"全站公告"，运营希望不发版就能改。用文件族语义设计三条通路并比较。

**来源**：内容注入通道选型题

通路一：根 +layout.server.ts load 读 CMS/DB → data.notice → 布局渲染：SSR 可见、缓存随页面，改数据即生效（最正统）；通路二：+server.ts 提供 /api/notices，组件 onMount fetch——免导航不刷新但 SSR 首屏没有（SEO 无价值可接受则用），且多一次 RT；通路三：hooks.handle 把公告塞响应头/cookie，布局读 $page.form?——离谱方案，面试用来展示"知道边界"：数据流有正门(load)与后门(头注入)，公告这种响应数据走正门。延伸：invalidate 协议让"后台点一下、所有在线页面刷新公告"成为可能（L3 失效协议预告）。

### 12. (D) 压轴架构题："+error.svelte 的就近落点规则"——预见到用户访问三层目录里不同深度的 500，画错误边界的作用域并说明"未预期错误为何会去 handleError"。

**来源**：错误层级前瞻题（L4 正片预习）

落点：错误由**最深已解析、最浅出错层**的 +error.svelte 承接——load/渲染发生在哪层出错，就向上找该层及祖先最近的 +error；/a/b/c 出错但 /a 有 +error 而 b/c 没有，则 /a 的壳保留、其下内容替换为错误块（布局不塌，用户还能导航）。500 类未预期错误（throw 的 TypeError 等）先过 **handleError**（hooks.server.ts）——那里做日志/上报并决定给用户的 message（防 stack 泄漏），产出规范化 error 再进 +error.svelte；预期错误用 `error(404, {...})` 直抛，**不经 handleError**（文档明示：你自己保证 body 安全）。两家全图的完整推演与表单 action 报错路径，L4 正片展开——本课先立规则意识。
