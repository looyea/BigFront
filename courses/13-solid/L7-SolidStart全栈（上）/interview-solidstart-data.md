# SolidStart 数据加载 · 面试题

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 描述 v2 数据加载两件套的完整链路。

`query(asyncFn, "key")` 定义一个**带具名缓存的数据访问**；路由组件里 `createAsync(() => fn(args))` 订阅其结果、返回响应式访问器；异步边界交给 Suspense。缓存失效与高级行为由 Solid Router 负责。
**来源**：v2 data-fetching「Basic query usage」与收尾说明转述。

### 2. (A) query 的第二个参数（缓存键）到底影响什么？

它是这份查询的身份：同键的调用共享/命中同一缓存——所以 route.preload 提前发的请求和组件里 createAsync 的消费能接上同一份结果，而不是各拉各的。
**来源**：v2 文档 query 具名缓存 + preload 示例的组合叙述转述。

### 3. (A) "use server" 指令放在 query 函数体首行，编译层面发生了什么变化？

该函数体被钉在**只在服务端按需运行**，客户端拿到的是调用入口；因此函数里可以直接 `useSession`、读 `process.env`、摸数据库。不加指令，函数就按普通代码在调用侧跑——这是能否触碰服务端资源的水岭。
**来源**：v2「Keep the data function on the server」一节转述。

### 4. (B) 同事写数据查询拿数据库连接串很自然，你 review 时盯哪一行？

盯函数体首行的 `"use server"`：有它，密钥/连接串只活与服务端；没有它，这段代码按调用侧执行，敏感逻辑就有下发到客户端的风险。这一行在 Start 里应当作安全红线审查。
**来源**：官方"把数据函数留在服务端"动机反推的 review 实践转述。

### 5. (C) createResource 和 query + createAsync 分属什么层次？各在什么时候用？

Resource 是 Solid 运行时的异步原语（组件作用域内把 promise 变响应式信号、带 loading/error 状态）；query/createAsync 是**框架层**方案，多了具名缓存跨处共享、route.preload 预热、"use server" 服务端执行。路由页取数优先后者，组件内一次性的本地异步仍可用 Resource。
**来源**：Solid reactivity 文档与 Start v2 数据文档的层次对比转述。

### 6. (D) 详情页从列表点进去总要等 300ms 白一下，用框架能力怎么治？

三板斧：① 路由文件导出 `route.preload`，在导航前把 `getPost(params.id)` 热进缓存；② 消费端 createAsync 直接接果；③ 未就绪时用就近 `<Suspense fallback>` 给骨架屏而非全局白。通常 ① 就把体感等待吃掉了大半。
**来源**：v2 preload 例子 + Suspense 就近策略组合的场景题转述。

### 7. (B) 参数换了页面数据却不换，你怀疑什么？

先确认查询函数的参数真的传进了 query 调用（`getPost(props.params.id)`），再核缓存键语义——是否命中了旧参数的缓存。参数化查询的去重/失效归 Solid Router 管，别自己脑补，查 Router 的 query 参考确认底层语义。
**来源**：v2 文档"高级 query 行为看 Solid Router"的排坑化转述。

### 8. (A) v2 例子里路由组件怎么拿 URL 动态参数？两种途径都说一下。

声明式渲染路径用 **props.params**（例子：`PostPage(props: { params: { id: string } })`）；命令式读取用 `useParams()`（routing 页的 UserPage 例子）。前者直接喂给 query，后者适合非 props 场景。
**来源**：v2 routing/data-fetching 与 useParams 例子的对照转述。

### 9. (C) 和 Next.js App Router 的 Server Components/RSC 相比，Start 的路由数据模型有什么不同？

Start 没有 RSC 概念：路由组件仍是完整 Solid 组件（两端同构渲染），数据获取走 query + "use server" 的显式 RPC 边界；"哪段代码在服务端跑"由指令逐函数标注，而不是由文件类型（server component）划分组件树。心智差异：边界在"函数"，不在"组件树"。
**来源**：Solid vs Next 数据架构对比在社区讨论中的高频论题转述。

### 10. (D) 给"账户页显示当前登录用户"设计数据层（要求 session 密钥绝不下发）。

`getCurrentUser = query(async () => { "use server"; const s = await useSession<{userId?:string}>({password: process.env.SESSION_SECRET, name:"session"}); return {userId: s.data.userId ?? null}; }, "currentUser")`；组件里 `const user = createAsync(() => getCurrentUser())` 渲染。密钥只存在于服务端函数体内。
**来源**：v2 文档 useSession 官方示例的场景化转述。

### 11. (B) 有人把 createAsync 的返回值直接解构 `const { title } = posts()`，可能踩到什么？

posts() 在解析完成前不是最终对象——直接解构要么拿到 undefined 抛错，要么把"当时快照"拿出来丢掉响应式。正确做法：Suspense 兜住未就绪期、就绪后经 `<For>`/属性惰性读取消费，别提前解构。
**来源**：异步数据 + L4「不解构、不提前求值」纪律叠加出的常见坑转述。

### 12. (C) route.preload 和把 fetch 写在组件 onMount 里，网络瀑布有什么结构差异？

preload 在**导航发生前/发生中**就把请求发出，数据与组件 chunk 下载并行、且结果进具名缓存可被组件直接接用；onMount 里 fetch 必须等组件挂载渲染完才开始，形成"渲染→取数→再渲染"的瀑布。官方数据层的默认姿势就是让取数脱离组件生命周期。
**来源**：v2 preload 语义与传统 mount 取数模式的对比转述。
