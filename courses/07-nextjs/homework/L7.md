# L7 作业：性能、错误与测试

> 覆盖关卡：next-perf / next-error-loading / next-testing。五段式 20 题，先独立完成再对答案。

## 第一段：读代码找 Bug（10 题）

**题 1**
```tsx
// app/dashboard/error.tsx
export default function Error({ reset }) {
  return <div>出错了 <button onClick={reset}>重试</button></div>;
}
```
这段 error 组件缺了什么会导致构建报错？

**题 2**
```tsx
const Heavy = dynamic(() => import('./heavy'), { ssr: false });
```
首屏 LCP 元素就是 Heavy 渲染的封面区。指出这个配置对性能指标的伤害与改法。

**题 3**
```tsx
export default async function Page() {
  const a = await fetch('https://api.x/list1').then(r => r.json());
  const b = await fetch('https://api.x/list2').then(r => r.json());
  return <Board a={a} b={b} />;
}
```
TTFB ≈ 两个接口耗时之和。给出最小改动的修复。

**题 4**
```tsx
try {
  const post = await getPost(slug);
  if (!post) notFound();
  return <Article post={post} />;
} catch (e) {
  return <div>加载失败：{e.message}</div>;
}
```
访问不存在的文章时没有渲染 404 页而是显示了"加载失败"。为什么？

**题 5**
```tsx
// app/global-error.tsx
export default function GlobalError({ error }) {
  return <main><h1>站点异常</h1></main>;
}
```
根布局崩溃时这个页面的渲染会出什么问题？

**题 6**
```tsx
<Link href="/docs/intro" prefetch>文档</Link>
```
页面里有 500 个这样的链接，列表页加载时网络打满。指出问题与两种缓解手段。

**题 7**
```tsx
// app/articles/[slug]/page.tsx
export default function Page({ params }) {
  const { slug } = params; // 直接同步解构
  return <h1>{slug}</h1>;
}
```
Next 15 生产构建行为与本地 dev 不一致，某路由 params 显示为 `[object Promise]`。错在哪？

**题 8**
```ts
vi.mock('@/lib/db');
test('文章页', () => {
  render(<ArticlePage />); // 未 await
  expect(screen.getByText('Hello')).toBeInTheDocument();
});
```
服务端组件测试直接失败找不到元素。给出两处修正。

**题 9**
```ts
import GET from '@/app/api/posts/route';
test('列表接口', async () => {
  const res = await GET();
  expect(res.body.id).toBe(1);
});
```
这个 Route Handler 测试写法有两处不符合 Web Standards 契约，指出。

**题 10**
```tsx
<button onClick={() => { throw new Error('boom'); }}>炸</button>
```
点击后该段的 error.js 没有接住这个错误。为什么？错误最终由谁处理？

## 第二段：手写编程（5 题）

**题 11** 写一个"错误率门闩"组件：包一层 `<Timeout>`，若 children 渲染超过 3 秒则显示降级 UI 而不是继续 loading（提示：Suspense + 服务端超时可用 `Promise.race` 思想，客户端可用 error boundary 主动 throw）。

**题 12** 给 Server Action `transferMoney(from, to, amount)` 写完整的三分支单测：成功返回 `{ok:true}`、余额不足返回 `{ok:false, error:'insufficient'}`、未登录 rejects 重定向到 /login。mock 边界自定。

**题 13** 写一个 Playwright 测试：用户从 /login 用错误密码登录 → 停留登录页且看到错误文案 → 正确密码登录 → 跳转 /dashboard 且头像可见。要求用 role/label 选择器。

**题 14** 实现一个 `useWebVitals()` 客户端 hook 的思想版伪代码：如何在 Next 布局中挂载 web-vitals 上报，且只上报每页最差一次？

**题 15** 用 `@next/bundle-analyzer` 改写 next.config.js，实现 `ANALYZE=true pnpm build` 输出 server 与 client 两份 Treemap。

## 第三段：场景题（1 题）

**题 16** 电商商品详情页：LCP 4.2s（不合格）、INP 380ms（不合格）、偶发 500。已知信息：首图是 `<img>` 直引第三方 CDN；评价区整个页面一起 await；页头搜索框组件 200KB JS。请给出归因表和按 ROI 排序的优化方案，并说明每项优化对应哪个指标。

## 第四段：简答（3 题）

**题 17** 为什么 error.js 拿不到服务端组件的真实堆栈？digest 机制的设计动机是什么？

**题 18** "mock 只放外部依赖，业务规则永不 mock"——用你自己的话解释并各举一个正反例。

**题 19** 简述测试金字塔在 Next 全栈应用里的四层对象分别是什么，各自选什么工具。

## 第五段：挑战题 🏆（1 题）

**题 20** 🏆 为 07 包迄今所学设计一套"上线前质量门禁"流水线脚本清单：从 lint/typecheck → build（含 bundle 体积红线）→ 单测 → Playwright 冒烟 → Lighthouse CI 指标卡点。写出每一步的命令、失败阻断策略，并标注哪些环节复用了 09-express/10-vite 课的思路。
