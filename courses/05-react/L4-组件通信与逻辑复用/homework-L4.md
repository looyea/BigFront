# L4 课后作业 · 组件通信与逻辑复用

> 覆盖：props/children 组合、Context 跨层透值、自定义 Hook 复用有状态逻辑。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug（10 小题）

**1.** 找出问题并说明后果：
```jsx
function Demo() {
  const [n, setN] = useState(0);
  if (n > 0) {
    const [m] = useState(10);   // ← ?
    return <p>{m}</p>;
  }
  return <button onClick={() => setN(1)}>{n}</button>;
}
```

**2.** 这段 Context 有什么性能隐患？
```jsx
const Ctx = createContext();
function Provider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  return (
    <Ctx.Provider value={{ user, setUser, theme, setTheme }}>
      {children}
    </Ctx.Provider>
  );
}
```

**3.** 为什么 `useCounter` 的两个组件计数没有各自独立？（找错）
```jsx
let count = 0;                     // ← ?
function useCounter() {
  const inc = () => { count++; };
  return { count, inc };
}
```

**4.** 修正 `useWindowWidth` 在 SSR 下的报错：
```jsx
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);  // ← ?
  return w;
}
```

**5.** 这段 Hook 违反了什么、会怎样？
```jsx
function useData(id) {
  const [d, setD] = useState(null);
  if (id) {                        // ← ?
    useEffect(() => { fetch(id).then(setD); }, [id]);
  }
  return d;
}
```

**6.** 为什么子组件的 `React.memo` 在这里失效？
```jsx
function useToggle() {
  const [on, setOn] = useState(false);
  return { on, toggle: () => setOn(v => !v) };   // ← ?
}
```

**7.** 组合写法哪里读起来"来源不透明"（对照 mixin 的坑）？——口述即可，指出 Hook 如何避免。

**8.** 这段 render prop 有什么问题？
```jsx
<DataSet url="/api/user">
  {(data) => <Profile data={data} />}
  {(err) => <Error text={err} />}    {/* ← ? */}
</DataSet>
```

**9.** `useContext` 拿到 `undefined`/初始值而非 Provider 的值，两种最常见原因？

**10.** 这段自定义 Hook 返回值消费是否有 bug？
```jsx
function useLocalStorage(key, init) { /* ...返回 [value, setValue] */ }
const [name] = useLocalStorage('name', '');
name = 'bob';                        // ← ?
```

---

## 第二段 · 手写编程（5 小题）

**11.** 实现 `useLocalStorage(key, initialValue)`：读初始值、写回 localStorage、并**跨组件同步**（提示：`useSyncExternalStore` 或 `storage` 事件 + 订阅）。要求 SSR 安全。

**12.** 把第一段第 2 题的单一 Context 拆成 `UserContext` + `ThemeContext`（或 state/dispatch 两 Context），说明为何能减少无关组件重渲染。

**13.** 实现 `useFetch(url)`：返回 `{ data, error, loading }`，内部用 `AbortController` + `ignore` 标志处理竞态（呼应 react-effect-patterns）。

**14.** 用**组合**（children + 具名 prop）重构下面这段 prop  drilling，去掉中间层透传：
```jsx
<Page user={u} theme={t} onLogout={f} showSidebar sidebarUser={u} />
```

**15.** 写一个 `useToggle` 和一个基于它组合的 `useSet`（`{ has, add, del, toggle }`），保证返回的函数引用稳定。

---

## 第三段 · 场景题（1 小题）

**16.** 你在做一个后台系统：顶部有"当前登录用户 + 主题 + 折叠状态"三个全局值，几乎每个组件都要读主题，但只有少数组件改它；侧边栏树很深、只有它需要折叠状态。请设计：哪些放 Context、要不要拆多个 Context、值要不要 `useMemo`、频繁重渲染怎么缓解、什么逻辑该抽成自定义 Hook 而不是塞进 Provider。给出组件/Hook 划分与理由。

---

## 第四段 · 简答题（3 小题）

**17.** 用一句话分别说清 props/children、Context、自定义 Hook 各自解决什么问题，它们是互斥还是正交？

**18.** 为什么"在组件里调用自定义 Hook = 该组件一份状态"，而 Vue 把 ref 提到模块级就能跨组件共享？React 想做共享单例该借助什么？

**19.** Rules of Hooks 的两条铁律是什么？为什么 React 用"调用顺序"而不是"变量名"来定位状态？

---

## 第五段 · 挑战题 🏆

**20.** 设计一个 `createStore`（几十行即可）：外部可变 store + `subscribe` + `getState`，再用 `useSyncExternalStore` 封一个 `useStore(selector)`，实现：① 只有 selector 结果变化的组件才重渲染；② SSR 提供 `getServerSnapshot`；③ 对比 Pinia"引用即响应式源"的心智差异，写清你在 React 里如何避免"每请求串状态"。附测试：两个组件选同一 store 不同切片，改一个切片时另一个不重渲染。
