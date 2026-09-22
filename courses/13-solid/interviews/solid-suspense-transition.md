# solid-suspense-transition 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) <Suspense> 是怎么知道"该显示 fallback"的？
**来源**：Suspense 触发机制题的转述。

它识别边界内**对被 Suspense 追踪的异步依赖的读取**——典型是读到尚在 pending 的 createResource、或 createAsync 的 `read()`。一旦被追踪的异步在边界内被读且未 resolve，Suspense 就渲染 fallback，resolve 后换成真实子树。

### 2. (A) 官方说 Suspense "非阻塞"，这意味着挂起期间子树到底跑不跑？
**来源**：非阻塞语义题的转述。

跑。挂起**不冻结整个应用**：子树照常执行、创建响应式 owner，只是**内容暂不落 DOM**、由 fallback 顶着，等异步解析后才把解析内容插入文档。这与"卡住不动"的直觉相反，是 Solid 异步不阻塞主线程的体现。

### 3. (B) 边界里读到 pending 资源时，界面上一个 onMount 里的埋点上报没触发，为什么？
**来源**：effect 时机排坑题的转述。

官方明确：**suspended 子树里的 onMount 和 createEffect 要等边界 resolve 之后才执行**。挂起期间子树虽在跑、owner 在建，但这些渲染后钩子延后到揭示时才跑。别把"必须在 loading 期做"的事放进挂起子树的 onMount。

### 4. (C) 嵌套两层 Suspense，一个孙组件读到 pending 资源，哪层 fallback？带来什么好处？
**来源**：就近边界题的转述。

**最近的祖先边界**处理该异步依赖、只它切 fallback，外层不动。好处是**局部兜底**：详情区加载中只有详情区塌、标题区照常，避免整页闪白。可自由嵌套做多级加载区。

### 5. (A) useTransition 返回什么？start(fn) 和 pending() 各自作用？
**来源**：transition API 题的转述。

返回 `[pending, start]`。`start(fn)` 把 `fn` 内发生的更新标记为"过渡"、返回 Promise；过渡期间**旧界面保留、新数据后台取、就绪后原子替换**。`pending()` 是访问器，报告当前是否仍在过渡中——可做顶部进度条或禁用按钮。

### 6. (B) 点"下一用户"时数据区闪一下 fallback 又切新内容，很难看。怎么用 transition 消除？
**来源**：闪屏消除题的转述。

把触发取数的 state 变更包进过渡：`await start(()=>setUserId(2))`。这样 resource 进 `refreshing`（保留旧值）、Suspense 不会退回 fallback，新数据到了再整体替换。配合 `<Suspense>` 包住数据区即可"旧界面留到最后一刻、不闪屏"。

### 7. (C) startTransition 和 useTransition 有何区别？客户端与服务端行为差在哪？
**来源**：两过渡 API 与 SSR 题的转述。

`startTransition(fn)` 就是 useTransition 里那个 `start`、只是**不带 pending 访问器**（不需要进度态时用它）。客户端：`start` 在微任务里**异步调度**过渡、`pending()` 反映进行与否；服务端：`pending()` 恒 false、**过渡同步跑完**（SSR 没有闪屏这回事）。

### 8. (A) 多个兄弟 Suspense 各自好了就跳出来、页面乱抖，怎么有序收场？
**来源**：SuspenseList 编排题的转述。

用 `<SuspenseList revealOrder="forwards|backwards|together" tail="collapsed|hidden">` 包住这些兄弟边界。它登记每个子边界的 `inFallback`、汇总成有序揭示（自上/自下/一起出）。注意官方标为**实验性**，上生产前评估。

### 9. (D) 设计：一个仪表盘 4 个卡片各自异步取数，要求"按固定顺序一起出现、没到的显示骨架"。写清组件与属性。
**来源**：多块揭示设计题的转述。

`<SuspenseList revealOrder="together">` 包 4 个 `<Suspense fallback={<Skeleton/>}>`，together 让它们**全就绪才一起揭示**、未到时各自显示骨架但顺序稳定不互插。要"从上到下逐个补位"就 forwards；"没到的先隐藏"用 tail="hidden"。

### 10. (C) Solid 的 Suspense 和 React 的 Suspense 心智差别？为什么 React 老手会说"它更像数据边界"？
**来源**：跨框架 Suspense 对比题的转述。

理念一致（边界内异步未好显示 fallback），但 Solid **没有重渲循环**：Suspense 的挂起/揭示是沿 Owner 树对"被追踪异步读取"的反应，不涉及"重跑组件"。React 里 Suspense 常和并发渲染/useTransition 深绑且行为随版本演进；Solid 里它与 useTransition 是清晰分离的两件工具、组合使用。

### 11. (B) 用了 Suspense 后路由切换偶发"整页闪一下"，排查方向？
**来源**：路由闪屏排坑题的转述。

① 切页取数没走 transition——把导航包成过渡（router 的 `<Link transition>` / `useNavigate` 复用 USE_TRANSITION 上下文）让旧页留到新页就绪。② fallback 层级太靠外（整页级 Suspense 兜了所有）→ 下沉到就近边界。③ 首帧无 initialValue 导致 unresolved 闪白。核心：数据切换尽量走 refreshing+transition 而非退回 fallback。

### 12. (D) 场景：无限滚动列表，每翻一页追加、页与页之间要保留已加载内容、加载中只在列表底部显示 spinner。怎么组合 resource + Suspense + transition？
**来源**：分页/无限滚动设计题的转述。

页码 signal 作 source 或 `refetch(page)`；追加不替换可用 mutate 合并旧+新，或让 fetcher 依 `info.value` 累加。翻页包进 `start(...)` 过渡：旧列表保留（refreshing）、底部单独一个小 `<Suspense fallback={<Spinner/>}>` 就近兜底——整列表不塌。切忌把整个列表包一个顶层 Suspense，否则翻页全列表闪回 fallback。

🚀 实操请去做 L5 作业：复现就近边界、effect 延后、transition 防闪、SuspenseList 编排、SSR 同步过渡五道题。
