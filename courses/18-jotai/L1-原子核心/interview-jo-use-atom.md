# 面试题：三个 hook（jo-use-atom）

### 1. (实战类) useAtom / useAtomValue / useSetAtom 怎么选？
**来源**：https://jotai.org/docs/core/use-atom

读写都要→useAtom；只读→useAtomValue；只写→useSetAtom，最小订阅、意图清晰。

### 2. (原理类) useSetAtom 的 setter 为何引用稳定？
**来源**：https://jotai.org/docs/core/use-set-atom

内部对同一 atom 返回同一 bound setter，不随渲染变化，故可入依赖数组。

### 3. (性能类) 只读用 useSetAtom 会订阅导致重渲吗？
**来源**：https://jotai.org/docs/core/use-set-atom

不会——useSetAtom 只拿写函数、不订阅值，值变不重渲。

### 4. (对比类) 与 Zustand useStore 的职责切分差异？
**来源**：https://zustand.docs.pmnd.rs/

Zustand 一个 hook 读写共用靠 selector；Jotai 把读写拆成不同 hook，订阅即最小 atom。

### 5. (坑类) 在 effect 依赖里放 useAtom 的 setter 会怎样？
**来源**：https://react.dev/reference/react/useEffect

useAtom 的 setter 也稳定，但为清晰只写场景应显式用 useSetAtom。

### 6. (实战类) 自定义 useToggle 里用哪个 hook？
**来源**：https://jotai.org/docs/utilities

返回 useSetAtom 包一个 toggle：set(atom, v=>!v)，无需订阅值。

### 7. (设计类) 为什么只读组件坚持用 useAtomValue？
**来源**：https://jotai.org/docs/core/use-atom-value

表意精确、避免多余 setter 解构、lint 可约束不写只读 atom。

### 8. (综合类) 一个组件读 a 写 b，怎么写最省？
**来源**：https://jotai.org/docs/core/use-set-atom

const a=useAtomValue(aAtom); const setB=useSetAtom(bAtom); 分别精准订阅。

### 9. (TS类) useAtom 返回元组类型怎么来的？
**来源**：https://jotai.org/docs/typescript/typescript

由 atom 的读/写类型推断为 [AtomValue, Setter]。

### 10. (坑类) 把 useAtomValue 用于会被本组件写的 atom？
**来源**：https://jotai.org/docs/core/use-atom

那需要写函数，应改 useAtom 或配 useSetAtom，useAtomValue 拿不到 setter。

### 11. (性能类) 派生 atom 读取用什么？
**来源**：https://jotai.org/docs/core/atom

useAtomValue(derived)，自动追踪依赖，仅相关源变才重算重渲。

### 12. (对比类) 和 Redux useSelector/useDispatch 的对应？
**来源**：https://react-redux.js.org/

useAtomValue≈useSelector、useSetAtom 触发写≈useDispatch 发 action。

### 13. (实战类) 如何触发 write-only atom？
**来源**：https://jotai.org/docs/advanced/write-only-atoms

const run=useSetAtom(actionAtom); onClick={()=>run(arg)}（呼应 jo-write-only）。

### 14. (设计类) 团队里三 hook 的使用约定？
**来源**：https://jotai.org/docs/core/use-atom

只读 useAtomValue、只写 useSetAtom、同时需要才 useAtom；禁止在只写场景解构 value。

### 15. (综合类) 举一个因选错 hook 造成多余重渲的例子。
**来源**：https://jotai.org/docs/core/use-atom

一个只需 setTheme 的按钮却用了 useAtom(themeAtom) 订阅了主题值，主题变即无谓重渲；应 useSetAtom。
