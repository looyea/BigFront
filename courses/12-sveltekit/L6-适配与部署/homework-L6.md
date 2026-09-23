# L6 阶段作业：适配与部署

> 覆盖：kit-adapters / kit-prerender-static / kit-deploy-node

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```ts
// svelte.config.js
kit: { adapter: adapterStatic() }
// src/routes/+layout.js
export const ssr = false;   // "顺手关 SSR 提性能"
```
用 adapter-static 部署后，首页 HTML 是**空壳**、白屏等 JS。指出 prerender 与 ssr 的冲突点，给出 SSG 正确的前置组合。

**Bug 2**
```ts
kit: { adapter: adapterStatic({ fallback: 'index.html' }) }
```
带 `prerender=true` 的首页与 fallback 抢同一个文件名，部署后首页行为诡异。改成什么、为什么？顺带说 fallback 本质是给谁用的。

**Bug 3**
```ts
// src/routes/blog/[slug]/+page.server.js
export const prerender = true;
// 没有任何 entries 导出；站点里也没有链接指向具体 slug
```
构建报 "marked as prerenderable, but were not prerendered"。给两种不同方向的修法（一种补发现、一种改兜底），说明各自原理。

**Bug 4**
```ts
// src/routes/+layout.js 根
export const prerender = true;
// src/routes/dashboard/+layout.server.js
// 忘记关，且有 form action
```
Dashboard 有 action 却继承了 prerender=true。为什么"带 action 的页必须关预渲染"？给最小修法。

**Bug 5**
```ts
// +page.js
export const load = ({ url }) => {
  const q = url.searchParams.get('ref');   // 想在预渲染页里读来源
  return { q };
};
export const prerender = true;
```
构建期直接报错。为什么预渲染禁读 searchParams？给出"营销落地页要按 ?ref 显示不同文案"的两条正确出路。

**Bug 6**
```dockerfile
FROM node:20
COPY . .
RUN npm ci && npm run build
CMD ["node", "build"]
```
镜像巨大、且 `npm ci` 因 lock 不匹配失败；生产 `.env` 也没被读到。指出多阶段与 .env 两处问题并改造成生产级 Dockerfile 片段。

**Bug 7**
```ts
// 反代(Caddy)后，未设任何 origin 环境变量
login: async ({ cookies, url }) => { /* 校验OK后 cookies.set + redirect */ }
```
本地 dev 正常，生产提交登录表单报 403 `Cross-site POST form submissions are forbidden`。为什么偏偏生产复现、dev 不复现？给两个环境变量修法。

**Bug 8**
```ts
// 用了自定义 server：import { handler } from './build/handler.js'
app.use(handler); app.listen(3000);
// 期望 PORT=8080 node my-server.js 改端口
```
设了 `PORT=8080` 却仍监听 3000。为什么生命周期变量在这里失效？还要保住优雅停机该怎么办？

**Bug 9**
```jsonc
// package.json：pg 驱动放在 devDependencies
// SSR 里 import pg 连库
```
Docker 运行阶段 `npm ci --omit dev` 后生产 500 找不到 pg。指出归类错误与规则依据（打进 vs 外部化）。

**Bug 10**
```ts
kit: { adapter: adapterAuto() }   // "auto 最省心，生产也用它"
```
团队要 Vercel 上对 `/api/heavy` 单独走 node runtime 而非 edge，用 auto 配不出来。为什么该换专用 adapter？auto 的定位是什么？

## 二、手写题（5 题）

**手写 1** 混合站点 adapter 与开关：根 layout `prerender=true`；`(marketing)` 全静态、`(app)`（有 action/登录态）`prerender=false`。给出各 layout 的导出、选用的 adapter（能兼顾动态 SSR 的那个）与一句选型理由。

**手写 2** entry generator：`shop/[sku]/+page.server.js` 从 `$lib/server/db` 拉全部在售 sku、把它们预渲染。写出 `entries`（async，`EntryGenerator` 类型）+ `prerender=true`，并说明为何 `entries` 里不写 `prerender` 会怎样。

**手写 3** adapter-node 生产 Dockerfile（多阶段）：build 阶段全量装依赖并 `npm run build`；runtime 阶段 `npm ci --omit dev` + 只 COPY `build/`、`package*.json`、生产 `node_modules`；`ORIGIN`/`PORT` 运行时注入（注释说明为何不构建期烤死）；`CMD ["node","build"]`。

**手写 4** 优雅停机接线：在 `$lib/server/db.js` 导出连接，`hooks.server.js` 的 `init` 里 connect；另写一段监听 `sveltekit:shutdown` 的 `await db.close()` 代码，注释它比 `process.on('exit')` 强在哪两点。

**手写 5** 用 handler.js 搭自定义 server：加 `/healthcheck` 轻端点、其余 `app.use(handler)`、监听 `process.env.PORT ?? 3000`（**手动实现** PORT 语义），并列出"此时哪些 Kit 环境变量仍生效"（≥5 个）。

## 三、场景题（1 题）

为"公开文档站 + 内部 BI 后台"的单体仓库设计**一套代码、两条落地路线**，逐条给落点：
① 文档站要极致首屏与 SEO、可整个丢 CDN 静态托管；BI 后台需登录态与实时查询——选哪个 adapter 能同时容纳二者、页面选项怎么切边界；
② 文档站的 `/docs/[...slug]` 有一千多篇来自 Git，怎么保证全部被预渲染（提示：爬虫够不够、要不要 entries）；
③ BI 后台有导出 CSV 的 form action，落在哪条渲染路径、为何不能静态；
④ 两条路线的**缓存头**分别怎么配（哈希资源 vs HTML vs 后台动态页）；
⑤ 若公司要求后台"数据不出内网、可长连接跑重查询"，而文档站希望零运维——这会把两条路线分别推向自托管还是平台？为什么；
⑥ 同一个 `ORIGIN` 在两域名（docs.x.com / bi.x.com）下如何不写死、按部署注入；
⑦ 表单 action 在两域反代后都出现过 403，一次性给出环境变量层面的统一解法。

## 四、简答题（3 题）

**简答 1** 用三句话讲清 adapter-static / adapter-node / 平台适配器各自"有没有常驻进程、要不要线上 SSR"，并各配一个最适合的业务形态。

**简答 2** 默写"能否预渲染"的判据，再列三条硬禁区（带 action、读 searchParams、per-user 内容）并各说为什么。

**简答 3** 生产为什么必须设 ORIGIN 或 PROTOCOL_HEADER/HOST_HEADER？不设最先在哪个功能上暴雷？`XFF_DEPTH` 又解决什么、为什么从右往左数？

## 五、挑战题 🏆

**"预渲染 + SSR 混合站的缓存雪崩"排查**：某站根 layout `prerender=true`，`/blog/[slug]` 用 entry generator 全量预渲染，`_app/immutable` 资源带 hash。上线后运营反馈"每次发版后，老用户访问旧博客文章会偶发资源 404、样式错乱"。请推演：①预渲染的 HTML 里引用的 chunk 文件名随构建 hash 变化，而 HTML 本身若被 CDN **长缓存**会怎样（画出"旧 HTML → 新 chunk 名已覆盖删除"的失效链）；②给出 HTML 入口与哈希资源两套相反的 Cache-Control 策略及理由；③若保留一批"构建期不存在、运行期新发布"的 slug，prerender 该设 `true` 还是 `'auto'`，为什么；④对比 Next ISR 的 `revalidate` 半动态模型，说 Kit 这套"静态 + 长尾 SSR('auto')"在同类问题上的一种替代解法与它做不到的一点（对比作答）。

---

**本阶段关键词**：build 末尾跑 adapter、中间产物落地、static/node/平台三选一、prerender 前置(ssr≠false)、fallback SPA 负 SEO、strict 校验、prerender true/false/auto 与 manifest、链接爬虫与 entries 默认['*']、crawl、concurrency 网络瓶颈、entry generator 动态段、searchParams 禁读、带 action 不能预渲染、内容相同判据、缓存头归托管、node build 三件套、devDeps 打进/deps 外部化、ORIGIN/PROTOCOL_HEADER/HOST_HEADER、Cross-site 403、envPrefix、--env-file、XFF_DEPTH 从右数、sveltekit:shutdown、handler.js 生命周期变量失效、adapter-auto 边界、多阶段 Dockerfile

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 ①② 即得 4 分基础分，③④ 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L7**：kit-api-design——`+server.ts` 的 API 工程：各 HTTP 方法路由组织、错误响应一致性、Response 流式返回与 Cache-Control/ETag 策略。
