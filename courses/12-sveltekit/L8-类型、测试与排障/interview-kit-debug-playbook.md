# kit-debug-playbook 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 生产环境页面 500 白屏，服务端日志却啥也没打，第一步查哪？
**来源**：500 白屏排障开场题的转述。

先想"错误在哪一层"。若是 `handle` 里 `resolve` 之外抛的错，它是致命错误、不经页面错误边界、按 `Accept` 头回 JSON 或 `src/error.html`——且你没在 `handleError` 打点就会"静默"。第一步：贴一行 `handleError({ error, event }){ console.error(error, event.url); throw error; }` 或看容器/`node build` 的 stderr。dev 里还要排查是不是 `try/catch` 把抛错吞了。

### 2. (B) load 里 `try { ... } catch(e) { return 降级数据 }` 结果重定向和 404 全失灵，为什么？
**来源**：吞抛错排坑题的转述。

`redirect()`/`error()` 靠**抛出带标记的对象**让 SvelteKit 实现控制流；你的 catch 把它当普通异常咽下、返回了降级数据，框架就收不到重定向/错误信号。要么别包这层 catch，要么用 `isRedirect(e)`/`isHttpError(e)` 判出后**原样 `throw e` 重抛**，只 catch 真正的意外异常。

### 3. (B) 控制台报 `Hydration failed — the server rendered HTML didn't match`，列三类最常见根因与修法。
**来源**：水合失配高频题的转述。

① 首帧用了 `Date.now()`/`Math.random()`/本地时区格式化——两端算不同：挪进 `$effect`/`onMount` 后填充。② 用 `if (browser)` 切首帧标记：SSR 渲一套、水合渲另一套：改成两端同结构、浏览器内容在 effect 里填。③ 非法 HTML 嵌套被浏览器解析器修正：修标记合法性。核心原则：SSR 与客户端首帧必须产出一致 DOM。

### 4. (A) 为什么 load 里 fetch 一次、水合又 fetch 一次会引发问题？Kit 默认怎么防？
**来源**：数据两端一致性题的转述。

若水合期重发请求拿到不同数据，DOM 就对不上。Kit 默认把 SSR 期 `event.fetch` 的响应**内联进 HTML**（`text`/`json` 被 hook 捕获），水合时从 HTML 读、不再发网络请求——前提是你走 `event.fetch` 而非绕过它用原生 `fetch`/裸调外部 API。headers 不会序列化，除非经 `filterSerializedResponseHeaders`。

### 5. (B) 一个页面无限重发 `/api/x` 请求、越点越卡，多半是什么？
**来源**：load 死循环题的转述。

某 load `fetch('/api/x')` 或 `depends` 了某 key，**同一 load 又 `invalidate` 自己依赖的 `/api/x`/key**——每次跑完把自身依赖标脏→重跑→再标脏，死循环。拆法：`invalidate` 只在变更后由 action/`afterNavigate`/事件回调触发，绝不在 load 内标脏自己依赖的资源；刷新用独立 `^[a-z]+:` key 别撞 fetch URL；`invalidateAll()` 也别放 load 里。

### 6. (A) 把含密钥的 `$lib/server/db.js` import 进了 `+page.svelte`，会发生什么、为什么这是好事？
**来源**：server-only 边界题的转述。

构建直接失败：`Cannot import $lib/server/... into client-side code`。这是 Kit 用目录约定划的**服务端/客户端硬边界防呆**，替你挡住把服务端模块（连库、持密钥）误送进浏览器 bundle。正解是换通道：服务端能力只在 server load/`+server.js`/handle 用，数据经 load `return`、动作走 action/endpoint。

### 7. (B) 项目跑得好好的，`vite build` 却报 `Cannot use $env/static/private in client`，怎么修？
**来源**：env 越界构建报错题的转述。

`$env/*/private` 禁止被客户端可达代码 import，报此错说明某 `+page.svelte`/universal `+layout.js` 等直/间接引到了它。修法：把读取私密 env 的代码移进 `$lib/server/*` 或 `+page.server.js`/`+server.js`/`handle`；确需给前端的配置改用 `PUBLIC_` 前缀走 `$env/static/public`。别为了过构建把私密值误设成 public。

### 8. (D) 复盘：密钥不知何时泄露到了前端。按 SvelteKit 的模型，列出两条最可能的路径与封堵。
**来源**：安全泄露复盘题的转述。

路径一：把密钥配成 `PUBLIC_` 前缀（进 `$env/static/public` 被编进客户端 bundle），或绕过防呆直接用 `import.meta.env`/Vite `define` 注入前端——封堵：私密值只放 `$env/*/private`、只在服务端用。路径二：`+page.server.js`/universal load **return 了整条含 passwordHash/token 的记录**，它作为 `page.data` 序列化进 HTML——封堵：load 只 return 前端真要展示的字段。口诀：进 bundle 看是否 public，进 HTML 看是否 load 返回。

### 9. (B) `event.cookies` 在某 load 里是 undefined，为什么？该去哪操作 cookie？
**来源**：cookies 归属排坑题的转述。

cookies API 只在**服务端**存在（`+page.server.js`/`+server.js`/`handle`/action）。你在 universal `+page.js`/`+layout.js`（两端跑、无 cookies）里访问自然是 undefined。要读写 cookie 移到 server 侧；客户端想带 cookie 走 `fetch`（同源自动带）或经 action。

### 10. (B) 退出登录删了 session cookie，但页面顶部用户名还在、刷新才没，为什么？
**来源**：登出态不同步题的转述（接 L4）。

action 成功后 Kit 重渲染页面并重跑 load，但**不重跑 `handle`**——`event.locals.user` 还是本次请求开头 handle 塞进去的旧值，load 读它仍显示已登录。修法：登出 action 里删 cookie 后**手动 `event.locals.user = null`**，再靠 load/`invalidateAll` 刷新 UI。

### 11. (C) 页面偶发"内容闪一下再稳定"，SSR 项目里为什么？如何定位是 hydration 还是数据问题？
**来源**：闪动诊断题的转述。

两类：① context/state 在深层页更新，SSR 时上层已渲完不受影响、客户端却会向上冒（状态管理文档所述），水合期闪——把状态下传别指望上溯。② 首帧依赖客户端才有的数据（如 localStorage、`browser`）。定位：看控制台是否有 hydration mismatch 报错（有→水合/标记不一致），无错但闪→多半是 effect 里补数据或上溯状态；对比"右键查看网页源码"的 SSR HTML 与首帧 DOM。

### 12. (D) 给一份 Kit 线上事故应急 checklist（从"用户报白屏"到定位）。
**来源**：事故手册综合题的转述。

① 先看是**全站**还是**单页**：全站→多半 handle/全局 layout/init 炸了，查 stderr/handleError；单页→该路由 load/action/渲染。② 拿**裸 JSON 还是 error.html**：JSON=端点/handle 致命错，error.html=根 layout 错或 fallback。③ 开 `?` 请求看 `Accept: text/html` vs `application/json` 分叉，区分数据错还是渲染错。④ 白屏无日志→补 `handleError` 打点、确认没被 try/catch 吞抛错。⑤ 复现用 build+preview（非 dev），排除只在生产出现的水合/产物问题。⑥ 关缓存/预渲染变量逐步二分。

🚀 **下一组**：L8 课后作业——generated types、测试矩阵与事故手册的综合复盘。

---

## 补充（新专题 13-15）

### 13.  密钥疑似泄露进前端产物，按什么顺序应急与取证？ 

 先轮换（泄露即失效）、再从 build 产物反查（grep 客户端 chunk 与预渲染 HTML）、定位混入路径（import 链/误用 $env/static 非 public），最后在 CI 加产物扫描门禁（secretlint 等）防复发。 

**来源**： https://svelte.dev/docs/kit/keywords#server 

### 14.  hydration 报错信息含糊，你的定位工具箱？ 

 二分注释可疑组件、对比 View Source 与 DOM 差异定位首个错位节点、检查浏览器扩展改写与非法嵌套（p 内 div）、开 vite dev 的警告堆栈；确认成因后修模板而非关 SSR。 

**来源**： https://svelte.dev/docs/kit/state 

### 15.  线上偶发：改了 server load 后部分客户端导航拿到旧数据，怀疑什么？ 

 版本轮询未开或间隔过大：?_data 请求命中旧 chunk/缓存；查 CDN 对 HTML 与 ?_data 的缓存策略、service worker（若有）拦截、以及 depends 未覆盖导致免跑旧值。三处逐排。 

**来源**： https://svelte.dev/docs/kit/configuration#version 
