# 服务端专属模块：+page.server.ts 与 +server.ts

> 目标：建立"私有领土"心智——server load 的 devalue 序列化契约、两级 load 的接力全貌、$lib/server 编译期禁区、event.fetch 的服务端超能力，以及 +server.ts 作为一等公民 API 端点的完整形态（呼应 svelte-ssr-hydration、next-route-handlers）。

## 一、什么逼你换成 server load

三件事任何一件成立，load 就得搬进 `+page.server.js/ts`（类型从 `PageLoad` 换 `PageServerLoad`）：直接查数据库/读文件系统、用私有环境变量（`$env/dynamic/private` 那族）、碰 cookies/locals。ServerLoadEvent 在此前所有字段之上追加服务端专属成员：`cookies`（get/set，set 走标准序列化选项）、`locals`（handle hook 塞进来的请求级数据）、`request`（原始 Request）、`platform`（适配器注入的环境上下文）、`clientAddress`。

**运行时机**：server load 永远只在服务端；客户端导航时 Kit 会向服务端发一次数据请求拿它的返回值——所以这条链路上代码根本没离开过服务器，这正是"私有"的含义。

## 二、devalue 序列化契约（server load 的物理法则）

server load 的返回值要跨网络边界，**必须能被 devalue 序列化**：JSON 能表达的一切 + `BigInt`/`Date`/`Map`/`Set`/`RegExp` + 重复引用与循环引用。函数、类实例、Svelte 组件构造器——不行；自定义类型的收发可以走 transport hooks 定制。对比之下 universal load 可以返回任意值（比如组件构造器），因为它和组件同侧执行。

**同目录共存接力**（L1 契约的完整展开）：`+page.server.js` 与 `+page.js` 并存时，**server load 先跑**，返回值成为 universal load 入参的 `data` 字段；页面最终拿到的只有 universal 的返回——server 的原始数据**不直达页面**。典型用法：服务端环境敏感数据进（DB 句柄、私有 env）、可加工的可序列化结果出。rare 但官方点名的场景：要用服务端数据初始化一个不可序列化的类实例，就必须两级齐上。

## 三、$lib/server：编译期划出的禁区

`src/lib/server/**` 是约定俗成的私有区：**浏览器侧代码一旦 import 到它，构建直接报错**，不是 lint 提醒而是打包器执法。这个机制让"这文件会不会泄漏到客户端"不需要人肉记忆——放对目录就安全。配套习惯：私有 env 的读取、DB client、密钥运算全部下沉到 `src/lib/server/`，路由文件只做编排。

## 四、event.fetch：长得像 fetch 的透传代理

load 里解构出的 `fetch` 与浏览器原生 fetch 行为一致，但服务端执行时多了五层超能力：

1. **凭证继承**：自动带上页面请求的 `cookie` 与 `authorization` 头，可以发"带登录态"的服务端请求；
2. **相对 URL**：服务端上下文也能 `fetch('/api/x')`（原生 fetch 要求绝对地址）;
3. **内网直连**：请求自家 `+server.js` 路由时**直接调用处理函数**，不走一圈 HTTP；
4. **SSR 响应内联**：响应体在渲染时被捕获、内联进 HTML（挂接 `text/json/arrayBuffer` 的读取）；水合时直接从 HTML 读——**一致且省一次网络**。响应头默认不序列化，需要时在配置里开 `filterSerializedResponseHeaders`；
5. **hydration 读缓存**：如果你绕过 event.fetch 用全局 fetch，水合期会看到控制台警告+数据不一致，这就是官方给"load 里必须用注入的 fetch"的理由。

**cookies 透传的域名规则**是隐藏考点：只有目标主机与本应用**同名或更具体的子域**才转发 cookie——应用服务 `my.domain.com` 时，`my.domain.com`、`sub.my.domain.com` 收得到；`domain.com`、`api.domain.com` 收不到。且当请求显式 `credentials: 'include'` 时，其余 cookie 一律不转发（服务端拿不到浏览器"哪个 cookie 属于哪个域"的信息，不敢瞎转）——要精细控制得上 `handleFetch` hook。

## 五、+server.ts：API 端点全形态

不渲染页面、只回数据的 `src/routes/api/xxx/+server.js`，导出与 HTTP 动词同名的函数（`GET/POST/PATCH/PUT/DELETE/OPTIONS/HEAD`），入参 RequestEvent、出参标准 `Response`。要点清单：

- `json(data, init)` 辅助函数一键出 JSON（自动补 Content-Type/Content-Length）；`error`/`redirect` 也能 throw 进响应链；
- **流式响应**：`new Response(ReadableStream)` 合法——大流量导出、SSE 都这么写（Lambda 类缓冲型平台除外）；
- 错误行为与页面不同：**+error.svelte 不参与**，抛错按 Accept 头返回 JSON 错误体或 `src/error.html` 兜底页；
- `+layout` 对 `+server.js` 无效——要统一拦截逻辑去 server `handle` hook（L5 主角）；
- GET 存在时，HEAD 请求自动返回其响应的 content-length；Vite 开发期会给端点注入 CORS 头，生产没有——别拿 dev 行为当契约；
- 页面开关里 **prerender 对 +server.js 直接适用**（构建期把端点响应烘成静态文件，还会继承 fetch 它的页面默认值），`trailingSlash` 也可在端点文件导出；ssr/csr 则是对 HTML 渲染过程的开关，对纯数据端点无意义。

一句分工：表单从浏览器写数据进服务端，**form actions 是默认答案**（L4），+server.ts 留给真正的对外 API/非 HTML 消费者（呼应 next-route-handlers 的双轨格局）。另知悉即可：新版 Kit 文档已出现 experimental 的 remote functions 机制，契约未稳定，本课程不纳入考纲。

## 六、自检清单
- [ ] server load 的三种入选理由与 ServerLoadEvent 追加的专属成员清单
- [ ] devalue 契约允许/拒绝哪些类型；两级 load 共存的接力方向与"server 不直达页面"
- [ ] $lib/server 靠什么机制保护私域——lint 还是构建器？
- [ ] event.fetch 相对全局 fetch 的五层超能力 + cookie 透传的域名规则四条 + include 的盲区
- [ ] +server.ts 的错误呈现链、+layout 无效的原因、prerender 为何是端点唯一适用的页面开关

🚀 **下一关**：kit-streaming——把 Promise 塞进 data：SSR 分段输出的时机控制、骨架层编排与流式的五个环境陷阱。
