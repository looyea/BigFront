# 面试题：网络层与集成（vitest-network）

### 1. (原理类) MSW 工作在哪一层，为什么优于 vi.mock？
**来源**：https://vitest.dev/guide/mocking/requests.html

MSW 在网络请求边界拦截（Node 里 patch http/fetch），被测代码照常发真实 fetch/axios 请求、走真实序列化，只在「发出去」那一刻拿到假响应。vi.mock 要求替换模块、被测方得「知道」自己被 mock，脆弱。MSW 零侵入、更真实。

### 2. (实战类) MSW 在 Vitest 里怎么接起来？
**来源**：https://vitest.dev/guide/mocking/requests.html

用 msw/node 的 setupServer(...handlers) 建 server，放 setupFiles（on-server 全局）；beforeAll listen、afterEach resetHandlers、afterAll close。handlers 声明「方法+路径 → 响应」，全项目共用一套假接口层。

### 3. (对比类) on-server 和 in-browser 的 MSW 有何区别？
**来源**：https://vitest.dev/guide/mocking/requests.html

on-server 用 setupServer 在 Node/jsdom 测试里拦（本项目单测走这条）；in-browser 用 setupWorker 配 browser mode 在真浏览器拦。二者 handlers 可复用，运行环境不同。jsdom 单测用 setupServer 就够。

### 4. (坑类) 忘了 resetHandlers 会怎样？
**来源**：https://vitest.dev/guide/mocking/requests.html

某用例里 server.use 的临时覆盖会泄漏到后续用例，导致别的测试拿到不该有的响应、偶发难查的红。规范：afterEach 里 server.resetHandlers() 回到默认 handlers，server.close() 放 afterAll。

### 5. (实战类) 怎么让某条用例测「接口返回 500」？
**来源**：https://vitest.dev/guide/mocking/requests.html

在该用例里 server.use(http.get("/api/x", () => HttpResponse.error()) 或返回 status:500) 临时覆盖默认 handler。测完 afterEach 的 resetHandlers 会还原。这样错误分支不用碰真后端就能稳定复现。

### 6. (对比类) 既然有 MSW，还要 vi.mock 网络吗？
**来源**：https://vitest.dev/guide/mocking/requests.html

一般不用 vi.mock 处理 HTTP。MSW 管「接口返回什么」，更真实；vi.mock 留给替换非网络的本地模块/副作用依赖。二者各司其职：网络用 MSW、模块用 vi.mock、对象方法用 vi.spyOn。

### 7. (实战类) 测 TanStack Query 组件的完整链路怎么做？
**来源**：https://vitest.dev/guide/mocking/requests.html

用 QueryClientProvider（配 retry:false 的 test client）包住组件，MSW 提供对应 endpoint，render 后 await screen.findByText 断言数据渲染、再验 loading→success。整条「请求→缓存→重渲染」都真跑。呼应 19 包 devtools 测试关。

### 8. (原理类) node 环境里没有 fetch 怎么办？
**来源**：https://vitest.dev/guide/environment.html

老版本 Node 无全局 fetch：升到 18+、或用 happy-dom（自带 fetch）、或 setup 里 vi.stubGlobal("fetch", 实现)。jsdom 本身不提供可用 fetch。MSW 的 setupServer 也依赖有可用的 fetch/http，先备齐。

### 9. (坑类) 用了 axios 还能被 MSW 拦吗？
**来源**：https://vitest.dev/guide/mocking/requests.html

能。axios 底层走 XHR/http，MSW 在更底层拦（jsdom 的 XHR、Node 的 http/undici）。不需要为 axios 单独写 handler 形状，按后端 URL/方法声明即可，别去 vi.mock("axios") 反而测不到拦截器链。

### 10. (实战类) 怎么断言「请求真的发出了 / 发了几次」？
**来源**：https://vitest.dev/guide/mocking/requests.html

在 handler 里记录（或包一层 onUnhandledRequest/spy），用例结束断言命中次数；更常见是间接断言：请求结果反映到 UI（findBy 出现内容）即证明发出了。真要数次数可在 handler 内 push 到数组后断言长度。

### 11. (对比类) 单测 / 集成 / E2E 的边界怎么划？
**来源**：https://vitest.dev/guide/comparisons.html

Vitest（单元/组件/配 MSW 的集成）覆盖「前端逻辑与契约消费」，快而稳；跨浏览器真实用户流程、真实后端联调交给 Playwright/Cypress（E2E）。测试金字塔里 Vitest 在中下层，别拿它硬扛本该 E2E 的事。

### 12. (实战类) 什么时候该用真实后端 / testcontainers？
**来源**：https://vitest.dev/guide/recipes/db-transaction.html

对少数「契约真的对吗、迁移跑不跑得通」的关键链路，值得起真实依赖（testcontainers 拉 DB、或指向 staging）做集成测试；其余海量用例仍用 MSW 保持快、确定、无网络依赖。真实依赖少而精。

### 13. (坑类) mock 了网络但 loading 态测不到？
**来源**：https://vitest.dev/guide/recipes/wait-for.html

handler 立即返回会让 loading 一闪而过。可在 handler 里 await delay(…) 制造可观测的 pending 窗口，再断言 loading 文案；或用 vi.waitFor 抓瞬时状态。别为了测 loading 把断言写成脆弱的时间赌注。

### 14. (原理类) MSW 会影响构建/生产吗？
**来源**：https://vitest.dev/guide/mocking/requests.html

不会。setupServer 只存在于测试 setupFiles/环境里，不打包进应用；它是测试期的进程内拦截器。生产代码零改动、零 MSW 依赖，这正是它相对手写 mock 的干净之处。

### 15. (实战类) 测一个会重试/分页的请求函数怎么组织？
**来源**：https://vitest.dev/guide/mocking/requests.html

用 server.use 配 mockResolvedValueOnce 式「先 500 后 200」的有序 handler 测重试；分页用不同页参数命中不同 handler 测翻页累加。核心是「按调用顺序喂不同响应」，配合 findBy 断言中间/最终态。
