# kit-server-modules 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) server load 的返回值要过什么契约？devalue 比 JSON 多支持哪些？
**来源**：数据序列化机制高频题的转述。

必须可被 devalue 序列化（跨网络送达 universal/页面）。比 JSON 多：BigInt、Date、Map、Set、RegExp、重复/循环引用。函数、类实例、组件构造器不行；自定义类型可经 transport hooks 定制收发。反面记忆点：universal load 不受此限（同侧执行），"server 能返回 Map、能返回闭包"是错一半的常见口试陷阱。

### 2. (A) +page.server.js 与 +page.js 同目录共存的完整数据流？
**来源**：两级 load 协作设计题的转述。

server load **先跑**（Node 环境、可查库）→ 返回值成为 universal load 入参的 `data` 字段 → universal 加工（可合并外部 API、实例化不可序列化对象）→ **页面只拿到 universal 的返回**，server 原始数据不直达。设计动机：把"环境敏感进、可序列化出"的闸门显式化；只为用 cookies/DB 而把已经可序列化的数据硬搬去 universal 再处理，是多余的中间层。

### 3. (A) $lib/server 目录的保护机制是约定还是执法？
**来源**：工程安全实践类面试的转述。

执法：浏览器可达代码 import src/lib/server 下模块时**构建失败**，不是 review 约定也不是 lint。所以"这个 helper 会泄漏密钥吗"的答案由目录位置担保。追问高频：泄漏链通常发生在把 server-only 逻辑放进 src/lib 根下共享文件——正确姿势是私域一律下沉 src/lib/server，公域工具才放 lib 根。

### 4. (B) SSR 时 event.fetch 请求第三方 API 一切正常，水合后浏览器里却二次请求了该 API——哪里漏了？
**来源**：双重请求排坑经典案例的转述。

内联机制只认 **event.fetch** 且响应体要经 `text/json/arrayBuffer` 读取才会被捕获；常见漏点：①load 里用了全局 fetch；②把 Response 传进不可序列化通道后又手动转；③响应在子函数里用 axios/got 之类别的实现发出。修好后水合读 HTML 内联值，网络面板应只见一次。headers 还要 `filterSerializedResponseHeaders` 才随体内联。

### 5. (B) 应用跑在 app.example.com，server load 里 event.fetch('https://api.example.com/v1/me') 期望带上会话 cookie，线上发现对方永远收到未登录。为什么？
**来源**：子域透传规则实战题的转述。

cookie 透传只覆盖**本站或更具体子域**：api.example.com 是平级子域（example.com 的下级、但不是 app.example.com 的下级），拿不到 cookie。方案三选：登录域改到公共父域（domain=.example.com）；或经 handleFetch hook 手动注入凭证头；或把该请求收进自家 +server.js 代理。别用 credentials:'include' 硬试——那时 Kit 反而一个 cookie 都不转。

### 6. (C) +server.js 端点 vs form actions vs handle hook，写/读数据的三种通道怎么选？
**来源**：架构选型对比面试题的转述。

浏览器表单直连服务端的**写**：form actions 是默认答案（渐进增强、无 JS 可用、返回自动进 form prop）；对外/跨端消费的 **API**：+server.js（标准 Request/Response、可流、可被任意客户端调用）；**横切逻辑**（鉴权、日志、改写请求）：handle hook——注意 +layout 对端点无效、+error.svelte 不接端点错误，端点的世界只有 Request→Response。三者共同构成"页面数据（load 读）+ 表单（actions 写）+ API（server 端点）+ 中间件（handle）"四通道。

### 7. (A) 端点处理函数的入参出参是什么形态？GET 之外的动词怎么触发 HEAD？
**来源**：Web API 端点基础题的转述。

导出与 HTTP 动词同名的函数（GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD），入参 RequestEvent（cookies/locals/request/url…），出参标准 `Response`（json/error/redirect 辅助可选）。没写 HEAD 但写了 GET 时，HEAD 请求自动返回 GET 响应的 content-length。抛错时 +error.svelte 不参与——按 Accept 头给 JSON 错误体或 src/error.html。

### 8. (B) 同事在 +server.js 里 import 了页面用的 zod schema，schema 文件又 import 了某个浏览器工具库，构建炸了。解释错误传染路径。
**来源**：共享模块污染类社区答疑转述。

方向反了才炸：不是"server import 客户端代码构建失败"，而是那条共享链把工具库拉进了**客户端可达**的图里——页面组件 import schema（合法，schema 同构），schema import 的"工具库"若含浏览器全局（window 直写顶层），server 侧评估时同样出事；若它含私有逻辑又恰在 lib/server 下，客户端侧被构建器拦截。治理：同构的进 lib 根、纯服务端的进 lib/server、纯浏览器的进 lib/client 类目录，共享契约文件保持零副作用。

### 9. (C) Kit 的 event.fetch 继承凭证设计，和 Next.js Route Handler 里手动转发 cookie 的做法，各有什么风险与收益？
**来源**：SSR 数据层安全对比题的转述。

Kit：SSR 期发出的内部/子域请求自动带原页面请求的 cookie/authorization——省样板且防"忘了转发登录态导致 SSR 永远未登录"的经典 bug；代价是权限边界隐蔽，须记住域名白名单规则（平级/父域不转发）与 include 的全禁语义，敏感上游要用 handleFetch 精控。Next Route Handler 什么都不自动做：手动 `headers().get('cookie')` 拼接，显式但易漏、易把 cookie 拼进日志。谈"默认值的安全性"是这题的考点。

### 10. (D) 设计：给开放平台做 /api/v1/* 一组端点，要求鉴权、限流、统一 JSON 错误体、可被预渲染页面调用。列出文件布局与每一层落点。
**来源**：API 设计场景面试题的转述。

`src/routes/api/v1/<资源>/+server.ts` 按资源分文件；鉴权+限流放 server `handle`（利用 url.pathname 前缀匹配，端点错误不走 +error 所以要自己兜）；错误体统一——各 handler 抛 `error(status, {code, message})`，handle 里封成 JSON；被自家页面调用时享受内网直达与内联（universal load 里 event.fetch 这些路径即可）；需要缓存的只读端点可在端点文件导出 `prerender = true` 烘成静态 JSON。加分点：主动说 CORS 只有 dev 白送、生产得自己发 OPTIONS。

### 11. (D) 页面需要在服务端"带着用户 cookie"调一个只有浏览器才能完成 OAuth 续期的内部服务，SSR/水合两次执行下如何保证只续一次？
**来源**：SSR+水合双执行经典坑场景化的转述。

续期逻辑放 **server load**（只在服务端跑一次，水合不重执行 server 模块——它根本不下发）；cookie 经 event.fetch 自动透传给内部服务；返回"已续期用户态"进 universal/页面。若误放 universal load，SSR 与水合各跑一次、二次请求打到 OAuth。延伸：getRequestEvent（$app/server，2.20+）可把这套鉴权链抽成无参 helper，但记住无 AsyncLocalStorage 的环境里必须同步调用。

### 12. (B) 有人把 +page.server.js 整个重命名为 +page.js 后功能"看似正常"，埋了什么雷？反向：只有 +page.js 能否读 cookie？
**来源**：文件语义迁移双向考题的转述。

正向雷：私有 env（`$env/dynamic/private`）与 DB import 在浏览器侧执行时——前者拿不到值（构建剥离），后者直接崩；本地"看似正常"多半因为 ssr 首访仍服务端跑过、且你只看了首屏。反向：universal load 没有 cookies API（那是 RequestEvent 家族的成员），想在浏览器侧带 cookie 请求只能依赖 fetch 的默认凭证行为（同源自动携带），读不到也设不了 document.cookie 以外的等价物——需要 set-cookie 就必须回到 server 侧。

🚀 **下一组**：kit-streaming 面试题——水位编排、环境陷阱与 1.x 语义迁移。

---

## 补充（新专题 13-15）

### 13.  同一个业务查询既给页面 load 用又给开放端点用，怎么复用不产生双份请求？ 

 把查询下沉到 $lib/server/service 纯函数，load 与端点各自薄封装调用；自家页面 load 直接 event.fetch 自家端点会得到缓存去重与凭证继承，但绕一跳 HTTP，取舍在于端点需要独立鉴权与限流时值得，否则直调 service 更省。 

**来源**： https://svelte.dev/docs/kit/load#Fetching-from-the-server 

### 14.  给开放平台设计 /api/v1 端点组：版本、鉴权、限流在 Kit 里怎么落？ 

 版本进路由目录（routes/api/v1/...）而非 header 魔法（Header 要兼容时也可）；鉴权在 hooks.server 按前缀统一挂 key 校验，限流用本地 Map 或 Redis 中间件放 handle 层；端点内只留业务，跨端复用靠 $lib/server。 

**来源**： https://svelte.dev/docs/kit/advanced-routing#Endpoints 

### 15.  ServerLoadEvent 相比 LoadEvent 多出的 dependencies/locals 等，对两端代码共享意味着什么纪律？ 

 用了只有服务端存在的成员（locals、cookies、platform）的代码只能放 .server 文件，否则 universal load 在客户端执行会 undefined；共享逻辑靠参数注入而非直接读 event，是防『本地正常线上崩』的结构性手段。 

**来源**： https://svelte.dev/docs/kit/types#server ； https://svelte.dev/docs/kit/load 
