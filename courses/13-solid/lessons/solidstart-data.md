# SolidStart 数据加载：query、createAsync 与 "use server"

> 目标：能在路由文件里定义带缓存的数据查询、在组件里以响应式方式消费、把数据函数钉在服务端执行、并用 route.preload 提前预热——理解 v2 数据层"query 定义 + createAsync 读取"的分工。呼应课业「会用 SolidStart 组织全栈应用」的数据半。

## 一、v2 数据加载的骨架：两件套

SolidStart v2 的数据加载围绕 **Solid Router 的 `query` API + `createAsync`**：
- **`query(fn, key)`**：定义一个**带缓存的数据访问**——第二个参数是缓存键；
- **`createAsync(() => fn())`**：在路由组件里**读取结果**，返回可响应的访问器，解析完成前为 undefined 语义。

```tsx
import { For } from "solid-js";
import { createAsync, query } from "@solidjs/router";

const getPosts = query(async () => {
  const res = await fetch("https://example.com/api/posts");
  return res.json() as Promise<Array<{ id: number; title: string }>>;
}, "posts");

export default function PostsPage() {
  const posts = createAsync(() => getPosts());
  return <For each={posts()}>{(post) => <li>{post.title}</li>}</For>;
}
```
分工记牢：**query 管"怎么拿 + 缓存到哪个键"，createAsync 管"在组件里订阅结果"**。缓存失效与高级 query 行为由 Solid Router 负责（官方原话：需要更底层的缓存语义去查 Solid Router 参考）。

## 二、和纯客户端 createResource 的关系

L5 的 `createResource` 是 **Solid 运行时原语**：组件内把异步包成响应式信号。v2 这套是**框架层方案**，多出三件事：
1. **具名缓存键**（"posts"）——同一查询跨组件/跨导航去重，不各拉各的；
2. 可配 **route.preload** 在进路由**之前**发请求；
3. 配 `"use server"` 后**函数体可只在服务端执行**——密钥、DB、session 都不下发。
简单说：Resource 管"响应式地等一个 promise"，query/createAsync 管"**这个 promise 在哪跑、缓存给谁用、什么时候提前跑**"。

## 三、"use server"：把数据函数钉在服务端

查询要用**只在服务端存在的东西**（环境变量、数据库、会话）时，在函数体首行加 `"use server"` 指令——编译后**客户端只得到"调用入口"，函数体只在服务端需要时运行**：
```tsx
import { query } from "@solidjs/router";
import { useSession } from "@solidjs/start/http";

const getCurrentUser = query(async () => {
  "use server";
  const session = await useSession<{ userId?: string }>({
    password: process.env.SESSION_SECRET as string,
    name: "session",
  });
  return { userId: session.data.userId ?? null };
}, "currentUser");
```
若不加指令，query 体就按普通代码走（在调用侧执行）——**"能不能直接摸服务端资源"的分水岭就是这一行**。（同一条 `"use server"` 指令也是 L8 服务端函数的地基。）

## 四、route.preload：导航前把数据热好

想让用户**指针还没点进去、数据已在路上**？在路由文件导出 `route.preload`，把本页的 query 提前发出去：
```tsx
import { query, type RouteDefinition } from "@solidjs/router";

const getPost = query(async (id: string) => {
  "use server";
  const res = await fetch(`https://example.com/api/posts/${id}`);
  return res.json();
}, "post");

export const route = {
  preload: ({ params }) => getPost(params.id),
} satisfies RouteDefinition;
```
预加载命中的是**同一个缓存键**，组件里 `createAsync(() => getPost(props.params.id))` 直接接果，不必等挂载。

## 五、动态参数怎么进查询

v2 的路由组件通过 **props.params** 拿参数（见上例 `props.params.id`），把它传给 query 函数即可做**参数化的按页取数**；`useParams()` 依然可用作命令式读取。注意 query 的缓存键语义由 Router 管理——参数不同是否共享缓存，以 Solid Router 的 query 参考为准，别自创心智模型。

## 六、渲染侧的配套：Suspense 就近挂

`createAsync` 的结果未就绪时组件如何占位？用熟悉的 `<Suspense fallback>` 包住消费方——Start 的 root 布局已全局包了一层（上一关讲的"防意外水合错误"），需要更精细的骨架屏时在**路由组件内部再就近包**。数据与渲染互不阻塞的机制，正是 L5 的 Suspense 非阻塞模型在框架里的落地。

## 七、写数据层的三条纪律

1. **数据访问一律过 query 具名化**——别在组件里裸 `fetch` + effect set 信号（L6 的反模式）；
2. **碰服务端资源必须先加 `"use server"`**——review 时把这一行当安全红线看；
3. **慢查询先想 preload**——路由级预热通常比在组件里做 loading 编排更省事。

## 八、自检清单

- [ ] 能一句话说清 query 与 createAsync 的分工，以及缓存键的作用
- [ ] 知道 `"use server"` 加与不加的区别，能写出 useSession 的例子
- [ ] 会用 `route.preload` 在导航前热数据，并明白它与组件消费共享同一缓存
- [ ] 能解释 props.params 如何驱动参数化查询
- [ ] 能把 createResource 与 query/createAsync 的适用层次讲给别人听

🚀 **下一站 L8**：服务端函数、SSR/部署与测试——把 "use server" 用成完整的动作层，并把应用部署出去。
