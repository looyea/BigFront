# svelte-lifecycle 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与大厂前端面经高频主题的转述。

---

### 1. (A) Svelte 5 组件从创建到销毁经历哪些阶段？和 Vue/React 怎么对齐？

**来源**：Svelte 文档 — Component lifecycle 章节转述

五段：①脚本同步体（建信号/context/props 就位）→②构建 DOM 树（未进文档）→③插入文档：action 执行、onMount、`$effect` 首跑 →④更新：state 变→微任务 flush→`$effect.pre`→DOM patch→`$effect` →⑤销毁：`$effect` 清理→action destroy→节点移除。对齐 Vue：setup≈①，onMounted≈③，watchEffect/onUpdated≈④，onUnmounted≈⑤；对齐 React：函数体每次重跑没有对应物（Svelte 只跑①一次），`useEffect(fn, [])`≈③、其 cleanup≈⑤、无依赖数组的 useEffect≈④。

### 2. (B) 为什么 Svelte 5 把 onDestroy/beforeUpdate/afterUpdate 都"退休"了？onMount 为何保留？

**来源**：Svelte 5 发布博客 RUNES 部分 + 维护者 FAQ 答疑

生命周期碎片本质是"在错误时机担心忘记清理"的补丁：`$effect(() => { ...sub(); return () => unsub(); })` 把**订阅与清理写在同一作用域**，依赖变化重跑前和销毁时都执行清理，比 onDestroy 更难漏。before/afterUpdate 折叠进 `$effect.pre`/`$effect` 的时机语义。onMount 保留是因为"只跑一次的挂载后逻辑"（聚焦、第三方初始化）语义直白，强塞进 effect 反而要人为制造依赖。考点：**钩子是时机枚举，effect 是依赖驱动**——后者与响应式图同源。

### 3. (B) 面试官现场提问："我想在 DOM 更新后立刻读元素的 scrollHeight，代码怎么写？写错会出什么症状？"

**来源**：Stack Overflow — svelte get updated element height after state change

症状：state 改完同步读，读到**旧布局**（更新排在微任务）。正解两选一：`await tick()` 之后读（异步、不打断交互）；或 `flushSync(() => { count++; })` 强制同步刷完再读（用于读之前必须量、且在同一事件链里，如自动增高 textarea）。追问点：flushSync 滥用会破坏批处理、放大布局抖动，默认永远不需要。

### 4. (A) `$effect` 首跑和重跑的时机一样吗？SSR 时呢？

**来源**：Svelte 文档 — $effect 语义说明

首跑在组件**挂载进文档之后**（所以能安全摸 DOM）；重跑在依赖变化的微任务 flush、DOM patch 之后。`$effect.pre` 则在 patch **之前**（想在读布局前改样式等场景）。SSR 阶段**一次都不跑**——服务端没有 DOM，effect/action/onMount 全部静默；组件里服务端唯一执行的是脚本同步体，这也是"顶层别碰 window"的根因。

### 5. (C) React 的 `useEffect(() => {...}, [])` 在 StrictMode 下跑两遍，Svelte 的 onMount/$effect 首跑有类似行为吗？这差异说明什么？

**来源**：React 文档 — StrictMode 双调用说明；Svelte 社区对比帖

Svelte 没有"故意双跑"的机制——脚本体与 onMount 各执行一次，StrictMode 的双调用是 React 为暴露"渲染函数必须纯、effect 必须可重入"的侦探设定。差异源于模型：React effect 依附于"每次渲染"，必须在概念上区分 mount/update；Svelte effect 依附于信号图，图的生命周期真实存在，不需要伪随机重放来暴露问题。面试延伸：Svelte 严格模式=开发期 runes 校验警告（如在派生里写 state 会直接 error），思路是**静态检查**而非运行时重放。

### 6. (B) 一个组件放在 `{#if}` 里，开关一次后表单填的内容没了——列举至少三种保住状态的方案。

**来源**：Reddit r/sveltejs — "why does my form reset" 高频帖

① **数据提升**：state 放进永活的父组件/ context / 全局模块（`.svelte.js`），组件只做展示（呼应 svelte-global-state）；② **不销毁改隐藏**：`class:hidden={!open}` 或 `display:none`，代价是 DOM 常驻；③ **销毁但存草稿**：`$effect` 清理时写 sessionStorage/localStorage，重建时初始化读回；④（L9 预告）`$memo` 类状态保留原语。选型看语义：真"关掉即作废"就别保——先问产品要哪种。

### 7. (D) 设计一个"倒计时组件"，把生命周期知识点全用上：挂载、随 prop 重启、tick 语义、卸载清理。

**来源**：大厂前端面经 — 定时器组件设计题

```svelte
<script>
  let { seconds = 60, onfinish } = $props();
  let left = $state(seconds);
  $effect(() => {
    left = seconds;                         // prop 变→重启
    const t = setInterval(() => {
      if (left <= 1) { clearInterval(t); onfinish?.(); }
      else left--;
    }, 1000);
    return () => clearInterval(t);          // 重跑前&销毁都清
  });
</script>
<span>{left}s</span>
```

要点：清理闭环在 effect 内（无 onDestroy）；`seconds` 变化自动重启倒计时；`onfinish` 走 props 回调而非事件分发器；测试时可用假定时器。追问"SSR 呢"——effect 不跑、服务端只渲染初值，天然安全。

### 8. (A) action、onMount、$effect 三者都能"挂载后干活"，边界在哪？

**来源**：Svelte 官方 tutorial 评论区 — when to use action vs effect

**需要复用一段"带 DOM 的行为"跨组件/跨元素**→action（参数化、update 通道，如 v-click-outside 的 Svelte 版）；**本组件一次性挂载逻辑**→onMount；**逻辑依赖响应式状态、状态变要重接线**→`$effect`。反例：把订阅 WebSocket 写进 onMount 又要监听 url 变化重连，会堆出手动 cleanup 管理——那是 effect 的主场。一句话：action 面向元素，effect 面向依赖，onMount 面向"仅一次"。

### 9. (B) 线上偶现"切换页面后旧页面定时器还在跑"，你的排查与根因假设？

**来源**：生产事故复盘类面试高频题（多框架通用，Svelte 语境作答）

根因假设：① 定时器注册在 onMount/顶层而清理挂在别处（或根本没清）；② 路由"复用不销毁"策略让组件真的没走卸载（SvelteKit 同名布局切换默认保实例）；③ 清理写在了 `{#if}` 块内组件里，外层没销毁它就一直活。排查：销毁打点 `$effect(() => () => console.log('bye', id))`；Performance 面板录 CPU 看 idle 时 timer 尖峰归属。修复：订阅-清理同作用域（第 2 题模式），路由级兜底可在页面容器 `{#key pathname}` 强制重建。

### 10. (C) Vue 的 `onBeforeMount/onMounted/onBeforeUpdate/onUpdated/onBeforeUnmount/onUnmounted` 六钩子，Svelte 5 对应什么？少了的钩子去哪了？

**来源**：Vue 文档生命周期图 + Svelte 迁移指南对照题

beforeMount≈构建 DOM 后插入前——Svelte 不暴露（无真实需求）；mounted≈onMount/`$effect` 首跑；beforeUpdate≈`$effect.pre`；updated≈`$effect`；beforeUnmount≈没有独立钩子（清理函数即最后一段同步逻辑，需要"销毁前 DOM 还在"的观测可用 `persist:transition` 类边界手段）；unmounted≈`$effect` 清理。设计哲学差异：Vue 给**时机枚举**（用户挑点位），Svelte 给**依赖驱动**（框架定时机），before 系钩子在信号模型里大多不需要。

### 11. (D) 你们要做"页面离开确认 + 离开时保存草稿"，生命周期角度怎么组合？

**来源**：大厂面经 — 路由守卫与离开拦截设计题

两层：① **浏览器层**——`beforeunload` 用 `<svelte:window beforeunload={handler}>`（特殊元素，L9 细讲），dirty 时 preventDefault；② **应用层**——纯 Svelte 无路由守卫，SPA 路由库（如 svelte-spa-router 的 leaveGuards）或 SvelteKit 的 `beforeNavigate`/`onNavigate` 才是正解，草稿保存在组件 `$effect` 清理里写 storage 兜底"任何路径的销毁"。追问点：清理里做**同步**写（localStorage），异步 fetch 要用 `navigator.sendBeacon`（呼应 node/http 话题）。

### 12. (A) "`$effect` 不在 SSR 跑"会导致什么经典翻车？给规避清单。

**来源**：SvelteKit  issues — hydration mismatch 系列问题汇编

① 服务端 HTML 少了只有 effect 里补的内容（水合后不 flush 就白屏一块）→ 首屏可见数据必须在同步体/load 拿；② `Math.random()`/`Date.now()` 在同步体里参与模板 → 服务端与客户端两次求值不一致 → hydration mismatch 警告与节点错乱 → 时间戳类"仅客户端"渲染包 `{#if mounted}`（onMount 置位）；③ 依赖 localStorage 初值 → 服务端读不到渲出空态水合后闪一下 → 同样 mounted 门闸或 `browser` 判断（`$app/environment` 到 Kit 讲）。原则：**SSR 只认同步体的确定性输出**。

---

## 补充（新专题 13-15）

### 13.  Svelte 5 为什么把 onDestroy/beforeUpdate 等生命周期钩子基本废掉、改用 $effect？这背后的统一模型是什么？

统一模型：runes 想把"生命周期"归约成"响应式的建立与销毁"——$effect 本身就同时是 create（首次运行）、update（依赖变重跑）、destroy（重跑前/组件销毁时跑 cleanup）三合一（对应既有"为何移除 onDestroy"题）。传统钩子（onMount/onDestroy/onDestroy）是把"时刻"切散给不同 API，Svelte 5 认为"副作用的生灭应跟随它依赖的数据"而非"组件的固定阶段"。收益：① 建立与清理物理相邻（一个 effect 里订阅、return 退订，不会忘配对——对比 React 依赖数组易错）；② 组件级销毁只是"effect 不再需要时清理"的特例；③ 心智从"记住有几个钩子何时跑"变成"effect = 一段有生命周期的响应式订阅"。代价：纯"只挂载一次/只销毁一次"的组件级时机仍要 onMount（DOM 引用场景）或 $effect.root（脱离组件生命周期，对应 effects-advanced 题）。加分句：能把这个演进讲成"从『组件时刻驱动』到『数据依赖驱动副作用』"的范式迁移，就抓住了 Svelte 5/React/Vue3 共同的收敛方向（三者都在往 effect/scope 收敛，只是语法不同）——呼应 lifecycle 关 React/Vue 生命周期对照题。

**来源**：Svelte 5 生命周期简化说明；effect cleanup 模式；React useEffect 对照

### 14.  一个组件放在 {#if} 里被反复开关，它的状态、effect、动画分别发生什么？和"用 display 隐藏"怎么选？

{#if} 翻假：块内组件被 unmount——$state 全部销毁（下次翻真是全新实例、初始值）、所有 $effect 跑 cleanup 并停止、transition 播放出场（若有）、DOM 移除；翻真：重新 mount（初始 state、effect 首跑、进场动画）。后果：表单值、滚动位置、内部定时器在"关"时全丢（既有"开关一次后表单填的值没了"题）。与 display:none 对比：display 保留实例（state/effect/定时器都活着、隐藏期继续跑，可能白耗资源或后台轮询），切换零重建（对应 component-composition 关同主题题、lifecycle"旧页面定时器还在跑"事故）。选择：需要"关即彻底重置 + 停掉一切"→{#if}；需要"关只是看不见、开即回到原状"→display/visibility/或 keep 实例；要"保留 DOM 但停副作用"→{#if} 配状态提升（把要留的数据提到不被销毁的父层）。加分句：这题考的是"状态所有权与生命周期绑在哪"——{#if} 把状态生命周期绑到"条件为真"，display 绑到"组件实例存在"；成熟的组件设计会显式决定"哪些状态该比可见性活得更久"并据此放置（提升到父/context/全局），而不是被 {#if} 的默认销毁行为坑到才发现。

**来源**：条件块与组件实例生命周期；effect teardown；既有"{#if} 开关后表单值"题

### 15.  action、onMount、$effect 都能在"挂载后"做事，三者时机与能力差异是什么？怎么选？

时机：action 在"它绑定的那个元素被创建插入时"触发（最贴近元素、且携带 node 引用）；onMount 在"组件首次挂载到 DOM 后"跑一次（客户端 only）；$effect 在"组件 state 变化后的 flush 时"跑（可能重复、SSR 不跑，首跑也在挂载后）。能力：action 天生持有它服务的 DOM 节点、生命周期跟随该节点（元素消失自动 destroy）——最适合"给某元素加可复用行为"；onMount 是"组件级、只跑一次、需要 DOM 就绪的初始化"（且 return 函数做销毁）；$effect 是"响应式驱动、会随依赖重跑"。选择口诀：绑元素的可复用 DOM 行为→action；组件一次性初始化（拿 bind:this 引用、初始化第三方）→onMount；数据变了要同步点什么→$effect（对应既有三者辨析题）。加分句：区分点是"你做的事跟随什么变化"——跟随某个元素的存亡用 action、跟随组件挂载这一次用 onMount、跟随某些数据的每次变化用 $effect；很多误用是把"只该跑一次的 DOM 初始化"写进了会重跑的 $effect（既有"定时器还在跑"事故的一种成因就是把订阅放错生命周期载体）。

**来源**：Svelte mount 时机；action vs onMount vs effect；既有"三者都能挂 DOM"辨析
