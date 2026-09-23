# 服务端函数与数据变更 · 面试题

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) "use server" 指令在编译层到底做了什么？

它是服务端函数编译器的 directive：函数级放体首行、文件级放文件首行。客户端构建里被转换的引用变成"经客户端运行时发起的远程调用"，SSR/server-function 构建里走服务端运行时，合格模块进入服务端函数 manifest。不需要任何 import。
**来源**：官方 use-server 参考页 Behavior 一节转述。

### 2. (A) 服务端函数的参数和返回值怎么跨端传输？哪些类型免费可用？

序列化搬运，模式二选一：json（客户端 JSON.parse、严格 CSP 友好、载荷略大）与 js（Seroval 更小更快、但要 unsafe-eval）。v1 默认 js、v2 默认 json。默认插件集支持 FormData/Headers/Request/Response/URL/URLSearchParams/AbortSignal/Event 等 web 类型。
**来源**：官方 defineConfig 页 Serialization 一节转述。

### 3. (A) 解释 single-flight mutation 解决的问题与机制。

常规"改完拉新"要两个 HTTP 请求。Single-flight：表单 POST 一个请求上去，action 完成后框架自动 revalidate 相关 query——因该 query 已被 preload，服务端可把重校验结果**流进同一个响应**返回，两跳压成一跳。
**来源**：官方 data-mutation 页 Single-flight mutations 小节转述。

### 4. (B) 你的同事的 mutation 没走成 single-flight，按官方口径查哪两点？

① action 是否真的是服务端函数中执行（"use server" 在场）；② 被它改的数据是否被 preload——若 action 会 redirect，预加载要放在**目标页**而不是当前页。两点缺一即退回双请求。
**来源**：官方列出的两个生效前提反推的排坑题转述。

### 5. (B) 把 API 密钥写进 query 函数就安全了吗？

不——除非函数体首行有 `"use server"`（或文件级指令），否则函数按调用侧代码处理。官方范式是 query + "use server" 直取 session/DB：整段逻辑只在服务端运行，客户端只有调用入口。review 时把这行当安全红线。
**来源**：官方"Keep the data function on the server"与 actions 示例的安全边界转述。

### 6. (C) 表单写数据：action + `<form action={...}>` 和 onClick 里调服务端函数，选哪个？

纯表单提交选前者：官方形态就是 `action(...)` 配 `action.with(id)` 绑 form、method=post，天然吃到 single-flight 与 redirect(throw) 语义；命令式调用适合非表单动作。两条路底层同为服务端函数，差别在"由浏览器原生提交驱动"还是"由代码驱动"。
**来源**：官方 data-mutation 登出/改商品两例的组合转述。

### 7. (C) 和 Next.js 的 Server Actions 相比，SolidStart 的动作层有什么不同？

同有 "use server" 指令传统；SolidStart 侧动作是 Solid Router 的 **action** 原语套服务端函数，且把"改后自动重校验 + 同响应流回"命名为 single-flight mutation 的显式特性（前提：preload）。边界同样落在函数而非组件树。
**来源**：Next 迁移社区讨论中两框架动作层对比的高频论题转述。

### 8. (D) 设计"商品详情页改名"全链路（一个请求完成改+刷新展示）。

query getProduct("product") + route.preload 预热；action updateProduct（"use server"，从 FormData 取 name 写库）；表单 `<form action={updateProduct.with(id)} method="post">`。提交后自动 revalidate getProduct，新名字随同一响应流回、响应式更新 DOM。
**来源**：官方 ProductDetail 完整示例的场景化转述。

### 9. (A) action 里怎么跳转？为什么是 throw？

`throw redirect("/")`——redirect 是控制流信号，用 throw 穿透 action 的执行路径交给路由层处理，官方登出示例即此形态。return 一个 redirect 是不生效的写法陷阱。
**来源**：官方 logoutAction 示例的 throw redirect 惯用法转述。

### 10. (B) 服务端函数里 window is not defined 正常吗？该拿什么？

正常——它跑在服务端。要请求上下文用 `getRequestEvent()`（headers/url 等），要函数自身元信息用 `getServerFunctionMeta()`。需要浏览器才有的东西请挪回客户端代码。
**来源**：官方 middleware/server 参考页 getRequestEvent 用法转述。

### 11. (D) 严 CSP 的金融后台项目，序列化配置怎么定？代价是什么？

选 `serialization.mode: "json"`（v2 本就默认）——不依赖 eval；代价是载荷略大。反过来若追求载荷与性能用 js 模式，就得给 CSP 开 unsafe-eval，合规上通常不可接受。这是一次"性能 vs 安全策略"的显式取舍。
**来源**：官方 json/js 模式权衡叙述的场景化转述。

### 12. (C) query、action、API 路由三种服务端入口，各给一个最适场景。

query：页面渲染要读的数据（带缓存键、可 preload，如账户信息）；action：由用户提交驱动的状态变更（登出、改名、下单）；API 路由：给**外部 HTTP 客户端**消费的端点（REST/GraphQL/tRPC，官方 api-routes 页的定位）。三者共享同一套指令与序列化机制。
**来源**：官方 data-mutation 与 api-routes 页的分工叙述转述。
