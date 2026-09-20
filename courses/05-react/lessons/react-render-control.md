# 条件渲染与渲染控制

> 目标：控制"什么该出现、出错/加载中怎么兜底"是组件树的骨架逻辑。本课讲：`&&`/三元/early return 做条件渲染、`null` 与"渲染Nothing"、**ErrorBoundary**（类组件捕获子树渲染错误、`componentDidCatch`）、以及 **Suspense** 配合懒加载/数据流显示 fallback。这是把 react-jsx（`{}` 里放表达式）、react-effect-patterns（异步兜底）、react-component（组件边界）串起来的一关，并对照 Vue 的 `v-if/v-show`、`<Suspense>`、`onErrorCaptured`。

---

## 一、三种条件渲染写法

```jsx
// 1) 三元：二选一
{isLoggedIn ? <Dashboard /> : <Login />}

// 2) 逻辑与：满足才渲染，否则 false（不渲染）
{showBanner && <Banner />}

// 3) early return：整块组件级别的分支
function Profile({ user }) {
  if (!user) return <LoadingSkeleton />;
  return <div>{user.name}</div>;
}
```
- 呼应 **react-jsx**：`{}` 里只能放表达式，`if/for` 是语句——要么用 `&&`/三元，要么把判断提到 JSX 外；
- ⚠️ `count && <X/>` 当 `count === 0` 会渲染出字符 `0`（0 是合法可渲染值），应先 `count > 0 &&` 或 `!!count &&`；
- early return 让"未准备好"的分支干净退出，避免深层嵌套三元。

---

## 二、渲染 Nothing 与隐藏

```jsx
function Row({ hidden, children }) {
  if (hidden) return null;          // 完全不渲染，不占 DOM
  return <li>{children}</li>;
}
```
- 组件返回 `null` → 这个位置什么都不渲染（**卸载**，内部 state 丢弃、DOM 移除）；
- 想要"保留 DOM/状态、只是不显示"（类似 Vue `v-show`），React 没有内置指令，靠 **CSS**：`style={{ display: hidden ? 'none' : '' }}` 或 className 切换——因为组件仍被渲染，state 与副作用都保留；
- `v-if`（销毁重建）≈ `cond ? <X/> : null`；`v-show`（display 切换）≈ CSS 显隐。这是与 Vue 最直接的对照（呼应 vue-conditional-list）。

---

## 三、ErrorBoundary：捕获渲染期错误

React **没有**函数式 ErrorBoundary Hook，它必须是**类组件**，实现 `static getDerivedStateFromError` 或 `componentDidCatch`：

```jsx
class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; } // 渲染降级 UI
  componentDidCatch(error, info) { /* 上报日志 */ }
  render() {
    if (this.state.error) return <Fallback onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
// <ErrorBoundary><Risky/></ErrorBoundary>
```
- 捕获的是**子树在渲染期间**抛出的错误（render、生命周期、构造）；
- **捕获不到**：事件处理器里的错误、异步（setTimeout/promise）、服务端渲染、以及 Boundary 自身抛的错——这些用 try/catch 或全局处理；
- 一个 ErrorBoundary 兜住其下整棵子树；建议放在路由级/大区块边界，配合 react-router 的错误元素（呼应 react-router-data）。
- 对照 Vue：Vue 用 `onErrorCaptured` 钩子（组合式）捕获子组件错误，React 只能靠这个类组件边界。

---

## 四、Suspense：声明式"等待中"

```jsx
const Heavy = lazy(() => import('./Heavy'));   // 代码分割（呼应 10-vite 动态 import）
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Heavy />
    </Suspense>
  );
}
```
- 子树在"还没准备好"（懒加载 chunk 未到、数据流 pending）时，React 渲染 `fallback`，就绪后自动替换；
- `lazy` + `Suspense` 是路由/大组件按需加载的标准组合（呼应 react-router-data）；
- React 19 起数据请求库也可"throw a promise"接入 Suspense，把加载态从组件里彻底移出（呼应 react-data-fetching）；
- 与 Vue 的 `<Suspense>` + 异步组件 `defineAsyncComponent` 理念一致（呼应 vue-async-suspense）。

---

## 五、自检清单

- [ ] `{}` 里为什么不能写 if？条件渲染有哪三种写法？
- [ ] `count && <X/>` 在 count=0 时的坑是什么？
- [ ] return null 与 CSS display:none 分别对应 Vue 的 v-if 还是 v-show？状态保留有何不同？
- [ ] ErrorBoundary 能捕获哪些错误、不能捕获哪些？为什么它是类组件？
- [ ] lazy + Suspense 解决什么？fallback 何时显示？

---

## 🚀 部署预告

- 本课补齐"渲染控制"三件套：条件用表达式、错误用 ErrorBoundary 边界、加载用 Suspense fallback；
- L5 三关（表单/列表/渲染控制）到此收官，下一关进入 **L6**：路由与数据获取——先讲 React Router 的 `BrowserRouter/Routes/Route/Link` 与嵌套 `Outlet`（把 react-context、react-custom-hooks 落到"页面级"结构，对照 vue-router-basics）。
