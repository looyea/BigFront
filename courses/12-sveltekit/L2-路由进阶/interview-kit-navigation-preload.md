# kit-navigation-preload 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 用户点击一个站内 <a> 后，SvelteKit 到渲染完成之间发生了什么？
**来源**：Kit 客户端导航机制高频题的转述。

Kit 接管点击（preventDefault）→ **import 目标路由的代码 chunk** → **执行其 load 函数**取数（服务端数据经 fetch 拿）→ 更新 `$page` 状态并渲染，全程不刷新文档。预取的全部意义是把前两步提前到 hover/tap 时刻——官方口径约 200ms 的领先，正是"跟手"与"卡顿"的分界。

### 2. (A) data-sveltekit-preload-data 的两个取值分别由什么事件触发？默认脚手架配了哪个？
**来源**：官方链接选项文档直接转述的面试基础题。

`"hover"`：桌面鼠标在链接上**停住**、移动端 `touchstart`；`"tap"`：`touchstart`/`mousedown` 注册瞬间。默认模板在 `src/app.html` 的 `<body data-sveltekit-preload-data="hover">`，全站生效、可被祖先/自身属性覆盖。追问高频：何时降 tap——数据时效性极高（行情页）或 hover 误触导致后端压力时。

### 3. (A) preload-code 的 eager/viewport 与 hover/tap 两组语义差在哪？为什么官方要设这个差？
**来源**：预取策略设计类面试的转述。

四档激进级递减：eager（立刻）、viewport（进视口）、hover、tap。前两个只对**导航完成后当场存在于 DOM 的链接**生效——`{#if}` 后插入的链接不会被主动扫描，官方明示为规避 MutationObserver 式 DOM 监听的性能陷阱。后两档由真实用户动作驱动，无此限制。设计哲学：激进预取的收益上限被"扫不到新链接"封顶，换取零观察者开销。

### 4. (A) 用户开启 saveData 后预取行为如何？工程上意味着什么？
**来源**：性能与用户体验专题面试的转述。

`navigator.connection.saveData` 为 true 时，preload-data 与 preload-code 属性**一律被忽略**（数据与代码都不预取）。意味着：①你不需要手写省流量判断；②别用 `preloadData()`/`preloadCode()` 编程式绕过——那等于替用户花流量；③低端网设备的"预取没生效"排查先看这一层。

### 5. (B) 同元素并存 preload-data="hover" 与 preload-code="tap"，抓包发现 hover 就拉了 chunk——"矛盾"吗？
**来源**：调试类社区答疑转述的面试题。

不矛盾。预取代码是预取数据的前提步骤，data="hover" 已隐含 hover 时拉代码；preload-code 属性**只有比 preload-data 更激进才有效果**，tap 比 hover 保守所以整条被忽略。想"hover 拉代码但不拉数据"应写 code="hover" 且不写 data 属性（或 data="false"）。

### 6. (B) 搜索结果下拉列表里渲染出的链接，全站 hover 预取体感依旧慢，为什么、怎么办？
**来源**：真实产品性能优化案例转述。

下拉里的链接是导航完成后动态插入 DOM 的，eager/viewport 类主动扫描不覆盖它们，只能等 hover——而搜索结果停留时长往往不足 200ms。解法：渲染后用 `$app/navigation` 的 `preloadCode(pathname)` 对前 N 条批量预取（支持 `/blog/*` 通配），只热代码不打数据接口，避开后端放大。这是"属性预取管静态页、编程预取管动态列表"的标准分工。

### 7. (B) 点了个链接页面整个白屏刷新了，排查清单给出最可能的三个原因。
**来源**：社区求助高频案例的转述。

①链接带 `data-sveltekit-reload` 或 `rel="external"`（设计如此，整页导航）；②href 指向的不是本应用接管的路径（`<a href="/api/xxx">` 指向端点、或 base path 不一致）；③`<a>` 外面套了东西吞了 href 判断（target="_blank"、download 属性、或点击目标其实不是 a 元素）。排查手段：Network 面板看是 document 请求还是 chunk fetch。

### 8. (C) 对比 Next.js <Link> 的 prefetch、Nuxt <NuxtLink> 的 prefetch 与 Kit 属性式预取的机制差异。
**来源**：跨框架性能专题面试的转述。

Next `<Link>` 默认对**视口内**链接预取页面 JS 与（App Router 下）RSC payload，是组件内置行为；Nuxt `<NuxtLink>` 组件级 `prefetch` prop + 路由规则 `app.routerPrefetch`；Kit 反组件化——**原生 `<a>` + DOM 属性继承**，任何元素（包括第三方组件渲染出的链接）挂上属性即获能，无需换成专用组件。取舍：Kit 对组件库侵入为零，但行为藏在 HTML 属性里，可读性靠约定。

### 9. (A) 导航生命周期三钩子各自定位？beforeNavigate 怎么拦截、type='leave' 时有何特殊？
**来源**：$app/navigation API 面试高频组合题的转述。

`beforeNavigate`：导航前拦截器（点链接/goto/前进后退都触发），调 `navigation.cancel()` 阻止完成；`type === 'leave'`（离开应用/关标签）时 cancel 触发**浏览器原生**离开确认，最终听用户的。`onNavigate`：URL/状态已变、DOM 未更新，可返回 Promise 配合 startViewTransition。`afterNavigate`：完成后的副作用上报类逻辑。三者都须在组件初始化期注册、随组件卸载失效。

### 10. (D) 电商列表页 200 个商品链接，设计一套不过度预取的策略。
**来源**：性能方案设计面试题的转述。

分层：①全局维持 data="hover"（用户意图驱动，成本可控）；②关全站 preload-data 改为 **code="viewport"** 只热代码——chunk 是 CDN 静态资源，进视口就拉，不打后端；③首屏外的图片/数据接口一律不预取；④尊重 saveData（自动）。论证核心：数据预取的代价在**服务端**（load 可能查库），代码预取的代价只在 **CDN/带宽**——激进档位给便宜的那半，保守档位留给贵的那半。

### 11. (D) 表单页有未保存修改，离开前拦一下——用本关知识给出实现骨架与其局限。
**来源**：交互保护类场景面试题的转述。

组件初始化期 `beforeNavigate(({ cancel, type }) => { if (dirty && type !== 'leave') cancel(); })`，配合弹窗让用户确认后再放行（确认后清 dirty、重新 goto）。局限必答：①type='leave' 时 cancel 只是弹浏览器原生框，文案不可定制——精确文案要另接 window beforeunload；②拦的是 Kit 接管的路由内导航与 goto，端点跳转/新标签页管不到；③纯浏览器后退手势在多历史记录场景 cancel 后状态易错位，重要数据应持久化草稿而非依赖拦截。

### 12. (B) 同事写了 <a goto="/x">点我</a>，点击报 undefined 错，纠正并给出两种正解。
**来源**：新手社区答疑转述。

`goto` 是 `$app/navigation` 导出的**函数**，不是 HTML 属性。正解一（优先）：这就是普通站内链接，`<a href="/x">` 让 Kit 接管即可，根本不需要 goto；正解二（确需程序化，如先埋点再跳）：`<button onclick={async () => { track(); await goto('/x'); }}>`。goto 特有的 opts（keepFocus/noScroll/replaceState）与属性族能力重合，能用 href 就别用 goto——可访问性与中键新开标签都白送。

🚀 **下一站 L3**：kit-load-universal——load 函数全解：event 契约、依赖追踪与失效重取。
