# 错误与加载：error.js、global-error 与兜底体系

性能关讲了怎么"跑得快"，这一关讲怎么"摔得体面"。App Router 把错误处理也做成了文件约定：往段目录里放一个 error.js，这个段及其以下所有子路由的渲染错误就有人接住了（段的配置旋钮家族再添一员，呼应 next-fetch-cache 第 5 节段配置）。

## 1. 错误文件全家福

| 文件 | 接住什么 | 位置规则 |
|------|----------|----------|
| `error.js` | 该段及子树的渲染错误 | 每个段都可放，就近捕获 |
| `global-error.js` | 根 layout 自身的错误 | 只能放 app/ 根，必须自己包 `<html><body>` |
| `not-found.js` | `notFound()` 调用 / 404 | 就近段的 not-found 渲染 |
| `forbidden.js` / `unauthorized.js` | `forbidden()` / `unauthorized()` | 403/401 的声明式兜底 |
| `loading.js` | 该段加载中的 Suspense fallback | 见 next-context-streaming 第 2 节 |
| `redirects`/`rewrites` | next.config 里的 URL 搬迁规则 | 不是文件约定，是配置 |

关键心智：**错误边界 = 段边界**。React 的 Error Boundary 机制（componentDidCatch 家族）被框架按目录结构自动布好了点，你不再手写 class 组件（呼应 react-architecture 的错误边界一节）。

## 2. error.js 怎么写

```tsx
// app/dashboard/error.tsx
'use client';  // error 组件必须客户端渲染——它要在"React 都炸了"时工作

export default function Error({
  error, reset, digests,
}: { error: Error & { digest?: string }; reset: () => void; digests: string[] }) {
  return (
    <div>
      <h2>出错了：{error.message}</h2>
      <p>错误编号：{error.digest}</p>
      <button onClick={() => reset()}>重试</button>
    </div>
  );
}
```

三个必须知道的点：

1. **`'use client'` 是硬性要求**，错误 UI 本身不能再依赖服务端渲染链路；
2. **digest 是排查生命线**：服务端真实错误堆栈只会以 digest 形式出现在日志里，浏览器控制台看不到（防止泄漏内部信息）。页面展示 digest、日志系统按 digest 检索，是标准配合（第 4 节）；
3. **reset() 不是刷新**：它清的是该段的错误状态并重新渲染子树，比重载整页体验好得多。

捕获顺序由近及远：子段的 error.js 先接，没写就冒泡到父段，最后到 global-error。所以布局策略是——**每个功能段放轻量 error（只坏一块），根上放 global-error 兜底（保整体）**，这就是"错误边界粒度=故障爆炸半径"（呼应 next-boundaries 第 3 节边界思维）。

## 3. 声明式中断：notFound / forbidden / redirect

服务端代码里不再"抛字符串自己接"，框架给了三个语义化信号：

```tsx
// app/articles/[slug]/page.tsx
import { notFound, forbidden, redirect } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();          // 渲染就近的 not-found.js，响应码 404
  if (!post.visible) forbidden(); // 403，渲染 forbidden.js
  if (post.movedTo) redirect(`/articles/${post.movedTo}`); // 307 跳转（呼应 next-link-router 第 3 节）
  return <Article post={post} />;
}
```

注意三者都靠 throw 中断执行，**不要包在 try/catch 里**，否则信号被吞（和 next-forms-mutations 里 redirect 进 Action 的坑同源）。not-found.js 页面记得给返回首页的出口，并在 metadata 里配 robots 不允许索引 404（呼应 next-metadata 第 3 节）。

## 4. 日志与监控：错误不能只给用户看

用户看到的永远是友好 UI，工程师看到的是另一套：

- **服务端日志**：error.js 拿不到堆栈，真实堆栈在服务端 stdout / 平台日志里，用 digest 对齐。Node 侧日志落盘与轮转思路同 node-config（呼应 node-config 第 4 节）；
- **异常上报**：接入 Sentry 等 SDK，Next 官方模板就是 `instrumentation.ts` + onRequestError / 客户端 onError 双通道。`instrumentation.ts` 是 v14+ 的框架级启动钩子，服务端/Edge 运行时各执行一次：

```ts
// instrumentation.ts（app/ 同级）
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { onRequestError } = await import('./sentry');
    // 注册全局错误钩子
  }
}
```

- **告警维度**：按路由段聚合错误率、盯 digest 突增；404/forbidden 数量异常往往意味着爬虫或越权探测（呼应 next-middleware-auth 第 5 节）。

## 5. loading.js 的深层意义：把"等"设计出来

呼应 next-context-streaming 的骨架屏三标准，从故障处理视角补一句：**loading.js / Suspense 本质是"可预期性的错误预防"**——没有占位的慢页面会被用户判定为"白屏 bug"，刷新、重复提交连锁反应比真 bug 还难查。所以：任何 await 数据的段都应有 loading 反馈；用 Router Cache 命中的导航不会闪 loading，这是特性不是 bug（呼应 next-fetch-cache 第 6 节）。

## 6. 自检清单

- [ ] 每个功能段是否有就近 error.js？根上是否有 global-error.js（带自包 html/body）？
- [ ] error UI 是否展示了 digest 和重试按钮？
- [ ] 业务"查无此资源"是否统一用 notFound() 而非返回 null？
- [ ] notFound/redirect 是否避免了被外层 try/catch 吞掉？
- [ ] 服务端是否有 digest → 日志 的检索链路？客户端是否接了 onError 上报？
- [ ] 404/403 页面是否可导航回主流程、是否禁止索引？

## 7. 小结

App Router 的错误体系=文件约定 + 段边界 + 声明式信号：error.js 管崩溃、not-found/forbidden 管业务中断、global-error 管最后一道命、loading 管"慢到像死"的灰色地带，digest 把用户侧与工程师侧的两次呈现缝合起来。兜底做全，下一关才能放心谈测试验证。

🚀 部署预告：错误体系管的是线上事故，那上线前呢？下一关 next-testing 讲如何给 async 服务端组件、Server Actions 与整站流程写测试，把事故扼杀在 CI 里。
