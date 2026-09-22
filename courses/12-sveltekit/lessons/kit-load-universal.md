# universal load：+page.ts 与 +layout.ts 全解

> 目标：吃透 load 的 event 契约（url/params/route/fetch/data/parent/depends/untrack/setHeaders）、数据向下游的合并遮蔽规则、依赖追踪与失效重取协议——L1 埋的"load 是数据协议不是组件生命周期"，这一关全量兑现。

## 一、load 的形态与执行纪律

`+page.svelte` 的同胞文件 `+page.js/ts` 导出 `load`，返回值以 `data` prop 进组件；类型来自每目录生成的 `$types` 模块（`PageLoad`/`LayoutLoad`），全程类型自动推导。执行纪律三条：

1. **默认双端**：首访在 SSR 时于服务端跑、 hydration 时**在浏览器再跑一遍**（fetch 的响应从 HTML 内联数据里读，不再打网络）；此后所有客户端导航都在浏览器执行；
2. **两种例外**：`ssr = false` 时只在浏览器跑；页面若 prerender，则 load 在**构建期**执行而非运行时；
3. **不是组件生命周期**：load 与组件实例无关——重跑 load 只会更新 `data` prop，**不会重建组件**，组件内部 state 全部保留。要清状态，去 `afterNavigate` 里手动 reset，或用 `{#key}` 块强制重建。

## 二、event 契约全家桶

universal load 收到的 `LoadEvent`，按用途分四组：

| 组 | 成员 | 要点 |
|---|---|---|
| 请求描述 | `params`、`url`、`route` | `params` 由 url.pathname 与 route.id 推导；`url` 是标准 URL 对象（searchParams 可用）；**`url.hash` 在 load 里拿不到**（服务端没有它） |
| 数据通道 | `fetch`、`data`、`parent` | `data` 承载同目录 server load 的返回值（接力契约下关展开）；`parent()` 取上层数据 |
| 失效协议 | `depends`、`untrack` | 声明依赖 / 排除依赖，第四节 |
| 响应影响 | `setHeaders` | 只在服务端生效，见下 |

`setHeaders` 三条纪律：给响应设缓存头（把上游数据的 `cache-control`/`age` 透传出去是官方示例的标准姿势）；**同一 header 设两次（哪怕在不同 load 里）就是错误**；`set-cookie` 不许走它——那是 cookies API（server load 专属）的活。浏览器端执行时 `setHeaders` 静默无效果。

`parent()` 的隐藏语义：**缺失的 `+layout.js` 被视作 `({ data }) => data`**——所以哪怕某层只有 server load，universal 子层的 `parent()` 也能拿到它。注意瀑布陷阱：官方警告先发起不依赖 parent 的请求、最后再 `await parent()`，否则白排一个串行水位。

## 三、数据向下游：合并、遮蔽与反向窥视

三条规则一句话背完：

- **向下继承**：layout load 的数据对所有子 layout 与子 page 的 `data` 可见；
- **同名后者赢**：layout 返回 `{a, b}`、page 返回 `{b, c}`，页面拿到 `{a, b(新), c}`——层级由浅入深依次覆盖同名键；
- **向上反查**：父 layout 想拿子 page 的数据，用 `$app/state` 的 `page.data`（如根布局 `<title>{page.data.title}</title>`）——类型由 `App.PageData` 汇总。

`page.data` 是"倒装句"专用通道，别滥用：它意味着布局层依赖页面层数据，SSR 首帧与客户端导航两个时机下这份数据的可得性并不总是一致（比如导航中途），交互逻辑放得越深越稳。

## 四、依赖追踪：load 何时重跑、何时装死

Kit 自动追踪每个 load 的依赖，导航时**只重跑受影响的那些**。从 `/blog/a` 去 `/blog/b`：`+page.server.js`（引用了 `params.slug`）重跑，`+layout.server.js`（只查列表）不跑——列表数据还在缓存里活着。官方重跑条件清单：

1. 引用过的 `params` 属性变了；
2. 引用过的 `url` 属性（pathname/search）变了——`request.url` **不参与追踪**；
3. `url.searchParams.get('x')` 用过且 x 变了：`?x=1→?x=2` 重跑，但 `?x=1&y=1→?x=1&y=2` 不跑（**查询参数逐个独立追踪**）；
4. `await parent()` 且父 load 重跑了（子随父动）；
5. fetch/depends 声明过的 URL 被 `invalidate()` 点名；
6. `invalidateAll()` 强行全部重跑。

两个精修阀门：**`untrack(() => ...)`** 把同步调用从追踪里摘出去（如首页判断 `url.pathname === '/'` 不希望换页重跑）；追踪只认 **load 函数体内**的访问——藏在嵌套 Promise 回调里读 `params.x` 不会建立依赖（开发模式会警告你）。

## 五、手动失效：depends 与 invalidate 的握手

- universal load 里的 `fetch(url)` 自动登记依赖；**server load 不会自动依赖它 fetch 的 URL**——官方理由：防把内部请求路径泄露成客户端失效信号。手动声明用 `depends(...urls)`；
- `invalidate(url | 谓词)`（来自 `$app/navigation`）触发登记过该依赖的 load 重跑；`invalidateAll()` 无差别全量重跑；
- 自定义信号格式：`depends('app:random')` + `invalidate('app:random')`——自定义标识符必须**小写字母前缀加冒号**（URI scheme 规范），这是表单提交后精准刷新一块数据的标准打法（L4 form actions 的主角搭档）。

## 六、自检清单
- [ ] load 默认双端执行的三个时机（SSR/hydration 复用 fetch 缓存/客户端导航），以及 ssr=false 与 prerender 两个例外
- [ ] setHeaders 三条纪律与 url.hash 为什么在 load 里不可得
- [ ] 数据合并三规则：向下继承、同名后者赢、page.data 反向通道；缺失 +layout.js 的隐式转发语义
- [ ] 背出重跑条件清单，说明 searchParams 的逐参数追踪粒度
- [ ] depends/invalidate 握手机制；为什么 server load 不自动依赖 fetch 的 URL；untrack 的使用粒度限制

🚀 **下一关**：kit-server-modules——+page.server.ts 的序列化契约、$lib/server 禁区、event.fetch 的服务端超能力与 +server.ts 端点。
