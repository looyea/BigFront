# L8 作业：部署、综合实战与架构判断

> 覆盖关卡：nuxt-deploy / nuxt-fullstack-project / nuxt-architect。五段式 20 题，也是全课程收官作业。

## 第一段：读代码找 Bug（10 题）

**题 1**
```dockerfile
FROM node:22
COPY . .
RUN npm install && npm run build
CMD ["npm", "run", "dev"]
```
这份 Dockerfile 有 4 处生产问题。逐一指出（涉及 dev 常驻、镜像体积、依赖缓存层、密钥/权限）。

**题 2**
```bash
# 部署脚本：在构建机上跑，而构建机持有生产数据库密码
npm run build
```
```ts
runtimeConfig: { dbUrl: process.env.NUXT_DATABASE_URL }
```
安全评审要求"构建机不得持有生产密钥"。说明当前哪里违反了"一次构建多处运行"，改法是什么。

**题 3**
```nginx
location / {
  proxy_pass http://127.0.0.1:3000;
  # 没有设置任何 X-Forwarded-* 头
}
```
上线后 secure cookie 不下发、canonical 变成 http、限流拿到的都是内网 IP。解释这三者共同的根因并补配置。

**题 4**
```ts
// server/utils/cache.ts
const mem = new Map();
export const hit = (k) => mem.get(k);
```
多副本部署后命中率忽高忽低、且改数据后部分实例仍返回旧值。指出为何不能用进程内 Map 做共享缓存，正确方案。

**题 5**
```ts
nitro: { preset: 'static' },
```
```ts
// server/api/notes.get.ts
export default defineEventHandler(() => db.notes());
```
构建出的静态站里 `/api/notes` 404、登录后拿不到身份。解释 static preset 下哪些能力被牺牲，这类页面应怎么取数。

**题 6**（综合 Bug）
工作台 `/app` 配置：
```ts
routeRules: { '/app/**': { swr: 300 } }
```
且鉴权只在 `middleware/auth.ts` 里做。用户 A 刷新看到用户 B 的数据、且直接 curl `/api/notes/mine` 无需登录即可拿数据。指出两处越权根因与修复。

**题 7**（综合 Bug）
```ts
// composables/useAuth.ts —— 在 onMounted 里 useFetch('/api/me')
```
公开分享页首屏未登录态闪一下才变成已登录、且分享爬虫抓到的是未登录 HTML。说明"取数时机"错在哪，改法。

**题 8**
```ts
const draft = useCookie('draft', { default: { text: '' } });  // 裸对象
```
偶发跨请求串草稿。指出 `default` 写法问题（应是工厂函数）并说明 useCookie 与服务端 setCookie 的可见性时机差异。

**题 9**
```ts
export default defineEventHandler(async (e) => {
  const u = e.context.user;             // 期望 middleware 已挂
  return db.notes(u.id);
});
```
某新加的 server route 忘了经过 session middleware（因为放在被放行清单里），`u` 为 undefined 直接 500 且泄露堆栈。从"门禁该放哪一层"角度重构。

**题 10**
```ts
// nuxt.config.ts
features: { inlineStyles: true },
```
预渲染后落地页 HTML 从 28KB 涨到 150KB、CDN 命中率下降、LCP 反而变差。解释内联样式的代价，给出按页面类型的取舍。

## 第二段：手写编程（5 题）

**题 11**
写一个多阶段 Dockerfile（构建阶段 `npm ci`+build、运行阶段只 COPY `.output`、非 root、`HOSTNAME=0.0.0.0`/`NODE_ENV=production`、健康检查 `/api/health`），并写对应的 Nginx `/_nuxt/` immutable 长缓存 + `/` 反代 + `X-Forwarded-*` 透传。

**题 12**
为 NoteDeck-N 设计"数据摆放表"：列出 首页统计、笔记正文、评论分页、编辑器草稿、主题偏好、成员字典 六项，各自标注 SSR取/payload/客户端取/useState/useCookie/服务端缓存 的选择与理由（考察时机与生命周期判断）。

**题 13**
写一个 `modules/analytics` 团队模块骨架：构建期 `addImports`+`addPlugin({mode})`、运行期放 `runtime/`、通过 `runtimeConfig.public` 接收 dsn 与采样率（构建期默认值 + 运行期可覆盖），并说明为何 dsn 要能运行期改而采样率默认可以构建期定。

**题 14**
写鉴权的完整三处代码：`server/middleware/session.ts`（解析挂 context，不拦截）、`middleware/auth.ts`（route 层，无身份 `navigateTo('/login?redirect=')` 且校验站内）、`server/utils/guards.ts` 的 `requireUser` 并在 `server/api/notes/mine.get.ts` 使用。配一条集成测试断言"无 cookie 访问该接口返回 401 而非 500、响应不含 stack"。

**题 15**
设计发布方案：写清楚"不可变制品晋级"流程（一次 build → 测试/预发/生产注入各自 `NUXT_*`）、灰度切流方式、以及"回滚 = 切回旧制品"为何优于"线上修复"。给出一张从 commit 到生产的门禁清单（prepare→单测→集成→Lighthouse/预算→e2e 冒烟→部署→金丝雀观测）。

## 第三段：场景设计（1 题）

**题 16**
你要为一家公司从零制定"Vue 全栈（Nuxt）技术基线"，覆盖多个产品团队。请输出：
- 页面渲染分类规范（落地/内容/私有/工具四类 × 渲染与缓存 × 索引策略）；
- 鉴权与安全的不可谈判项（服务端裁判 + 数据层 owner + 凭据运行期注入 + 私有内容不入共享缓存）；
- 状态与数据摆放的分层约定与 payload 预算；
- 质量门禁（类型/分层测试/性能与体积预算/SSR 直出与 no-store 回归）；
- 部署与运行时标准（preset 选择、容器基线、Nginx/CDN 头、多实例共享存储、优雅退出、可回滚）；
- 横切能力（埋点/错误/品牌）如何框架化、边界靠什么工具守；
- 并说明每条基线"防的是哪个真实事故"（体现判断力而非罗列）。

## 第四段：简答（3 题）

**题 17**
用"时机"解释下列每个现象的根因：auto-import 覆盖、runtimeConfig public 改值要重启、useFetch 的 SSR 分支、hydration mismatch、route middleware 拦不住 API。

**题 18**
从首屏 JS 成本、数据获取、状态、部署自由度四个维度，各用一句话对比 Nuxt（同构 SSR + Nitro）与 Next（RSC + App Router）。

**题 19**
"三层鉴权、fail-fast 配置、测试左移"背后是同一条什么工程哲学？用一句话概括，并各举一个本课程里的具体落地例子。

## 第五段：挑战题（1 题）

**题 20** 🏆 毕业设计
独立完成并上线一个 Nuxt 全栈小产品（NoteDeck-N 或自选），要求体现整门课的能力：
- 数据层（DB + Redis）经 runtimeConfig 注入、Nitro 插件 fail-fast 断言；
- 完整鉴权（httpOnly cookie + session + route/server/数据 三层）；
- 混合渲染（公开区 prerender/isr + BFF 缓存，私有区 ssr:true no-store + 302 前置）；
- SEO 基座（useSeoMeta、canonical 按环境、动态 OG 图、robots/sitemap、JSON-LD）；
- 无闪烁暗色主题、性能达 Lighthouse ≥90（现场数据佐证）、预算进 CI；
- createError 契约 + error.vue 自包含 + 不外泄堆栈 + 错误上报；
- 分层测试（单测/组件 mountSuspended/接口契约/e2e 关键流程 + SSR 直出回归）全绿；
- 容器化 + Nginx/CDN + 一次构建多环境注入 + 可回滚发布；
- 交一份 2 页的架构决策记录（ADR）：至少 3 个关键选择说明"时机/边界/代价/收益"；
- 最后写 200 字：这个项目里你会**刻意不做**什么、为什么（考察"知道边界"比"堆功能"更重要的收官判断）。
