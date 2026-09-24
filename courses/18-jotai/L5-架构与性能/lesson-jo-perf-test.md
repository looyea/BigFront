# 性能调优与测试

## 一、重渲粒度分析
Jotai 默认按 atom 订阅更新——组件只因它 `useAtom/useAtomValue` 用到的 atom 变化而重渲。用 React DevTools Profiler + Jotai DevTools 看依赖图与订阅数（呼应 react-performance）。

Jotai DevTools（devtools 包）提供两样别家没有的观测面：atoms 面板高亮「刚刚变了」的原子、依赖图面板画出 get 建立的边。调优第一步永远是取证：某次输入后到底哪些原子变了、多少组件在订阅它们——没有这两列数字，「Jotai 天然细粒度」就会变成不查就下结论的借口。

## 二、避免派生链过深
深链末端消费触发整链重算（呼应 jo-dependencies）。优化：扁平化派生、把重计算结果落成更少的稳定 atom、必要时 selectAtom 浅比较（呼应 jo-focus-select）。

经验阈值：派生链 3 层以内基本无痛；5 层以上且源头高频变更时，重算放大开始可见。修法的优先序——先问「这层派生是否必要」（纯映射直接删），再问「能否把昂贵的中间结果落成可写原子由 write 显式维护」（用空间换时间），最后才是 memo/select 补丁。

## 三、高频 atom 隔离
坐标/滚动等高频值放独立 atom，用 store.sub 做 transient 更新不接渲染（呼应 za-store-api），或 debounce atom（呼应 jo-race）。

transient 的具体形态：滚动位置原子不 useAtomValue，而是 `store.sub(scrollAtom, () => el.scrollTop = store.get(scrollAtom))`——直接写 DOM，每帧更新零 React 提交。需要渲染消费的再走 debounce/节流原子。两条路对应两种需求：只动 DOM（进度条、视差）走上；要进组件状态（章节高亮）走下。

## 四、测试：store 隔离直测

```ts
import { createStore } from 'jotai/vanilla';
const store = createStore();
store.set(countAtom, 5);
expect(store.get(doubleAtom)).toBe(10);
```
纯逻辑无需 render；组件层用新 Provider + Suspense（async）集成测。

分层测试金字塔在 Jotai 里格外清晰：**业务规则测 store 直读直写**（快、无 DOM），**渲染契约测组件**（renderWithProviders 工具函数统一包 Provider），**异步编排测 await store.get(asyncAtom)**。底层用例占大头——这正是原子化「逻辑与组件解耦」的兑现时刻（呼应 jo-write-only 的纯函数式 action）。

## 五、async 测试
用 vi.mock/msw 打桩 fetch，await store.get(asyncAtom) 拿结果断言，或 renderHook 配 Suspense。

两个细节：① await store.get(asyncAtom) 会真的执行取数并缓存 resolved 值，同 store 内后续 get 不再发请求——测「一次取数多处消费」很顺手；② 测失败路径用 msw 返回 500，断言 await 抛错即可，不需要 ErrorBoundary——boundary 行为留给组件层集成测（呼应 jo-loadable：loadable 消费的错误路径在此测三态对象更直接）。

## 六、订阅泄漏与 mount 成本

两条巡检项：① store.sub 返回 unsub，组件外的手动订阅（transient、埋点）必须回收——与 za-subscribe 同款纪律；② 组件 mount 时 useAtom 的注册成本 O(订阅边数)，一个巨型 atom 被 500 个组件订阅，mount 峰值可见——把宽订阅拆成窄原子是治本药。基准脚本化：vitest + 计数器原子压 1000 次 set，断言某组件重渲次数，性能红线从此进 CI（呼应 za-testing-deep 的渲染计数法）。

## 小结
性能三板斧：DevTools 取证依赖图与订阅数、控派生深度、高频值 transient 隔离；测试三层次：store 直测规则、Provider 包组件、await get 测异步——观测与测试都吃到原子化架构的红利。

## 部署预告
本地做一个滚动进度条页：scrollAtom 用 store.sub transient 直写 DOM，React Profiler 验证滚动期间组件零重渲；再给派生链写一个渲染计数测试（set 源 100 次断言末端组件只渲 100 次而非 N×100），把性能红线固化成 CI 用例。
