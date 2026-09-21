# 综合实战：NoteDeck-N 全栈应用的完整交付线

## 0. 本关怎么用

前面七关是"能力点"，本关把它们按**真实工程顺序**串成一条线，做一个能上线的产品 NoteDeck-N（团队协作笔记：Markdown 写作、分享、评论、成员权限）。每步都回指前面某一关——照这个顺序走一遍，检验的是"会不会用"，不是"知不知道"。

## 1. 需求 → 渲染与缓存策略（先定策略再写码，呼应 L3/L6/L7）

先给页面分类，因为渲染模式决定后续一切：

| 页面 | 数据/身份 | routeRules | SEO |
|---|---|---|---|
| 落地页 `/` | 公开静态 | `prerender: true` | 索引 + 完整 meta |
| 公开笔记 `/n/[slug]` | 公开、可缓存 | `isr: 3600` | 索引 + OG 图 |
| 工作台 `/app/**` | 私有、按成员 | `{}` + `no-store` | noindex、302 前置 |
| 分享页 `/s/[token]` | 半公开 | `swr: 300` | noindex（可访问但不收） |
| API `/api/**` | 混合 | handler 级缓存 | — |

这一步用 `definePageMeta`、`useSeoMeta`、`error.vue` 会大量出现（L2/L6/L7）。

## 2. 目录与数据层设计（呼应 nuxt-directory、nuxt-server-routes）

```
app/
├─ pages/        index.vue  n/[slug].vue  app/*.vue  s/[token].vue  login.vue
├─ components/   Editor.client.vue  CommentList.vue  ...
├─ composables/  useAuth.ts  useNote.ts  useTheme.ts
├─ stores/       note.ts  ui.ts
├─ middleware/   auth.ts  owner.ts（route middleware）
├─ error.vue
server/
├─ api/          notes/[id].get.ts  notes.post.ts  auth/login.post.ts  comments/*.ts
├─ routes/       sitemap.xml.ts  og/[slug].ts
├─ middleware/   session.ts（只解析身份挂 event.context）
├─ utils/        db.ts  guards.ts（requireUser/requireRole）
├─ plugins/      init-db.ts（Nitro 插件，启动断言配置）
```

数据层：`server/utils/db.ts` 用 runtimeConfig 的非 public 栏读连接串（L4），Nitro 插件 `init-db.ts` 里 **fail-fast 断言关键配置缺失即启动失败**（呼应 nuxt-runtime-config 第 5 节）；查询一律带 `noteId`/`workspaceId` owner 维度（三层纵深第三层，L5）。

## 3. 鉴权链路（串起 L4→L5，最考验"两侧一致"）

```
① server/middleware/session.ts：读 sid cookie → 查 session → event.context.user（只解析不拦截）
② route middleware auth.ts：SSR 首屏 + 客户端导航都跑；无 user → navigateTo('/login?redirect=…')（校验站内）
③ server/api handler：requireUser/requireRole 判定 401/403（真正门禁）
④ composables/useAuth.ts：useFetch('/api/me', { key:'me' }) 一次取、进 payload、两侧复用
```

身份载体：httpOnly + Secure + SameSite=Lax 的 sid cookie，session 存 Redis（多实例共享，呼应 nuxt-deploy 第 8 题）。401 走"引导登录"通道而非错误页（呼应 nuxt-error-debug 第 8 题）。公开页（落地/笔记）不进 ④ 以免未登录用户看不了。

## 4. 数据获取与状态（呼应 L4/L5）

- 页面首屏数据：`await useFetch`（SSR 直出、进 payload），列表用 `pick` 只取必要字段控 payload（呼应 nuxt-perf 第 3 节）；
- 编辑器草稿等跨组件共享、刷新即丢 → `useState`；购物车式需持久 → 后端；主题 → cookie（呼应 nuxt-state 第 2 节判定）；
- 编辑器、图表等重组件 `.client.vue` + `defineAsyncComponent` 拆出主包（呼应 nuxt-styling 第 3 节）；
- BFF 聚合：详情页一个 `useFetch('/api/note-detail?slug=')`，服务端并行拉正文+作者+评论摘要，客户端只发一次（呼应 nuxt-server-routes 的短路）。

## 5. SEO 与分享（呼应 nuxt-seo-meta）

公开笔记页 `useSeoMeta` 响应式填 title/description/og，`ogImage` 指向 `/og/[slug]`（satori→PNG、URL 带内容哈希、绝对地址），canonical 用 `runtimeConfig.public.siteUrl`（按环境注入）；`@nuxtjs/robots` 生产放行公开区、挡住 `/app`；sitemap 由 `server/routes/sitemap.xml.ts` 生成（只放可索引 canonical）；JSON-LD `Article` 带转义。用 e2e 断言"首屏 HTML 里就有正文"（呼应 nuxt-testing 第 6 节）。

## 6. 样式与模块（呼应 L6）

`@nuxtjs/tailwindcss` + design tokens（app.config 默认值 + cookie 用户覆盖）；错误上报/埋点/品牌做成团队自研模块 `modules/analytics|brand`（构建期注入、运行期放 runtime/，呼应 nuxt-modules 第 3 节）；UI 库按需引入。全局样式统一 `css` 数组，禁组件裸 `<style>`。

## 7. 性能、错误、测试（呼应 L7）

- 性能：公开页 prerender/isr、BFF 缓存到 Redis、主图 preload、payload 裁剪；预算进 CI（Lighthouse + 体积）；
- 错误：边界层一律 `createError`；上游写作导出等软失败降级不 500；error.vue 自包含、不外露 stack；`app:error` 接上报；
- 测试：utils 单测、编辑器/评论组件 `mountSuspended`、`server/api` 真 Nitro 契约测（404/401/缓存头）、Playwright 关键流程（登录→建笔记→分享）+ SSR 直出回归。

## 8. 部署（呼应 L4/L8 上一关）

多阶段 Docker 出 `.output` 运行镜像（非 root、HOSTNAME=0.0.0.0、只 COPY 产物）；Nginx 反代 + `/_nuxt/` immutable + 透传 `X-Forwarded-*`；`NUXT_*` 运行期注入、构建机不含生产密钥；session/缓存共享 Redis；健康检查 `/api/health`；不可变制品晋级 + 灰度 + 一键回滚。

## 9. 一条"从零到上线"的检查顺序

```
定渲染/缓存策略 → 目录与数据层(fail-fast) → 鉴权链路(两侧一致) → 取数与状态
→ SEO/分享 → 样式与团队模块 → 性能/错误/测试左移 → 容器化与发布门禁
```

每步都能在对应关里找到"为什么这样做"。能独立把这条线走通、并说清每一环的取舍，就是本包要求的"会做工程"。

## 10. 🚀 部署预告

最后一关 **nuxt-architect**：拉高视角做技术选型总复盘——同构 SSR（Nuxt）与 RSC（Next）两条路线的本质差异、Nitro 带来的启示、什么项目选谁、以及这整套大前端技能地图如何收束成你的判断力。
