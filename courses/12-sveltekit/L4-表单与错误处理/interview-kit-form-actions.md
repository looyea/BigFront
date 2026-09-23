# kit-form-actions 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) Form Actions 为什么只接受 POST？GET 表单去了哪里？
**来源**：HTML 语义与框架设计题的转述。

GET 按 HTTP 语义不应有副作用，所以 actions 一律 POST（官方 JSDoc 原话）。`method="GET"`（或干脆不写）的表单不会被废弃而是换了赛道：Kit 把它视同 `<a>` 走客户端路由，提交即导航到 `/search?q=...` 并触发 load，不碰任何 action；data-sveltekit-reload/replacestate/keepfocus/noscroll 在 form 上同样有效。这设计让"搜索框用 form 写"成为正统而非 hack。

### 2. (A) default 与具名 action 为什么互斥？推演一遍事故链。
**来源**：路由寻址细节高频题的转述。

具名 action 靠查询参数 `?/register` 寻址；POST 成功后若不重定向，这个查询参数会**留在 URL 里**。此时同页 default 的下一次 POST（表单 action 属性缺省指向当前 URL）就被残留参数劫持，悄悄进了 register——写操作走错通道 yet 状态码 200 毫无察觉。官方选择釜底抽薪：两种形态不允许共存。加分：formaction 按钮级改道有同样残留问题，所以成功路径常配 redirect(303) 清 URL。

### 3. (A) action 返回值的完整旅程：从 return 到模板亮绿灯。
**来源**：数据流闭环设计题的转述。

返回值（须 JSON 可序列化，devalue 口径）→ 页面 `form` prop + `$app/state` 的 `page.form`（全局可见直到下次更新）→ 模板 `{#if form?.success}` 呈现。同时 `page.status` 反映 fail() 的状态码。官方两条细节：这条消息是**短暂的**（刷新即失，它只因本次提交存在）；一页多 form 时结构自由，惯例塞 `id` 键认领。意外错误与 redirect 会中断这趟旅程，分别走 +error 边界与 goto。

### 4. (B) 登录 action 里 set 了 session cookie，但紧接着 load 读 `cookies.get('sessionid')` 是 undefined——哪里断了？
**来源**：cookies 时序社区答疑转述。

没断——`cookies.set` 的 JSDoc 明说设完**本次请求内** cookies.get 立即可读到（还同步进 set-cookie 头）。真凶通常在另一头：handle 早于 action 跑且**不为后续 load 重跑**，如果 load 依赖的是 `event.locals.user`（handle 从旧 cookie 解出的），action 换了 cookie 但 locals 还是旧值。修法即官方 logout 示例两件套：动 cookie 的同时手动同步 `event.locals.user = ...`。

### 5. (B) 无 JS 环境下 use:enhance 的六件默认事一件都不会发生，用户看到的世界是什么样？这套设计的名字叫什么？
**来源**：渐进增强哲学必考题的转述。

无 JS 时走浏览器原生 POST → 整页服务端重渲染：form prop 数据、load 新数据、错误回显全都在（这些都是服务端渲出来的），代价是每次提交一次全页刷新、滚动位置与焦点丢失。这套"先保证能用再保证好用"的设计就叫渐进增强（progressive enhancement）：actions 的正确性**不依赖** JS，enhance 只是把整页刷新升级成局部更新。反义陷阱：先写 fetch 提交再补 no-JS 兜底叫"优雅降级"，方向相反，Kit 站前者。

### 6. (B) 用了 use:enhance 加自定义回调后，invalidateAll 不跑了、表单也不清空了。为什么？两种找回方式？
**来源**：enhance 覆盖规则排坑题的转述。

官方规则：前置函数一旦**返回回调**，就整体覆盖默认提交后逻辑（六件套全没）。找回：①回调里调 `update()`（还接受 `{ invalidateAll, reset }` 微调）；②对 result 调 `applyAction(result)`——它按 type 分发（success/failure 写 status+form 且**不分页**、redirect 走 goto+invalidateAll、error 渲最近边界），是跨页提交场景的正解（update 只保同页语义）。

### 7. (B) 同目录既有 +page.server.js（带 actions）又有 +server.js（带 POST）。组件里 fetch 同一 URL 提交，action 从没被调用。为什么？怎么救？
**来源**：路由优先级社区答疑转述。

fetch 请求默认被路由到 **+server.js 端点**（URL 撞车时端点优先于 action）。加请求头 `x-sveltekit-action: 'true'` 显式声明投 action。这题的延伸考点是概念分层：同一路径上"页面（load/actions/组件）"与"资源端点（RESTful）"是两套语义，混放可以但路由要自己理清楚。

### 8. (C) Kit Form Actions vs Next.js Server Actions：同叫 action，差在哪三层？
**来源**：跨框架对比高频题的转述。

①**协议**：Kit 保留 HTTP 表单原生语义（POST + FormData + 303，无 JS 直接可用）；Next 是 RSC 私有调用协议（加密 ID 编进行为里，无 JS 时只能靠 `form action` + server action 的兜底路径，渐进增强支持晚且弱）。②**返回值去向**：Kit 进 form prop 由你渲染；Next 靠 revalidatePath/router.refresh 隐式刷新 RSC 缓存。③**失败通道**：Kit 用 fail() 显式带状态码带数据；Next 用 throw 后 `useActionState` 接 error 对象。一句话定调：Kit 是"表单进化"，Next 是"RPC 收编"。

### 9. (D) 设计"评论提交"表单：无 JS 可提交、有 JS 不刷新、成功后只刷评论列表、失败保留已输入内容并把焦点送回文本框。给出各环节落点。
**来源**：表单全链路设计面试题的转述。

+page.server.js 具名 action（只有 create，default 让位）：解析 FormData → zod 校验 → `fail(400, { input: { body }, errors })` 或 `{ success: true }`。模板：`<form method="POST" action="?/create" use:enhance={...}>`，回调里 result.type==='success' 时 `invalidate('app:comments')`（评论 load 用 depends 登记）替代全量 invalidateAll；textarea 绑 `value={form?.input?.body ?? ''}` 回显；回调里 requestAnimationFrame 后 focus 到 textarea。无 JS 兜底：一切回显本来就在服务端渲染里。加分点：说出"为什么这里具名而非 default"（防 2 题的残留链 + 语义自明）。

### 10. (D) 提交按钮要防双击重复下单，同时保留"原生提交时按钮自然失效"的体验。给两层方案。
**来源**：表单交互健壮性场景题的转述。

无 JS 层：`<button>` 的 disabled 不能用（会不提交 name/value），社区惯用 form 提交后原生行为就是禁用态视觉——真正防重要靠服务端幂等（订单号唯一键/去重表），这是面试必答的底线。有 JS 层：use:enhance 前置函数里 `pending = true` 置灰按钮、回调里灭灯 update()；或 2.12+ 直接读 `$app/state` 的 `form.pending`（老 store 写法 `$form.pending`）绑 disabled。两层合讲才完整：前端防抖是体验，服务端幂等才是正确性。

### 11. (B) 同事的 action 返回 `{ user: dbRow }`，浏览器里 form.user 是 undefined 且 dev 有序列化告警。列三个可能死因。
**来源**：action 返回值排坑三连的转述。

①dbRow 含驱动私有句柄/类实例（如 Prisma 的 Decimal、Date 的某些子类），devalue 还原后变形或告警；②更常见：返回了 **Promise**——action 的返回值不像 server load 那样享有流式特权，未 await 的 Promise 到了客户端早已不是你要的形状，`await` 它；③跨页提交：`<form action="/other">` 投别页 action，本页 form prop 按规则**不更新**（enhance 第 1 件默认事的同页限制），误以为数据丢了。排查顺序：先看网络响应体有没有数据（区分服务端没给 vs 客户端没接）。

### 12. (A) `use:enhance` 挂在不满足条件的表单上会怎样？把报错条件背全。
**来源**：API 边界记忆题的转述。

两个硬条件缺一即**运行时报错**（官方明说）：method 必须是 POST（不写 method 默认 GET，也中招）、目标必须是 +page.server.js 里的 actions（指向 +server.js 端点的路径不行）。它不能救 GET 表单——那类表单本来就不需要 enhance（客户端路由已经无刷行了）。这题顺带考古术语混战：官方文档自嘲 "the enhance action and `<form action>` are both called 'action'. These docs are action-packed"——答题时区分清楚 action(表单提交函数) / action(directive, use:xxx) / form action 属性三义。

🚀 **下一组**：kit-form-validation 面试题——双端校验分工、FormData 整形与 superForms 生态。
