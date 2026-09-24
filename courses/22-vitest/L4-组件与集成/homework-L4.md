# L4 作业：组件与集成

## 一、知识回顾
1. DOM 环境：jsdom vs happy-dom 选型、@vitest-environment 按文件、environmentOptions、缺 API 在 setupFiles polyfill、cleanup/unmount、jest-dom 语义断言。
2. 组件测试：React RTL（render→getByRole→userEvent→断言）、Vue @vue/test-utils；按用户语义查询；Pinia/Zustand 注入真 store；异步渲染 findBy/waitFor/flushPromises；快照克制。
3. 网络：MSW 在请求边界拦截、setupFiles(on-server) listen/resetHandlers/close、server.use 临时覆盖；测 TanStack Query 完整链路；E2E 边界。

## 二、代码实操
1. 给一个「点击 +1、异步拉标题」的组件：`await userEvent.click` 两次断言数字=2、`await screen.findByText` 等异步标题；断言标题用了 @vitest-environment jsdom/happy-dom。
2. 装 msw，在 setupFiles 建 setupServer + 一个 `GET /api/hello` handler，测一个 fetch 该接口的函数；再 server.use 让它返回 500 测错误分支，验证 resetHandlers 后恢复默认。
3. 给一个用 Pinia 的 Vue 组件 mount 传 createPinia 实例、预置 state 后断言视图；对照 Zustand 用 setState 重置。

## 三、思考题
1. 为什么测网络推荐 MSW 而非 vi.mock axios？从「被测代码是否感知」角度答。
2. 组件快照为什么「少而精」？核心行为该用什么断言替代？

## 四、延伸阅读
- vitest.dev guide/browser/component-testing、guide/mocking/requests、guide/recipes/wait-for、api/browser/vue、config/environmentoptions

## 五、自查清单
- [ ] 会给组件测试正确切到 jsdom/happy-dom 并补 polyfill
- [ ] 会用 RTL/test-utils 按用户语义测交互
- [ ] 能用 MSW 给组件/Query 打假接口测完整链路
- [ ] 分得清单测/集成/E2E 的边界
