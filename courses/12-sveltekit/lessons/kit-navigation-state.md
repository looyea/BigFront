# 导航状态深水区：$app/state、stores 与新代际

> 目标：讲清 SvelteKit 应用级状态的两代 API 与迁移——`$app/stores`（`page`/`navigating`/`updated` 三个可读 store，已 `@deprecated`）到 `$app/state`（2.12+ 的三个只读响应对象，**只能用 runes 追踪**）的动机与写法差异、`navigating`/`willUnload`/`updated.check` 的订阅纪律、`beforeNavigate`/`afterNavigate`/`onNavigate` 三代导航钩子与竞态/取消、`invalidate` 家族与滚动恢复（呼应 svelte-reactive-runes 的信号化、svelte-stores 的订阅模型）

## 一、两代 API：为什么从 stores 换成 state

SvelteKit 提供三件**应用级状态**：`page`、`navigating`、`updated`。它们有两套模块：

- `$app/stores`（旧）：三个 `Readable` store，靠 `subscribe`/`$` 前缀自动订阅取值。**三者现已全部 `@deprecated`**，官方注明"改用 `$app/state`（需 Svelte 5）"。
- `$app/state`（新，**2.12 加入**）：三个**只读响应对象**，直接 `import { page } from '$app/state'` 然后 `page.url.pathname` 用点号取。低于 2.12 才继续用 stores。

迁移动机是**响应式粒度**。store 是"整对象订阅"——`$page` 一变，凡是订阅了它的组件全部重渲染，哪怕你只用到 `page.params.id`。`$app/state` 建立在 Svelte 5 的细粒度信号之上：`page.params.id` 本身是个被追踪的属性，**只有真正读到该属性的那份 `$derived`/模板才会更新**。代价是一条硬规矩：

> `page` 的变化**只能用 runes 感知**。`const id = $derived(page.params.id)` 会正确更新；老式 `$: badId = page.params.id` **永不更新**（初始值后就僵住）。

这是迁移期最阴的坑：语法不报错，只是不再响应。Svelte 5 环境请全用 `$derived`/`$effect`/`$props`。

## 二、page：形状与"只在渲染期可读"

`page`（`$app/state`）是一个只读响应对象，聚合了：`data`（各 layout/page load 合并结果）、`form`（action 返回，L4）、`params`、`route.id`、`state`（`goto`/`pushState` 传的 `page.state`）、`status`、`error`、`url`。

订阅纪律一条：**服务端只能在渲染期读 `page`，不能在 load 函数里读**（load 里请用它的入参 `event`/`params`/`data` 等）；浏览器则任意时刻可读。典型用法替代以前一堆 `export let` 层层透传：

```svelte
<script>
  import { page } from '$app/state';
</script>
<p>当前在 {page.url.pathname}</p>
{#if page.error}<span>出错了</span>{:else}<span>正常</span>{/if}
```

## 三、navigating 与 willUnload：知道"正在跳、会不会卸载"

`navigating` 是只读对象，导航进行中携带 `from`/`to`/`type`，`type === 'popstate'` 时还有 `delta`；**没有导航时、以及服务端渲染期，其值全为 `null`**。`type` 取值：`enter`（首次进入）/`leave`（离开应用）/`link`（点了个链接）/`popstate`（前进后退）。用它可做顶部进度条：

```svelte
<script>
  import { navigating } from '$app/state';
</script>
{#if navigating.to}<div class="bar" />{/if}
```

`willUnload` 是挂在这条导航上的布尔**属性**（`navigation.willUnload`），含义是"若不取消，本次导航会导致文档卸载"——即 `type === 'leave'`，或 `type === 'link'` 但目标 `route === null`（要跳到非本应用管辖的 URL）。它与 `beforeNavigate` 配合来做"离开前拦截"（见下节）。注意：`$app/state` 对外只暴露 `page`/`navigating`/`updated` 三件，`willUnload` 不是第四个顶层导出，而是导航对象上的字段——别写成 `import { willUnload } from '$app/state'`。

## 四、beforeNavigate / afterNavigate / onNavigate：三代钩子与取消

`$app/navigation` 提供导航生命周期钩子，**都必须在组件初始化期调用，组件挂载期间保持有效**：

- `beforeNavigate(cb)`：拦截器。`cb(navigation)` 里调 **`navigation.cancel()`** 取消本次导航。当 `navigation.type === 'leave'`（关标签/离开应用）时，`cancel()` 会触发**浏览器原生的"确定离开？"确认框**——此时最终是否离开由用户在系统弹窗里决定。典型场景：表单有未保存改动时挡一下。
- `afterNavigate(cb)`：组件挂载时、以及每次导航到某 URL 后运行。适合页面级埋点、聚焦、第三方脚本重init。
- `onNavigate(cb)`（较新）：在导航到新 URL **前一刻**运行（**整页导航期间不跑**）。返回 Promise 会被 await（可配 `document.startViewTransition` 做平滑过渡）；返回函数则在 DOM 更新后调用。用于"离开前抓张截图/存个滚动位置"这类精确时机控制。

`navigation.to.route.id === null` 表示目标不是 SvelteKit 管辖的路由（如站内一个纯静态 `.pdf` 或外部链接），据此区分处理。

## 五、竞态与 AbortController：慢请求别盖住快结果

导航竞态的经典形态：快速点 A→B，A 的 load 请求慢、后返回，把 B 的结果覆盖成 A 的。三条防线：

1. **load 里用 `event.fetch` 并透传 `signal`**：Kit 会在导航被取代时 abort 掉上一个 load 的 fetch，减少无用回包。
2. **别在 load 里写共享可变状态**（服务端会串用户、客户端会竞态），一律 `return` 数据交给 `page.data`（L3/状态纪律）。
3. **组件级的异步**用"令牌/代次计数"或 `AbortController`：`$effect` 里发请求时 `const ac = new AbortController()`，return `ac.abort` 作清理；或用 `$derived` 依赖 `page.params` 让 Svelte 自己管重跑。

`updated`（版本检测）也是竞态相关：配 `version.pollInterval` 后 Kit 轮询新版本，发现新 `version` 就把 `updated.current` 置 `true`；`updated.check()` 强制立即查。检测到新版后通常提示用户刷新——**它不会自动重载**，避免打断进行中的操作。

```svelte
<script>
  import { updated } from '$app/state';
  let show = $state(false);
  $effect(() => { if (updated.current) show = true; });
</script>
{#if show}<button onclick={() => location.reload()}>有新版，点击刷新</button>{/if}
```

## 六、刷新粒度：goto / invalidate / invalidateAll / preload 家族

导航相关的可编程入口：

- `goto(url, opts)`：编程式导航（返回 Promise，失败会 reject）。外部 URL 别用 `goto`，写 `window.location = url`。opts 有 `replaceState`/`noScroll`/`keepFocus`/`invalidateAll`/`invalidate`/`state`。
- `invalidate(resource)`：让**依赖该 URL**（通过 `fetch` 或 `depends`）的当前页 load 重跑。参数可为字符串/URL/判定函数；自定义标识用 `^[a-z]+:` 形式（如 `custom:state`）合法。
- `invalidateAll()`：当前页所有 load 全部重跑。
- `preloadCode(pathname)`：**只预取路由代码、不跑 load**（支持 `/blog/*` 通配）。
- `preloadData(href)`：预取代码 **且** 跑 load，等价于 `data-sveltekit-preload-data` 的效果，下次导航到 `href` 即时呈现。
- `pushState(url, state)` / `replaceState(url, state)`：浅路由，造/换历史条目并写入 `page.state`（第一参传 `''` 表示用当前 URL）。

## 七、滚动恢复控制

Kit 默认会：普通链接导航滚到顶、`popstate`（前进/后退）恢复原位。要接管：

- `+layout.(js|server.js)` 里 `export function scroll({ to, from, type })` 返回 `{ x, y, top, left, behavior }` 决定滚动落点（如锚点、记住某容器位置）。
- `disableScrollHandling()`：在 `onMount`/`afterNavigate`/action 里调用可**关掉内置滚动处理**（官方劝退，因为违背用户预期）。
- 需要读/存当前滚动位置（配合 `onNavigate` 抓快照）时，较新版本提供 `getScrollPosition()`/`setScrollPosition()`。

组件跨导航被**复用**（不销毁重建）是滚动/侧栏状态能保留的原因，也是 `onMount`/`onDestroy` 不重跑的原因——要"每次进入都跑一遍"用 `afterNavigate`/`beforeNavigate`；要强制某个子组件在路由变化时重建，用 `{#key page.url.pathname}<Child/>{/key}`。

## 八、自检清单

1. 说清 `$app/stores` 三件套的现状（是否 deprecated）与迁移到 `$app/state` 的版本前提、响应式粒度收益。
2. 解释"`page` 变化只能用 runes 感知"——给出 `$derived` 正确写法与被淘汰的 `$:` 写法，说明后者为何"不报错但僵住"。
3. 描述 `navigating` 的字段与"无导航/服务端渲染期全为 null"，以及 `willUnload` 到底是顶层导出还是导航对象属性。
4. 区分 `beforeNavigate`/`afterNavigate`/`onNavigate` 三钩子时机，写出"未保存改动离开前弹原生确认"要用哪个、靠什么触发。
5. 说清导航竞态的三条防线，以及 `updated.check()`/`version.pollInterval` 检测到新版后会不会自动重载。

🚀 **下一站 L8**：kit-typescript——generated types 开关与产物、`$page.params` 按路由收窄、load 返回值的数据类型流转、ActionData/Actions 类型协议。
