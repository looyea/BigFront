# kit-error-boundaries 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) error()/redirect()/json() 三件套各自的调用契约与禁区？
**来源**：投掷工具基础题的转述。

error(status, body)：status 限 400-599，body  conform App.Error（字符串自动包成 {message}），**调用即抛**、不过 handleError、渲染最近 +error 边界。redirect(status, location)：限 3xx，303=POST 转 GET、307/308 保方法，同样调用即抛。json(data, init)：**不抛**，只在 +server.js 端点（和 superForms 返回值）的世界里造 Response——load/action 里没有它的戏。三者共同红线：别让外层 try/catch 把前两者的抛截肢（isRedirect/isHttpError 判出重抛）。

### 2. (A) expected 与 unexpected 错误为什么在 handleError 上厚此薄彼？
**来源**：错误分层设计原理题的转述。

expected 是**你签过字的业务结论**（404 就是结论本身），再走一遍钩子改写反而添乱，官方明说 "without invoking handleError"。unexpected 是失控现场：message 可能含 SQL、堆栈可能含密钥路径——所以默认对用户只给壳 `{message: "Internal Error"}`，同时**强制**过 handleError：那是日志上报与"你想不想给用户看更多"的唯一收口。一句话：expected 走白名单直放，unexpected 走消毒通道。追问高频：handleError 里怎么区分两者？——`typeof error.message === 'string'` 的原生 Error 与 HttpError 实例的判据（isHttpError），以及给 expected 塞 code 后按 code 过滤。

### 3. (B) 用户反馈"访问不存在的文章应该看到我们漂亮的 404 页，怎么有时是裸文本页？"列三条出处。
**来源**：错误页呈现链路排坑题的转述。

①错发生在**根 layout 的 load**——官方规则：根布局错误没有边界可渲染（+error 本在它内部，自举死锁），直接走 fallback 页（src/error.html 或默认极简页）；②错发生在 **+server.js 端点或 handle**，且请求 Accept 要 JSON/不含 HTML——响应是 JSON 错误体或 fallback，组件级 +error.svelte 根本不参与；③错误其实发生在**渲染期**且未开 handleRenderingErrors——SSR 渲染炸默认整页 500 走 fallback，不是边界。口诀：+error.svelte 只接"load/action 抛给路由树"的那一段。

### 4. (A) +layout.server.js 抛错时的边界定位规则？为什么旁边那个 +error.svelte 不算数？
**来源**：边界几何高频题的转述。

官方明文：错误发生在某层 layout 的 load，**最近的边界在该布局之上**（不含它自己旁边的）——因为 layout 的 +error.svelte 语义是"给我**子树**兜底"，layout 本身渲染失败时它没有出场的位置。子路由出错则吃最近的（自己层的 > 父层的）。链条尽头：根 layout 出错时"之上的最近边界"已不存在，落 fallback。设计一致性可以这样背：+error.svelte 是 `{@render children()}` 位置上的替身，children 都取不到它的人，它也保护不了谁。

### 5. (B) 老代码 `throw error(404, 'Not found')` 在新项目里被 lint 提示冗余；而 1.x 教程抄来的代码升 2.x 后出了个诡异 bug——可能是什么？
**来源**：代际语义迁移题的转述。

冗余是正史：1.x 的 error()/redirect() 只**造**异常要自己 throw，2.x 起函数内部直接抛。诡异的来源：1.x 时代有人用 `return error(404)`（忘 throw）——那时只是返回了个 Error 实例、页面数据烂掉但不一定报错；2.x 里同样的写法会在函数**内部**直接抛出去，行为骤变（比如你包在外层的 catch 或 Promise.all 语义跟着翻车）。升级排查法：全局搜 `return error(` 与裸 `error(` 后依赖返回值的代码。redirect 同理。

### 6. (C) 对照 svelte:boundary 与 ~error：HTTP 错误呈现和运行时崩溃兜底在 Kit 世界里怎么分工？
**来源**：Svelte/SvelteKit 错误体系分层题（呼应 svelte-error-boundary 关）的转述。

三层：**+error.svelte** 吃"路由生命周期内的 HTTP 语义错误"（load/action 抛的 expected + 被 handleRenderingErrors 引进来的渲染错），带状态码、可 SSR、SEO 可控；**svelte:boundary + failed snippet** 吃组件树的运行时崩溃（事件/effect/渲染），纯客户端兜底，无 HTTP 状态码可言；**~error/:global:error**（Svelte 5）只接事件处理器与 effect 的错、且拿不到 status 语义。Kit 的路由层级用 @sveltejs/kit 的 error() 与 $page.error 这条线，组件私有灾难用 boundary——混用的症状是"404 页不该出现的崩溃堆栈出现在 page.error 里"或反。

### 7. (C) 和 Next.js 的 error.tsx / not-found.tsx 比，Kit 的 +error.svelte 少了一环什么能力？多了一环什么？
**来源**：跨框架错误边界对比题的转述。

少：**reset()** ——Next 的 error.tsx 收 `reset` 回调可以"重试渲染"（清错误态再跑一遍组件树）；Kit 的 +error.svelte 没这个内建把手，等价操作得手写 goto/invalidate 或 `window.location` 重进。多：**HTTP 状态码是一等公民**——page.status 与服务端响应码天然一致（搜索引擎与监控看到的就是 404/500），Next 的 error.tsx 默认响应仍是 200（渲染期边界），语义错位要靠路由层自己找补。另两处小差：Next 的 error 是真 Error 实例要自己挖 message，Kit 的 page.error 天生是 conform App.Error 的纯对象。

### 8. (D) 给 SSR 站点设计 404/500 策略：要 SEO 正确、要 Sentry 上报、要根布局挂掉的极端场景也有脸。逐条给落点。
**来源**：错误体系架构设计面试题的转述。

SEO：业务 404 用 `error(404, ...)` 抛（响应码真 404，别渲染个"未找到"文案配 200——软 404 坑收录）；500 同理让 unexpected 自然 500。Sentry：handleError 里 `if (!isHttpError(error) || error.status >= 500) capture(error)`——4xx 业务错不进告警池；返回值仍要 conform App.Error（钩子返回即 page.error）。根布局：预置 src/error.html（带 %sveltekit.status% 占位），并配 `config.kit.paths` 站内资源用绝对路径防 fallback 页裸样式。加分点：说清端点错误不吃 +error.svelte、监控要按 Accept 分支采 JSON 错误体。

### 9. (B) src/error.html 写好后一直没生效，可能的三个原因？
**来源**：fallback 页排坑题的转述。

①放错位置——必须是 **src/error.html**（与 app.d.ts 同级），不是 static/ 也不是 root；②根本不是 fallback 场景——错误被某个 +error.svelte 接住了（fallback 只服务根 layout 抛错/端点无 HTML 可渲/handle 抛错三类）；③写成了模板语法——它**不是 Svelte 组件**，只有 `%sveltekit.status%`、`%sveltekit.error.message%` 两个官方占位符会被替换，别的插值原样输出。补一刀：dev 模式下 Kit 可能显示 overlay 而非你的页面，验证要 build+preview。

### 10. (D) 流式页面（L3）的慢 Promise reject 了：错误会怎么呈现？和 load 同步段抛错有何不同？
**来源**：流式×错误交叉题的转述。

分界线是"响应是否已开始流出"。同步段抛 expected error：正常走 +error.svelte、状态码如愿。慢 Promise 的 reject：HTTP 头与首块已发出，状态码覆水难收——若模板 {:catch} 接住，错误只在该块内呈现（页面其他部分健康）；没人接则 Kit 把错误块流进已开的响应（客户端侧呈现），且**非 event.fetch 创建的 Promise 无人 catch 会让服务端崩在 unhandled rejection**。结论：流式资源的错误预算必须花在 {:catch} 与 noop catch 上，error() 的"改状态码"权力在流开始时就没了（与 redirect/setHeaders 同理）。

### 11. (A) +error.svelte 里的最小正确写法？三个易犯姿势错误。
**来源**：边界组件基本功题的转述。

正写：`import { page } from '$app/state';` 后 `{page.error.message}` / `{page.status}`。姿势错误：①继续从 $app/stores 引 `import { page } from '$app/stores'` 又混用 $page/$state（2.12 代际混搭，双份心智）；②把 page.error 当 Error 实例挖 `.stack`/`instanceof`（它是 App.Error 纯对象，堆栈早在 masking 时留下）；③直接 `{page.error}` 渲染整个对象——带 code/id 的私有结构就此暴露，模板永远只取白名单字段。加分：2.54 实验开关下 +error 还要兼容 `let { error } = $props()` 的 prop 来源（渲染错时 page.error 不更新）。

### 12. (D) 内部工具站：登录墙做成"未登录全站统一跳 /login?redirectTo=..."。用本关+前两关的知识拼出完整链路，并指出安全债。
**来源**：鉴权链路综合题的转述。

链路：handle 解析 session 塞 locals（每条请求、含 action 后 load 之前——L3 鉴权策略）→ 各 +page.server.js 里 `if (!locals.user) redirect(307, '/login?redirectTo=' + url.pathname)`；**端点与页面分叉**：fetch 型请求（Accept: JSON）给 `error(401, ...)` 而非 redirect（JSON 客户端不跟 3xx 语义）。登录页 action 成功 `redirect(303, redirectTo)`。安全债两条要点名：redirectTo 未白名单校验＝开放重定向钓鱼（L5 安全清单的债）；307 保留 POST 方法意味着"带着原方法撞登录页"，页面路径用 303 更干净——说得出这层方法语义差别算满分。

🚀 **下一组**：L4 课后作业——actions 契约、校验管道与错误几何的综合复盘。
