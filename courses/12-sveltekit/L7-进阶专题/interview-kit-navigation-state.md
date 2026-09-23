# kit-navigation-state 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) $app/stores 和 $app/state 是什么关系？为什么要迁移？
**来源**：两代状态 API 开场题的转述。

$app/state（2.12+）提供 page/navigating/updated 三个只读响应对象；$app/stores 是它们早期的 Readable store 版本，三者现已全部 @deprecated，官方建议 Svelte 5 下改用 $app/state。迁移动机是响应式粒度：store 是整对象订阅、一变全重渲，state 基于细粒度信号、只有真正读到该属性的派生/模板才更新。

### 2. (A) "page 的变化只能用 runes 感知"是什么意思？举正反例。
**来源**：迁移期最阴坑的转述。

$app/state 的 page 是信号化对象，必须用 runes 追踪：`let id = $derived(page.params.id)` 会正确更新；而老式 `$: badId = page.params.id` **永不更新**（初始加载后就僵住）。后者不报错、只是不再响应，是迁移期最容易漏的 bug。同理一次性 `let id = page.params.id` 也不会随导航更新。

### 3. (B) 低于 2.12 的项目想用 $app/state 会怎样？迁移要注意什么 Svelte 版本前提？
**来源**：版本兼容排坑题的转述。

$app/state 是 2.12 加入的，更早版本得继续用 $app/stores。$app/state 的 runes 追踪依赖 Svelte 5，因此"$app/state + runes"要求 Kit 2.12+ 且 Svelte 5。迁移时把所有从 page 派生的量改成 $derived、把订阅副作用改成 $effect，别残留 `$:` 或 `$page` 前缀语法。

### 4. (A) 服务端能在 load 函数里读 page 吗？page 各字段的读取时机是？
**来源**：page 读取纪律题的转述。

不能。$app/state 的 page 在服务端只能在**渲染期**读（不在 load 等函数里），浏览器任意时刻可读。load 里要用它的入参 event（params/url/data/locals 等）。page 聚合 data、form、params、route.id、state、status、error、url。

### 5. (A) navigating 对象何时为 null？它带哪些字段？
**来源**：navigating 形状题的转述。

navigating 是只读对象，导航进行中携带 from/to/type，type==='popstate' 时另有 delta；**没有导航时、以及服务端渲染期，其值全为 null**。type 取 enter/leave/link/popstate。常用于做顶部进度条（navigating.to 非空即显示）。

### 6. (B) 有人写 `import { willUnload } from '$app/state'` 报错，为什么？willUnload 到底是什么？
**来源**：willUnload 认知误区题的转述。

$app/state 只对外暴露 page/navigating/updated 三件，willUnload 不是第四个顶层导出，所以那样 import 拿不到。它是挂在导航对象上的布尔**属性**（navigation.willUnload），表示本次导航若不取消会导致文档卸载——即 type==='leave'，或 type==='link' 但 to.route===null。

### 7. (D) 表单有未保存改动，关标签/离开前弹"确定离开？"，怎么写？
**来源**：beforeNavigate 卸载守卫场景题的转述。

在组件初始化期调 beforeNavigate((navigation)=>{ if(dirty){ if(navigation.type==='leave'){ navigation.cancel(); /* 触发浏览器原生卸载确认 */ } else { if(!confirm('有未保存改动')) navigation.cancel(); } } })。type==='leave'（关标签/离开应用）时 cancel() 会触发浏览器原生"确定离开？"框，最终去留由用户在系统弹窗决定。

### 8. (C) beforeNavigate、afterNavigate、onNavigate 三钩子的时机差别？
**来源**：导航钩子横向题的转述。

三者都必须在组件初始化期调用、挂载期间有效。beforeNavigate 导航前拦截、可 cancel；afterNavigate 挂载时与每次导航后运行（埋点/聚焦/重init）；onNavigate（较新）在导航到新 URL 前一刻运行（整页导航期间不跑），返回 Promise 会被 await（可配 startViewTransition），返回函数则在 DOM 更新后调用（离开前抓快照/存滚动位置）。

### 9. (B) 快速点 A→B，A 的慢请求后返回把 B 覆盖了，怎么防这种导航竞态？
**来源**：竞态经典题的转述。

三招：① load 里用 event.fetch 并透传 signal，导航被取代时 Kit 会 abort 上一个 load 的 fetch；② 别在 load 写共享可变状态，一律 return 交给 page.data；③ 组件级异步用 AbortController 或 $effect/$derived 依赖 page.params，让 Svelte 管理重跑与清理。核心是"数据流单向、副作用可取消"。

### 10. (A) updated 怎么检测新版本？检测到后会自己刷新吗？
**来源**：版本更新机制题的转述。

初始 false。配 version.pollInterval 非零后 Kit 轮询新版本，发现新 version 就把 updated.current 置 true；updated.check() 可强制立即查。**不会自动重载**——以免打断进行中的操作，需你监听 current 自行提示"有新版，点击刷新"。

### 11. (C) preloadCode 与 preloadData 的区别？invalidate 与 invalidateAll 呢？
**来源**：预取/失效家族横向题的转述。

preloadCode(pathname) 只预取路由代码、不跑 load（支持 /blog/* 通配）；preloadData(href) 预取代码且跑 load，等价 data-sveltekit-preload-data，下次导航即时呈现。invalidate(resource) 让依赖该 URL（fetch/depends）的当前页 load 重跑，参数可为字符串/URL/判定函数、自定义标识用 `^[a-z]+:`；invalidateAll() 当前页所有 load 全重跑。

### 12. (D) 接管滚动行为：想让某类导航滚到指定位置、并保留侧栏滚动，怎么做？
**来源**：滚动恢复设计题的转述。

在 +layout.js 导出 `scroll({ to, from, type })` 返回目标（如 {x,y,behavior:'smooth'} 或锚点 top/left）。Kit 默认：链接导航滚顶、popstate 恢复原位。侧栏等内部容器滚动因组件跨导航被**复用**（不销毁重建）天然保留；若需禁用内置处理自己接管用 disableScrollHandling()（官方劝退）。要在导航间存取滚动位置，配合 onNavigate 抓快照、较新版本用 getScrollPosition/setScrollPosition。

🚀 **下一组**：L7 课后作业——端点契约、i18n 路由与导航状态的综合复盘。
