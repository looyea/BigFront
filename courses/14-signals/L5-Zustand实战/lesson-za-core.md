# za-core：最小 store——create / get / set 与 selector

> 目标：十行写一个可用的 Zustand store，吃透 set 合并语义与 selector 订阅（含 useShallow），掌握组件外 getState/setState/subscribe 的旁路通道，看懂 useSyncExternalStore 这条外部 store 入 React 的正门（呼应 react-usestate、za-middleware、mobx-stores）

## 一、十行起步：Zustand 的最小完整体

```js
import { create } from 'zustand';

const useBearStore = create((set, get) => ({
  bears: 0,
  addBear: () => set((s) => ({ bears: s.bears + 1 })),   // action 就长在 store 里
  reset: () => set({ bears: 0 }),
  roar: () => console.log('当前熊数：', get().bears),     // get：action 里读最新状态
}));

function BearCounter() {
  const bears = useBearStore((s) => s.bears);            // selector：订什么拿什么
  return <h1>{bears} around here...</h1>;
}
function Controls() {
  const addBear = useBearStore((s) => s.addBear);        // 取函数引用稳定，天然不过时
  return <button onClick={addBear}>one more</button>;
}
```

对照 Redux 同功能：没有 Provider（模块单例即全局）、没有 action type 表、没有 reducer 文件、没有 dispatch 样板——**create 返回的 hook 本身就是 store+绑定层**。这也是 13 包之后我们对『外部 store 入 React』的标准答案（L1 提过：Zustand v1 早于 useSyncExternalStore，机制上先于官方正门）。

## 二、set 的合并语义与『不可变』硬约束

```js
set({ bears: 1 });                    // 浅合并：其余字段原样保留，返回新 state 对象
set((s) => ({ bears: s.bears + 1 })); // 函数式：基于最新 state 计算（并发/连续 set 安全）
set({ nested: { ...s.nested, x: 1 } });// 深字段：手动展开——或者交给 immer 中间件（za-middleware）
```

两条铁律：

1. **必须产生新引用**：`state.bears = 5` 或 `set(state)` 原对象返回——订阅比较 `Object.is(新, 旧)` 认为没变，UI 永不更新。Zustand 的变更判定是**快照替换制**，与 MobX 的『字段被写』机制正相反（L4 的教训在这里是反面教材：就地改在 Zustand 里是静默失败，不报错）；
2. **函数式 set 优先**：异步回调里 `set((s) => ...)` 读到的一定是当下最新，闭包旧值陷阱绝迹。

## 三、selector：订阅面就是你的比较面

```js
const user = useStore((s) => s.user);                  // ✓ 只订 user
const pos = useStore((s) => ({ x: s.x, y: s.y }));     // ✗ 每次返回新对象 → 永远『变了』→ 无限重渲
import { useShallow } from 'zustand/react/shallow';
const pos = useStore(useShallow((s) => ({ x: s.x, y: s.y })));  // ✓ 浅比较产物，稳了
```

Zustand 的订阅模型一句话说尽：**每次相关更新时执行你的 selector，把产物与上次产物比较（默认 Object.is），变了才重渲组件**。于是：

- 多字段/派生对象 → `useShallow`（或 reselect 风格 memo selector）；
- 数组切片 → `useShallow` 对数组同样有效；
- **同参 selector 返回新对象是第一大坑**——症状：React 报 `The result of getSnapshot should be cached` 或死循环重渲。

与 MobX 对照的阅读题：MobX『谁读谁订』（隐式），Zustand『谁 selector 到谁订』（半显式）——后者依赖可以 grep，前者对重构更宽容，各是一派（呼应 mobx-react 的『禁忌清单 vs 显式容器』成本模型）。

## 四、store 的旁路：组件外读写与订阅

```js
useBearStore.getState().addBear();            // 事件处理器、工具函数里直接用
useBearStore.setState({ bears: 42 });         // 测试重置利器
const unsub = useBearStore.subscribe(
  (s) => s.bears,                              // v4.4+：selector 版 subscribe
  (bears) => sendBeacon(bears),                // 只在 bears 变时回调
);
```

三件套把 store 变成真正的『框架无关状态源』：路由守卫、WebSocket 回调、Web Worker 消息处理都能读写——**这份能力正是 signal 派共享状态层的同款卖点**（Zustand 在这里是『带 React 绑定的 signal store』的不可变变体，L6 再收）。subscribe 的 transient 用法（不走渲染的高频订阅，如动画帧读数）在 za-patterns 展开。

## 五、useSyncExternalStore：外部 store 的官方正门

```js
// React 18 提供的外部订阅标准桥（简化示意）：
const value = useSyncExternalStore(
  (cb) => { const u = store.subscribe(cb); return u; },  // subscribe：注册监听返回退订
  () => store.getState(),                                 // getSnapshot：读当下快照
);
```

它解决的问题专列：**撕裂（tearing）**——并发渲染下两个组件可能读到同一 store 的不同时刻的值。React 通过此 hook 在渲染提交时复核快照、不一致即重渲，把『外部可变源』纳入并发安全体系。Zustand v4+ 的 useStore 底层就是它；你手写任何外部 store 绑定（包括 Redux、自研 signal 桥），正门都在这。L1 时间线里 2020 年『外部 store 复兴』的技术注脚就是这一行 hook（呼应 13 包 solid 与 React 集成的同类讨论）。

## 六、五版演进的时间防坑

- v3：无 selector 版 subscribe、中间件签名略异——老教程重灾区；
- v4：useShallow 迁到 `zustand/react/shallow`、vanilla extract、middleware 链标准化；
- v5（当前）：要求 React 18+、`zustand/shallow` 旧路径拆分清理、类型推断收紧——升级看 changelog 里『useShallow import 路径』这条最容易中。

版本时钟与 RxJS 同理：**Zustand 的教程库存量巨大，2021 年的文章在 v5 下直接编译错**。

> 🚀 部署预告：zustand 核心约 1.1KB gzip（selector/中间件全加也不到 4KB）——是四强里最小，体积账见 sig-size；本关实验用官方 CodeSandbox 模板即可，零后端。
