# useAtom / useAtomValue / useSetAtom

## 一、三个 hook

```tsx
const [count, setCount] = useAtom(countAtom);   // 读 + 写
const count = useAtomValue(countAtom);           // 只读（组件不因写该 atom 而重渲多余）
const setCount = useSetAtom(countAtom);          // 只写，返回稳定 setter
```

三者都建立「本组件对该 atom 的订阅」：useSetAtom **不订阅值**——组件不因该 atom 变化而重渲，只拿一个永远稳定的写入口。

## 二、减重渲：只读别用 useAtom

`useAtom` 返回 [value, setter]，订阅该 atom。若组件只需要「写」不需要「读」，用 `useSetAtom`；只需读用 `useAtomValue`——后者语义清晰且不会引入 setter。

`useSetAtom` 返回的 setter 引用稳定，可安全放进 useEffect 依赖数组而不会造成重复触发。

反例记忆法：一个「提交按钮」组件用了 useAtom(formAtom)，于是每次输入框改表单它都重渲——其实它只需要 dispatch。改成 useSetAtom 后订阅消失，重渲归零。Jotai 的「selector 粒度」问题天然不存在，但 hook 选型就是你的订阅声明。

## 三、派生读
只读派生 atom 直接用 useAtomValue(derivedAtom)，Jotai 自动追踪其依赖（呼应 jo-derived）。

```tsx
const fullName = useAtomValue(fullAtom); // 源 atom 任一变则更新，组件只订阅这一个
```

派生原子的依赖变化会「传染」到订阅者：组件订阅 fullAtom，firstName 变它也重渲——精确且不多（对比 Context value 一变全子树遭殃，呼应 jo-global）。

## 四、对比 Zustand selector
- Zustand：useStore(s=>s.x) 一函数读写合一，写用 getState().action。
- Jotai：读用 useAtomValue、写用 useSetAtom，天然按 atom 拆分，订阅即最小单元。

Zustand 的 selector 是「订阅切片的函数」，Jotai 的 hook 参数直接就是「被订阅的原子」——前者防过度订阅靠自觉（za-selectors-deep 一整关在讲这事），后者把粒度做成了物理事实。

## 五、自定义 setter
写 atom 可以传值或 updater：setCount(5) 或 setCount(c=>c+1)；对一个「写 atom」set 会触发其 write 函数（呼应 jo-write-only）。

类型细节：useSetAtom 的泛型会按目标 atom 的 write 参数推断——对 `atom(null, (get, set, by: number) => ...)`，dispatch 的签名就是 `(by: number) => void`，TS 自动帮你校验「这个 action 该传什么」。

## 六、何时仍要 useAtom

读写都要、且读的值确实驱动渲染时才用 useAtom（典型：受控输入框的 value+onChange 同源）。团队规范常写成三条：`useAtomValue` 默认、`useSetAtom` 触发、`useAtom` 例外——看到 useAtom 就要能说出为什么两处都需要。

## 小结
三 hook 各取所需：读用 useAtomValue、写用 useSetAtom（不订阅、引用稳）、读写才 useAtom——hook 选型即订阅声明，派生原子用只读 hook 直接消费。

## 部署预告
本地写「输入框 + 字数统计 + 提交按钮」三组件：统计 useAtomValue、提交 useSetAtom、输入框 useAtom，用 Profiler 验证打字时提交按钮零重渲。
