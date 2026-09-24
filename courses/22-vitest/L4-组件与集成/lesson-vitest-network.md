# 网络层 mock 与集成测试

## 一、为什么用 MSW 而不是 vi.mock axios

`vi.mock('axios')` 要求被测代码「配合」被替换，且每个方法都得手搓、还测不到真实的拦截/序列化。**MSW（Mock Service Worker）**在**网络层**拦截：你声明「`GET /api/user` 返回某 JSON」，被测代码照常 `fetch/axios` 发**真请求**，MSW 在中间给出假响应。被测方零改动、行为最真实。

## 二、在 Vitest 里接 MSW

```ts
// setup.ts
import { setupServer } from 'msw/node';
export const server = setupServer(...handlers);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`handlers` 定义路由 → 响应。把上面放 `setupFiles`（**on-server**，Node 里跑），全项目共用一个 server。呼应 **19-tanstack-query** 的测试关——那里用 MSW 测 query 组件是同一套思路。

## 三、per-test 覆盖与断言

某条用例要「接口 500」或「返回不同数据」，用 `server.use(overrideHandler)` 临时覆盖，`afterEach` 的 `resetHandlers()` 会复位——**别漏复位**，否则覆盖泄漏到后续用例。也可包一个 spy 断言请求真的发了、发了几次。

## 四、测 TanStack Query 组件的完整链路

`render(<QueryClientProvider><User/></QueryClientProvider>)`，MSW 提供 `/api/user` handler，然后 `await screen.findByText('预期内容')`——这条链路真实走完「发请求→缓存→渲染」，比 mock useQuery 有价值得多。loading→success 状态转换也可推进。

## 五、fetch / axios 与集成边界

- 老 Node 无全局 `fetch`：装 `undici` 或在 setup 里 `vi.stubGlobal('fetch', ...)`，或直接用 `happy-dom`（自带 fetch）。MSW 对 fetch/axios 都能拦。
- **边界**：MSW 测的是「前端如何消费接口契约」，**不验后端真的对**。跨浏览器端到端流程该上 **Playwright/Cypress**；对少数关键链路可用 testcontainers/真实实例做集成。别用单测硬扛本该 E2E 的事。

## 小结
网络层用 MSW 而非 vi.mock axios——它拦在请求边界、被测代码发真请求更真实；setupFiles(on-server) 建 setupServer + listen/resetHandlers/close；单用例 server.use 临时覆盖、 afterEach 复位防泄漏；测 TanStack Query 走「QueryClientProvider+MSW+findBy」完整链路（呼应 19 包）；老 node 需 fetch；真跨端流程交给 Playwright、别用单测硬扛。

## 部署预告
装 `msw`，在 setupFiles 建 `setupServer` 并给一个 `GET /api/hello` handler；写一个 fetch 该接口的函数测成功值，再用 `server.use` 让同一接口返回 500 测错误分支，确认 `resetHandlers` 后下一条用例又回到默认响应。
