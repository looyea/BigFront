# kit-load-universal 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) universal load 与 server load 的分工判据？各自返回值的物理法则？
**来源**：SvelteKit 数据层面试开场必考题的转述。

要查库/读文件/用私有 env/碰 cookies → server load（+page.server.js）；从公开外部 API 取数、或要返回不可序列化值（组件构造器）→ universal。输出契约不对称：server load 必须过 devalue 序列化（JSON + BigInt/Date/Map/Set/RegExp/循环引用）；universal 可返回任意值。同目录共存时 server 先跑，返回作为 universal 的 event.data，页面只拿 universal 的最终返回。

### 2. (A) load 在一次完整首访里到底执行几次？数据会不会重复请求？
**来源**：SSR 水合机制结合考法面试题的转述。

SSR 时服务端跑一次，hydration 时浏览器再跑一次——但 load 里经 event.fetch 发出的请求在 SSR 时被捕获内联进 HTML，水合那次直接读内联值，**不再打网络**。此后客户端导航都在浏览器跑。如果绕过 event.fetch 用全局 fetch，水合期就会出现二次请求 + 控制台警告，这就是"load 里用注入的 fetch"的由来。

### 3. (A) 布局数据与页面数据的合并规则？父布局如何反向读子页面数据？
**来源**：嵌套数据流高频题的转述。

layout load 数据向所有子 layout/page 可见；同名键**后返回者赢**（层级由浅入深覆盖）：layout {a,b} + page {b,c} → {a, b(页版), c}。父读子用 `$app/state` 的 `page.data`（如根布局设 `<title>`），类型靠 `App.PageData` 汇总——但注意这是导航中途才齐全的数据，交互逻辑别依赖它。

### 4. (A) 背出 load 重跑的完整条件清单，并说明查询参数的追踪粒度。
**来源**：官方文档总结节直接转化的面试高频题。

①引用过的 params 属性变化；②引用过的 url 属性（pathname/search）变化（request.url 不追踪）；③searchParams.get('x') 用过且 x 变（逐参数独立：y 变不触发读了 x 的 load）；④await parent() 且父重跑（子随父动）；⑤子层 await parent() 重跑且父是 server load；⑥fetch/depends 登记的 URL 被 invalidate；⑦invalidateAll。粒度惊喜点：依赖追踪只看函数体内的访问，藏在返回后 Promise 里的 params 访问不算数（dev 会警告）。

### 5. (B) 页面从 /list?a=1 导航到 /list?b=2（a 被删），读了 a 的 load 重跑吗？只读 b 的呢？
**来源**：社区依赖追踪答疑案例的转述。

读了 `searchParams.get('a')` 的 load 重跑（a 变了：1→null）；只读 b 的不因 a 变化重跑，但 b 从 null→2 对它而言是"变化"，会重跑。追踪以"被读过的键的值是否改变"为准，增删参同属改变。排错含义：列表筛选 load 反复跑？多半是多解构了没用到的 searchParams 键。

### 6. (B) 表单提交成功后想只刷新"订单列表"这一块数据，不动整页——give 出最小闭环代码思路。
**来源**：局部刷新方案设计面试题的转述。

订单列表所在 load 里 `depends('app:orders')`；提交成功的组件里 `await invalidate('app:orders')`（$app/navigation）。自定义标识符必须小写字母前缀+冒号（URI scheme 规范）。若列表数据来自 universal load 的 event.fetch，fetch 的 URL 已自动登记依赖，invalidate(该URL) 即可，连 depends 都省。对比 invalidateAll：全量重跑+闪烁，面试要能说出两者取舍。

### 7. (B) +layout.server.js 里的鉴权判断，导航到子路由时没生效——为什么？
**来源**：权限漏洞复盘类面试的转述。

依赖追踪的"善意"：从 /admin/a 去 /admin/b，layout 的 params 没变，layout load **不重跑**，旧鉴权结果被缓存复用——session 恰好在期间过期就漏了。官方给的策略分层：横切鉴权放 handle hook（load 之前、每条请求必跑）；路由专属守卫放各 +page.server.js；只有"每个子页都 await parent()"的布局才敢承担鉴权职责。这题的关键词是"layout load 不是请求级钩子"。

### 8. (C) event.fetch 与全局 fetch、与 Next.js 里直接 import 服务端函数取数，三者语义差异？
**来源**：跨框架数据获取对比高频题的转述。

event.fetch：协议兼容原生 fetch，服务端执行时继承凭证/支持相对 URL/本站端点直达 handler/响应内联供水合复用。全局 fetch 在 load 里=放弃内联协议，水合二次请求+警告。Next App Router 的"server component 直接调 async 函数查库"没有 fetch 语义（进程内调用），浏览器端换 useSWR/react-query——Kit 的 load 模型更接近"声明式的同构数据层"：一套代码两端跑，靠注入的 fetch 对齐两端数据。

### 9. (C) 为什么 url.hash 在 load 里拿不到？这条限制透露了 load 的什么本质？
**来源**：文档细节反向出题的面试变体转述。

浏览器发 HTTP 请求从不携带 # 片段，服务端渲染那次 load 物理上无从得知——官方明说 load 期间 hash 不可访问。透露的本质：load 是**请求驱动**的数据协议，不是组件挂载钩子；一切"只有浏览器才存在"的状态（hash、window、滚动位置）都不属于它的输入域。想在数据层用 hash，只能进页后在组件/`$effect` 里处理。

### 10. (D) 设计：商品详情页 = 布局级推荐位（全站共享）+ 页面级商品数据 + 每分钟刷新的库存状态。用 load 分层与失效协议落地。
**来源**：数据分层设计面试题的转述。

根/商品子树 layout load 出推荐位（params 不变就不重跑，天然缓存）；+page.server.js 查商品（依赖 params.id）；库存单独 depends('app:stock:{id}') 类自定义依赖 + 前端定时或交互时 invalidate 精准刷。要点：三档生命周期对应三层重跑粒度；库存若必须服务端权威，放 server load 再配 depends，别用组件内 setInterval 打全局 API 绕开失效协议。

### 11. (D) 电商购物车角标要全站实时：根布局 load 返回 count 的方案有什么问题？给修正版。
**来源**：全局状态与 load 边界场景题的转述。

问题三连：①根 layout load 加购后不重跑（依赖没变），角标是旧的；②客户端导航它也不重跑，缓存粘性；③强行 invalidateAll 则全页数据陪绑。修正：count 属于**客户端可推的会话状态**——放全局 store（Svelte 5 runes / state 模块），由 form action 返回值（form prop）或显式 fetch 更新；真要服务端权威，就 depends('app:cart-count') + 加购成功后 invalidate 这一个键，只重跑相关 load。面试考的是"load 不是全局状态容器"的边界感。

### 12. (B) 你写的 load 明明 await parent() 了，本地正常、线上导航后子页数据仍是旧的。列排查方向。
**来源**：缓存疑难社区答疑转述。

①确认"旧"发生在数据层还是组件层：load 重跑了但组件 state 遮蔽（组件不重建特性），{#key} 或 afterNavigate 重置可验；②parent() 是否真的在**函数体内**被 await（藏进 then 链晚于 return 就不建立父子联动）；③线上多实例 + 粘性会话问题：数据其实来自另一台机器的 prerender 缓存（prerender='auto' 的边缘命中）；④中间 CDN 缓存了整页 HTML。依赖追踪是纯客户端机制，跨实例/CDN 场景它无能为力——分清层，别错怪 load。

🚀 **下一组**：kit-server-modules 面试题——序列化契约、fetch 透传与端点边界。
