# server/api 与 Nitro 事件：全栈的后半边天

Next 写接口要开 Route Handler 并接受序列化关税（呼应 next-route-handlers），Nuxt 的接口住在独立的 `server/` 世界——同仓、同构建、不同引擎（Nitro/H3）。这关掌握 event handler 写法、H3 工具箱，以及那个让 Next 眼红的 `defineCachedEventHandler`。

## 1. 文件即接口：HTTP 方法编码在文件名

```ts
// 目的：一个文件就是一个接口——HTTP 方法写在文件名后缀，入参统一是 H3 的 event
// server/api/articles.get.ts        → GET /api/articles
// server/api/articles/[id].delete.ts → DELETE /api/articles/:id
import { defineEventHandler, getQuery, readBody } from 'h3';

export default defineEventHandler(async (event) => {
  const { page = 1 } = getQuery(event);            // ✅ 读查询参数 /api/articles?page=2 → page='2'
  const id = getRouterParam(event, 'id');          // ✅ 读路径参数 [id] → :id 的值
  const body = await readBody(event);              // ✅ JSON 体自动解析，无需手搬 stream
  event.context.db;                                // ✅ 读 Nitro 插件注入的资源（连接池等）
  return { ok: true, data: await list({ page: +page }) };  // ✅ return 即 200，对象自动转 JSON
});
// ❌ 想处理 POST 却把文件写成 articles.get.ts → 只能接 GET，POST 命不中路由 405；方法靠文件名后缀而非导出函数名
```

与 Next Route Handler 的三重差异：① 方法靠文件名后缀而非导出函数名；② 入参是 **H3 的 event 对象**（不是 Request/Response 对——Web 标准之上的一层薄封装，getHeader/readBody 等工具族）；③ 返回值语义：return 即 200 JSON，`sendStream`/`sendRedirect` 走显式 API。**注意没有"页面与接口同目录共存"的概念**——server/ 与 app/ 是两个构建世界，也互不能 import（跨世界共享走 #shared，呼应 nuxt-directory A1）。

## 2. 校验与错误：H3 的正规姿势

```ts
// 目的：参数校验与错误——抛带状态码的 H3Error，前后端共用同一份 zod schema
import { validate } from '#shared/schemas';          // ✅ zod schema 两端共用（海关免费！）

export default defineEventHandler(async (event) => {
  const parsed = postSchema.safeParse(await readBody(event));
  if (!parsed.success) {   // ✅ 非法入参抛 422，Nitro 统一转 JSON 错误响应，客户端 useFetch 的 error 能拿到
    throw createError({ statusCode: 422, statusMessage: '参数不合法', data: flatten(parsed.error) });
  }
  const user = event.context.user;
  if (!user) throw createError({ statusCode: 401 });  // ✅ 错误即 HTTP 语义，未登录直接 401
  // ...
});
// ❌ 不 safeParse 直接用 body.title 拼入库/模板 → 超长或恶意字段直接进库（前端一切皆可伪造）
```

要点：① `createError` 抛的是带状态码的 H3Error，Nitro 统一转 JSON 错误响应（客户端 useFetch 的 error 能拿到 statusCode——第 4 节错误归一的接口端）；② 参数校验用 shared/ 里的同一份 zod——**前后端共享 schema 零成本**，Next 靠 #shared 目录也能做但 Nuxt 是默认姿势（呼应 next-forms-mutations 的三层校验）；③ server/utils 自动导入工具（DB 封装、鉴权 helper），服务端世界里它们是"全局函数"。

## 3. defineCachedEventHandler：一个函数顶一层 CDN

```ts
// 目的：排行榜缓置——10 秒窗口、内部键去重，一个函数顶一层 CDN（Nuxt 版数据层缓存）
// server/api/hot-rank.get.ts —— 排行榜：10 秒窗口，内部键去重
export default defineEventHandler(defineCachedEventHandler(
  async (event) => buildRanking(),
  { maxAge: 10, swr: true, name: 'rank', getKey: () => 'global' },  // ✅ maxAge 给窗口、swr 后台再生、getKey='global' 全局共享一份
));
// ❌ 带用户态的接口 getKey 忘了拼 user id → 所有人的响应共用一份缓存，A 的数据喂给 B（串号，与 HTML 缓存同一条安全红线）
```

这就是 Nuxt 版的"数据层缓存金字塔"压缩版（对照 next-fetch-cache 三层）：maxAge+swr 给窗口与后台再生， getKey 自定义缓存键（**安全线同款：键必须包含影响响应的全部请求者变量**——带用户态的接口 getKey 忘了 user id 就是串号事故），storage 选项接 Redis/平台 KV（多实例共享，直接解决 Next 自托管最头疼的 cacheHandler 问题，呼应 next-deploy C2）。routeRules 的 swr 管 HTML 层、这里管数据层——两层各司其职。

## 4. 中间件、插件与生命周期站位

```
server/
  middleware/auth.ts    → 全局服务端中间件：每请求最先跑（解析 session 挂 event.context.user）
  plugins/db.ts         → defineNitroPlugin：实例启动一次（建连接池、预热）
  routes/health.get.ts  → 非 /api 前缀端点（探活用，呼应 next-deploy D2）
  error.ts              → 服务端错误处理器：统一日志与脱敏输出
```

auth 中间件的实现纪律：只解析、不拦截——把 user 挂 context，拦截决定留给具体 handler/页面（不是所有路径都要登录；matcher 意识从 Next middleware 带来，别忘 `/api/auth/*` 这类豁免，呼应 next-middleware-auth 第 4 节）。

## 5. 内部调用的近道：$fetch 与本地 API 的短路

SSR 期间页面 `useFetch('/api/x')` 会被 Nitro 识别为**本地接口并直接内部调用**（不真的走一遍 HTTP 环回）——这是同仓同引擎的便利（Next 里服务端组件调自家 Route Handler 反而要绕公网或拆函数）。但两个限制：跨进程部署（app 与 api 分开扩）时短路失效；内部调用不带公网 headers（X-Forwarded 之类），依赖它们的逻辑要单测覆盖（nuxt-testing 见）。

## 6. 自检清单

- [ ] 文件名后缀→HTTP 方法、动态段→getRouterParam 形成肌肉记忆；
- [ ] createError 的状态码语义与客户端 error 的通路清楚；
- [ ] defineCachedEventHandler 的 getKey 安全线与 storage 共享会配；
- [ ] server 与 app 互不可 import、共享走 #shared 记得牢；
- [ ] 全局 server middleware"只挂 context 不做拦截"的纪律。

## 7. 小结

server/ 是 Nitro 给 Nuxt 全栈的完整后端工位：H3 工具箱、缓存原语、插件生命周期一样不缺，比 Next 的 Route Handler 更"独立王国"（也因此没有 RSC 那种同进程直调的全家桶体验——两种全栈哲学的又一次对撞，nuxt-architect 收官再谈）。下一关配置体系收尾 L4：runtimeConfig 如何撑起"一产物多环境"。

🚀 部署预告：下一关 nuxt-runtime-config 讲配置的双栏设计与 NUXT_ 环境变量注入——把 07 包 NEXT_PUBLIC_ 的血泪教训升级成 Nuxt 的防呆结构。
