# 面试题：Selector 进阶（za-selectors-deep）

### 1. (原理类) selector 什么时候会被重新执行？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

store 每次变化时 useSyncExternalStore 都会重跑 selector 取新快照再比较，不是仅在依赖字段变化时跑。

### 2. (坑类) 返回新对象导致无限循环的完整链路是什么？
**来源**：https://react.dev/reference/react/useSyncExternalStore

selector→新引用→Object.is 不等→重渲→组件重新调用 useStore→又新引用……形成渲染循环。

### 3. (实战类) 需要同时用 a、b 两个字段渲染，推荐写法？
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/create

要么两个原始值 selector，要么 useShallow(s=>({a:s.a,b:s.b}))；后者字段多时更整洁。

### 4. (对比类) useShallow 与旧版第二个 equality 参数区别？
**来源**：https://github.com/pmndrs/zustand/releases

旧版 create hook 支持传自定义 equality；v5 移除默认 shallow，改推 useShallow 包装，语义更集中。

### 5. (性能类) 派生计算很重怎么避免每帧跑？
**来源**：https://zustand.docs.pmnd.rs/integrations/immer-middleware

在 action 里算好结果存字段，或组件用 useMemo 缓存，或用外部 memoized selector 库。

### 6. (TS类) useShallow 会影响类型推断吗？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

不会，泛型透传，返回值类型仍由 selector 决定。

### 7. (原理类) 为什么 getSnapshot 必须稳定？
**来源**：https://react.dev/reference/react/useSyncExternalStore

React 靠比较前后快照判断是否重渲，不稳定会误判为持续变化，破坏并发一致性。

### 8. (坑类) useShallow 能救第二层新对象吗？
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/create

不能，浅比较只看第一层；第二层需结构共享或更深的自定义比较。

### 9. (实战类) 列表页订阅过滤后子集，怎么写 selector 高效？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

订阅原始 ids/items + 用 memoized 派生，或把过滤结果由 action 维护成独立字段，避免每帧 filter 出新数组。

### 10. (对比类) Zustand selector 与 Pinia getter 缓存策略差异？
**来源**：https://zustand.docs.pmnd.rs/integrations/redux

Pinia getter(computed) 惰性且自带缓存；Zustand selector 每次变更都重跑，靠比较判重，需自行 memo。

### 11. (设计类) selector 粒度与 store 拆分的关系？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

store 越大越难靠 selector 隔离无关更新，按变更相关性拆 slice 能让订阅粒度自然收敛。

### 12. (趋势类) React Compiler 对 selector 优化的影响？
**来源**：https://react.dev/learn/react-compiler

编译器可自动 memo 派生，减少手写 useShallow/memo，但订阅粒度仍由 selector 决定。

### 13. (性能类) 如何量化“过度订阅”？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

Profiler 记录无关 state 变化引发的渲染次数；或用 subscribe 打点看某 selector 命中频率。

### 14. (综合类) 给出一个订阅三字段并派生总价的正确写法。
**来源**：https://zustand.docs.pmnd.rs/reference/hooks/create

const {price,qty,rate}=useStore(useShallow(s=>({price:s.price,qty:s.qty,rate:s.rate}))); const total=useMemo(()=>price*qty*rate,[price,qty,rate]);

### 15. (综合类) 团队里 selector 规范你会怎么定？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

① 默认只返回原始值；② 多字段必须 useShallow；③ 重派生走 memo 或 action 预计算；④ PR 附 Profiler 截图证明无过度订阅。
