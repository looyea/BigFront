# Route Handlers（API 路由）

> 目标：Next 里的"`app/api/*/route.ts`"是什么、不是什么。它是 **Web 标准 Request/Response 风格的接口层**，不是"内嵌的迷你 Express"。本课讲：方法导出与动态默认、NextResponse 的糖、三大正当用途（webhook/BFF 聚合/流式响应）、以及和 09-express 的分工宣言。呼应 **exp-server**（中间件管线）、**exp-rest**（资源设计）、**node-http**（Request/Response 本尊）。

---

## 一、形态：一段目录的"HTTP 方法导出"

```ts
// app/api/hello/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {          // 文件名固定 route，方法=导出函数名
  const q = new URL(req.url).searchParams.get('q');
  return NextResponse.json({ ok: true, q });
}
export async function POST(req: Request) {
  const body = await req.json();
  return new Response(JSON.stringify({ echo: body }), { status: 201 });  // 原生 Response 完全合法
}
```

- 支持 `GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS`（+ 实验 `handler` 全方法）；
- route.ts 可与 page.tsx **同目录共存**：浏览器导航永远命中 page，route 只响应直接对 API 的 fetch——但为可读性建议把接口集中到 `app/api/**`，别在同一段里双开门（前课 next-routing 面试第 2 题回收）；
- `params` 同样异步：`export async function GET(req, ctx: { params: Promise<{id:string}> })`。

**默认全动态**：Route Handler 不参与 Full Route Cache（GET 想缓存要配 `export const dynamic='force-static'` 或走 CDN 层）——接口世界"默认实时"与页面世界"默认静态"正好镜像，别拿页面直觉套（呼应 next-revalidate 第二节）。

---

## 二、NextResponse：Response 的三块糖

```ts
NextResponse.json(data)                      // 省手动 stringify+content-type
NextResponse.redirect(url)                   // 3xx
res.cookies.set('sid', v, { httpOnly: true, sameSite: 'lax', secure: true })  // 读写 cookie 双功能
req.cookies.get('sid')                       // 读也可走 Request 侧
```

中间件那套 `NextResponse.next()/rewrite()` 在 L5 见。**没有 `res.send/res.status().json()` 链式糖**——Web 标准的 `Response` 是不可变对象，状态/头都在构造参数里，写过 node-http 原生版的人秒懂（呼应 node-http 的 res 对象对比）。

---

## 三、什么时候**该**写 Route Handler（三正当用途）

1. **Webhook 接收**：支付/第三方回调必须有固定 URL 端点、验签、快速 200——放这里省一次网络跳（内网同源）；
2. **BFF 聚合/裁剪**：客户端要 3 个上游拼合的数据，一次 handler 内 `Promise.all` 聚合再下发（隐藏上游地址与密钥，呼应 exp-server 的 BFF 论、mp-network 的域名收敛）；
3. **流式/特殊协议响应**：SSE（`ReadableStream` 直接 return）、文件下载、`text/event-stream` AI 输出——Response 天然支持 ReadableStream，而 Express 要靠 res.write 脚手架手搓（呼应 exp-server 的响应链对比）。

**什么时候不该**：CRUD 领域服务（该是独立后端，09 全包论证过）、长连接 WebSocket 服务（Node 独立进程更顺手，node-net 的地盘）、任何"其实是页面取数"的需求（RSC 直接 await，何必 HTTP 绕一圈——"接口是给渲染的解药，不是调料"）。

---

## 四、鉴权与校验： Express 老友的移植清单

| 09-express 的原则 | Next 里的对应写法 |
|---|---|
| 中间件统一鉴权 | handler 首行 `await getSession()` 或封装 `withAuth(handler)` 高阶函数 |
| 输入校验（zod） | `Schema.parse(await req.json())` + 统一错误映射 `{ error }`→400 |
| 限流 | edge 不便存状态 → 平台 KV 或上游网关做（node-config 的 env 注入） |
| 响应约定 | NextResponse.json + 状态码语义同 exp-rest 那张表 |

```ts
export const POST = withAuth(async (req, ctx) => {
  const dto = CreateSchema.parse(await req.json());     // 抛错 → 统一错误响应
  await createOrder(ctx.uid, dto);
  revalidateTag(`orders-${ctx.uid}`);                   // 写侧失效（L4 闭环）
  return NextResponse.json({ ok: true }, { status: 201 });
});
```

高阶函数 `withAuth` 就是 Express 中间件的"函数式转世"——同一条管线思想换了一种宿主（呼应 exp-patterns、es-closure 的闭包复用）。

---

## 五、Edge 与 Node 双运行时

```ts
export const runtime = 'edge';   // 该 handler 跑在轻量隔离运行时：冷启动亚毫秒、就近部署
```

- Edge：无 Node API（fs/child_process/多数 npm 原生包）、有 Web API+平台 KV；适合鉴权判断、A/B、轻量聚合；
- Node（默认）：全家桶都在，DB 驱动、图像处理随便用；
- **同一项目的不同 route 可以不同 runtime**——但 import 图不能横跨（edge 文件不许间接拉到 node-only 包，构建期就报）。心智对照小程序"分包环境差异"：先定运行时再选依赖（呼应 mp-subpackage 独立分包自包含）。

---

## 六、自检清单

- [ ] route.ts 的默认缓存姿态与 page 有何镜像差异？
- [ ] NextResponse 比原生 Response 多了哪三块糖？
- [ ] Route Handler 的三正当用途与一反例？
- [ ] Express 的中间件鉴权在 Next 里怎么移植？
- [ ] runtime 混用时的依赖红线是什么？

---

## 🚀 部署预告

- L4 收官：读（fetch 缓存/段策略）写（Route Handler）两翼齐飞；进入 **L5**——**next-server-actions** 把"表单提交"变成"函数调用"，Web 的无 JS 渐进增强在 React 阵营复活（对照 mp-login 的授权流你会对"端点式表单"有全新体感）。
