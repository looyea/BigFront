# 事故手册：Kit 高频报错读法与拆弹

> 目标：给一份能贴着读的排障谱系——"500 白屏"如何顺 handle→handleError→stderr 定位、hydration mismatch 在 Kit/Svelte 的报错长相与五类根因、load 死循环的 `invalidate` 自依赖模型、`$lib/server` 越界导入的构建期拦截、`$env` 与 load 返回值把密钥打进 bundle/HTML 的泄露路径复盘（呼应 svelte-effects-advanced 排障谱系、svelte-ssr-hydration 水合纪律）

## 一、"500 白屏"：错误在哪一层被吞

现象：页面整块白或直接 500，浏览器啥线索都没有。先分清错误发生在**哪一层**，读法完全不同：

- **`handle` 里 `resolve` 之外抛错 = 致命错误**（L5）：它不经过页面错误边界，Kit 按 `Accept` 头回 **JSON 错误**或 **`src/error.html` 兜底页**。这种"白屏/裸 JSON"多半是中间件自己炸了（读 cookie 前解构了 undefined、await 了不存在的方法）。
- **load / action 抛的未预期错误**：走 `handleError`（服务端或客户端）。`error()` 抛的预期错误**不过 `handleError`**、原样进 `page.error`（L4）。
- **渲染期抛错**：由最近的上层 `+error.svelte` 接住；根 layout 自己的错落到 `src/error.html`。

定位三板斧：① 看**服务端 stderr**（`node build` 控制台/容器日志），未预期错误栈基本都在这；② 在 `handleError` 里 `console.error(error, event)` 打点，把 `event.url`、`event.route?.id`、`locals` 摘要带上；③ 白屏且是 dev 时先排除"其实是抛错被某处 `try/catch` 吞了"——**别 catch 住 `error()`/`redirect()` 抛出的东西**，要 catch 就用 `isHttpError(e)`/`isRedirect(e)` 判出后**原样重抛**，否则 SvelteKit 拿不到控制流（L4）。

## 二、hydration mismatch：SSR 吐的 HTML 和客户端首帧不一致

Kit 默认 SSR 出 HTML，浏览器再水合。若"服务端渲染结果"与"客户端首次渲染结果"对不上，控制台会甩 `Hydration failed — the server rendered HTML didn't match the client...` 或 `did not find expected node` 之类，轻则错位、重则整棵子树推倒重渲。五类高频根因：

1. **非确定性值**：`Date.now()`、`Math.random()`、`new Date()` 格式化到"当前时刻"、`Intl` 时区差异——服务端与客户端天然算不同。→ 把这类值放到 `$effect`/`onMount` 里再算，或由 load 传一个服务端定好的值。
2. **`if (browser)` 决定首帧渲染不同结构**：SSR 时 `browser===false` 渲 A、水合渲 B，直接对不上。→ 别用 `browser` 切**首帧标记**，改"两端渲同一结构、内容在 `$effect` 里填充"，或用 `{#await}`/占位。
3. **非法 HTML 嵌套被浏览器解析器"修正"**：`<p>` 里套 `<div>`、`<table>` 结构不合法，浏览器把 DOM 改了样，水合比对就崩。→ 修标记合法性。
4. **load 数据两端不一致**：SSR 用一份、水合又发一次 fetch 拿到不同结果。→ Kit 已把 SSR 期 `event.fetch` 的响应内联进 HTML、水合时从 HTML 读（L3），别绕过它另发请求。
5. **context/state 在深层页更新**：SSR 时深层组件改了 context，上层已渲完不受影响，客户端却会向上冒——水合期"闪"一下（状态管理文档明说）。→ 状态**往下传**别指望往上。

> 注：`@html`、`{#each}` 顺序不稳定、组件 key 缺失导致的重排，也常表现为水合错乱——先稳定 key。

## 三、load 死循环：`invalidate` 自己依赖的 URL

典型：某 load 里 `await fetch('/api/x')` 或直接 `depends('data:x')`，**同一个 load 末尾又 `invalidate('/api/x')`/`invalidate('data:x')`**。因为 `invalidate` 的语义是"让依赖该资源的所有 load 重跑"——你把它自己依赖的资源标脏，它就再跑、再标脏……**无限循环**，页面卡死或 `Maximum call depth` / 请求风暴。

拆法：

- `invalidate` 只该在**变更之后**由调用方触发——**action 成功后 Kit 已自动重跑 load**（L4），或放 `afterNavigate`/事件回调里手动刷；**不要在 load 内部 invalidate 自己依赖的东西**。
- 需要"刷新"用**稳定的自定义 key**：`depends('custom:foo')` 与外部 `invalidate('custom:foo')` 用同一 `^[a-z]+:` 前缀串，别和 fetch 的 URL 撞车。
- `invalidateAll()` 同理不要出现在 load 里。
- 另一个隐性自依赖：load 里读 `page.url.searchParams`（或某 store）又因它变化被重触发，形成环——检查依赖声明是否把"自己产生的变化"也算进去了。

## 四、`$lib/server` 越界导入：构建期就给你拦下

把 `$lib/server/db.js`、含密钥的模块 import 进了 `+page.svelte`、`+layout.js`（universal，两端跑）等**客户端可达**的代码——**构建直接失败**：`Cannot import $lib/server/... into client-side code`（types 文档确证，server-only modules 机制）。这是特性不是 bug：Kit 用目录约定替你划了服务端/客户端的硬边界。

正解不是"想办法绕过去"，而是**换通道**：服务端能力只在 `+page.server.js`/`+server.js`/`handle` 里用，需要给组件的数据经 server load `return`（会被序列化下发），需要动作走 action/endpoint。若某工具"服务端为主、客户端也要用"，拆开——共享的纯逻辑放普通 `$lib`，I/O+密钥部分单独放 `$lib/server`。

## 五、密钥打进 bundle / HTML：`$env` 与 load 的两条泄露路

排障谱系里最贵的一类是**安全事故**，两条典型路径必须刻进脑子：

1. **`$env` 用错模块**：`$env/static/*` 在构建期被**静态替换成字面量烤进产物**（L8/测试关），`$env/*/private` **禁止被客户端代码 import（构建即报错，就是上面那条防呆）**。真正的泄露往往是你**绕过了防呆**：把一个本应私密的值配成 `PUBLIC_` 前缀（于是进了 `$env/static/public`、被编进客户端 bundle），或直接用 `import.meta.env`/Vite `define` 把密钥注入前端。记住矩阵：**只有 `public` 那两个模块的值可以给浏览器**，私密的永远留在服务端。
2. **load 返回值会被序列化到浏览器**：`+page.server.js` 的 load `return` 的东西、以及 universal load 的返回，最终都成为 `page.data` 发到前端。**别把整条数据库记录（含 `passwordHash`、内部 id、token）原样 return**——只 return 前端真要展示的字段。把密钥塞进 `locals`/在 server load 内部使用而不返回，才是安全位。

复盘口诀：**"进不进 bundle 看是不是 public、进不进 HTML 看是不是 load 返回"**。凡这两条路径上的值，默认按"用户能看见"对待。

## 六、其它常踩（速查）

- **`./$types` 一片红**：tsconfig 没 `extends` `.svelte-kit/tsconfig.json`，或没先跑 `vite prepare`/`dev` 生成产物（L8 类型关）。
- **`event.cookies` 在 universal load 里 undefined**：cookies API 只在**服务端**有（L5），要动 cookie 去 `+page.server.js`/`handle`/action。
- **action 后登录态没变**：删 cookie 后 action 只重跑 load、**不重跑 handle**，`locals.user` 是上一次值——手动 `event.locals.user = null`（L4 登出两件套）。
- **预渲染页读了 `searchParams` 构建报错**：预渲染期无 query（L6），改法两条：客户端读，或转动态 SSR。
- **`redirect`/`error` 不生效**：十有八九是被外层 `try/catch` 吞了没重抛（见第一节）。

## 七、自检清单

1. 说出 `handle` 里 `resolve` 之外抛错、load 未预期抛错、`error()` 预期抛错三者分别落到哪里、走不走 `handleError`。
2. 列 hydration mismatch 的五类根因，各配一个修法；为什么不能用 `if (browser)` 切首帧标记。
3. 解释 load 内 `invalidate` 自己 fetch/depends 的资源为何致死循环，`invalidate` 的正确触发时机与自定义 key 写法。
4. `$lib/server` 被客户端 import 会发生什么、为什么这是防呆、正确换通道的三条路径。
5. 复述"密钥泄露两问"：一个值会不会进 bundle 取决于什么、会不会进 HTML 取决于什么，各自的安全写法。

🚀 **下一站 L9**：kit-internals——构建期 nodes/matchers manifest、resolve 的匹配-加载-渲染流水线、SSR 时 `render()` 的调用位点、客户端导航为何是"load + 局部重渲"。
