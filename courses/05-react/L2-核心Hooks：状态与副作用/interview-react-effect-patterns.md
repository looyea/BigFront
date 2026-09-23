# react-effect-patterns 面试题精选

> 共 12 题，覆盖 A 数据获取 / B 竞态与取消 / C 订阅与外部系统 / D 时机与反模式类。

## 一、数据获取（A 类）

### 1. 用 useEffect 手写数据请求，标准骨架包含哪几件事？
① loading/error/data 三态；② 用 `AbortController` 在 cleanup 里取消在途请求；③ `ignore` 标志防对已卸载/过期一轮写 state；④ 依赖 id 变化重跑；⑤ 内部 async 函数（effect 回调本身不能 async）。（呼应 react-effect-patterns 第一、七节）
**来源**：react.dev — You Might Not Need an Effect(数据获取)、MDN AbortController

### 2. 为什么 useEffect 回调不能直接是 async？怎么办？
effect 的返回值被 React 用作 cleanup，而 `async` 函数总返回 Promise → React 会把 Promise 当 cleanup 报错/忽略。做法：effect 内定义并立即调用一个 async 函数（IIFE）或 `.then`（呼应 react-effect-patterns 第七节）。
**来源**：react.dev — 指定 Effect 函数、常见 async effect 错误

### 3. 手写到一定规模为什么要上 TanStack Query / SWR？
手写缺：跨组件缓存、请求去重、失效与重新验证、分页/无限、乐观更新、重试退避、窗口聚焦刷新。这些正是 Query 类库的职责——把"服务端状态"从 useEffect 脏活里解放（呼应 react-data-fetching、L6）。
**来源**：TanStack Query 文档 — 为什么需要库、SWR 官网

## 二、竞态与取消（B 类）

### 4. 什么是数据获取的竞态？举一个真实场景。
多个请求乱序返回，后发先至的旧结果覆盖了新结果。场景：搜索框输入从 "re"→"react"，"react" 的请求先回、"re" 的慢回并覆盖 → 显示错误结果。修法：`AbortController.abort()` 取消上一个，或 `ignore`/比对最新 request id（呼应 react-effect-patterns 第二节）。
**来源**：MDN AbortController、竞态与取消模式

### 5. cleanup 里 abort 后为什么还要 ignore 标志？两者不重复吗？
不完全重复：abort 会取消网络、`.catch` 收到 AbortError；但并非所有 fetch 实现/polyfill 都能即时中断已 resolve 的链路，且你不想把"主动取消"当成错误 setState。`ignore` 是纯前端保险：过期结果一律不写 state（呼应 react-effect-patterns 第一节）。
**来源**：react.dev — 忽略过时的 Effect 结果、AbortController 实践

## 三、订阅与外部系统（C 类）

### 6. 集成一个非 React 的图表/地图库，effect 该怎么写？
挂载时 `const inst = new Lib(ref.current, opts)`，把实例存 `useRef`；依赖变化时 `inst.update(newOpts)` 或销毁重建；**cleanup 必须 `inst.dispose()`** 释放定时器/DOM/事件。别把库内部可变状态塞进 React state（呼应 react-effect-patterns 第三节、react-refs）。
**来源**：react.dev — 与第三方库集成、组件封装 refs

### 7. 高频事件（resize/scroll）用 effect 订阅要注意什么？
add 与 remove 成对防泄漏；高频回调要 **节流/防抖** 或用 `useDeferredValue` 降载；只存"需要的派生值"而非整个事件对象。订阅外部 store 用 `useSyncExternalStore` 更稳（呼应 react-effect-patterns 第三节、react-advanced-hooks）。
**来源**：web.dev — throttle vs debounce、useSyncExternalStore

### 8. `useRef` 存可变实例（如 timer id、库实例）为什么不用 useState？
这些值变化**不需要触发重渲染**，且要跨渲染保持同一引用。`useState` 更新会重渲染、且拿不到"当前 mutation"语义；`useRef` 提供 `.current` 可变容器，改它不重渲染（呼应 react-refs、vue 里普通变量）。
**来源**：react.dev — useRef、Manipulating DOM with refs

## 四、时机与反模式（D 类）

### 9. useEffect / useLayoutEffect / useInsertionEffect 执行顺序与用途？
一次提交的顺序：`useInsertionEffect`（注入样式，CSS-in-JS 专用）→ DOM 更新 → `useLayoutEffect`（绘制前同步，读/改布局）→ 浏览器绘制 → `useEffect`（绘制后异步，通用副作用）。日常绝大多数用 useEffect，SSR 下 useLayoutEffect 告警（呼应 react-effect-patterns 第四、五节）。
**来源**：react.dev — useInsertionEffect、useLayoutEffect

### 10. "用 effect 把 props 复制进 state 再同步" 为什么是坏味道？怎么改？
造成双份真相 + 额外渲染 + 同步遗漏 bug。能派生就在 render 里直接用 props/`useMemo`；确需"可编辑初值来自 props"就用 `key` 重挂载重置，或受控化（呼应 react-usestate 面试题第10题、You Might Not Need an Effect）。
**来源**：react.dev — You Might Not Need an Effect、State as props 反模式

### 11. effect 里对已卸载组件 setState 会怎样？现代 React 还需要担心吗？
React 18 已移除该 warning，但对过期组件写 state 仍是**浪费与潜在逻辑错误**（尤其覆盖新数据）。用 ignore/abort 在异步回调里判空是良好习惯（呼应 react-effect-patterns 第一节）。
**来源**：React 18 release notes — 移除 setState-on-unmounted 警告

### 12. "父传一个 flag，子用 useEffect 监听 flag 再执行" 通常应改成什么？
直接把它设计成**事件驱动**：让父把要执行的动作作为回调 prop 传下、或在触发点的处理器里直接做，而不是造一个布尔 state 再用 effect watch（那会引入多余渲染与"消费后置回 false"的脏逻辑）（呼应 react-effect-patterns 第六节、vue 事件 vs watch）。
**来源**：react.dev — 从 Effect 中提升状态/事件传递、Anti-patterns
