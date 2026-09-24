# 依赖图与 Batching

## 一、读即订阅

派生 atom 的 getter 里每个 `get(a)` 都建立一条依赖边。Jotai 据此构建有向依赖图，源变则向下游标脏、按需重算（呼应 solid-effect-tracking）。

组件侧同理：`useAtomValue(x)` 建立「组件 → x」的边，组件 getter 里再 get 的派生链自动接上——人和图共用一套边语义，这就是「自动依赖收集」的完整含义：没有一行配置，图随读生成。

## 二、更新向下游传播
一个源 atom 更新，只有「依赖了它」的派生与订阅组件被通知，兄弟分支不受影响——细粒度更新的根本。

```
a ──> b ──> d          set(a)：b、d 及其订阅者更新
a ──> c                c 与 e 纹丝不动
d ──> e
```

与 Zustand 的对照：store 变化会通知**所有**订阅者跑 selector，靠「selector 结果判等」拦截重渲——广播 + 过滤；Jotai 是图上标脏 + 精确点火——两种模型殊途同归于「只渲该渲的」，但后者把判等的活从每个 selector 挪进了图结构。

## 三、Batching
同一事件里 set 多个 atom，React 18 自动批处理成一次渲染。极端同步场景（promise 微任务外）可用 unstable_batchedUpdates 手动包裹。

```ts
set(firstNameAtom, 'Grace');
set(lastNameAtom, 'Hopper');   // 同事件两次写 → fullAtom 的订阅者只重渲一次
```

React 19 里连 setTimeout/await 之后的多次 set 也自动批（并发渲染器的 universal batching），unstable_batchedUpdates 基本退役——记住「一事件一帧」是运行时保证，不再依赖库层去重。

## 四、性能陷阱
派生链过深/过宽、或让一个高频 atom 被太多组件依赖，会造成放大重算。诊断：拆细 atom、给重派生加 memo、用 Profiler 看命中。

三类病灶对号入座：
1. **过深**（A→B→C→…→H）：一次 A 变八层连锁重算——把重计算落成一个「浅稳定」原子（结果本身 memo 化）或重构为两级汇总。
2. **过宽**（一个 atom 被 500 行组件订阅）：任何字段级小改 500 连坐——用 focusAtom/splitAtom 拆订阅面（jo-focus-select）。
3. **高频**（scroll/mouse 原子进图）：每帧点火——transient 走 store.sub 不进渲染（呼应 za-store-api 第四节）。

## 五、与 Zustand 的心智差
Zustand 手动 selector 决定订阅；Jotai 通过 getter 的 get **自动** 收集依赖（呼应 za-sync-external 的手动 vs 自动）。

一句话带走：Zustand 问「**你要读哪块**」（selector 函数），Jotai 问「**你是谁、谁依赖你**」（原子身份）。迁移时最大的不适应是反过来的——从 Jotai 回 Zustand 会突然要为每个订阅写判等。

## 六、图的可观测性

依赖图看不见摸不着，调试三板斧：① jotai-devtools 的 StoreInspector 可视化「哪个原子被改、谁在订阅」（jo-perf-test 详述）；② 派生 getter 首行插 console.log——被调频率即订阅热度；③ 单测里 `store.get(derived)` 前后断言（惰性验证：没读就不算，呼应 jo-derived）。

## 小结
Jotai 的响应力来自「自动依赖图 + 向下游传播 + 同帧批处理」；三大病灶（深链/宽订阅/高频）各有治理工具；图的可观测性靠 DevTools 与惰性实验。

## 部署预告
本地造一个 8 层派生链 + 1 个被 100 组件订阅的宽原子，用 StoreInspector 看点火次数；再按「四、陷阱」清单逐条重构验证 Profiler 数字下降。
