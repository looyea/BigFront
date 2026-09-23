# kit-hooks-handle 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) handle 的签名与执行时机？它和 load、action 的先后关系是怎样的？
**来源**：SvelteKit 服务端中间件面试开场必考的转述。

`handle({ event, resolve })` 每条进入 SvelteKit 服务器的请求都跑（运行期与预渲染期皆然），返回 Response。它在 action 与 load **之前**执行——鉴权、塞 locals 都在此完成，之后 `resolve(event)` 才触发路由匹配、跑 action/load、渲染。resolve 永不抛错、总返回带状态码的 Response；resolve 之外的代码抛错是致命的，按 Accept 头回 JSON 或 fallback 页。

### 2. (A) 为什么说"静态资源请求不经过 handle"？预渲染期 handle 又为何会被调用？
**来源**：部署与预渲染机制结合考法的转述。

已预渲染成文件的页面和其它静态资源由托管层直接吐，不进 SvelteKit 运行时，handle 自然不触发。但预渲染**构建过程**里 Kit 会爬链接、逐个渲染路由，渲染即调用 handle 及其全部依赖（含 load）——所以别在 handle 顶层做"真发外部请求/写库"的副作用，需要排除时用 `$app/environment` 的 `building` 位判断。

### 3. (A) event.locals 的定位、生命周期与类型声明方式？
**来源**：请求上下文传递高频题的转述。

locals 是**请求级**容器：在 handle 里写、被同请求后续的 server load 与 +server.js 端点读，每个请求独立、不跨请求共享。类型靠 `src/app.d.ts` 里 `namespace App { interface Locals { user: ... } }` 声明。它是把"鉴权结果"从中间件递给路由层数据的唯一正规总线；注意 action 改了会话时 handle 不会为随后的 load 重跑，locals 需手动同步。

### 4. (A) resolve 的第二个参数能传哪些选项？分别解决什么？
**来源**：渲染定制进阶题的转述。

`ResolveOptions` 三项：①`transformPageChunk({html,done})` 对 HTML 分块做替换（注入主题 class、改写 head，done 标末块、分块不保证良构）；②`filterSerializedResponseHeaders(name,value)` 决定 event.fetch 响应哪些头被内联进 SSR 数据（默认全不放行）；③`preload({type,path})` 决定哪些 js/css/font 进 head 预加载（dev 不调用，依赖构建期分析）。

### 5. (B) 想给每个响应加一个耗时头，写完发现偶发 TypeError，为什么？
**来源**：不可变 Response 头踩坑案例的转述。

对 `Response.redirect()`、以及某些端点返回的 Response，其 headers 是**不可变**的，`response.headers.set(...)` 直接抛 TypeError。修法：改头前先 `response = response.clone()` 再操作，或避免在会返回重定向的路径上无脑加头。这是 handle 后织入里最阴的坑。

### 6. (B) 项目里既要接 Sentry、又要做鉴权、还要打日志，怎么组织多个 handle？
**来源**：中间件编排实战题的转述。

一个 hooks.server.js 只能有一个 handle 导出，用 `sequence(...)` 把多个 `Handle` 组合成一个：`export const handle = sequence(sentry.init(), auth, logging)`。顺序即洋葱序——排前面的先进、最后收尾。经验：错误监控/init 放最外、鉴权其次、日志/计时放内层靠近 resolve，保证 locals 在被下游读取前已填好。

### 7. (B) handleFetch 和 load 里的 event.fetch 是什么关系？给个"SSR 内网直连"的实例。
**来源**：服务端出网优化案例的转述。

handleFetch 拦截**服务端/预渲染执行时**由 event.fetch 发出的请求（endpoint/load/action/handle/handleError/reroute 里的都算），浏览器端 fetch 不归它。典型：把公网 `https://api.x.com/` 前缀 clone 成新 Request 换成 `http://localhost:9999/`，绕开前置代理/负载均衡，省一跳并可在头里注入内部凭据。

### 8. (C) reroute 与 redirect、与 handle 里的路径改写，三者边界在哪？
**来源**：URL 处理三兄弟对比题的转述。

reroute 在 handle 之前、跑在两端，返回**改写后的 pathname** 决定选哪条路由，**不改地址栏也不改 event.url**，被视作纯幂等函数（客户端缓存、同一 URL 只调一次），适合 i18n 别名。redirect 是真发 3xx 改变用户地址栏。handle 里 `return new Response(...)`/`redirect()` 是命令式拦截。口诀：换脑子选路由用 reroute，让用户地址栏变用 redirect，旁路整条响应自己造用 handle。

### 9. (C) server 与 client 两份 handleError 的差异？它们会被 error() 触发吗？
**来源**：错误处理跨端对比题的转述。

服务端 `HandleServerError` 入参含 RequestEvent、客户端 `HandleClientError` 的 event 是 NavigationEvent，签名不同须分别写。二者**只处理 unexpected 错误**（未捕获异常），`error()` 抛的 expected 错误不进 handleError、直接落到 page.error。返回值成为 page.error，要加字段先扩 App.Error（必含 message）；红线：handleError 自身绝不能抛。dev 下 Svelte 语法错的 error 带 frame 定位。

### 10. (C) handle 与 Express 中间件、Next middleware 的心智差异？
**来源**：跨框架中间件模型横向题的转述。

Express 是一串 `app.use` 洋葱、next() 下钻、res 可变对象；Kit 的 handle 把"下游"抽象成不可抛错的 `resolve(event)` 函数、返回**不可变优先的 Response**（改头要 clone），并用 sequence 显式组合而非全局注册。Next middleware（Edge）跑在路由匹配前、靠 matcher 配置决定作用范围、用 NextResponse 改写；Kit 的 handle 是纯代码、每条请求都进、locals 是它独有的请求级数据总线。

### 11. (D) 设计"预渲染 + 运行期混合"站点里 handle 的安全初始化策略。
**来源**：架构设计情景题的转述。

handle 里凡有外部副作用（连库、发请求、写文件）先判 `building`：预渲染期跳过或走 mock。鉴权/locals 填充在无状态可预渲染的页面应短路（这些页不该有用户态）。init（ServerInit）放一次性异步（DB 连接池），别每请求重建；浏览器端 init 保持极轻，因为其中的 await 会推迟 hydration。

### 12. (D) 要允许 load 返回一个自定义 Money 类实例并在客户端方法调用，落地方案？
**来源**：跨边界类型传输设计题的转述。

用 hooks.js 的 `transport`：`export const transport = { Money: { encode: v => v instanceof Money && [v.amount, v.currency], decode: ([a,c]) => new Money(a,c) } }`。服务端 encode 产出可序列化数组、客户端 decode 还原实例，load 与 form action 的返回值都享此通道。对比方案：放 universal load 里现场 new（不经序列化）适合无服务端数据的构造器；transport 适合"服务端产出、跨边界保真"。

🚀 **下一组**：L5 课后作业——handle 管道、locals 总线与跨端错误处理的综合复盘。

---

## 补充（新专题 13-15）

### 13.  多 handle 中间件用 sequence 组合时，洋葱序异常处理要注意什么？ 

 外层 resolve 包裹内层，任一层在 resolve 之外抛错即致命；排错时按 sequence 顺序二分定位，并给每个中间件单测其『不调 resolve 短路返回』的路径。 

**来源**： https://svelte.dev/docs/kit/hooks#Server-hooks-sequences 

### 14.  把鉴权中间件写成 handle 还是每个 server load 里检查？给出你的决策依据。 

 全站性、需覆盖端点与静态之外所有请求的放 handle（一处收口、locals 复用）；路由差异化授权贴近 load，配合分组 layout 减少重复；两层互补：handle 认证、load 授权。 

**来源**： https://svelte.dev/docs/kit/hooks#Server-hooks-handle 

### 15.  reroute、handle 里 redirect、客户端导航前 beforeNavigate 三种 URL 干预，分别适合什么？ 

 reroute 静默改写命中（URL 不变，适合 i18n 别名）；handle 里 redirect 改状态码与最终 URL（适合登录墙）；beforeNavigate 是客户端体验层拦截（未保存提示）。误用 reroute 做鉴权会破坏 404/跳转语义。 

**来源**： https://svelte.dev/docs/kit/hooks#Server-hooks-handle 
