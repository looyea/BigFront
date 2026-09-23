# next-link-router 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 Next.js 导航与预取高频面经，中文重述。

---

## A. Link 与预取机制

**1. Next.js Link 的 prefetch 预取的内容和普通 HTTP 缓存网页有什么不同？**
**来源**：掘金《RSC Payload 与 Router Prefetch 机制详解》；CSDN《Link 预取到底预取了啥》
预取的不是完整 HTML，而是该路由的 RSC Payload（序列化组件树+数据）与客户端 JS chunk，存进内存 Router Cache。点击时直接用它渲染，无需整页导航。这也解释了为何预取对动态页会降级（payload 不可缓存时只预取静态部分）。

**2. 什么情况下你会全局关闭 prefetch？代价是什么？**
**来源**：SegmentFault《高并发场景下的 Next 预取风暴》；知乎（App Router prefetch 相关讨论）
移动端弱网、接口计费/昂贵、长列表 Feed 流。可在 Link 逐个关，也可在自定义封装里默认关、白名单开。代价是牺牲"秒开"体感——需 LCP/跳转延迟数据说话，不是拍脑袋（呼应 react-performance 度量先行）。

**3. 为什么 Link 被称为渐进增强？和无 JS 环境的关系？**
**来源**：CSDN《Next.js 与优雅降级》
Link 渲染真实 `<a href>`，JS 未加载/禁用时点击仍是标准 HTTP 导航，服务端返回完整 HTML；JS 就绪后接管为无刷新导航。同一 URL 两种体验，SEO 与可用性双保（呼应 next-render-modes 的 view-source 验证法）。

---

## B. API 演进与对比

**4. next/router（Pages）到 next/navigation（App）的主要破坏性变化？**
**来源**：知乎《App Router 迁移 API 对照表》；SegmentFault《useRouter 的两个版本》
一个大 Router 对象拆成 usePathname/useSearchParams/useRouter 三钩子；router.query 没了（服务端 params/searchParams 走 props）；isReady 状态取消；push 不可中断渲染（服务端 redirect 取代）；events 订阅取消（loading 由 Suspense 体系承担）。

**5. Vue Router 和 Next 在"预取"设计上的哲学差异？**
**来源**：InfoQ《路由预取策略横评》
Vue Router 把预取留给生态（vite 预加载 + 手动 prefetch 钩子、或 vite 的 route 级 preload plugin），核心不内置；Next 将视口预取做成默认行为——"框架默认值 vs 显式控制"之争。两者都能关/都能开，差在默认心智成本归属（呼应 vue-router-guard-lazy、vite-splitting 的 preload）。

**6. 小程序的 wx.navigateTo/redirectTo/reLaunch 与 Next 导航 API 怎么映射？**
**来源**：掘金《跨端路由模型对照笔记》
push≈navigateTo（入栈可回退）、replace≈redirectTo（换栈顶）、服务端 redirect()≈reLaunch 的"清场跳转"气质（3xx 重开）、router.back≈navigateBack。本质差异：小程序是**页面栈**模型有 10 层上限，Web 是历史栈由浏览器管理、无硬性深度（呼应 mp-route 决策表）。

---

## C. 实战坑

**7. 点击 Link 后页面数据没更新，可能是什么原因？怎么修？**
**来源**：CSDN《Next 导航后缓存旧数据的 N 种姿势》
大概率 Router Cache：预取的 payload 有效期内直接复用。修：动态页降 TTL（`cacheLife/cacheBoundary` 新 API）或段配置 no-store、数据变更走 Server Action + revalidatePath 使缓存失效（L4/L5 主讲），临时救急 `router.refresh()`。

**8. useSearchParams 导致整页从 SSR 降级为客户端渲染，是怎么回事？**
**来源**：Next.js 官方文档相关条目；知乎《Suspense 与 searchParams 的水合问题》
预渲染页面在构建/服务端阶段没有 query，若使用点不在 Suspense 边界内，Next 只能把整页标为动态甚至放弃静态输出。官方解法：用 `<Suspense>` 包住消费组件，让静态壳保留、动态部分客户端补齐——这正是"边界思维"的第一次实战（L3 next-context-streaming 主讲）。

**9. 做"退出登录后所有页不可回退"，Next 里怎么组合拳？**
**来源**：SegmentFault《登出后的历史栈清理》
`router.replace('/login')` 避免入栈，但挡不住用户按回退看缓存页。完整方案：登出接口让会话 cookie 失效 + 各页服务端渲染时校验（redirect 兜底）+ 敏感页 `Cache-Control: no-store`。回退到的是"会重新鉴权的 SSR 页"而非白名单缓存（呼应 next-middleware-auth、exp-auth 的"服务端永远不信任前端状态"）。

---

## D. 综合设计

**10. 向导类流程（5 步表单）里，预取怎么做出"丝滑感"？注意什么？**
**来源**：掘金《用 router.prefetch 优化步骤跳转》
每步"下一步"点击时 `prefetch(下一步URL)`；或最后一步前预取成功页。注意：步骤 URL 若带动态校验（服务端按 query 出不同内容），预取 payload 可能与实际提交结果不一致——预取是"性能优化"不是"状态预演"，业务真值仍以实际请求为准（呼应 react-forms 的状态归属讨论）。

**11. 多标签页打开同一 Next 站点，A 标签改了数据，B 标签 Router Cache 会脏吗？怎么办？**
**来源**：知乎《前端缓存一致性在 RSC 时代的回归》
会脏——Router Cache 是标签页内存级。方案：关键页 no-store、或 B 标签 focus/visibilitychange 时 refresh；彻底点用版本号/ETag 让 payload 失效。这题的得分点在认出"SPA 时代的缓存一致性问题以新形态回归"（呼应 mp-storage 的 TTL 信封、react-data-fetching 的 stale 概念）。

**12. 让盲人用户/键盘用户可用你的导航，Next 提供什么、你还要补什么？**
**来源**：InfoQ《全栈框架的无障碍现状》；CSDN（Web 无障碍与 Next 实践相关）
Next 给：真实 `<a>`（读屏可识别链接语义）、路由切换的文档级更新。要补：焦点管理（无刷新导航后焦点应回主区域顶部，官方 useFocusEffect 模式）、skip-link、当前导航项 `aria-current`、loading 播报 aria-live（结合 loading.tsx，呼应 react-architecture 的可访问性边界）。

---

## 补充（新专题 13-15）

**13. <Link> 的 prefetch 是"免费性能午餐"还是"隐性带宽税"？如何按路由权重精细化？**
**来源**：掘金《Next.js 预取导致的带宽风暴排查记录》；Vercel 官方文档 <Link> prefetch 策略说明
本质是用"预取正确目标的概率 × RSC Payload 体积"换"点击后到首屏的时间"。免费的一面：内容站导航图清晰、用户大概率点向下一层，预取让跳转几乎无感。成税的一面：长列表（搜索/商品/ feed）几百条链接都进视口→全预取→带宽与服务端渲染成本被"浏览但从不点"的项吃爆。精细化：① 列表项、外部链接、低概率路径显式 prefetch={false}；② 只对"下一页/面包屑/主导航"这类高确定链接保持预取；③ 大 payload 页配合"轻量首屏 RSC + 重数据懒取"降低单次预取成本；④ 结合 CDN 缓存被预取的静态段 RSC，命中即返、重复预取几乎零成本；⑤ 用 Network 面板/日志量化预取请求占比，设预算。判断信号：出现"预取请求数远超导航数、列表页带宽飙升"就是过度预取。一句话：prefetch 默认对"导航型链接"是午餐、对"内容型条目"是税——按链接性质分级，而不是全开全关。

**14.  App Router 的 router.push/replace 与 History API、Vue Router、React Navigation 的心智映射与差异？**
**来源**：SegmentFault《各家路由导航 API 横向对比》；知乎《从 History API 到文件路由：前端路由演化史》
共同底座都是 History API（pushState/replaceState）+ 单页内不换整页。差异在"路由状态由谁拥有"：① 裸 History API 只给你 push/popstate，路由表与匹配自己实现；② Vue Router 有显式路由配置、嵌套路由、全局导航守卫（beforeEach）；③ React Router（SPA）用声明式 <Routes> + loader/action + useNavigate，守卫靠组件/hook；④ React Navigation（RN）用 navigator + 栈/ Tab、有 screen 事件与 useFocusEffect；⑤ App Router 没有"路由表"，路由=文件系统，导航用 useNavigate 的 router.push、守卫靠 middleware（请求层）+ layout/page 里读 session（组件层）+ loading/error 边界，focus/显隐类钩子只能靠 onShow 式手动（页面不卸载时监听 usePathname 变化）。迁移要点：把"全局 beforeEach 鉴权"改造成"middleware + 页内 session 检查"两层；把"嵌套 Outlet"对应到"layout 的 children"；把"路由参数"对应到 searchParams（URL 是公共 API）。

**15.  "URL 状态优先"在 App Router 下为什么被反复强调？如何在 searchParams 上做类型安全与校验？**
**来源**：InfoQ《URL 是最被低估的状态管理》；掘金《useSearchParams 的参数校验与防御式解析》
理由：URL 是可分享、可刷新、可前进后退、可被爬虫与预取"看到"的唯一真相源；把筛选/分页/Tab/搜索词放 searchParams 而非组件 state，能免费获得"刷新不丢、能分享、服务端可预渲染对应结果"。落到 App Router：searchParams 是一等入参（且是 Promise），服务端组件可直接读并据此取数渲染，比"客户端 fetch 后再改 URL"少一次往返。代价/规范：① searchParams 全是 string/string[]，需自己解析成 Number/布尔/枚举——要一层"取参即校验/归一"（zod 或手写 parse）防 ?page=abc 或注入；② 只把"值得被分享/影响结果"的放 URL，临时 UI 态（弹窗开合）留在本地 state，别把 URL 当垃圾桶；③ 深链要防御性编程（任何页可能被直接打开、参数被篡改），服务端为准、URL 为提示；④ 频繁写 searchParams 用 shallow 路由/replacer 避免刷屏 history 与过多 re-render。这套等于"手动补了个 router 的参数 schema 校验层"。
