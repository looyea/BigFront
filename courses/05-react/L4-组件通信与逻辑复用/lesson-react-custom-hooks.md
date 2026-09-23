# 自定义 Hook

> 目标：自定义 Hook 是 React 复用**有状态逻辑**的首选——以 `use` 开头、内部可调用其它 Hook、把一段"订阅状态 + 副作用 + 派生"打包成一个函数返回。本课讲：怎么写、Rules of Hooks 为什么存在、返回 ref/state/函数各意味着什么、组合多个小 Hook、SSR/多实例安全，以及它如何干净地取代 mixin/HOC（这是全课与 **vue-composables** 对照最密集的一关，二者理念几乎一致，差异在"每处调用各自一份状态 vs 引用共享"）。

---

## 一、什么是自定义 Hook

```jsx
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}
// 组件里：const w = useWindowWidth();
```
- 约定：**名字以 `use` 开头**（不是强制语法，但 ESLint `rules-of-hooks` 与人都靠它识别）；
- 本质：一个**能调用 Hook 的函数**，把"有状态逻辑"抽出来复用；
- 每个组件调用它得到**各自独立**的一份状态（关键差异，见第五节）。

---

## 二、Rules of Hooks（两条铁律）

1. **只在顶层调用**：不在 `if`/`for`/`try`/回调/条件 return 里调用 Hook；
2. **只在 React 函数里调用**：组件函数或自定义 Hook 内，不能在普通函数/类组件生命周期外的地方乱调。

原因（呼应 react-component 第四节）：React 靠 **Hook 调用顺序** 在内部为每个组件维护一条状态链表，第 N 个 `useState` 就是第 N 槽。顺序一旦因条件调用而变，状态就张冠李戴。把条件写进 Hook 内部、别把整个 Hook 包进条件里。

---

## 三、返回什么：state / setter / 函数 / ref

```jsx
function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = useCallback(() => setOn(v => !v), []);   // 稳定引用便于 memo
  return { on, toggle };          // 返回对象：消费方命名清晰、易扩展
}
```
- 返回**值**（`w`）：简单；
- 返回**对象** `{state, actions}`：多数场景最友好、字段可增不改调用方；
- 返回**元组** `[state, setState]`：仿 useState、位置解构；
- 内部函数用 `useCallback`、对象用 `useMemo` 稳定，方便配合 `React.memo`/依赖数组（呼应 react-memo-hooks）。

---

## 四、组合小 Hook

自定义 Hook 可调用别的自定义 Hook，层层拼装：

```jsx
function useLocalStorage(key, init) { /* 读写+订阅 */ }
function useCounter(key) {
  const [n, setN] = useLocalStorage(key, 0);   // 复用上面的 Hook
  return { n, inc: () => setN(c => c + 1), reset: () => setN(0) };
}
```
把"网络/存储/事件/表单"各抽成小 Hook，业务 Hook 编排它们——与 Vue composables 组合一模一样（呼应 vue-composables）。

---

## 五、与 Vue composables 的关键差异

| | React 自定义 Hook | Vue composable |
|---|---|---|
| 触发更新 | 返回**新值** → 组件重渲染 | 返回 `ref`，改 `.value` 即更新 |
| 状态归属 | 每次在**某组件**调用 = 该组件一份 | 若内部用模块级 `ref` 则跨组件**共享单例** |
| 心智 | "同步外部/计算值"，靠重跑 | "响应式源"，靠依赖追踪 |
| 别在条件里调 | 必须（Rules of Hooks） | setup 同步调用即可，更宽松 |

想让 React 逻辑"跨组件共享单例"，得靠 Context / store（useSyncExternalStore），而非单纯再调一次 Hook（呼应 react-context、react-state-mgmt、vue-composables）。

---

## 六、SSR 与多实例安全

- Hook 内部若碰 `window`/`document`/`localStorage`，要在 `useEffect` 里或 `typeof window!=='undefined'` 守卫（服务端首帧没有这些），否则 SSR 报错（呼应 vue-ssr-nuxt）；
- 别在 Hook 里用模块级可变变量存"用户态"——多请求/多实例会串（呼应 vue-pinia-advanced 每请求隔离）。

---

## 七、自检清单

- [ ] 自定义 Hook 靠什么被识别？内部能做什么？
- [ ] Rules of Hooks 两条是什么？为什么"调用顺序"如此关键？
- [ ] 返回值用对象 vs 元组各有什么好处？函数为什么要 useCallback？
- [ ] 为什么"每次在组件里调用 Hook = 该组件一份状态"？和 Vue 组合式哪里不同？
- [ ] 想在 React 做跨组件共享的有状态逻辑，该借助什么？

---

## 🚀 部署预告

- 本课把 L4 三关收束：**props/children 组合结构、Context 跨层透值、自定义 Hook 复用有状态逻辑**——三种正交的复用手段；
- 与 **vue-composables** 几乎一一对应，差异在"引用共享 vs 各自一份"，这条线在 **react-state-mgmt（L7）**、**react-architecture（L8）** 会再次出现；
- 下一步进入 **L5**：表单、列表与渲染控制——从"受控与非受控表单"开始（把 react-component、react-usestate 落到输入场景）。
