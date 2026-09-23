# mobx-core：observable / action / computed / reaction——四件套的日常用法

> 目标：上手 MobX——可变状态+自动追踪的『老炮派响应式』，掌握 makeAutoObservable 起步姿势、action 纪律、computed 缓存与 reaction 家族，看清它与 signal 系的同与异（呼应 solid-effect-tracking、vue-reactive、tc39-core）

## 一、MobX 是谁：比 signal 提案早十年的自动追踪

MobX 2015 年发布，是前端『自动依赖追踪』的量产先驱（L1 sig-landscape 时间线上的平行宇宙）。它与 signal 系共享同一部宪法——**读到即订阅、惰性 computed、推通知**——但载体不同：signal 派用**显式容器**（signal/computed 对象），MobX 用 **Proxy 包装可变对象**：

```js
import { makeAutoObservable } from 'mobx';

class TodoStore {
  todos = [];
  filter = 'all';

  constructor() { makeAutoObservable(this); }

  get visibleTodos() {                      // computed：getter 即派生
    return this.todos.filter((t) =>
      this.filter === 'done' ? t.done : this.filter === 'active' ? !t.done : true
    );
  }

  addTodo(text) {                           // action：方法默认成 action
    this.todos.push({ text, done: false }); // 直接 push！可变风格是 MobX 的本体
  }
}
```

`makeAutoObservable` 把类字段标 observable、getter 标 computed、方法标 action——**十行完成一个响应式领域对象**，这是 MobX 的招牌体验。哲学坐标（L1 sig-paradigms 三坐标落位）：粒度=属性级（Proxy 拦截到每个字段）、更新=**可变原地改**、传播=函数响应式（不生成新快照）。

## 二、四件套逐个认领

| 件套 | signal 对应物 | MobX 形态 | 一句话职责 |
| --- | --- | --- | --- |
| observable | signal | 被标记的字段/集合 | 可变状态的源 |
| action | （set 调用） | 包起的方法/函数 | **唯一允许改 state 的地方** |
| computed | computed | getter + 标记 | 惰性+缓存的派生值 |
| reaction | effect | autorun/reaction/when | 读状态跑副作用的出口 |

关键差异在 action：signal 派写入就是 `.set`，无需仪式；MobX 严格模式（`enforceActions: 'observed'`，6 版默认）下**在 action 之外改 observable 会告警**——因为一次 action 是一个『批量事务』：中途不发通知，结束时统一结算（这保证了 glitch-free 的同时，把批处理粒度交给了 action 边界）。

```js
import { autorun, reaction, when, runInAction } from 'mobx';

autorun(() => console.log(store.visibleTodos.length));   // 立即跑+依赖变再跑
const stop = autorun(...); stop();                        // 返回 disposer，signal 同款纪律

reaction(
  () => store.filter,                 // 数据函数：只有这里的读取建依赖
  (f) => analytics.track(f),          // 效果函数：这里的读取【不】建依赖！
);                                     // reaction 与 autorun 最大分岔：职责拆两段

when(() => store.todos.length > 0, () => hideSkeleton());  // 一次性：条件满足放闸即弃
```

**autorun vs reaction 的选择**是 MobX 面试的保留曲目：autorun 全量追踪（回调里读啥订啥，易过度订阅）；reaction 显式分离『盯什么』与『做什么』，副作用段的读取不建依赖——**reaction 天生就是 tc39-control 说的那种『浅观察』姿态**。

## 三、自动追踪的读时订阅心智

MobX 没有依赖数组、没有显式订阅声明——谁在什么作用域里读了哪个字段，字段就把谁记进自己的订阅者集合。三个推论：

1. **读取位置决定订阅范围**：computed getter 里 `if` 分支没走到的字段不算依赖（与 signal computed 的动态依赖同款红利）；
2. **在追踪作用域外读=白读**：普通函数里 `store.todos.length` 只是一次数值快照，不会有任何响应——『组件外读丢追踪』是 MobX 第一大新手坑（mobx-react 关细说）；
3. **读即订阅的过度订阅同样存在**：MobX 也提供 `untracked(fn)` 逃生舱、`computed({ equals })` 判等钩子——四件套的补丁家族与 signal 一一镜像（说明这两派真的共享同一部宪法）。

## 四、严格模式与调试台

```js
import { configure, observe } from 'mobx';

configure({
  enforceActions: 'observed',   // 有观察者才强制 action（6+ 默认）
  computedRequiresReaction: true, // 生产慎用：computed 无人读就告警，帮你抓死代码
});

observe(store.todos, 0, (ch) => console.log('0 号位变了', ch.newValue)); // 字段级审计
```

`configure` 三档 enforceActions（never/observed/always）对应团队纪律松紧；mobx-devtools 扩展可视化每次 action 改了什么、谁在订阅。与 Redux DevTools 的动作流水回放对比：MobX 记的是『字段变化账』（更像数据库触发器日志），Redux 记的是『action 事件账』（时间旅行的素材）——这个差异直接决定两派的调试与回放能力边界（mobx-stores 关的 patch/onSnapshot 会接手这条线）。

## 五、和 signal 系的选型直觉（先给一半，L6 收拢）

- 数据形态是**对象图、关系复杂、就地改**（编辑器实体、表单模型、游戏状态）→ MobX 心智顺滑；
- 数据形态是**扁平快照、要时间旅行、要跨端同构**→ Redux/Zustand 系不可变路线；
- 要在**框架外**写纯状态逻辑、甚至跨 React/Vue 双栈 → signal 系显式容器更中立（双栈共享状态层的经典方案，呼应 sig-scenarios）。

MobX 也提供了向 signal 阵营靠拢的桥：官方 `@reactively/mobx` interop 层让 MobX observable 与 TC39 signal 互相读取——四件套家族与三件套家族已经在互认亲属关系（呼应 tc39-frameworks）。

> 🚀 部署预告：MobX 框架无关（约 16KB gzip 全家桶），纯 Node/浏览器脚本里也能跑本节全部代码；React 绑定在 mobx-react 关展开，Vue 侧 mobx-vue 社区方案存在但少见——它的主场始终是 React 中大型应用。
