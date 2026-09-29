# React 测试

> 目标：React 组件测试的主流是 **Testing Library**（`@testing-library/react`），核心理念是"**按用户如何使用来测，而非实现细节**"——渲染组件、查询 DOM（优先可访问性角色/文本）、触发交互、断言结果。本课讲：`render`/`screen` 查询族（query/get/find 三态）、`fireEvent` vs `userEvent`、异步测试（`waitFor`/`findBy`）、mock（网络/Context/时间）、以及快照测试的边界。呼应 **vue-testing**（`@vue/test-utils`）、**node-testing**（Jest/Vitest 断言与 mock 通用）。

---

## 一、理念：测行为不测实现

```jsx
// 目的：按用户视角测——渲染组件、用可访问性角色查询、触发交互、断言回调被调
// 组件 Button.jsx
function Button({ onClick }) { return <button onClick={onClick}>Save</button>; }

// 测试
test('点击触发 onClick', () => {
  const cb = vi.fn();                       // mock 函数，记录调用
  render(<Button onClick={cb} />);          // 渲染到 jsdom
  userEvent.click(screen.getByRole('button', { name: /save/i }));   // ✅ 按 role+文本找（而非查 class/调内部方法）
  expect(cb).toHaveBeenCalled();             // 断言行为：点击后回调确实触发
});
// ❌ getByRole 匹配不到（文本不对/role 不唯一）→ 直接抛错 "Unable to find an accessible element..."（用 findBy 处理异步、query 断言不存在）
```
- 不碰组件内部 state、不调实例方法、不断言 class 名——这些一改就碎；
- 用**用户能看到/操作的东西**查询与断言：文本、role、label。这样重构内部实现测试仍绿（呼应"按可访问性查询"）。

---

## 二、查询三兄弟：get / query / find

| 前缀 | 找不到时 | 用途 |
|---|---|---|
| `getByRole` | **抛错** | 断言"应该存在"的元素 |
| `queryByRole` | 返回 `null` | 断言"**不应该**存在"（如 `expect(query).toBeNull()`） |
| `findByRole` | 返回 Promise（自动等待出现） | **异步**才出现的元素 |

- 优先 `getByRole`（带 `{ name }`）→ `getByLabelText` → `getByText`，尽量用可访问性语义而非 `getByTestId`（逼你写无障碍）；
- 断言用 jest-dom 扩展：`toBeVisible()`、`toHaveTextContent()`、`toBeDisabled()`、`toBeInTheDocument()`。

---

## 三、交互：fireEvent vs userEvent

```jsx
// 目的：userEvent 模拟真实用户行为序列（首选），fireEvent 只发单个底层事件（轻量）
// fireEvent：只触发单个 DOM 事件（底层）
fireEvent.change(screen.getByLabelText('用户名'), { target: { value: 'bob' } });

// userEvent：模拟真实用户行为序列（推荐）
await userEvent.type(input, 'bob');          // ✅ 逐字输入 + 中间态，触发受控组件真实更新
await userEvent.clear(input);
await userEvent.click(btn);                   // 含 pointer/focus 序列
// ❌ 对受控组件/需 await 微任务的交互忘 await → 断言早于 React 更新，拿到旧值而失败
```
- `userEvent` 更贴近真实（会触发 focus、pointerdown/up、键入多个事件），能暴露受控组件/校验的真实行为，首选；
- `fireEvent` 轻量、只发一个事件，适合快速触发特定事件。
- 受控表单交互要 `await`（React 更新 + 可能异步）。

---

## 四、异步与 Provider

```jsx
// 目的：组件依赖 Context/Router/Query 时，测试里要包相应 Provider，异步内容用 findBy 等
render(
  <QueryClientProvider client={qc}>        // 需要 Context/Router 的要包 provider
    <MemoryRouter><UserPage id="1"/></MemoryRouter>
  </QueryClientProvider>
);
expect(await screen.findByText('Alice')).toBeInTheDocument();   // ✅ 等异步渲染完成再断言
// ❌ 不包 Provider 直接 render(<UserPage/>) → 报 "No QueryClient set..."/useNavigate outside router；❌ 用 getBy 拿异步内容→尚未渲染而抛错
```
- 数据到达用 `findBy...` 或 `await waitFor(() => expect(...).toBeVisible())`，别 `setTimeout` 硬等；
- 组件依赖 Context/Router/Query 时，测试里包相应 Provider（呼应 react-context、react-router-basics、react-data-fetching）；
- **网络 mock**：用 MSW（Mock Service Worker）在 fetch 层拦截返回假数据，比逐函数 mock 更真实、复用高。

---

## 五、mock 与快照的边界

- `vi.fn()` / `jest.fn()` mock 回调；`vi.mock('./api')` mock 模块；`vi.useFakeTimers()` 测定时器/effect（呼应 node-testing）；
- **快照测试**适合防"意外 UI 变化"，但可读性差、易"无脑更新"变成走过场——谨慎用、别作主力；优先显式行为断言；
- 别测第三方库自身行为、别测 CSS 像素；一个测试测一个用户场景。

---

## 六、自检清单

- [ ] Testing Library 的核心哲学是什么？为何不测实现细节？
- [ ] get/query/find 分别在何时用？断言"不存在"用哪个？
- [ ] userEvent 相比 fireEvent 好在哪？
- [ ] 依赖 Context/Router 的组件测试要怎么做？异步内容怎么等？
- [ ] 快照测试适合什么、有什么风险？

---

## 🚀 部署预告

- 本课把测试落到"渲染→按可访问性查询→userEvent 交互→findBy/waitFor 处理异步→Provider/MSW 提供依赖"；
- L7 三关（状态管理/性能/测试）收官。下一关进入 **L8**：架构、Next.js 与部署——先讲 **react-architecture**：如何按 feature 组织、组件分层、Server/Client 边界、避免过度全局化，呼应 vue-project-architecture、node-config。
