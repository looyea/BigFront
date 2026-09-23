# kit-streaming 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) SvelteKit 流式的完整链路：从 server load 返回 Promise 到模板出内容，中间发生了什么？
**来源**：流式渲染机制高频开场题的转述。

server load 返回对象里的**未 resolve 的 Promise** 不会被 await 后才出页：SSR 先把已就绪部分渲成 HTML 流式下发，占位标记留在流里；Promise resolve 后，服务端把该块内容（含模板 {:await} pending 分支已渲出的骨架被替换）继续写进**同一个响应流**。客户端 JS 加载后弥合 DOM。关键点：这是**单条 HTTP 响应**内的分块推进，不是浏览器二次请求。

### 2. (A) 为什么官方示例把 await 放在对象字面量最后？放前面会怎样？
**来源**：Parallel loading 编排心法题的转述。

对象字面量按**从左到右求值**：若先写 `post: await loadPost(...)` 再写 `comments: loadComments(...)`，慢评论查询要等正文 resolve 后才**起飞**，人为制造瀑布。正确姿势是把不 await 的慢 Promise 放前面先发起，最后一行再 await 快数据——两个查询真正并行，正文带着首块 HTML 尽早出。这题考的是"流式不只是模板特性，是请求编排纪律"。

### 3. (B) 本地 dev 流式正常，上线后页面变成"全量就绪才出"，两条最可能的环境原因？
**来源**：部署环境缓冲排坑案例的转述。

①平台缓冲整个响应：官方点名 AWS Lambda、Firebase 等函数托管不支撑流式，所有 Promise resolve 完才发送；②反向代理开了缓冲：NGINX 默认 proxy_buffering 会把上游响应囤齐再吐。前者要换平台或接受降级，后者关缓冲（或对流式路由单独关）。排查手法：直接 curl 上游服务端口看分块到达节奏，再逐层加代理比对。

### 4. (B) 用户在流式 Promise 的 resolve 链里 throw redirect(307, '/login')，线上发现根本不跳转。为什么？正确位置在哪？
**来源**：流式与响应头时序考题的转述。

流式一旦开始出页，HTTP 状态码与 headers 已随首块发出，覆水难收——setHeaders 与 redirect 在这条链上**官方明确无效**。鉴权/跳转决策必须发生在"开始出页之前"：放在 server load 同步 await 掉的前置检查里，或上移到 handle hook。延伸坑：同理想给流式响应追加 Set-Cookie 也不行，且 cookie 的 path/domain 时机窗口只在 headers 发出前。

### 5. (A) universal load 返回值里放 Promise，能流式吗？要流式该放哪？
**来源**：两栖 load 边界题的转述。

不能。官方警告：页面若 SSR，universal load 返回的 Promise **不会流式**——服务端渲染器等不到它，浏览器重跑 universal load 时该 Promise 被重新创建（还可能造成二次请求）。要流式必须把 Promise 放进 **server load** 返回值；universal 侧只做"接收 server 下发、加工合并"的角色。这是"流式 = 服务端单条响应内的协议"本质的又一次印证。

### 6. (B) DB 驱动直查的流式 Promise 忘了挂 catch，最坏会发生什么？event.fetch 发起的为什么没事？
**来源**：unhandled rejection 崩服务案例的转述。

渲染开始**之前**就 reject 且无人处理的 Promise，会让 Node 进程崩在 unhandled rejection——整个服务受影响，不止这一页。官方规则：load 里经 event.fetch 发起的 Promise 由 Kit 自动挂兜底；其余（直调 ORM/驱动）必须自己标记已处理，最低配 `.catch(() => {})` + 模板 {:catch} 呈现错误。面试加分：解释为什么 noop catch 不够——吞掉异常还要把可展示的 error 塞进 resolve 值。

### 7. (C) 和 React 的 Suspense 流式（含 Next.js streaming/PPR）比，Kit 流式的单位与触发方式差异？
**来源**：跨框架流式对比题的转述。

React 以**组件**为挂起单位：任何组件内 await（use/数据钩子）触发最近的 Suspense 边界出 fallback，边界可任意嵌套、还能配合 PPR 在构建期预烘静态壳。Kit 以 **load 返回值的 Promise 键**为单位：数据层声明式分块，模板用 {#await} 给骨架，粒度天然对齐"路由数据"而不是组件树。共同哲学：快的先出、慢的到了再补；差异在"谁能挂起"——React 组件皆可、Kit 只有 server load 的 Promise 可。

### 8. (C) Svelte 模板侧要配合流式写什么？不写 pending 分支会怎样？
**来源**：模板与流式协作题的转述。

对数据里的 Promise 用 `{#await data.slow}{pending 骨架}{:then value}{内容}{:catch err}{错误}{/await}`（Svelte 5 新语法为 {#await}…{:then}…{:catch}，旧 {#await x then y} 仍可用）。不写 pending 分支：块位置先空着，resolve 后才一次性填内容——骨架屏效果消失但流式仍工作。对照记忆：这与 svelte-template 关的 #await 三叉戟是同一指令，只是这里它承担**首屏水位 UI** 的职责。

### 9. (B) 从 1.x 升 2.x 的项目里，有人抱怨"streaming 坏了"，也有人抱怨"以前没这问题现在页面报错"。两条各对应什么语义变更？
**来源**：版本迁移双向考题的转述。

"坏了"那位：1.x 顶层 return 的 Promise 会被自动 await、只有**嵌套**在对象里的 Promise 才流式；2.x 起顶层也不 await——他代码里 await 齐了才 return，行为其实一致，坏的是"以为在流式"的错觉。"现在报错"那位：2.x 里 Promise 真开始流式后，以前被自动 await 吞掉的 reject 如今裸奔到渲染阶段，暴露成页面级错误——正是补 catch/{:catch} 的时机。考点：升级日志里"顶层 Promise 不再被自动 await"这一条。

### 10. (D) 设计：文章详情页 = 秒出的正文 + 慢的评论区 + 需要登录态的"是否已点赞"按钮。用流式分层落地，指出哪些能进流、哪些不能。
**来源**：流式分层设计面试题的转述。

server load 先同步 await 点赞态之外必须前置的鉴权/重定向判断（开始流式后不能 redirect），然后返回 `{ post: await loadPost(), liked: loadLiked(), comments: loadComments() }`——后两者是流式 Promise，模板各配 {#await} 骨架。全部可进流，因为是 server load 的键。反例预警：若把 liked 放 universal load（想读 $app/state 的 session）就不流式了——要么走 server 侧 locals，要么接受重建。

### 11. (D) 运营要求"文章正文 SSR 秒出、评论纯客户端懒加载"，与流式方案对比怎么选？
**来源**：数据获取时机选型题的转述。

纯客户端懒加载（进页后组件里 fetch 评论）：HTML 更小、服务端压力后移，但评论对 SEO 不可见、有二次请求闪动。流式：评论最终仍在首响应 HTML 里（SEO 友好）、单连接无二次请求，代价是占着服务端连接与响应时长、且缓冲型平台直接退化。折中：正文流式 + 评论"可见后再加载"（action/use:enhance 类滚动触发）——面试要能说清"SEO 是否需要评论进 HTML"是这个决策的分水岭。

### 12. (B) 内网同事的页面流式偶发"骨架永远不出内容"，F12 看到 HTML 分块确实停了。给三个排查方向。
**来源**：流式卡死排障复盘题的转述。

①Promise 悬而不决：慢查询锁等待/上游超时没配，永远不 resolve——给 load 里的异步加超时竞速（Promise.race）让它 reject 进 {:catch}；②代理层把 chunked 响应缓冲到齐才转发，网络面板看似"停了"实为整块未到，直连源端口对比；③错误走了非流路径：reject 后没人 catch，Kit 无法把错误补进已开流的响应——查服务端日志的 unhandled rejection。顺序建议：先 curl 分块节奏定性（平台层 or 数据层），再下钻。

🚀 **下一组**：L3 课后作业——load 协议、server 边界与流式编排的综合复盘。

---

## 补充（新专题 13-15）

### 13.  把 DB 查询直接返回的流式 Promise 挂 .catch 之外，为什么还常挂 .finally 与计时？ 

 慢查询要暴露到监控：在 resolve/reject 链里 untrack 计时上报；catch 兜 UX，finally 收敛指标，三者都不得在链里再 throw，否则流式槽位悬挂成骨架永不落地。 

**来源**： https://svelte.dev/docs/kit/streaming 

### 14.  Kit 流式与 React 18 的 Suspense 流式在机制上的核心差异？ 

 Kit 流式的载体就是数据层的 Promise，无需组件树插桩，框架把占位注释写进 HTML 后原地替换；React 靠渲染期挂起重放组件，需要边界组件参与，两者的调试心智与产物结构完全不同。 

**来源**： https://svelte.dev/docs/kit/streaming ； https://react.dev/reference/react/Suspense 

### 15.  上线后流式页面在部分用户端变成全量就绪才出现，你的排查路径？ 

 依次查：平台是否缓冲响应（Lambda/部分网关默认缓冲）、反代 gzip 中间件未按 flush 分块（Express compression 需 threshold 或显式 flushHeaders）、CDN 关闭了流式透传；本地用 curl -N 直连源站即可定位是传输链哪一跳吞了分块。 

**来源**： https://svelte.dev/docs/kit/adapter-node#Streaming 
