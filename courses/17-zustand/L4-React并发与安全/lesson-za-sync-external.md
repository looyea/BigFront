# useSyncExternalStore 底层原理

## 一、Torn reads（撕裂）问题

并发渲染下，React 可能读取外部状态的**不同时刻快照**——高优先级更新读到新值、低优先级还读旧值，同一帧里界面自相矛盾。

具体化：用户点「删除」触发紧急更新，同时低优先级的列表重渲染还在读旧数组——按钮消失但行还在。useState 没有这个问题（状态在 React 自己手里），外部 store 才有，所以需要专门协议。

## 二、useSyncExternalStore 的契约

```ts
const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
```

- `subscribe(onChange)`：注册变化回调，返回退订函数。
- `getSnapshot()`：返回当前值，**无变化时必须返回相同引用**（用 Object.is 判等）。
- `getServerSnapshot()`：SSR/水合期间的稳定快照。

React 用它在订阅与渲染之间插入一致性检查：渲染前后各读一次 snapshot，若中途变了就丢弃这帧重渲——撕裂被协议根除。这也是「第三方状态库从此不用自己实现订阅去重」的原因。

## 三、Zustand 如何踩在这之上

create 返回的 hook 内部就是 `useSyncExternalStore(store.subscribe, () => selector(store.getState()))`。
所以 Zustand v4+ 天然并发安全。

对照历史：v3 时代 Redux 需要 react-redux 手搓订阅与 forceUpdate 兼容层；useSyncExternalStore（React 18 内置）把这块最难的并发正确性收编进了运行时——选库时「是否基于 uSES」就是是否并发安全的硬指标（MobX 6、Jotai 2、信号系同理）。

## 四、selector 返回新引用的坑

若 selector 每次返回新对象，getSnapshot 引用不稳 → React 认为「一直变」→ 报 "getSnapshot should be cached" 或死循环。解法：缓存引用或用 useShallow（呼应 za-selectors-deep）。

同族的坑还有「selector 里调 Date.now()/Math.random()」——即使 store 没变快照也不稳；把这类值放进 store 或用 state 外计算。

## 五、getServerSnapshot 与水合

SSR 下必须提供稳定 server snapshot，否则水合 mismatch。Zustand 的 `useStore` 在有 SSR 时要求 selector 结果可服务端稳定，或配合 persist 的 skipHydration（完整链路见 za-hydration）。

水合期 React 只读 getServerSnapshot、不跑 subscribe——所以「服务端渲染值 → 客户端首帧值」必须一致，第二帧起才允许变化，这是 SSR 水合闪屏分析的第一定律（呼应 za-next-app）。

## 六、手写 30 行复刻一个 mini-useStore

```ts
function useMiniStore(store, sel) {
  return React.useSyncExternalStore(
    store.subscribe,
    () => sel(store.getState()),
    () => sel(store.getInitialState())   // 水合快照
  );
}
```

能把这四行讲清楚，Zustand/Redux/Jotai 的 React 绑定就都通了——面试题「Zustand 为什么不需要 Provider」的答案也在里面：订阅的是模块级 store 实例，与组件树无关。

## 小结
useSyncExternalStore 是 Zustand 并发安全的基石：subscribe + 稳定 getSnapshot 两大约定；撕裂由协议根除，快照不稳由 useShallow 兜底，SSR 由 getServerSnapshot 负责。

## 部署预告
本地把 React DevTools 的 Profiler commit 闪烁开起来，对照「稳定 selector」与「新引用 selector」两种写法的重渲频率；再删掉 getServerSnapshot 在 Next SSR 下观察水合报错。
