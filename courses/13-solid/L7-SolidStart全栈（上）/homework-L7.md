# L7 阶段作业 · SolidStart 上（框架、路由、数据）

> 范围：SolidStart 总览与项目结构、文件路由全套约定、query + createAsync + "use server" + route.preload。共 10 Bug + 5 手写 + 1 场景 + 3 简答 + 1 挑战。

## 一、找 Bug（每题 3 分）

**Bug 1**
```bash
# 同事在 Node 18 的机器上执行
npm init solid   # 选 SolidStart v2 模板
npm i && npm run dev   # 报错/行为怪异
```
v2 文档对运行环境有什么硬性要求？

**Bug 2**
```tsx
// app.tsx
export default function App(props) {
  return (
    <Router root={() => <div>{props.children}</div>}>
      <FileRoutes />
    </Router>
  );
}
```
切路由时偶发"意外的水合错误"。官方点名缺了什么？

**Bug 3**
```tsx
// src/routes/dashboard.tsx
async function handler() { /* ... */ }
export default handler;   // 想让它成为 /dashboard 页面
```
访问 /dashboard 白屏不渲染。default export 的约定错在哪？

**Bug 4**
```tsx
// src/routes/api/ping.ts
export default function GET() { return new Response("pong"); }
```
`/api/ping` 不生效。API 路由的识别条件是什么？

**Bug 5**
```tsx
// routes/blog.tsx 与 routes/blog/ 目录并存
export default function BlogLayout(props) {
  return <div><h1>Blog</h1></div>;  // 子页面内容消失了
}
```
布局把子路由"吃"了。补什么？

**Bug 6**
```tsx
const getUser = query(async () => {
  const session = await useSession({ password: process.env.SECRET });
  return session.data;
}, "user");
```
构建后客户端 bundle 里能搜到 SECRET 读取逻辑。query 体里缺了哪一行？

**Bug 7**
```tsx
const posts = createAsync(() => getPosts());
const firstTitle = posts().title;   // 组件函数体第一行就这么写
```
运行报 `cannot read property of undefined`。两个错各在哪？

**Bug 8**
```
routes/
├── users/
│   └── index.tsx        // /users
└── users/
    └── [id].tsx         // 想有 /users/:id —— 但目录写成两个 users
```
同目录下既想要 users 布局、又要 /users/1 独立布局不套它，官方给的文件命名手法是什么？（先指出上面结构的问题）

**Bug 9**
```tsx
// 期望 /help/a/b/c 全部进同一页
export default function Help(props) {
  const path = useParams().slug; // 返回 ["a","b","c"]？
  return <div>{path.join("/")}</div>;
}
```
文件命名没写 catch-all 形态，且对参数形态的猜想也错了。给出正确文件名与 params 的真实形态。

**Bug 10**
```ts
// vite.config.ts
import { solidStart } from "@solidjs/start/config";
export default defineConfig({ plugins: [solidStart()] });
// 同事把业务中间件逻辑直接写进 src/entry-server.tsx
```
按 v2 的官方口子，中间件应该配在哪？entry 文件的定位是什么？

## 二、手写（每题 7 分）

**手写 1**：给出实现下列 URL 集的最小 routes 目录树（写出文件名即可）：`/`、`/blog`（带子树布局）、`/blog/:id`、`/docs/**`（任意深度共享一页）、`/about-us` 与 `/contact-us`（想按"静态页"分组但 URL 不含分组名）、`/api/health`（GET 接口）。

**手写 2**：写一个详情页 `routes/posts/[id].tsx`：`getPost = query(async (id) => { "use server"; ...fetch... }, "post")`，组件用 **props.params** 消费 `createAsync`，并导出 `route.preload` 预热同一查询。

**手写 3**：把下面"onMount 里 fetch + setSignal"的老写法重构成 v2 两件套，并说明数据瀑布发生了什么变化：
```tsx
const [data, setData] = createSignal(null);
onMount(async () => setData(await (await fetch("/api/list")).json()));
```

**手写 4**：给账户页设计数据层：`useSession` 读取 `{ userId? }`（密钥仅服务端）、query 具名 `currentUser`、组件渲染用户 id 或未登录提示，外层要求不白屏。

**手写 5**：写一段 `app.tsx` 骨架：Router + root 里全局 Suspense + FileRoutes，并给 root 外加一个全站页头页脚（演示根布局文件形态任选），标注每个 import 的来源包。

## 三、场景题（20 分）

**场景：** 你要为"电商后台"设计 Start 端目录与数据层。要求：① `/login` 全屏无侧栏，`/dashboard/**` 十几页共享侧栏布局，其中 `/dashboard/report` 要全屏；② 商品列表页 `/products` 有筛选参数（页码/关键词，走查询串）、要秒开；③ 订单详情 `/orders/:id` 数据要缓存复用（多处入口跳同一单）；④ 所有涉及密钥/DB 的读取绝不下发；⑤ 还要给移动端留一组 `/api/mobile/**` 接口。请给出：目录树（用到本关全部四种括号手法：布局同名、(分组)、(转义)、catch-all）+ 每页查询的具名缓存设计 + preload 策略，并说明哪些文件是 UI 路由哪些是 API 路由。

## 四、简答（每题 5 分）

**简答 1**：app.tsx / entry-client.tsx / entry-server.tsx 三文件各司何职？哪两个一般不碰？

**简答 2**：query、createAsync、"use server"、route.preload 各解决什么问题？用一段话串起来。

**简答 3**：`[[id]]` 与 `[...slug]` 分别在什么业务形态下用？各举一例。

## 五、挑战题（加分 10 分）

🏆 **挑战**：审查下面这段"看似官方其实处处是坑"的代码，找出**至少 5 处**问题并逐条给修法与理由：
```tsx
import { query, createAsync } from "@solidjs/start/router";
const list = query(async () => {
  const r = await fetch("https://api.example.com/items", { headers: { key: process.env.API_KEY } });
  return r.json();
});
export const route = { preload: () => list() };
export default function Items() {
  const items = createAsync(() => list());
  const { name } = items();
  return <ul>{items().map((i) => <li>{name + i.name}</li>)}</ul>;
}
```
(a) import 来源对不对；(b) query 少了什么参数与指令；(c) preload 写法是否成立；(d) 解构 `items()` 的两处时机问题；(e) 渲染层还缺哪个本关学过的约定（列表/边界）。

---

**本阶段关键词**：npm init solid、vite.config.ts/solidStart()、app.tsx/entry 文件、~/ 别名、@solidjs/start/env、FileRoutes、UI/API 路由、[id]/[[id]]/[...slug]、嵌套布局同名文件、(index 改名)、(转义)、(分组)、route config/preload、query、createAsync、"use server"、useSession、Suspense 水合。

**判分口径**：Bug 每题 3 分、手写每题 7 分、场景 20 分、简答每题 5 分、挑战加分 10 分（总分 100+10）。≥72 为合格；挑战题答出 (a)(b) 即得 4 分基础分，(c)(d) 各 +3。

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L8**：SolidStart 下——服务端函数与数据变更、SSR/SSG 与部署、测试。
