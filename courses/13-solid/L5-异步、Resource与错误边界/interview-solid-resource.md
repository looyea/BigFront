# solid-resource 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) createResource 和"在 createEffect 里 fetch 再 setSignal"有什么不同？为什么说它非阻塞？
**来源**：异步原语定位题的转述。

createEffect 方案要自己管 loading/error、自己处理依赖、await 之后读写还会脱出追踪窗口。createResource 是**专为异步造的 signal**：自动追踪 source、内建 `loading/error/latest/state`、source 变即重取。"非阻塞"指取数期间应用依旧响应、不冻结 UI——它不像传统那样让界面卡在数据回来之前。

### 2. (A) createResource 的两种调用形态？source 为假值时会发生什么？
**来源**：source+fetcher 形态题的转述。

① 无 source `createResource(fetcher)`：只跑一次（除非 refetch）。② 有 source `createResource(source, fetcher)`：source 每次变化自动重跑 fetcher，当前值作 fetcher 第一参。source 求值为 `false/null/undefined` 时 fetcher **不跑**——"ID 为空不发请求"天然靠这个短路，无需手写 `if`。

### 3. (C) 返回的 `[resource, {refetch, mutate}]` 里，refetch 和 mutate 的区别？
**来源**：读写接口题的转述。

`refetch(info?)` 重跑 fetcher（会真的再取数），`info` 传进去会落在 fetcher 的 `info.refetching`。`mutate(value)` **不调 fetcher、不发网络请求**，直接就地覆盖 resource 值，用于乐观更新。口诀：refetch=重新拿，mutate=本地改。

### 4. (A) 说说 resource 的五个 state，pending 与 refreshing 差在哪？
**来源**：五态模型题的转述。

`unresolved`(初始未取)/`pending`(正在取,latest undefined)/`ready`(成功)/`refreshing`(重取但**保留旧值** latest=T)/`errored`(失败)。pending vs refreshing：前者首次/无旧值可留、后者是"已有数据、正在后台刷"——refreshing 让 UI 可继续显示旧数据，是不闪屏的底层态。

### 5. (B) 用 `data()` 但界面一直显示空，明明请求成功了——最可能漏了什么？
**来源**：读取即触发题的转述。

`createResource` 的 fetcher **在被读取时才在合适时机跑/或 lazy 资源压根没触发**。若是 `lazy:true` 的延迟资源，必须手动 `refetch()` 才开始取；另一种是把读取放到了不追踪/不经过 Suspense 消费的地方。核心：确认资源是否真的被驱动去取（读它 / refetch / 去 lazy）。

### 6. (C) 给 createResource 传 initialValue 有什么收益？和 `data() ?? <加载>` 手写兜底比呢？
**来源**：initialValue 题的转述。

给了 `initialValue`，资源直接从 `ready` 开始、`data()` 首帧就有值、类型去掉 `| undefined`，不必到处判空/写 `?? <加载>`。比手写兜底更干净，且避免"首帧 undefined 闪一下"。

### 7. (A) fetcher 的签名 `(source, info)` 里 info 是什么？refetch 传的参去哪了？
**来源**：fetcher 信息题的转述。

`info = { value, refetching }`：`value` 是资源当前值（做增量/基于旧值算），`refetching` 是 `refetch(info)` 传入的参数（或自动 source 变化时为 `false`）。可据此区分"首取 / source 触发 / 手动带标志刷新"，走不同逻辑。

### 8. (B) 轮询资源怎么做到"组件销毁即停"？
**来源**：轮询与回收题的转述。

`setInterval(()=>refetch(), 1000)` 配 `onCleanup(()=>clearInterval(t))`——onCleanup 随该 Owner 作用域销毁自动清定时器（solid-lifecycle）。别在组件顶层裸 setInterval 不回收，那是内存/请求泄漏的经典源。

### 9. (A) resource 失败时错误会从哪暴露？createResource 为什么要配 ErrorBoundary？
**来源**：错误双路径题的转述。

fetcher reject → resource 进 `errored` 态、`resource.error` 可读（可在 JSX 判它做内联提示）。但当失败**经 Suspense/渲染读取冒泡**时，错误会抛给 `ErrorBoundary`。官方 tip：预计会出错就把 createResource 包进 ErrorBoundary。稳的做法是 `user.error` 内联提示 + 边界兜没预判的抛错，二者配合。

### 10. (C) createResource 和 createAsync 有什么区别，各自什么时候用？
**来源**：两异步原语对比题的转述。

createResource 需要被"读取/Suspense 消费"来驱动，返回值+loading/error/state，配 refetch/mutate，适合**组件里绑定到 UI 的数据**。createAsync 是"可 await 的 resource"：能像普通 Promise 一样 `await`、能在另一个 async 流程里链式取、`read()` 按需触发 Suspense、还有 `use` 同步取或挂起。要在异步逻辑里编排多个请求、或想"不读就不挂起"，用 createAsync；纯 UI 数据用 createResource。

### 11. (D) 设计：搜索框输入 → 防抖后按关键字取结果，要求"取新结果时旧结果仍在屏幕上、失败可回退"。用 resource 的哪些能力？
**来源**：搜索数据流设计题的转述。

`const [q]=createSignal('')`（输入经防抖写 q），`const [results,{mutate}]=createResource(q, searchFetcher)`；取新值时 resource 进 `refreshing`（保留旧 results()），配 `useTransition` 把"改 q"标为过渡 → 旧结果留到最后一刻原子替换。失败时进 `errored`、`results.error` 提示、旧值可保留（不 mutate 清空）。

### 12. (D) SSR/路由数据加载下，`ssrLoadFrom:"server"` 与 `"initial"` 的差别？deferStream 呢？
**来源**：SSR 资源加载策略题的转述。

`ssrLoadFrom:"server"`（默认）：水合时用服务端已取到的值、不重取；`"initial"`：客户端水合后重新取一次。`deferStream:true`：SSR 流式渲染时**允许该资源挂起、推迟这条 boundary 的 flush**（不提前把 fallback 冲出去），用于"宁可等数据也别先吐占位"的首屏。这组是 SolidStart 数据流（L7/L8）与 SvelteKit load 的对位概念。

🚀 实操请去做 L5 作业：复现 source 假值短路、refetch vs mutate、五态 refreshing、轮询 onCleanup、错误双路径五道题。

---

## 补充（新专题 13-15）

### 13.  搜索页：关键词每次变化发请求，如何防旧结果覆盖新结果、并支持回车立即重查？ 

 source 用信号承载关键词（变化自动重取），旧承诺不取消但用 refetching 与 generation 标记丢弃过期响应；更彻底是 fetcher 里接 AbortController 按次中断；回车强发走 refetch(true) 绕缓存。 

**来源**： https://www.solidjs.com/docs/latest/api#createresource 

### 14.  资源与 createAsync（Async 组件）怎么选型？ 

 createResource 适合 key 驱动、手动重取与 SSR 数据流；createAsync 返回带 state/loading/error 的细粒度信号且可在事件里直接 await，适合点击触发的过程；数据随路由参数走选前者，随用户动作走选后者。 

**来源**： https://github.com/solidjs/solid-helpers ； https://docs.solidjs.com/ 

### 15.  无限滚动列表每页一个资源，聚合层怎么设计才不整列表闪烁？ 

 页信号数组 + 每页独立资源（或 createResources 动态键），已加载页结果永不重取，新页 append；闪烁源于把整列表当单资源重取；配 store 键稳定与 For（非 Index）保行复用。 

**来源**： https://www.solidjs.com/docs/latest/api#createresource 
