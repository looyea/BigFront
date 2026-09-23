# L8 阶段作业 · SolidStart 下（服务端函数、部署、测试）

> 范围："use server"（函数级/文件级）、序列化模式、action 与 single-flight mutation、getRequestEvent、ssr 开关、prerender/crawlLinks、Nitro 预设与 Cloudflare 特例、v2 deployment plugins、@solidjs/testing-library 全家桶与 Vitest 坑。共 10 Bug + 5 手写 + 1 场景 + 3 简答 + 1 挑战。

## 一、找 Bug（每题 3 分）

**Bug 1**
```ts
import { useServer } from "@solidjs/start/server";
const save = useServer(async (data) => { await db.write(data); });
```
编译报 useServer 不存在。官方机制下正确的写法是？

**Bug 2**
```ts
"use server";
const helper = (x: number) => x * 2;          // 纯本地小工具
export async function calc() { return helper(21); }
```
同事把文件级指令放上了，还顺手把 `helper` 也 `export` 了出去——说明文件级指令下"导出即…"的规则，指出这里的设计问题。

**Bug 3**
```ts
export default defineConfig({ serialization: { mode: "js" } });
// 生产 CSP 头：script-src 'self'（无 unsafe-eval）
```
服务端函数返回值在客户端反序列化直接抛错。改哪、代价是什么？

**Bug 4**
```ts
const updateName = action(async (id, fd) => {
  await db.update(id, { name: fd.get("name") });   // 忘了指令
  return getProfile(id);                           // 想"顺手"拉新数据
}, "updateName");
```
既没吃到 single-flight 又有暴露 DB 逻辑风险。缺了什么、为什么 return 拉数据不管用？

**Bug 5**
```ts
const logout = action(async () => {
  await session.clear();
  return redirect("/");      // 登出后停在原页面
}, "logout");
```
官方惯用法里 redirect 应该怎么给？

**Bug 6**
```tsx
const product = createAsync(() => getProductQuery(id));
// 路由文件里没有导出 route.preload
```
表单提交后走了两个 HTTP 请求。对照官方两前提，缺的是哪个？

**Bug 7**
```ts
export default defineConfig({ server: { preset: "cloudflare_module" } });
// 线上运行时报 node:async_hooks 不可用
```
官方 Special note 要求的两处配置是什么（一处 vite、一处 wrangler）？

**Bug 8**
```ts
export default defineConfig({
  server: { prerender: { routes: ["/", "/app/dashboard"] } },
});
```
登录后台页被构建成了人人都得到同一份的静态页。prerender 名单的判据错在哪？

**Bug 9**
```tsx
const { getByText } = render(<TodoList initial={{ done: 1 }} />);
```
用 solid-testing-library 报类型错/行为怪。两个官方差异点各错在哪？

**Bug 10**
```
Vitest 用例里 createSignal 建出来的 signal 一切正常，
可组件一挂载就报 "dispose is not a function"。
```
官方 Known issues 点名的根因与排查方向？

## 二、手写（每题 7 分）

**手写 1**：写一个"改商品名"的 single-flight 全链路：query（"use server" + 缓存键）、`route.preload`、action（FormData 取 name、写 db）、`<form action={...with(id)} method="post">`。标注提交后框架自动做了哪两步。

**手写 2**：给"严 CSP + 小包体"两种诉求各写一份 `serialization` 配置，并用一句话说明各自会付出什么。

**手写 3**：一个文档站要全站预渲染、营销页 `/launch` 也要静态、`/admin/**` 保持动态：写出 defineConfig 相关片段（prerender + ssr 相关取舍），并解释 `/admin` 为什么不能进 crawlLinks 的可达集。

**手写 4**：部署 Cloudflare：默写 `server` 配置（preset + rollupConfig.external）与 wrangler.toml 关键行；再写一句验证 ALS 可用的冒烟思路。

**手写 5**：用 @solidjs/testing-library 测一个 `useParams` 页面（路由 `/ids/:id`，期望 "Id: 1234"）：写出含 `location` 选项的完整 `it(...)`，并解释为何这里必须 `findBy`。

## 三、场景题（20 分）

**场景：** 团队把一个 SolidStart 站点从自建 Node 迁到 Cloudflare，同时上新"评论"功能（表单提交→列表刷新要求一次请求完成、评论查询要预热）。上线后三起事故：① 评论提交偶发两个请求、列表转圈；② Workers 运行时报 async_hooks；③ 测试环境 Vitest 大面积 "dispose is not a function"，CI 直接红。请逐一给出根因判断、修复配置/代码（写出关键片段）、以及各自在 code review / CI 层面的"复发拦截"措施。

## 四、简答（每题 5 分）

**简答 1**：single-flight mutation 的两个前提与"省掉的那一次请求"省在哪。

**简答 2**：`getRequestEvent()` 与 `getServerFunctionMeta()` 各拿什么？各举一个用途。

**简答 3**：solid-testing-library 相对 React 版的三大 API 差异，以及各自的根本原因。

## 五、挑战题（加分 10 分）

🏆 **挑战**：下面是同事的"评论"实现，请回答四问：
```ts
const addComment = action(async (postId: string, fd: FormData) => {
  "use server";
  await db.comments.create({ postId, text: fd.get("text")?.toString() });
}, "addComment");

const getComments = query(async (postId: string) => {
  "use server";
  return db.comments.list(postId);
}, `comments`);

// 路由文件里：
export const route = { preload: ({ params }) => getComments(params.postId) };
```
(a) 这组代码能否吃到 single-flight？给出依据；(b) `getComments` 的缓存键写成了模板字符串 `` `comments` ``（恒等于 "comments"），对"不同 postId 的列表"意味着什么，参数化查询的缓存语义该以谁的文档为准；(c) 若 action 里校验失败要 `throw redirect(`/posts/${postId}/edit`)`，预加载要放哪才对；(d) 给这个功能补一条最短路径的测试策略（哪层用什么工具，不必写全码）。

---

**本阶段关键词**："use server" 函数级/文件级、serialization json/js、action、throw redirect、single-flight mutation、preload 前提、getRequestEvent、Nitro 预设、cloudflare_module + nodejs_compat、prerender/crawlLinks、ssr:false、Vite Environment API、@solidjs/testing-library、render 收函数、无 rerender、location+findBy、renderHook/owner、testEffect、renderDirective、solid-jest、双份 solid-js。

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L9**：终战——响应式源码级内核、React→Solid 迁移方法论与毕业项目。
