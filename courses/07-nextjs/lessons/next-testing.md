# 测试 Next.js：给服务端组件、Actions 和整站流程上保险

上一关的错误体系是"摔了怎么接住"（呼应 next-error-loading），这一关是"尽量别摔"。Next 应用测试的特殊性在于：被测试对象横跨两个运行时——服务端组件是 async 函数、Server Action 是 RPC、页面最终是 HTTP 响应。测试金字塔照旧，但每层的打法都要翻新（测试基础呼应 react-testing、exp-testing）。

## 1. 盘点：都测什么，用什么测

| 对象 | 本质 | 工具 | 层 |
|------|------|------|-----|
| 纯函数/工具库 | 普通 JS | Vitest/Jest | 单元 |
| 客户端组件 | 交互 + 状态 | Vitest + React Testing Library | 组件 |
| 服务端组件 | async 函数返回 React 树 | RTL 直接 await render | 组件 |
| Server Action | 带 'use server' 的异步函数 | 直接 import 调用 | 单元/集成 |
| Route Handler | Web Standards Request→Response | 构造 Request 调用导出的函数 | 集成 |
| 整站用户流程 | 浏览器里的真页面 | Playwright | E2E |

配置层面：Jest 用 `next/jest` 一行接管 SWC 转译（自动处理 JSX、tsconfig、mock `next/image`/`next/link`）；Vitest 则用 `@vitejs/plugin-react`（呼应 vite-intro 的双引擎背景）。

## 2. 服务端组件测试：它就是个 async 函数

RSC 没有 hook 可炸、没有生命周期，测试出奇地简单——渲染它、断言 HTML：

```tsx
// __tests__/article.test.tsx
import { render, screen } from '@testing-library/react';
import ArticlePage from '@/app/articles/[slug]/page';

test('渲染文章标题', async () => {
  // params 在 Next 15 是 Promise，测试里也要 await
  const ui = await ArticlePage({ params: Promise.resolve({ slug: 'hello' }) });
  render(ui); // RSC 输出可直接 render
  expect(screen.getByRole('heading')).toHaveTextContent('Hello');
});
```

关键技巧是**在数据层截断**：组件依赖 DB/fetch，测试就 mock 仓储函数或全局 fetch：

```ts
vi.mock('@/lib/db', () => ({ getPost: vi.fn().mockResolvedValue({ title: 'Hello' }) }));
// 或 mock fetch（呼应 next-fetch-cache：next 对 fetch 动了手脚，测试里也要按它的签名来）
vi.stubGlobal('fetch', vi.fn(async (url) =>
  new Response(JSON.stringify({ title: 'Hello' }), { headers: { 'content-type': 'application/json' } })));
```

断言别贪多：服务端组件测"渲染了什么/没渲染什么、状态码分支（notFound 触发）",不测样式。

## 3. Action 与 Route Handler：按函数契约测

Server Action 去掉网络层后就是普通 async 函数，直接调用断言返回值与副作用（呼应 next-server-actions 第 1 节"序列化端点"的另一面）：

```ts
import { createPost } from '@/app/posts/actions';
const state = await createPost({}, formDataWith('title', 'T1'));
expect(state.ok).toBe(true);
expect(mockDb.insert).toHaveBeenCalledOnce();
// 重定向断言：redirect 抛的是特殊信号，用 rejects 匹配
await expect(createPost({}, emptyForm)).rejects.toThrow(/NEXT_REDIRECT/);
```

Route Handler 测的是 Web Standards 契约（呼应 next-route-handlers 第 1 节）：

```ts
import GET from '@/app/api/posts/route';
const res = await GET(new Request('http://test/api/posts'));
expect(res.status).toBe(200);
expect(await res.json()).toEqual(expect.arrayContaining([expect.objectContaining({ id: 1 })]));
```

鉴权分支务必测"未带 cookie 时 401"——auth 逻辑的 bug 都是安全事故（呼应 next-middleware-auth 第 2 节三层纵深）。

## 4. E2E：Playwright 走真流程

组件测试证明"零件合格"，E2E 证明"整车能开"。Next 项目里 Playwright 三件套：

```bash
pnpm dlx playwright install --with-deps
npx playwright test --ui   # 时间旅行调试界面
```

```ts
// e2e/post.spec.ts
test('发布文章全流程', async ({ page }) => {
  await page.goto('/articles');
  await page.getByRole('link', { name: '写文章' }).click();
  await page.getByLabel('标题').fill('测试文章');
  await page.getByRole('button', { name: '发布' }).click();
  // Server Action 提交后断言跳转与落库呈现
  await expect(page).toHaveURL(/\/articles\/.*test/);
  await expect(page.getByRole('heading', { name: '测试文章' })).toBeVisible();
});
```

实践要点：① CI 里 `webServer` 配置自动 `next start` 拉起被测实例；② 只测黄金路径（登录、下单、发布），错误分支交给组件测试，否则 E2E 套件跑不动；③ 用 `data-testid` 锚定关键节点，但优先 role/label 选择器（可访问性顺带被检验）；④ 时间旅行截图 + trace.zip 归档是排查 CI 偶发失败的标准姿势（呼应 exp-testing 的 CI 思想）。

## 5. Mock 边界与测试环境三原则

Next 特有的坑：同一份代码在 nodejs / Edge / 浏览器三种运行时行为不同（middleware 只在 Edge，呼应 next-middleware-auth）。原则：

1. **越靠近外部世界越 mock**：DB、第三方 API、时钟；业务规则本身永远不 mock，否则测的是 mock；
2. **middleware 单独测**：导出成可测函数或用 Playwright 带 cookie 打真请求验 matcher（负向断言极易写错，呼应 next-middleware-auth 第 4 节）；
3. **不要在单测里相信缓存**：请求记忆化、Router Cache 都会让"第二次调用没发请求"（mock fetch 时断言调用次数就要把这条算进去，呼应 next-fetch-cache 第 2 节）。

## 6. 自检清单

- [ ] next/jest（或 Vitest）接管转译了吗，还是手写 babel 在受罪？
- [ ] 服务端组件是否直接 await 渲染测试，而不是被迫"转成客户端组件才好测"？
- [ ] Action 测了成功、校验失败、重定向三条分支吗？
- [ ] Route Handler 测了状态码与 JSON 契约吗？鉴权 401 分支有覆盖吗？
- [ ] E2E 是否只覆盖黄金路径、CI 是否采集 trace？
- [ ] 涉及 Edge 运行时的代码（middleware）有单独的验证通道吗？

## 7. 小结

Next 测试的心法是把"框架魔法"逐个还原成可测的普通形态：RSC 是 async 函数、Action 是 RPC 函数、Route Handler 是 Request/Response 纯变换、页面流程交给真浏览器。魔法被拆开，测试就站到了确定性一侧——而 CI 绿了，才轮到最后一关谈部署与架构终局。

🚀 部署预告：测试给质量上了保险，下一关 next-deploy 把这艘船开出去——Vercel 一键、standalone 产物、Docker 与 Nginx 自建，四种落地姿势一次讲清。
