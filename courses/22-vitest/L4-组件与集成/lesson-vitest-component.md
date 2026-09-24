# 组件测试：Vue / React

## 一、技术栈搭配

- **React**：React Testing Library（RTL）+ Vitest。核心 `render(<App/>)` → `screen.getByRole/getByText` 查询 → `userEvent` 交互 → jest-dom 断言。
- **Vue**：`@vue/test-utils`（`mount`）或 Vue Testing Library。Vitest 复用 vite 的 `@vitejs/plugin-vue`，`.vue` 直接可测、免额外 transform。

前提：把环境设成 `jsdom`/`happy-dom`（见上一关）。

## 二、查询优先「像用户」

RTL 主张 `getByRole`/`getByText`/`getByLabelText`——按**用户可见语义**查，而非 class/id。这样断言绑的是「用户能看到的」，重构 DOM 结构不至于全线红。`queryBy*`（找不到返回 null，验「不该存在」）、`findBy*`（异步等）按需选用。

## 三、交互与断言

`await userEvent.click(screen.getByRole('button'))`、`userEvent.type(input, 'hello')`——走真实事件流（比手搓 `fireEvent`/`el.click()` 更贴近用户）。断言用 jest-dom：`expect(screen.getByText('欢迎')).toBeInTheDocument()`。

## 四、状态注入（呼应 16/17 包）

组件依赖 **Pinia**：`mount(App, { global: { plugins: [createPinia()] } })`，或先取 store 设好初始态再挂。依赖 **Zustand**：用它的 `setState` 预置、或重置 store（`store.setState(initial)`）保证用例独立。别 mock 状态库本身，喂真实例更接近生产。

## 五、异步渲染与快照的克制

组件 `onMounted`/effect 里发请求，DOM 是**渲染后**才更新的——别 render 完立刻断言。用 `await screen.findBy...`、`vi.waitFor`、或 `flushPromises`（`await Promise.resolve()` 微任务 flush）等更新。组件整棵 `toMatchSnapshot` 能防结构意外，但极脆、易掩盖真问题——**核心行为用上面语义断言，快照只作辅助且少而精**。

## 小结
React 用 RTL（render→screen.getByRole→userEvent→jest-dom）、Vue 用 @vue/test-utils（mount），环境先设 jsdom/happy-dom；查询按用户语义、queryBy/findBy 分场景；userEvent 走真实事件；Pinia 注入 createPinia、Zustand 用 setState 预置（喂真 store 别 mock）；异步渲染用 findBy/waitFor/flushPromises；组件快照克制、核心靠语义断言。

## 部署预告
给一个「点击按钮计数 +1、异步拉标题」的组件写测试：`render` 后 `await userEvent.click` 两次断言数字=2，用 `await screen.findByText` 等异步标题；Vue 侧 `mount` 传入 Pinia 实例断言 store 驱动的值。体会「先渲染、再交互、异步要等」的节奏。
