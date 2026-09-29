# Selector 进阶：shallow / useShallow / equality

## 一、为什么 selector 是 Zustand 的性能命门

组件订阅通过 selector 表达：`const count = useStore(s => s.count)`。
底层 `useSyncExternalStore` 每次 store 变化都会重新执行 selector 拿新快照，再与上次用 **Object.is** 比较；不等则触发重渲。

陷阱：`useStore(s => ({ a: s.a, b: s.b }))` 每帧都返回**新对象** → Object.is 永远不等 → 组件在任何 state 变化时无谓重渲，甚至无限循环。

## 二、三种正确姿势

1. **拆成多个原始值 selector**（最省）
```ts
// 目的：姿势一—拆成多个原始值 selector（最省，无需 useShallow）
const a = useStore(s => s.a);   // 各自返回原始值，Object.is 比较稳定
const b = useStore(s => s.b);   // 只订 2 个原子值，a 变不重跑 b 的订阅
// ✅ 每个 selector 返回原始值，不产新引用，无谓重渲降为零
// ❌ 合成 useStore(s => ({ a: s.a, b: s.b }))→每帧新对象 Object.is 永远不等，任何变化都重渲
```

2. **useShallow 浅比较合并**
```ts
// 目的：姿势二—用 useShallow 浅比较合并多字段，恢复快照引用稳定
import { useShallow } from 'zustand/react/shallow';
const { a, b } = useStore(useShallow(s => ({ a: s.a, b: s.b })));   // 浅比较相等则复用上次的解构结果
// ✅ 确实需要一次拿多个字段时用 useShallow，内部缓存+浅比，避免每帧新对象
// ❌ 误用 useShallow 订嵌套对象（如 { user: s.user }）→只浅比一层，user 内层变了却比不出
```
v5 也支持 `useStore(s => [s.a, s.b], shallow)` 自定义 equality（部分场景）。

3. **数组多字段同理包 useShallow**。

## 三、getSnapshot 必须稳定

useSyncExternalStore 要求 getSnapshot 在无变化时返回**同一引用**。selector 返回派生新对象即违反此契约 → React 直接报 "The result of getSnapshot should be cached"。useShallow 通过缓存上一次结果并浅比较来恢复稳定性。

## 四、profiler 定位过度订阅

用 React DevTools Profiler 勾选 "Record why each component rendered"，观察某组件是否因整 store 变化而重渲。若是，说明 selector 粒度过粗——把它拆细或包 useShallow。

## 五、自定义 equality
```ts
// 目的：多字段统一走 useShallow（自定义 equality 的常见形式）
const user = useStore(
  useShallow(s => ({ name: s.name, role: s.role }))   // name/role 都没变则不重渲
);
// ✅ 只要取出的字段引用稳定，useShallow 就能拦住重渲
// ❌ 拿它订一个每次重新生成的派生对象→浅比也拦不住，得先让派生值本身稳定
```
需要深比较时用 immer 的 produced 引用不变特性，或 lodash/is-equal-with 包一层（慎用，成本高）。

## 六、函数与 action 的订阅取舍

action 引用从创建后就不变，混在对象里不会引起额外重渲，但把「值 + 函数」打包一个 useShallow 仍是常见写法：

```ts
// 目的：“值 + action”打包一个 useShallow——action 引用恒定不会引发额外重渲
const { theme, toggleTheme } = useStore(
  useShallow(s => ({ theme: s.theme, toggleTheme: s.toggleTheme }))   // theme 变才重渲，toggleTheme 恒定
);
// ✅ 一个 hook 同时拿值和动作，解构后用，action 引用稳定不拖重渲
// ❌ 为这而干脆写 useStore() 不传 selector→订阅整 store，任何字段变化都重渲该组件
```

另一个极端是干脆不写 selector：`useStore()` 订阅整个 store——任何字段变化都重渲该组件，只适合调试或极小组件，生产代码禁用。

## 七、列表场景的粒度设计

整表取回 `s.items` 再 map 渲染，会让每个列表项在任何一项变化时全部重渲。标准做法：组件只订阅 id 数组，行组件订阅自己那一行：

```tsx
// 目的：列表粒度设计——父只订 id 数组，行组件各自订自己那行（selector 粒度=重渲粒度）
function Board() {
  const ids = useStore(s => s.ids);           // 引用稳定（见 za-crud 归一化）
  return <>{ids.map(id => <TaskRow key={id} id={id} />)}</>;   // 只传 id，不把整 task 透下
}
function TaskRow({ id }) {
  const task = useStore(s => s.entities[id]); // 只有本行变化才重渲
  return <div>{task.title}</div>;
}
// ✅ 改一行只重渲那个 TaskRow，ids 不变时 Board 也不重渲
// ❌ Board 直接 useStore(s => s.items) 取整表再 map→任一项变就整表重渲所有行
```

这就是「selector 粒度 = 重渲粒度」——Zustand 性能优化第一口诀。

## 八、面试快答

- **Q：为什么 v5 移除了默认 shallow？** A：默认浅比较掩盖了粗粒度 selector 的设计问题，且对返回新引用的原始值场景多余；显式 useShallow 让意图清晰、包更小。
- **Q：getSnapshot 报错的三种成因？** A：selector 返回新对象/数组；store 外每次生成新值；中间件水合导致快照抖动。

## 小结
selector 只返回原始值或引用稳定对象；需要多字段就用 useShallow；列表用行级 selector 把重渲粒度压到最小；用 Profiler 验证订阅粒度。

## 部署预告
本地建一个 1000 行的列表 store，对比「整表 selector」与「行级 selector」在 Profiler 中的重渲次数，是最直观的验证方式。Next.js SSR 下的订阅注意见 za-sync-external。
