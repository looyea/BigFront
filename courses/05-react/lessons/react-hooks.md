# React L1 · 函数组件与常用 Hooks

> 🎯 目标：理解"UI=f(状态)"，会用 useState 管理状态、useEffect 处理副作用

## 一、JSX 与组件

组件是返回 JSX 的函数；`{}` 内写表达式；列表渲染用 `map` 且必须给 `key`（帮助协调 diff）。

## 二、useState

```jsx
function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN(n + 1)}>{n}</button>;
}
```

状态更新是**异步且不可变**的：不要直接改，要传新值/新对象。

## 三、useEffect

`useEffect(fn, deps)` 处理订阅、请求、手动改 DOM 等副作用；依赖数组决定何时重跑，返回函数用于清理。

## 四、渲染是纯函数

每次状态变化，React 重新调用组件函数得到新 UI，再高效更新 DOM。把组件当纯函数思考能少走弯路。
---

> 🚧 这是大前端学院的**骨架关卡**。课文已给出核心概念与最小示例；
> 你可以在 `courses/05-react/lessons/react-hooks.md` 里继续扩写，
> 并按同样路径新增/编辑小测(`quizzes/react-hooks.json`)与作业(`homework/L1.md`)，
> 平台会自动读取，改动随 Git 提交同步到你的 GitHub。
