# create 精析与 v5 变化

> 前置：14-signals 已用 za-core 建过最小 store，本关做深化与 v5 对齐。

## 一、create 返回的到底是什么

```ts
import { create } from 'zustand';
const useFishStore = create<FishState>((set, get) => ({
  fish: [],
  addFish: (f) => set((s) => ({ fish: [...s.fish, f] })),
}));
```

`create` 返回的是一个 **hook 函数**，同时它本身又是 store 实例——挂在上面的静态方法：

- `useFishStore(selector)`：组件内订阅式读取（走 useSyncExternalStore）
- `useFishStore.getState()`：任意位置非响应式读快照
- `useFishStore.setState(partial, replace?)`：外部写入，不触发订阅者以外的渲染
- `useFishStore.subscribe(selector?, listener, options?)`：命令式监听

这就是 Zustand「一个函数既是 hook 又是 store」的核心心智，对比 Redux 需要把 store 对象单独持有。

## 二、v4 → v5 关键变化

1. **默认 equality 从 shallow 改为 Object.is**（v4 早期 selector 默认浅比较已彻底移除）。这意味着 selector 返回新对象/数组会导致无限重渲——必须用 `useShallow` 或返回原始值。
2. **`create` 的 curried 形式统一**：有中间件时 `create<T>()((set)=>...)`，注意那对空括号 `()`。
3. **`combine` 提供更好类型推断**：`create(combine(initial, (set)=>({...})))` 免去手写 state 类型。

## 三、set 的两种写法

```ts
set({ count: 1 });                       // 浅合并 partial
set((s) => ({ count: s.count + 1 }));    // 函数式，能拿到最新 state
set(() => ({ a: 1 }), true);             // replace=true 整体替换（少用）
```

多次 set 在同一事件回调里会被 React 18 自动批处理，只渲染一次。

## 四、与 Redux createStore 对比

| 维度 | Zustand create | Redux createStore |
|---|---|---|
| Provider | 不需要 | 需要 |
| 更新方式 | set 直接改 | dispatch(action) → reducer |
| TS | 原生友好 | 样板较多 |
| 心智 | 像 useState | 像状态机 |

## 小结
create 是 hook 也是 store；v5 的 Object.is 默认是最大陷阱；set 优先用函数式；跨框架迁移时把「action+reducer」折叠进一个函数即可。
