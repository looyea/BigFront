# Context 跨层通信

> 目标：`Context` 解决"props 一层层往下传（prop drilling）"的痛点——在祖先 `Provider` 放值，任意后代 `useContext` 直接取。但它也是**性能陷阱高发区**：Provider 的 value 一变，**所有**消费组件强制重渲染（`memo` 也挡不住）。本课讲：createContext/Provider/useContext 三件套、正确用法与常见误用、如何靠**拆分 context + 稳定 value + 组件化下移**控制重渲染，以及"Context 不等于状态管理库"的边界（呼应 vue-provide-inject、react-render-model 重渲染、react-state-mgmt、react-usestate）。

---

## 一、三件套

```jsx
const ThemeCtx = createContext('light');       // 建 context，参数是默认值

function App() {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeCtx.Provider value={theme}>          {/* 提供方 */}
      <DeepTree />
    </ThemeCtx.Provider>
  );
}
function Deep() {
  const theme = useContext(ThemeCtx);          // 任意深度直接消费
  return <span>当前主题：{theme}</span>;
}
```
- `createContext(default)` 建容器；`<Ctx.Provider value=...>` 供值；`useContext(Ctx)` 取值；
- 查找方向：**向上找最近的 Provider**（与 Vue provide/inject 同构，呼应 vue-provide-inject）。

---

## 二、Context 适合"低频、广布"的值

典型：主题、语言、登录用户、路由信息、全局配置。共同点：**读得多、改得少、很多地方要**。
不适合：高频变化的业务数据（如每帧变的输入值、列表项）——那会牵动一大片重渲染。判据回到作用域：**一两层能传的别上 Context，跨很多层才用**（呼应 vue-state-patterns"作用域多大状态放多小"）。

---

## 三、性能陷阱：value 变 = 全体消费者重渲染

```jsx
// ❌ 每次 App 渲染都新建对象 → 所有 useContext 消费者重渲染（即便只用了 theme）
<Ctx.Provider value={{ theme, setTheme, user }}>
```
Context 的比较是 `Object.is(value)`。value 换成新对象 → 通知所有消费者。`React.memo(Consumer)` **挡不住** Context 更新（context 变化是强制的）。这是与 Vue 依赖收集最大的差异：Vue 只更新真正用到那个属性的组件，React Context 是"整棵消费子树广播"。

---

## 四、缓解三板斧

1. **稳定 value**：把要传的对象用 `useMemo` 包，或拆成多个 context；
2. **拆分 Context**：把"很少变的值"（state）与"常调用的分发器"（setter/dispatch）分开两个 context（dispatch 稳定，见下）；
3. **组件化下移 + 就地消费**：让"包 provider 的组件"本身不因无关 state 重渲染，把 provider 尽量下移到需要它的子树，消费组件保持小巧。

```jsx
const StateCtx = createContext(null);
const DispatchCtx = createContext(null);     // dispatch 引用稳定 → 只用它的组件不重渲染
function App({ children }) {
  const [state, dispatch] = useReducer(reducer, init);
  return <StateCtx.Provider value={state}><DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider></StateCtx.Provider>;
}
```

---

## 五、Context ≠ 状态管理库

Context 只管"把值透传给后代"，**本身不做**：性能优化选择器、中间件、devtools 时间旅行、持久化。用它凑一个全局 store 常掉进第三节陷阱。**Zustand/Redux 在"共享 + 细粒度订阅（selector）"上更强**，它们底层用 `useSyncExternalStore` 而非 Context（呼应 react-advanced-hooks、react-state-mgmt）。小项目低频全局值用 Context 足够；高频/大状态请上 store。

---

## 六、封装成自定义 Hook（推荐）

```jsx
function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (ctx === null) throw new Error('useTheme 必须在 ThemeProvider 内');
  return ctx;
}
```
把 `useContext` 藏进 `useXxx`、并 **fail-fast 判空**，消费方更干净、错误更早暴露（呼应 vue-provide-inject 的 fail fast、react-custom-hooks）。React 19 起还可 `use(Ctx)` 条件读取（呼应 react-advanced-hooks）。

---

## 七、自检清单

- [ ] prop drilling 是什么？Context 怎么解决？查找方向？
- [ ] 为什么给 Provider 传新对象会让所有消费者重渲染？memo 挡得住吗？
- [ ] 拆 state/dispatch 两个 context 为什么能减少重渲染？
- [ ] Context 和 Zustand/Redux 的边界在哪？
- [ ] 为什么要把 useContext 封装成 useXxx 并判空？

---

## 🚀 部署预告

- Context 的"value 变全体重渲染"根因是 **react-render-model** 的重渲染传播 + 引用比较，缓解靠 **react-memo-hooks** 的稳定引用；
- 与 **vue-provide-inject** 高度对照（向上最近 provider、传响应式源 vs 稳定 value、fail-fast）；
- 需要"共享 + 细粒度订阅"时升级到 store（**react-state-mgmt L7**）；把有状态逻辑抽成 `useXxx` 的通用技巧在 **react-custom-hooks（L4 收官）**。

下一关进入 **react-composition**：用 children / render props / 组件组合替代"把一切塞进 Context/全局"，组合优于继承。
