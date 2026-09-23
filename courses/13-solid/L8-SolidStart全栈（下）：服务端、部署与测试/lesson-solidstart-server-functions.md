# 服务端函数与数据变更："use server" 的完整用法

> 目标：把 L7 只见过一面的 `"use server"` 用成完整动作层——函数级/文件级两种形态、action 与 single-flight mutation、参数序列化、拿请求上下文——能独立实现"表单改数据、UI 自动跟上"的全链路。呼应课业「会用 SolidStart 组织全栈应用」的服务端半。

## 一、"use server" 是编译器认的指令串

官方参考页的定义极朴素：`"use server"` 是**服务端函数编译器识别的指令字符串**，不需要任何 import。编译后：
- **客户端构建**里，被转换的"服务端引用"走客户端运行时（实际发一次远程调用）；
- **SSR 与 server-function 构建**里走服务端运行时；
- 合法的转换模块会被加进**服务端函数 manifest**（清单）。

两种写法都合法：
```ts
// 函数级：函数体首行
const logMessage = async (message: string) => {
  "use server";
  console.log(message);
};

// 文件级：文件首行，整个模块导出的函数都是服务端函数
"use server";
export async function logMessage(message: string) { console.log(message); }
```

## 二、边界纪律：客户端只能"调用"，不能"看见"

服务端函数的意义=**敏感逻辑不出服务端**：写数据库、操作 session、读密钥都放得下（官方 data-mutation 原话：能安全访问 session、执行数据库删除，**而不把这些逻辑暴露给客户端**）。review 红线仍是那条——碰到服务端资源，函数/文件必须有这个指令。

## 三、序列化：参数和返回值怎么跨端

调用参数与结果要**序列化后在两端之间搬运**。配置在 `serialization.mode`：
- **`json`**：客户端用 JSON.parse，**最适配严格 CSP**（不依赖 eval），载荷略大；
- **`js`**：Seroval 的 JS 序列化，**载荷更小、性能更好**，但客户端反序列化依赖 eval、CSP 要 unsafe-eval。
默认值分代：**v1 为兼容默认 js；v2 默认 json**。默认启用的 Seroval+web 插件集支持 `FormData/Headers/Request/Response/URL/URLSearchParams/AbortSignal/Event` 等类型——表单直传 FormData 因此自然。

## 四、动作层：action 套 server function

数据变更用 Solid Router 的 **`action`**，把 `"use server"` 放进 action 体，整个动作就只在服务端跑：
```ts
import { action, redirect } from "@solidjs/router";
const logoutAction = action(async () => {
  "use server";
  const session = await useSession({ password: process.env.SESSION_SECRET, name: "session" });
  if (session.data.sessionId) { await session.clear(); /* db 删除… */ }
  throw redirect("/");   // redirect 用 throw 传递
}, "logout");
```
`<form action={myAction.with(id)} method="post">` 直接绑表单——官方登出/改商品名两例皆此形态。

## 五、Single-flight mutation：一次请求完成"改+取"

传统两步走：1 个请求更新、再来 1 个请求拉新数据。**Single-flight mutation 把这两步压成一次请求**——SolidStart 的特色能力，两个前提：
1. action 必须是**服务端函数**里执行的 action；
2. 被改的数据必须**被 preload**（若 action 会 redirect，则预加载放在目标页）。

机制：表单提交发一个 POST；action 完成后，框架**自动 revalidate** 相关 query；因为数据已 preload，服务端能直接重校验并**把结果流式塞回同一个响应**。
```ts
const updateProduct = action(async (id, formData: FormData) => {
  "use server"; await db.products.update(id, { name: formData.get("name")?.toString() });
}, "updateProduct");
const getProduct = query(async (id) => { "use server"; return db.products.get(id); }, "product");
export const route = { preload: ({ params }) => getProduct(params.id) } satisfies RouteDefinition;
```

## 六、拿请求上下文：getRequestEvent

服务端函数里要知道"这是哪个请求"（headers、url…）用 `getRequestEvent()`；中间件之外访问请求/响应上下文的正规口子就是它（配套还有 `getServerFunctionMeta` 查当前服务端函数元信息）。

## 七、什么时候用 query、什么时候用 action

| 意图 | 用 | 触发面 |
| --- | --- | --- |
| 读（可缓存、可预热） | `query`（+"use server" 若触服务端资源） | createAsync / route.preload |
| 写（改状态/删数据/登出） | `action`（+"use server"） | `<form>` 提交、命令式调用 |
| 纯后端端点给外部用 | API 路由（导出 GET/POST） | HTTP |

三者共用同一套服务端函数编译与序列化机制——**一套指令、三种入口**。

## 八、自检清单

- [ ] 能写出函数级与文件级两种 "use server"，并说清编译器对客户端/服务端各生成什么
- [ ] 知道 json/js 两种序列化模式的取舍与 v1/v2 默认差异
- [ ] 能背出 single-flight mutation 的两个前提与"一次请求完成改+取"的机制
- [ ] 会用 action.with() 绑表单、throw redirect 做跳转
- [ ] 知道 getRequestEvent / getServerFunctionMeta 的用途

🚀 **下一站**：SSR 模式与部署（solidstart-ssr-deploy）——ssr 开关、prerender 静态化、Nitro 预设与各家托管平台。
