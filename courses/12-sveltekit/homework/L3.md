# L3 阶段作业：load 数据协议

> 覆盖：kit-load-universal / kit-server-modules / kit-streaming

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**
```ts
// src/routes/blog/[slug]/+page.ts
export const load = async ({ params }) => {
  const res = await fetch(`https://api.example.com/posts/${params.slug}`);
  return { post: await res.json() };
};
```
同事坚称"load 的入参里本来就有 fetch，这里只是懒得多写一个解构"。这行 fetch 到底是谁？水合期会多发一次请求吗？

**Bug 2**
```ts
// +layout.server.js 导出 { user, unread }
// 子页 +page.js：
export const load = async (event) => {
  const data = await event.parent();
  const t = setTimeout(() => event.parent(), 0);
  return { theme: 'dark' };
};
```
评审说这份代码有"父子联动"问题。两行 parent 相关代码各错在哪？setTimeout 那行为什么危险？

**Bug 3**
```ts
// +layout.server.js 返回 { count: 1 }，同子树 +page.server.js 返回 { count: 2 }
```
页面里 `{page.data.count}` 显示 2。有人下结论："父先跑后跑，深者赢，所以布局的值永远没用。"这条规则漏了什么关键前提？（提示：换一个读取位置）

**Bug 4**
```ts
// +page.server.js
event.cookies.set('theme', 'dark', { path: '/blog' });
event.cookies.set('theme', 'light');
```
期望"第二条覆盖第一条"，实际浏览器里两条 Set-Cookie 都在。为什么 set 不是覆盖语义？想让它们互相覆盖，第三个参数里必须对齐什么？

**Bug 5**
```ts
// +page.server.js
import { PUBLIC_URL } from '$env/static/private';
```
本地 Node 跑得好，CI 构建报"该模块不存在导出"。$env 家族的静态/动态、public/private 四个象限里，这行踩了哪两个雷？

**Bug 6**
```ts
// src/routes/widgets/+page.js（universal）里 import 了含 Prisma 客户端的 $lib/server/db
```
构建直接失败。报错的是"universal 文件"还是"浏览器可达代码"这个身份？把 db 挪到 src/lib/db.ts（lib 根）能过构建吗？泄漏面变成什么？

**Bug 7**
```ts
// src/routes/api/v1/status/+server.ts
export function GET() { return json({ ok: true }); }
export const ssr = false;
```
同事在端点文件里导出开关，说"和页面文件同款姿势"。prerender 可以这样导、ssr 这样导有意义吗？

**Bug 8**
```ts
// +page.server.js
export const load = async ({ params }) => {
  return {
    post: await loadPost(params.slug),
    comments: loadComments(params.slug).catch(() => []),
  };
};
```
"已经挂了 catch，很安全"。流式编排上这代码仍有一个性能 bug 和一个语义 bug：分别是什么？（语义 bug 提示：comments 出错时用户看到什么？）

**Bug 9**
文章页 SSR 部署在 AWS Lambda 上，正文等评论接口 2 秒后才整页出现。代码里明明有未 await 的 Promise。查两层：平台层官方点名的行为是什么？如果想让评论干脆不拖页面，模板侧配合流式的指令写法是什么？

**Bug 10**
1.x 老项目升级 2.x 后，有人把 `return Promise.all([a, b])` 改成顶层 return 单个 Promise，说"2.x 顶层 Promise 会流式了，这样评论就能晚点出"。但页面首屏反而整体延迟。1.x→2.x 顶层 Promise 的语义到底变在哪？"流式"对**返回值的什么位置**生效？

## 二、手写题（5 题）

**手写 1** 写 `src/routes/blog/[slug]/+page.server.js` 的完整 load：①未登录（locals.user 为空）**同步** redirect(308, '/login')——必须发生在开始流式之前；②慢推荐位与慢评论以未 resolve 的 Promise 形式进流；③正文 await 后尽早出。利用对象字面量求值顺序写出"无瀑布"版本，并给两个流式 Promise 各补 catch 兜底。

**手写 2** 订单列表局部刷新闭环：`+page.ts` 里 depends('app:orders') 并 event.fetch('/api/orders')；组件里取消订单的函数 await 一个 action 成功后，只让订单数据重跑——写出 invalidate 调用与标识符命名合法性的依据（为什么不能写 'Orders' 或 'order:s' 开头大写）。

**手写 3** 三层数据接力：根 `+layout.server.js` 返回 { user }，`blog/+layout.server.js` 返回 { categories } 并透传 user，`blog/[slug]/+page.server.js` await parent() 拿两者 + params.slug 查正文。写出三个文件的 load 签名与返回形状；追问作答：blog 那层如果**删掉** +layout.server.js，页面读 user 还成立吗？为什么？

**手写 4** 给 `satisfies PageServerLoad` 的端点外一题：在 `src/routes/rss/+server.js` 里导出 GET——读私有 env 的 feed 密钥调上游、返回 text/xml 的 Response、并导出 `prerender = true` 让它烘成静态文件。写出 8 行以内代码，并一句话说明 prerender 版这条端点还能读到运行时私有 env 吗？

**手写 5** 判断执行侧默写：`+page.server.js` / `+page.js` / `+layout.server.js` / `+layout.js` 四文件同目录齐全。按顺序写出首访 SSR 时的 load 执行序列（含跑在 Node 还是浏览器、共几次），再写出二次访问（纯客户端导航进入）的序列。

## 三、场景题（1 题）

后台"文章管理"子树落地以下 6 条需求，画出 src/routes/admin 下完整文件清单并写明每个 load 的导出要点：
①顶栏全局统计（全站待审数）——切分类 tab 时**不重跑**；
②列表数据依赖 category 与 page 两个参数，翻页只重跑列表；
③批量操作成功后只刷新统计与列表两处，不整页闪；
④一条第三方慢链路（外部素材库）要进流式骨架，且失败时页面不能崩；
⑤该子树全部要求服务端权威鉴权（session 过期即踢），且**不能**依赖 layout load（提示它的缓存粘性）；
⑥其中 /admin/tools/health 是一个给监控拉取纯 JSON 的接口，不应执行任何页面 load。
附加一问：需求⑤的落点文件里，鉴权失败的 throw redirect 对"页面导航"与"fetch 来的 JSON 请求"两种进入方式，响应分别长什么样？

## 四、简答题（3 题）

**简答 1** 默写 load 重跑条件全清单（params/url 属性/searchParams 逐参数/parent 双向/depends/invalidateAll 六组），并用一句话解释"server load 不自动依赖它 fetch 的 URL"的设计动机。

**简答 2** event.fetch 的五条特性各是什么（凭证继承、相对 URL、本站端点直达、响应内联、headers 过滤）？其中哪一条决定了"水合零二次请求"，哪一条决定了"平级子域拿不到 cookie"？

**简答 3** 用 60 字以内说清"什么进 server、什么进 universal"的判据，然后各给一个反例：什么数据放进 server load 是多余的一层？什么值放进 server load 会直接违约？

## 五、挑战题 🏆

同目录四件套行为推演：`+layout.server.js` 返回 `{ a: 1, slow: promiseP }`，`+layout.js` 写 `export const load = ({ data }) => ({ ...data, a: data.a + 1 })`，`+page.server.js` 返回 `{ b: 2 }`，`+page.js` 不写。①页面最终拿到的 data 形状与 a 的值？②`slow` 这个流式 Promise 在哪一层还能被 {#await} 到、在哪一层已经变成 devalue 还原后的"新 Promise"？③把 +layout.js 删掉，行为变吗——"缺 universal 模块隐式视作 ({data}) => data"这条规则在这里如何体现？④若给这个布局导出 `prerender = true` 而 server load 读了运行时私有 env，构建期会发生什么？逐问作答并各附一条官方依据。

---

**本阶段关键词**：devalue 契约、cookies 双端不对称、setHeaders 红线、parent 隐式转发、同名遮蔽与 page.data、depends/invalidate、credentials include 全禁、$lib/server 执法、static/dynamic env、端点三件套、await 放最后、universal 不流式、缓冲平台、noop catch、1.x 顶层 await 语义

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 ①③ 两问即得 5 分基础分。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L4**：kit-form-actions——`<form>` 直连服务端的渐进增强写法：actions 契约、_pending/$form 状态与 use:enhance 接管。
