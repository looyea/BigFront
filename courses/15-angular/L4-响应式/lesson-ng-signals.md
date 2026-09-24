# ng-signals：Angular signals——与 TC39 提案同语义的独立实现

> 目标：掌握 signal()/computed()/effect()/untracked()/patch() 全 API 与写保护模型；与提案版、Solid 版的三处关键差异；官方『何时该用 signal 何时普通属性』判据（呼应 tc39-core、solid-signals、sig-landscape、ng-zoneless）

## 一、Angular signals 三件套：signal / computed / effect

```ts
import { signal, computed, effect } from '@angular/core';

// signal：可写值容器
const count = signal(0);
count();          // 读 → 0
count.set(5);     // 写 → 5
count.update(c => c + 1);  // 增量 → 6

// computed：惰性派生（只读、自动追踪源）
const doubled = computed(() => count() * 2);
doubled();        // 12（源变时自动重算）

// effect：副作用（写后执行，不在构造上下文里）
effect(() => {
  console.log('count is', count());  // 读即订阅
});
```

与 14 包 tc39-core 的关系：Angular signal/computed/effect 与 TC39 提案**同名同语义但不同实现**——Angular 在提案 Stage 1 时就独立写完了（v17 实验 v18 stable），从未用过提案 polyfill。

## 二、写保护模型：ReadonlySignal vs WritableSignal

```ts
const _count = signal(0);             // WritableSignal<number>
const count = _count.asReadonly();    // ReadonlySignal<number>

count.set(10);   // ❌ TS 编译报错：Property 'set' does not exist
count();         // ✅ 读没问题
```

**设计意图**：外部只读、内部通过 action 写——L3 服务关的『私有 writable + 公开 asReadonly』模式就是这条规则的组件级应用。v20+ dev mode 还有运行时 guard：`signal.set()` 在已销毁 injector 里调用会 warn。

## 三、patch()：对象/数组的增量更新

```ts
const state = signal({ user: { name: 'Alice', age: 30 }, items: [1,2,3] });

// 深层更新——不可变但局部 patch（v18.1+ stable）
state.update(s => ({ ...s, user: { ...s.user, age: 31 } }));

// patch 写法更短（v19+）：
state.patch({ user: { age: 32 } });
// 等价于把 { user: { age: 32 } } 深合并到当前值——内部仍产生新引用
```

**为什么 patch 重要**：signal 用 `===` 判断变化——直接改对象属性（mutation）不触发通知；patch 自动做深合并+新引用创建——省去手写 spread 地狱。与 14 包 sig-mutability 的『不可变是 signal 通知的前提』直接对应。

## 四、untracked()：屏蔽读取、不建依赖

```ts
const a = signal(1);
const b = signal(2);

const sum = computed(() => {
  return a() + untracked(() => b());
  // a() 建依赖、b() 不建——b 变了不触发 sum 重算
});
```

场景：effect 里只想因某些 signal 变化而执行、另一些只读取不追踪——untracked 做白名单。对照 14 包 tc39-control 的 watch/untrack 同概念。

## 五、与 TC39 提案的三处关键差异

| 点 | TC39 提案（Stage 1） | Angular signals |
|----|---------------------|-----------------|
| 创建语法 | `const s = new Signal.State(0)` | `signal(0)` 函数式 |
| 读写 API | `s.get()` / `s.set()` | `s()` 调用式读 / `s.set()` 写 |
| writable 分离 | 提案不强制（.set 公开） | asReadonly() 类型层屏蔽写 |

Angular **比提案先行**：提案还在讨论命名（Signal.State? signal()? getter?）时 Angular 已经把 `signal()` 函数式 + `()` 调用式 API 做进了框架——若提案未来定型与 Angular 不同，Angular 大概率保持自己 API（14 包 tc39-frameworks 关已预言此局）。

## 六、与 Solid signals 的两处应用层差异

| 点 | Solid | Angular |
|----|-------|---------|
| 粒度 | 每个表达式可独立细粒度追踪 | **组件级**——signal 变→该组件所有引用它的绑定重算 |
| effect 调度 | 微任务（microtask）同步批处理 | v18-20 异步（下一个变更检测周期）；v21+ zoneless 改微任务+事件 coalescing |
| 模板集成 | JSX 内自动追踪（读即订阅） | @if/@for/{{}} 绑定自动订阅 |

Solid 的细粒度让 `doubled = createMemo(() => count() * 2)` 只改 doubled 的 DOM text node——整个组件不重渲染；Angular 的 computed signal 变后通知的是**所有读了它的模板绑定**（在 zoneless 下仍是精确的，因为每个绑定是独立订阅者——粒度差异在缩小）。

## 七、『何时该用 signal 何时普通属性』官方判据

**用 signal 当**：
1. 这个值**参与模板渲染**或**被 computed/effect 读取**——需要变更通知；
2. 这个值是**异步来源**（HTTP 结果/WebSocket 推送/路由参数）——写后需要视图更新；
3. 需要**惰性派生**（computed）避免重复计算。

**用普通属性当**：
1. **私有且不影响渲染**（缓存、临时变量、计数器）；
2. **常量/配置**（构造时确定、永不变）；
3. **函数/DI 注入引用**（不需要响应式追踪）。

官方原文：signals are for **reactive state**——只有「变了要驱动视图/副作用」的值才需要 signal。

## 八、untracked 与 effect 的 cleanup 签名

```ts
const svc = inject(MyService);

effect((onCleanup) => {
  const id = setInterval(() => svc.tick(), 1000);
  onCleanup(() => clearInterval(id));  // effect 重跑前或销毁时清
  // 只有 tick() 里读的 signal 变了才重跑
});
```

v18+ 的 effect 支持 `onCleanup` 回调——与 Solid createEffect 的 `onCleanup` 同名同位（13 包 solid-effect-tracking 学过的概念）。Angular 还有 `effect.debounce()` / `effect.flush()` 等调度选项（v20+）。

> 🚀 下一关：toSignal/toObservable 双向桥——RxJS 与 signals 共存的现实工程方案。
