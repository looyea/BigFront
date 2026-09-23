# exp-view 面试题精选

> 共 15 题，覆盖 **模板引擎原理 / EJS / 布局 / 安全 / SSR / 缓存 / 选型** 七类。

---

## 一、模板引擎原理

### 1. Express 是如何做到"支持任意模板引擎"的？

通过两个约定：① `app.set('view engine', ext)` 指定默认扩展；② `app.engine(ext, callback)` 注册引擎适配器，callback 签名 `(filePath, options, cb)` 最终 `cb(null, htmlString)`。`res.render` 找到对应引擎函数编译模板并把返回的 HTML 作为响应体发出。consolidate.js 为几十种引擎预写了统一适配器。

**来源**：Express API — "app.engine()" / "res.render()"; consolidate.js GitHub README; Express — "Using template engines"

### 2. res.render 内部做了哪些事？如果模板文件不存在会怎样？

解析视图路径（相对 views 目录 + 补扩展名）→ 调注册的引擎编译 + 注入 locals/options → 得到 HTML → 自动 `res.send`（Content-Type: text/html，状态 200）。文件不存在 → 引擎抛错 → 传给错误中间件（Errno ENOENT / "Failed to lookup view"）。可传回调自行处理错误。

**来源**：Express — "res.render error handling"; Express source — "lib/view.js"; StackOverflow — "Failed to lookup view"

---

## 二、EJS

### 3. EJS 的 `<%= %>`、`<%- %>`、`<% %>`、`<%# %>` 分别是什么？

`<%= %>` 输出表达式结果并 HTML 转义；`<%- %>` 输出原始值不转义（用于可信 HTML 片段/include）；`<% %>` 执行 JS 控制流不输出（if/for）；`<%# %>` 模板注释（不输出到结果）。默认优先 `<%= %>` 防 XSS。

**来源**：EJS 官方文档 — "Tags / Control flow / comments"; MDN — "HTML escaping"

### 4. EJS 里 include 和 layout 有什么区别？

include = 把子模板渲染后字符串嵌入当前位置（组合，父子结构相同层级）；layout = 页面只提供"内容"，由外层布局提供 head/nav/footer（继承，反转控制）。EJS 原生只有 include，layout 需 express-ejs-layouts 通过 `<%- body %>` 占位实现。

**来源**：EJS — "includes"; express-ejs-layouts README — "Defining custom script/html blocks"; DRY — "composition vs inheritance"

---

## 三、安全

### 5. 模板引擎最常见的安全漏洞是什么？如何防？

**XSS（跨站脚本）**——把用户可控内容用不转义方式输出（EJS `<%- %>`、Pug `!=`、Nunjucks `|safe`）。防御：① 默认转义输出；② 富文本先经 DOMPurify/sanitize-html 白名单清洗；③ CSP 头兜底；④ 不在模板里 eval 用户输入。另有 SSTI（服务端模板注入）——把用户输入当模板源码渲染，绝不可行。

**来源**：OWASP — "XSS Prevention Cheat Sheet"; OWASP — "Server Side Template Injection"; DOMPurify GitHub

### 6. 什么是 SSTI？举一个危险例子。

Server-Side Template Injection：把用户输入拼进模板字符串再交给引擎编译执行。例：`ejs.render('你好 ' + req.query.name)` → 攻击者传 `<% process.mainModule.require('child_process').exec('rm -rf /') %>` → 远程代码执行 RCE。防御：只把用户输入作为**数据变量**传入（`render('t', {name})`），永不拼进模板源码。

**来源**：PortSwigger — "Server-side template injection"; OWASP — "SSTI"; HackTricks — "Template Injection"

---

## 四、SSR 思维

### 7. 模板引擎渲染和现代 SSR（Next/Nuxt）有什么异同？

相同：都在服务端把数据 + 模板 → HTML 返回，利于 SEO / 首屏。不同：传统引擎（EJS/Pug）产出的是"死" HTML，无客户端交互水合；Next/Nuxt 用 Vue/React 组件在服务端渲染后再在客户端 hydrate（激活事件/状态），是同构 JS。前者适合简单页/邮件，后者适合富交互 SPA 想要 SSR。

**来源**：Next.js — "Server-Side Rendering"; Vue SSR guide — "Hydration"; MDN — "Isomorphic JavaScript"

### 8. 为什么很多纯 API 后端今天不再用模板引擎？

前后端分离：后端只输出 JSON，前端框架（Vue/React）负责视图与交互 → 职责清晰、可独立部署/复用（同一 API 服务 Web+App+小程序）。模板引擎退守到：服务端邮件、简单多页营销站、内部 admin、SEO 落地页等场景。

**来源**：Martin Fowler — "Serverless / microservices"; 业界 — "前后端分离"; Express — "Creating a REST API"

---

## 五、缓存与性能

### 9. view cache 的原理？多 worker（PM2 cluster）下有什么问题？

引擎把模板源码编译成渲染函数并缓存复用，省掉每次 parse/compile 开销。问题：PM2 多进程各有独立内存缓存 → 改模板热更新时不能只刷一个进程；且缓存不跨进程共享。生产通常发版重启（各进程重新编译）即可，无需运行时刷新。

**来源**：Express — "view cache setting"; EJS — "cache option"; PM2 — "cluster mode"

### 10. 页面数据渲染很慢，从模板角度有哪些优化点？

① 减少模板里重复计算/循环内查询（N+1）→ 提前批量取数；② 片段级缓存（把不常变的 header/列表用 cache 存 HTML 片段）；③ 开启 view cache；④ 大列表分页而非一次渲染上千行；⑤ 用更快引擎（性能 EJS≈Pug，复杂逻辑可预计算）。

**来源**：web.dev — "Rendering performance"; NearForm — "Node.js performance"; Memcached/Redis — "fragment caching"

---

## 六、综合

### 11. 邮件模板为什么要单独一套（如 using render 回调拿字符串）？

邮件需要"渲染成 HTML 字符串"塞进 SMTP body，而非直接 HTTP 响应。用 `res.render(view, data, (err, html) => ...)` 拿到字符串 → 传给 nodemailer。且邮件 HTML 有特殊性（内联样式、table 布局、客户端兼容）→ 通常单独模板 + juice/mjml 工具，不复用网页 layout。

**来源**：Nodemailer docs — "Sending HTML"; Express — "res.render callback"; MJU/React Email — "email templates"

### 12. 一个既要 SEO 又要富交互的产品页，你会怎么在 Express 里落地？

方案：① Express 用模板引擎/Nuxt/Next SSR 输出带完整内容的 HTML（保 SEO/首屏）；② 页面里挂一个前端框架 app，用 hydration 接管交互区；③ 数据通过 `<script>window.__INITIAL_STATE__=...</script>` 注入避免二次请求；④ 静态资源走 CDN、HTML no-cache。本质是"同构 SSR"，Express 可做 SSR node server。

**来源**：Vue — "SSR Hydration"; Next.js — "SSR + hydration"; web.dev — "Isomorphic rendering"

---

## 补充（新专题 13-15）

### 13.  从 Express 模板渲染的 SEO 页面演进到富交互产品页，你的架构路线怎么规划？

路线按"交互复杂度"分档而不是按时髦度：① 纯展示页（博客/营销页）留在模板引擎——EJS/Nunjucks + CDN 强缓存，零 JS 成本最低，SEO 天然完整；② 轻交互（表单增强、局部刷新）走"渐进增强"：服务端出全量 HTML + 少量 vanilla/htmx 型增强，不引入构建链——很多团队高估了交互需求，这档能停很久；③ 重交互产品页（富组件状态、复杂路由）再上 SSR 框架（Next/Nuxt），此时 Express 退居纯 API——混合部署（模板页与 SSR 页并存）要处理共享设计系统与 session 互认（同域 cookie 可透传）。迁移决策的成本清单：构建链引入（CI 时长、sourcemap 排障）、双栈人才、TTFB（SSR 框架的服务端渲染预算）、hydration 一致性坑（呼应前端课程包）。反模式：为 3% 的交互页面把 100% 流量拖进 JS 框架。收口句："SEO + 富交互"的正解是给不同页面选不同渲染模式（呼应 render-modes），而不是让所有页面臣服于一个框架。

**来源**：Express 官方 Using template engines；Next.js 官方 SSR 迁移讨论；InfoQ《传统服务端渲染到混合渲染的三年》

### 14.  view engine 抽象层（app.set('view engine') / __express 协议）是怎么做到"支持任意模板引擎"的？自己适配一个引擎要写什么？

协议本质：res.render 把"文件路径+选项+回调"交给 app.get("view engine") 定位的引擎函数，约定是引擎签名 (filePath, options, callback(err, html))——历史上引擎库在模块上挂 __express 属性自报兼容，Express 检测到就直接调用，没挂的走 consolidate 桥（统一把各库 render 适配成该签名）。自己适配新引擎三步：① 提供 sync/async 双包装（引擎本身支持字符串模板要处理"缓存编译结果按文件路径"）；② 处理 extname（app.engine('xyz', engineFn) 显式注册，未注册扩展名 render 会去找同名文件）；③ 错误协议（编译错/IO 错走 callback(err) 进 Express 错误链，别 throw 穿出去）。工程注意点：模板编译缓存（dev 关闭以热更、prod 开启，view cache 与 PM2 多进程一致性）、locals 合并顺序（app.locals < res.locals < render 传入，同名后者胜）、流式渲染的缺席（render 是整串 HTML 协议，大页面首字节优化要靠引擎侧字符串分块+手动 res.write——这也是模板引擎在高并发页面输给流式 SSR 框架的结构性原因）。加分句：Express 的扩展点哲学都是"薄协议"——一个函数签名换一个生态，view engine/connect 中间件/错误 handler 皆如此。

**来源**：Express 官方 view engine 文档；consolidate.js 源码；知乎《Express 模板适配层的极简设计》

### 15.  模板层的 XSS 防线之外，服务端渲染页面还要配哪些安全头？CSP 和模板的冲突点在哪？

头清单在 helmet 基础上按"渲染页特有"补：CSP（核心）、X-Content-Type-Options、Referrer-Policy、页内表单的 SameSite cookie、跨域资源引用只走 https 源。CSP 与模板的四个冲突点与解法：① 内联 script/style 被 default-src 杀——渐进方案 nonce（res.locals.cspNonce 每请求随机，中间件生成+helmet/csp 配置同源注入，模板所有内联块带 nonce，并配 hash 兜底 CDN 统计代码）或 hash 白名单（静态内联可算哈希，动态插入内容不行）；② 模板拼出来的属性事件（onclick="...<%= %>"）——CSP 管不住 unsafe-hashes 之外的事件属性，根治是改 addEventListener，属性内插值本身就是注入面；③ 第三方嵌入（地图/支付 iframe）与 frame-src 白名单的粒度（域名通配 vs 精确），以及给他人嵌入的页面配 X-Frame-Options/CSP frame-ancestors 的方向区分（我嵌人 vs 人嵌我，面试最爱混）；④ report-only 先行——CSP-Report-Only + report-to 端点收集违规两周再 enforce（直接上线=静默功能坏死），reports 里区分"自己 bug"与"攻击探测"。深层考点：CSRF 防线与 CSP 的关系（CSP 不能替代 CSRF token，same-site cookie 才是当代主力），"防御矩阵=每层管各的"而不是指望单个头。收口：安全头的测试要在预发真点上跑（curl -I 清单进 CI 断言），"配置了 ≠ 生效了"。

**来源**：MDN CSP；OWASP CSP CheatSheet；SegmentFault《上了 CSP 之后内联脚本全挂了》
