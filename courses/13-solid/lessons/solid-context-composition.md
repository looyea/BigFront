# Context 与组件组合

> 目标：解决"深层组件传值要一层层 drill"的痛——Solid 用 `createContext`/`Provider`/`useContext` 沿 **Owner 树**把值注入后代；关键不是"有个全局袋子"，而是**把 signal/store 放进 context 的 value**，于是共享状态却不触发全树重渲、每个消费者只按自己读到的那部分细粒度更新。掌握本地 context 模式（Provider 建状态 + `useXxx` 取用）、"组合优于配置"的组件拆分（children / render prop / 专用小组件）、以及"逻辑复用就是普通函数 `createXxx`（在 owner 内调用）"（呼应 solid-components、solid-signals、solid-stores）

## 一、prop drilling 之痛与 context 定位

父传给子、子再传给孙……只为最深处用一个值，中间层被迫接一堆自己不用的 prop，就是 prop drilling。React 用 Context 解、代价常是"Provider value 一变、整棵子树重渲"。Solid 也提供 context，但因为**组件本就不重渲、且 context 的 value 可以是 signal/store**，共享状态时能细粒度、不轰炸下游——这是两家 context 心智的根本差别。

## 二、createContext / Provider / useContext

```jsx
import { createContext, useContext } from "solid-js";

const ThemeCtx = createContext("light");        // 参数是"没有 Provider 时的默认值"

function App() {
  return <ThemeCtx.Provider value="dark">
    <Toolbar/>
  </ThemeCtx.Provider>;
}

function Toolbar() {
  const theme = useContext(ThemeCtx);           // "dark"
  return <span>{theme}</span>;
}
```

- `createContext<T>(defaultValue?)` 返回一个带 `.Provider` 的上下文对象；
- `<ThemeCtx.Provider value={...}>` 把值挂到自己这一子树；
- 后代 `useContext(ThemeCtx)` 拿到**沿组件/Owner 树往上最近的** Provider 的 value；
- **既没有 Provider 又没给默认值时，`useContext` 抛错**（这是它和"读不到就是 undefined"的直觉差别，踩过一次就记住了）。

## 三、把 signal/store 放进 context（本地 context 模式，核心）

Solid 的 context value **本身不是响应式的**——它就是原样递给后代。所以正确姿势是**在 value 里放 signal / store / accessor**，让响应式留在 signal 层、context 只负责"把这条 signal 传到深处"：

```jsx
const [StoreCtx, StoreProvider] = createStoreContext();   // 概念示意

function StateProvider(props) {
  const [count, setCount] = createSignal(0);              // 状态建在 Provider 里
  const [todos, setTodos] = createStore([]);
  const api = { count, setCount, todos, setTodos };
  return <ApiCtx.Provider value={api}>{props.children}</ApiCtx.Provider>;
}

function useApi() { return useContext(ApiCtx); }           // 自定义"取用钩子"

// 深处组件：
const api = useApi();
<For each={api.todos}>{t => <li>{t.text}</li>}</For>       // 只订阅 todos 这条路径
<button onClick={() => api.setCount(c => c + 1)}>{api.count()}</button>
```

要点：**共享的是 signal/store 本身，不是它们的快照**。每个消费者 `api.count()`、`api.todos[i].text` 各自建立细粒度订阅——`count` 变了不会惊动只读 `todos` 的组件，彻底避开 React 式"Provider 变→全体重渲"。这就是 Ryan 提出的 **Local Context**：一个组件当"自己的状态容器"，把内部 state 通过 context 暴露给子树，配一个 `useXxx` 收口。

## 四、组合优于配置：children、render prop、专用小组件

Solid 官方推荐**组合**而非"一个巨型组件塞满配置项"。三种组合手段：

```jsx
// ① children 插槽（ParentComponent）：结构由父决定
<Card title="用户">{props.children}</Card>

// ② render prop / 函数 prop：子把值回填给父渲染（solid-components 提过）
<List items={data()} render={item => <Row item={item}/>} />

// ③ 拆成职责单一的小组件，各自只订阅自己需要的 signal
<Toolbar><SearchBox/><ThemeToggle/><UserChip/></Toolbar>
```

组件"只执行一次"让拆分**几乎零运行时成本**——多拆一个组件不会多一次渲染，只多一个 Owner 节点。所以大胆拆、按职责拆，别攒大组件。

## 五、逻辑复用 = 普通函数（不是特殊"Hook"）

React 的 Hook 是带调用顺序魔法规则的专用 API。Solid 里**"可复用逻辑"就是一个普通函数**，只要它在某个 Owner 作用域内被调用（组件体内、`createRoot` 下），里面就能自由 `createSignal`/`createMemo`/`createEffect`：

```jsx
function useMouse() {                        // 约定叫 use/create 开头，其实只是普通函数
  const [pos, setPos] = createSignal({ x: 0, y: 0 });
  createEffect(() => {
    const h = e => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    onCleanup(() => window.removeEventListener("mousemove", h));   // 随 owner 自动回收
  });
  return pos;                                // 返回 signal，调用方 pos() 读
}
```

没有"只在顶层调用/依赖数组"的规矩——因为它不靠重渲驱动、靠的是 signal 订阅 + Owner 回收。这也是从 React 迁移时最解压的一处（react-to-solid-migration 会展开）。

## 六、单向数据流下"往上"的三条路（收口）

props 只读，数据要回流：① **回调 prop**（最直接）；② **共享 signal/store via context**（深层、多处）；③ **状态提升**到共同父级。三者都保持"读走 props/context、改走 setter/回调"的单向流，不去改 props。

## 七、自检清单

1. Solid 的 context 为什么能"共享状态却不全树重渲"？关键在往 context 的 value 里放什么（提示：signal/store 而非快照）？
2. `useContext(Ctx)` 在"没有 Provider 且没默认值"时会怎样？和"返回 undefined"的直觉差别在哪？
3. 用一句话说清 Local Context 模式：谁建状态、怎么暴露、`useXxx` 起什么作用、为什么消费者仍是细粒度更新。
4. 为什么在 Solid 里"拆很多小组件"几乎零运行时成本？（从"组件只执行一次 + 只多一个 Owner 节点"回答）
5. Solid 里的"自定义 Hook"和 React 的 Hook 最本质的区别是什么（提示：调用顺序魔法/依赖数组 vs 普通函数 + Owner 回收）？`onCleanup` 在复用函数里靠什么被正确触发？

🚀 下一站 L4：样式、事件与 TypeScript——`ref` 与类名/内联样式、事件（on*/on:*/绑 accessor 才动态）、`mergeProps`/`splitProps` 的类型面，以及 `ParentComponent`/`ComponentProps`/泛型组件的写法。
