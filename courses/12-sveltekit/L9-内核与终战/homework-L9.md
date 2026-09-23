# L9 阶段作业：内核与终战

> 覆盖：kit-internals / kit-performance / kit-capstone

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```js
// src/hooks.server.js
import { connectDb } from '$lib/server/db';
connectDb();                     // 想在启动时连库
export const handle = async ({ event, resolve }) => resolve(event);
```
本地 dev 正常，CI 里 `vite build` 崩在"连不上数据库"。指出 Kit 构建期对路由/hooks 文件做了什么、缺了哪个守卫、怎么改。

**Bug 2**
```js
// src/hooks.server.js
export async function handle({ event, resolve }) {
  try {
    return await resolve(event);         // 想统一兜底
  } catch (e) {
    return new Response('出错啦', { status: 200 });
  }
}
```
上线后发现：需要登录的页面不再跳登录、404 页也不出现了。指出这层 catch 吞掉了什么、正确写法。

**Bug 3**
```js
// src/routes/dashboard/+page.server.js
export const prerender = true;           // 想让首屏更快
export async function load({ cookies }) {
  const me = await getMe(await cookies.get('sid'));
  return { me };
}
```
部署后用户 A 在 /dashboard 看到了用户 B 的名字。指出 prerender 用错在哪、怎么改。

**Bug 4**
```js
// src/routes/x/+page.js（universal）
export async function load() {
  const r = await globalThis.fetch('/api/hot');   // 取热门数据
  return { data: await r.json() };
}
```
Network 面板里 `/api/hot` 在首屏被打了**两次**（一次 SSR、一次水合后）。指出破坏了 Kit 哪项开箱优化、正确取数方式。

**Bug 5**
```js
// src/routes/y/+page.server.js
export function load() {
  return { tags: new Set(['a', 'b']), fmt: (x) => x };   // 一个 Set、一个函数
}
```
访问 /y 直接 500。指出 load 返回值经过什么处理、哪些类型过不去、怎么改数据形状。

**Bug 6**
```js
// src/routes/z/+page.js
import { API_SECRET } from '$env/static/private';
export function load() { return { key: API_SECRET }; }
```
`vite build` 或运行时把密钥暴露/报错。指出这条 universal load 触碰了哪条边界、正确通道是什么。

**Bug 7**
```js
// 自托管 server.js（用 @sveltejs/kit 手动装配）
export async function fetch(request) {
  const app = new Server(manifest);      // 每个请求都 new + init
  await app.init({ env: process.env });
  return app.respond(request);
}
```
高并发下 CPU 被重复初始化打满。指出 `Server` 三方法各自的正确调用频次、怎么改。

**Bug 8**
```js
// 期望字体像 js/css 一样被自动预加载，于是啥也没配
// 结果弱网下标题文字先空白后跳位（CLS/LCP 变差）
```
指出 Kit 对字体预加载的默认行为、以及应在哪个钩子、用什么参数补上。

**Bug 9**
```svelte
<!-- +page.svelte -->
<script>
  import { page } from '$app/state';
  if (!page.data.user?.isAdmin) { /* 藏起“删除”按钮 */ }
</script>
```
安全评审说"这不是授权、只是遮眼"。指出客户端数据能否作为授权依据、真正的守卫应放哪两处。

**Bug 10**
```js
// src/routes/settings/+page.server.js
export const actions = {
  save: async ({ request }) => {
    await save(await request.formData());
    return { ok: true };                  // 成功后就这么返回
  }
};
```
用户刷新页面就把同一次提交又发了一遍。指出 action 成功后的正确收尾、以及它同时能防什么。

## 二、手写题（5 题）

**手写 1** 写一份自托管用的服务端入口：`import { Server } from '@sveltejs/kit'`，用构建产物的 `manifest` `new Server(manifest)`、**进程启动时 `await app.init({ env })` 一次**、导出 `fetch(request) => app.respond(request)`。注释标出三方法各在什么频次被调、"SSR 的 render 发生在哪一步内部"。

**手写 2** 把 Bug 1 改成既能在启动时连库、又不误伤构建/预渲染：用 `import { building } from '$app/environment'` 守卫；并写一个 universal load **用事件里的 `fetch`** 取 `/api/hot`（保住数据内联）、只 `return` 渲染必需字段。两处一起给。

**手写 3** 写一对 server load（`+layout.server.js` 取 `user`、`+page.server.js` 取 `items`），注释说明：为什么这**两次**后端取数会被 Kit 归并、以及"先取 user 再据 user 从浏览器串行取 items"（universal 版）为什么会形成瀑布、如何用一次 server 侧 join 化解。

**手写 4** 给首屏做两件性能事：① 用 `@sveltejs/enhanced-img`（`<enhanced:img>`）渲一张主视觉图并说明它如何改善 LCP/CLS；② 在 `handle` 里给 `resolve` 传 `preload` 过滤，把 `src/app.html` 引用的那个 `.woff2` 纳入预加载。两段代码一起给。

**手写 5** 写一个"负责"的 `handleError`：用 `isRedirect(error)` / `isHttpError(error)` 判出后**原样 `throw error`**（绝不吞控制流），真·未预期异常才 `console.error(event.route?.id, event.url, error)` 并按 `App.Error` 形状返回 `{ message: 'Internal Error' }`；再补一句：`error()` 抛的预期错误会不会进到这里？

## 三、场景题（1 题）

你负责把一个中大型 SvelteKit 站推上线，上线前评审 + 上线后首周暴露出如下问题，逐条给排查与修法：

① **构建**：新同事 clone 后 CI 首次 `vite build` 偶发失败于"顶层 import 就执行"的模块——定位到 `hooks.server.js` 与某 `+layout.server.js` 的构建期执行，给统一守卫策略；哪些代码必须包进 `if (!building)`；
② **数据/水合**：某页把 `new Set()`、一个日期格式化函数放进了 load 返回，偶发 500；另一页 SSR 时间戳与客户端首帧对不上报 `Hydration failed`——分别指出 devalue 契约与"两端首帧不一致"两条根因并各给修法；
③ **性能**：Lighthouse 报移动端 LCP 4.6s、CLS 0.21，Network 里看到字体后加载、首页 JS 体积异常大、`/api/*` 出现串行瀑布——给出按 ROI 排序的优化动作，并说明每项主要改善哪个指标；
④ **鉴权/泄露**：渗透测试发现非管理员能直接 POST 到管理员 action，且 HTML 里能搜到一个内部服务地址——给"双层守卫 + load 最小字段 + 私密 env 通道"三处修复；
⑤ **可观测**：线上报一批 500 但容器日志啥上下文都没有。给出你的 `handleError` 结构化日志字段（含 `route.id`、`VERSION`）与"expected 不上报"的区分理由；
⑥ 用一句话回答：为什么以上①②③④⑤必须在 `build + preview`（而非 dev）里回归？这套差异的机制根源是什么？
⑦ 收口：把它整理成一份能贴进 PR 的"上线前 checklist"（至少覆盖路由/load/action/鉴权/部署/性能安全/监控七块，每块一条可验证判据）。

## 四、简答题（3 题）

**简答 1** 写出 `Server` 类三个方法签名，分别说明调用频次（进程一次 / 每请求一次），并指出"SSR 的 render()"这条流水线从 `handle` 到 `Response` 的完整顺序。

**简答 2** Kit 开箱九项优化里，"数据内联"和"请求合并"各自依赖你怎么写 load 才生效？各给一个会亲手破坏它的反例写法。

**简答 3** 用两三句说清"Kit 首屏像 MPA、站内跳转像 SPA"分别对应哪条机制路径；为什么客户端导航不必重新请求整份 HTML。

## 五、挑战题 🏆

**"上线首周的连环案"**：一个后台在 `vite dev` 全程正常，一到 `build + preview` / 线上就同时出现四种怪象：
(a) 改了 `+page.server.js` 的 load 后，**点链接进该页拿到旧数据、强刷才更新**——从"客户端导航拉 load 数据 + 保守失效"机制解释成因，给出正确的 `depends`/`invalidate` 修法；
(b) 一个只读 `+server.js` 端点把**源站打到过载**——指出 Kit 端点的缓存默认模型，给出 `Cache-Control`/`ETag` + CDN/edge 的显式加缓存方案；
(c) 某页**偶发 `Hydration failed`**，其 load 里 `return { now: Date.now() }` 且首帧直接渲染——解释两端各算一次为何不一致，给"服务端定值下发"与"首帧占位、`$effect` 后填"两种修法；
(d) 综合：为什么 (a)(b)(c) 三者**只有 build+preview/线上才暴露、dev 不暴露**（机制层面），并设计一套防回归组合——至少一条 Playwright e2e（跑 build+preview、断言无 hydration 报错且软导航能拿到新数据）+ 一条体积/缓存 CI 门禁（visualizer 体积阈值或响应头断言），说清各自挡住哪类退化。

---

**本阶段关键词**：Server(manifest)/init/respond、SSRManifest、generateManifest、两阶段构建(Vite→adapter)、building 守卫、构建期执行 load/hooks、prerender 在第一阶段、manifest 四类内容(nodes/matchers/路由匹配表/版本资源)、handle→resolve→匹配→逐层load→SSR render→Response、resolve 内/外抛错、别 catch 吞 redirect/error、?_data 数据请求、客户端导航=拉数据+局部重渲、首屏像MPA站内像SPA、开箱九优化、request coalescing、parallel loading、data inlining(用 load 的 fetch)、conservative invalidation、字体不自动preload→handle resolve preload过滤、enhanced-img、visualizer/minify:false、动态import vs 静态、Partytown/服务端分析、瀑布(server load 一次 join)、预加载要节制、SPA模式首屏瀑布、非必需数据返promise流式、HTTP/2+小文件并行、前后端同机房/边缘、devalue 序列化契约、授权双层守卫、客户端 $page.data 非授权依据、登出三件套、误prerender串页、密钥泄露三路径、端点无自动缓存、渐进增强无JS提交、handleError 上报 route.id/VERSION、expected 不过 handleError

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🎓 **12-sveltekit 终点站**：L9 交付即整包 27 关满配。下一步把本清单变成真实毕业项目的 PR 评审表逐条签字上线；随后可开新包 13-solid（SolidJS）。
