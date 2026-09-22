# 性能：让细粒度保持"细"，把该省的省掉

> 目标：能列出 Solid 应用真正有效的性能手段——保住更新粒度、用 memo 收敛计算、用 untrack/on 关掉多余订阅、batch 合并写、lazy/Suspense 做代码与数据分割、onCleanup 防泄漏——并说清"为什么大多数时候你不需要手动优化、什么时候才需要"。

## 一、默认就已经快：别用 VDOM 思维

Solid 组件只运行一次、更新直达具体 DOM 属性——**没有"重渲染整棵子树"这回事**。所以 React 里的 `React.memo`、`useMemo`、依赖数组那套"防止组件重渲染"的优化在这里基本不存在。**性能的第一原则是：别亲手把细粒度弄粗。**

## 二、头号性能纪律：保住更新粒度

把细粒度"弄粗"的最常见两件事（components 页反复强调）：
- **解构 props / signal**：`const {count} = props`、`const [x] = signal` 读到的是**当时的值快照**，之后不再更新，或逼你整块重算；
- **提前求值**：在 JSX 之前 `const v = count()`，把本应绑到**最小渲染 effect** 的那一次读取，提出来变成了组件级的粗更新。

正确姿势：**始终 `props.x` / `foo()` 惰性读取、用到才读**，让每个属性各自成订阅点。

## 三、用 createMemo 收敛重复计算

memo = **缓存 + 惰性 + 即时一致**：依赖不变就不重算、算出来值没变就不通知下游。适合把"多处用到、且昂贵"的派生值收敛成一份：
```ts
const visible = createMemo(() => state.items.filter((i) => i.show).sort(byTime));
```
**但别过度**：官方点名——如果 memo 只是**直接返回一个属性、没有任何过滤/排序/计算**，那它反而多创建了一个订阅者，不如**直接用那个属性**。memo 是给"真计算"用的。

## 四、用 untrack / on 关掉多余订阅

有时一个 effect/JSX 里读了某信号，**却不希望它的变化触发自己**：
```ts
import { on, untrack } from "solid-js";
createEffect(on(a, (aVal) => { /* 只订阅 a，不追踪这里面读别的信号 */ }));
createEffect(() => { b(); untrack(() => c()); }); // c 不进依赖集
```
`on(deps, fn, { defer })` 显式指定依赖、`defer: true` 跳过首次执行——避免"顺手读了个信号结果被它拖着狂跑"。

## 五、batch 合并多次写

一个同步块里连续多次写，默认各自触发更新。用 `batch`（或 store 的自动批处理）合并成一次：
```ts
import { batch } from "solid-js";
batch(() => { setA(1); setB(2); setC(3); }); // 下游只更新一次
```
store 一次 `setState` 多个属性、或 produce 里改多字段，天然会批处理——这也是"少写 effect 里连环 set"的又一层收益。

## 六、别在 effect 里 set 信号（防循环 + 防多余渲染）

effects 官方明确：**尽量别在 effect 里写信号**——可能造成额外渲染甚至**无限循环**。派生值交给 memo（见三），把"算"和"副作用"分开：effect 只负责"和外部世界打交道"（订阅、日志、异步），不负责维持内部计算一致性。

## 七、lazy + Suspense：代码与数据都别阻塞

- **代码分割**：`const Heavy = lazy(() => import("./Heavy"))`，只在真正渲染时才 `import()`，**减小首包**；配 `<Suspense fallback>` 占位。
- **数据非阻塞**：`createResource` 让数据请求和组件渲染**解耦并行**，外层 Suspense 挂起、兄弟内容照常流式出现（suspense 页）。
- 路由级/重组件级按需 `lazy`，是把 TTI 压下来的主力手段。

## 八、onCleanup 防内存泄漏

组件卸载后仍有引用在后台跑 = 内存泄漏。`setInterval`、事件订阅、WebSocket、第三方实例等都要在 `onCleanup` 里释放（effects 官方专门点出这个用途）：
```ts
const timer = setInterval(tick, 1000);
onCleanup(() => clearInterval(timer));
```
`createRoot` 之外的游离响应式作用域（前面异步桥接的例子）不自动回收，更要显式 dispose。

## 九、列表用 For（keyed）复用 DOM

遍历渲染用 `<For>`：按 item 引用 keyed，**插入/删除/移动时只增删对应 DOM、其余复用**，map 回调只跑一次。别用普通 `Array.map` 手工塞进 JSX（那是非响应式一次性渲染，项变化整段重建）。项结构极稳定且按位置更新时再考虑 `<Index>`。

## 十、自检清单

- [ ] 能说明"Solid 无需防重渲染"、头号纪律是保住更新粒度（不解构、不提前求值）
- [ ] 会用 memo 收敛真计算、也知道"纯返回属性就别上 memo"
- [ ] 会用 untrack / on({defer}) 关掉多余订阅、batch 合并多写
- [ ] 坚定"不在 effect 里 set 信号"，派生交给 memo
- [ ] 会用 lazy + Suspense 做代码/数据分割、onCleanup 防泄漏、For 做 keyed 列表

🚀 **下一站**：L7 SolidStart——把纯客户端的响应式本领，接到路由、数据加载与服务端渲染上。
