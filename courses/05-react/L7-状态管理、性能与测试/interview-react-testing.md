# react-testing 面试题精选

> 共 12 题，覆盖 A 理念 / B 查询与断言 / C 交互与异步 / D mock·快照·Vue 对照四类。

---

## 一、测试理念（A 类）

### 1. Testing Library 的核心理念是什么？为什么不测实现细节？

**答**：理念是"**以用户视角测行为**"：渲染组件 → 像用户那样查询可见元素（文本/role/label）→ 触发交互 → 断言可见结果。不测内部 state、私有方法、class 名，因为实现细节一改（重构）测试就红，即使行为没变——脆弱、维护成本高。按行为测，则只要用户可见功能不变，内部随便重构，测试稳定，且天然逼你写出可访问性良好的组件（呼应 react-testing 第一节）。

**来源**：Testing Library 文档 — Guiding Principle、Kent C. Dodds — Testing Implementation Details Considered Harmful

### 2. 组件测试、集成测试、单元测试在 React 里如何取舍？

**答**：React 组件天然适合**集成风格**测试——测"组件 + 它渲染出的 DOM + 交互"这条真实路径，而非把每个渲染函数拆成孤立单测。单元级留给纯逻辑（工具函数、自定义 Hook 用 `renderHook`）。少量端到端（Playwright/Cypress）覆盖关键流程。重心放在"中层的组件行为测试"，性价比最高，避免大量脆弱的实现级断言。

**来源**：Testing Library 文档 — Which test should I write、React Testing Library 实践

---

## 二、查询与断言（B 类）

### 3. getBy / queryBy / findBy 有什么区别？分别用在什么场景？

**答**：找不到时行为不同：`getBy` **抛错**（用于"元素应在"的常规查询与断言）；`queryBy` 返回 `null` 不抛错（专用于断言"**不该存在**"，如 `expect(screen.queryByText('错误')).toBeNull()`）；`findBy` 返回 **Promise** 自动重试等待（用于异步才出现的元素）。三者都有 `AllBy` 变体返回数组。用错会导致"该等待时不等待"或"断言不存在时反而抛错"。

**来源**：Testing Library 文档 — Queries、getBy vs queryBy vs findBy

### 4. 查询优先级为什么推荐 role/labelText/text 而不是 testId？

**答**：`getByRole`（配 `{name}`）、`getByLabelText`、`getByText` 基于**可访问性语义**，最贴近用户如何识别元素，且会连带验证你的 ARIA/label 是否正确（写不出好的 role 查询往往说明组件无障碍有缺陷）。`getByTestId` 是"最后手段"——它绕过了用户视角，只在语义查询都不适用（如无文本的非交互容器）时用。测试查询顺序 = 用户对界面的感知顺序。

**来源**：Testing Library 文档 — Query priority、getByRole / Screen queries

### 5. 断言一般配什么库？举几个常用 matcher。

**答**：配 **jest-dom**（`@testing-library/jest-dom`）扩展语义化 matcher：`toBeInTheDocument()`、`toBeVisible()`、`toHaveTextContent()`、`toHaveValue()`、`toBeDisabled()`、`toHaveAttribute()`、`toBeChecked()`，比裸 `toBe`/`toEqual` 表达力更强、失败信息更友好。Vitest/Jest 通用。

**来源**：jest-dom 文档 — matchers、Testing Library 文档

---

## 三、交互与异步（C 类）

### 6. fireEvent 和 userEvent 有何区别？推荐用哪个？

**答**：`fireEvent.click(el)` 只派发**单个** DOM 事件，底层、快但不够真实——不会触发配套的 focus、pointerdown/up、键入序列。`userEvent.click/type` 模拟**完整真实交互序列**（type 会逐字符、触发中间态），更能暴露受控组件、校验、光标行为等真实问题。推荐默认用 `userEvent`（且需 `await`），`fireEvent` 仅用于"确实只想触一个事件"的性能/特例场景。

**来源**：Testing Library 文档 — userEvent vs fireEvent、user-event 文档

### 7. 组件里点按钮触发异步请求后再更新 UI，测试怎么写才稳定？

**答**：`await userEvent.click(btn)` 后用 `await screen.findByText('结果')`（自动等待出现），或 `await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('完成'))`。**别用 `setTimeout`/`sleep` 硬等**（不稳定、拖慢）。配合 MSW mock 网络返回可控数据（含延迟/错误分支测 error 态）。核心是"等待条件成立"而非"等待固定时间"（呼应 react-testing 第四节、react-effect-patterns）。

**来源**：Testing Library 文档 — waitFor / findBy、MSW 文档

---

## 四、mock、快照与 Vue 对照（D 类）

### 8. 测依赖网络/Context/路由的组件，如何提供这些运行时？

**答**：网络用 **MSW**（在 fetch/XHR 层拦截返回假响应），比 `vi.mock` 每个 api 函数更真实、跨测试复用。Context/Router/Query 需在测试里**包 Provider**：常见是写一个自定义 `render`（test-utils）默认套上 `MemoryRouter`、`QueryClientProvider`、你的主题 Auth Provider，避免每个测试重复。也可用真实 Context 的 Provider 传测试值。原则：给组件"它生产环境需要的那层壳"（呼应 react-testing 第四节）。

**来源**：MSW 文档、Testing Library — 自定义 render / providers、React Router — Mocking router

### 9. mock 一个模块/函数/定时器分别怎么做？各有什么坑？

**答**：`vi.mock('./api')`（或 jest.mock）替换整个模块，注意自动 mock 与工厂返回、别 mock 了你其实想测的东西；`vi.fn()` 造带调用记录的假函数（`toHaveBeenCalled`/`toHaveBeenLastCalledWith`/`mockResolvedValue`）；`vi.useFakeTimers()` + `advanceTimersByTime` 测 setTimeout/防抖/effect，但要 `vi.runAllTimers`/`useRealTimers` 清理，否则异步断言挂起。坑：过度 mock 会让测试"只验证了 mock"，失去意义——能不用假实现就不用（呼应 node-testing）。

**来源**：Vitest 文档 — Mocking、vi.fn / vi.mock / timers、Jest Mock Function 指南

### 10. 快照测试适合什么、有什么风险？

**答**：适合"防意外变化"——把渲染输出序列化存档，下次不一致就提示，适合抓回归、测不易断言的结构。**风险**：① 可读性差、失败信息模糊；② 人们倾向"直接更新快照"，久了变成走过场、不再真正审查；③ 脆弱（无关改动也触发）。建议：小范围、配合行为断言用，别当主力，关键逻辑仍要显式 `expect`。

**来源**：Testing Library 文档 — Snapshot testing 立场、Jest — Snapshot Testing 文档

### 11. 从 @vue/test-utils 迁到 React Testing Library，思维上最大改变是什么？

**答**：VTU 传统上偏**白盒**：能拿 wrapper、读 `vm` 实例、直接调方法、`setValue`、`find('.class')`，易测到实现。RTL 强制**黑盒/用户视角**：只通过 `screen` 的语义查询 + 交互 + 可见断言，不给"组件实例"。迁移要点：① 用 role/label 查询取代 CSS 选择器；② 用 `userEvent` 取代直接改实例状态；③ 用自定义 render 包 Provider 取代 `globalProperties`/`mocks`。理念从"测组件怎么写的"转向"测组件对用户做了什么"（呼应 vue-testing）。

**来源**：Vue Test Utils 文档、Testing Library — Guiding Principle、VTU vs RTL 对比文章

### 12. 设计一个 React 组件测试策略（面试如何答得体系化）？

**答**：① 分层：纯逻辑用 `renderHook`/单测，UI 组件用 RTL 测"查询+交互+断言"，关键流程留少量 E2E；② 依赖治理：MSW 统一 mock 接口（成功/失败/延迟分支各测）、自定义 render 注入 Provider；③ 查询守可访问性优先、断言用 jest-dom 语义 matcher；④ 交互 `userEvent` + `await`、异步 `findBy/waitFor` 不硬等；⑤ 快照谨慎、别测实现细节；⑥ 配 CI 覆盖率但对"行为覆盖"而非"行覆盖"负责。体现的是"测行为、稳、快、可维护"的权衡观。

**来源**：Testing Library 最佳实践、Kent C. Dodds — Testing Principles、Vitest/Jest 文档
