# 响应式内核（源码级）：从两个原语到一张计算图

> 目标：把前八关所有"为什么"收束成一套自洽的心智模型——从官方"从零搭一个响应系统"出发，讲透 signal/observer 的最小实现、订阅与短路的代码级真相、Owner/Computation 图、批处理与拓扑序、编译器如何把 JSX 变成 getter+render effect，直到 Start 的 "use server" 编译产物的来路。这是整包的技术收官关。

## 一、最小可运行的响应系统（官方从零实现）

官方用不到 30 行讲清全部魔法。核心三件套：
```js
let currentSubscriber = null;                 // 全局"当前正在跑的 observer"
function createSignal(initialValue) {
  let value = initialValue;
  const subscribers = new Set();             // 谁订阅了我
  const getter = () => {
    if (currentSubscriber) subscribers.add(currentSubscriber); // 读时登记
    return value;
  };
  const setter = (newValue) => {
    if (value === newValue) return;         // 短路：没变就不通知
    value = newValue;
    for (const s of subscribers) s();       // 通知全部依赖重跑
  };
  return [getter, setter];
}
function createEffect(fn) {
  const prev = currentSubscriber;            // 保存，支持嵌套
  currentSubscriber = fn;
  fn();                                      // 立即跑一次 → 建立订阅
  currentSubscriber = prev;
}
```
一句话记牢：**signal = 值 + 订阅者集合；getter 读时把"当前 observer"塞进集合；setter 变了才遍历通知**。你前面学的一切"自动依赖收集"都是这段代码的展开。

## 二、从玩具到 Solid：几个关键升级

最小实现之上，Solid 补齐了工业级细节（都在前几关出现过，这里归位）：
- **比较与更新分离**：真实 setter 支持函数式更新 `set(x => x+1)`、`equals` 自定义相等；短路仍基于"新旧是否相等"。
- **Observer 分层**：不止 effect——`createComputed`（拓扑序、内部用）、`createMemo`（把 observer 的结果**再包成一个 signal** 返回，从而可被下游订阅+缓存）、`createRenderEffect`（渲染期立即写 DOM）。它们共享同一套"读时登记"机制。
- **动态依赖**：温度例子里 memo 早返回，`unit` 那轮没被 getter 读到，就**不进 subscribers**——所以改它不触发。依赖集每轮按"实际读到什么"重建。
- **同步登记的另一面**：`setTimeout` 里读 signal 时 `currentSubscriber` 已复位为 null，登记不上——这就是"异步丢追踪"的代码级解释，也是 `on`/`untrack` 存在的理由。

## 三、Owner 与 Computation 图：谁 owning 谁

每个 computation 创建时捕获当前 **Owner**（通常是它所在的组件/作用域），连成树。作用有二：
1. **生命周期回收**：Owner 销毁（组件卸载）时，其名下的 effect/memo/监听按 `onCleanup` 逆序释放、子 Owner 先于父——这解释了 L2 的"游离异步泄漏"与 L6 的"onCleanup 防内存泄漏"；
2. **Context 解析**：`useContext` 沿 Owner 树向上找 Provider（L3），而非 DOM/渲染树。

`createRoot` 手动造一个 Owner 根，返回 dispose——**脱离组件自动回收的世界，要自己收尾**。

## 四、更新调度：批处理与拓扑序

裸版 setter 是"改一个立即通知"，会级联抖动。Solid 的实装有：
- **自动 batch**：一个同步块内的多次写、store 的多次路径写，被收拢成一次提交（对应 L4 的 store 自动批处理、L6 的手动 `batch`）；
- **拓扑排序更新**：一次提交里，按依赖图层级推进——**上游 memo 先于下游 effect、更新父不重跑子**，保证"所有派生在下一次可见更新前算完"，且每个节点一轮最多跑一次（`===` 短路让"值没变的 memo"不向下传播）。

这套调度就是"细粒度且无级联风暴"的实现根基。

## 五、编译器视角：JSX 到底变成了什么

关键认知：**Solid 的 JSX 不是"渲染产物"，是"构建真实 DOM 的代码"**。编译后：
- 静态结构（标签、写死属性）→ 一次性 `document.createElement` 建好、`insert` 进树；
- 每个**动态表达式** `{count()}` → 编译成一个 **getter 调用 + 包一层 render effect**：该 render effect 是"当前 observer"，读 `count()` 时登记订阅，变化时**只对那个文本节点/属性赋值**——这就是"更新到属性级别、不重跑组件"的物理实现；
- props 被包成 **Proxy/getter**（`createComponent` 那层），所以"别解构、用到才读"——解构=脱离 getter、丢追踪；提前求值=把本应进最细 render effect 的读取抬到组件顶层、粒度变粗。

## 六、到了 Start："use server" 的编译来路

把 L8 的指令接到编译器上（官方 use-server 行为）：
- 标了 `"use server"` 的函数/模块，编译时被**从客户端 bundle 抽走**、函数体只进服务端，客户端留下一个"远程调用代理"（走配置的 client runtime）；
- 合格模块登记进**服务端函数 manifest**，运行时按序列化模式（json/js）搬参数与返回值；
- 于是 single-flight、request event、session 全在服务端作用域里发生——**指令就是这条客户端/服务端边界的编译期开关**。

## 七、把九关串成一句话

组件是一次性的 DOM 工厂（L1/五）；状态用 signal/store、派生用 memo、异步用 resource/query（L2/5/7）；一切靠"读时登记、写时短路、拓扑批处理"精确更新到属性（L6）；生命周期与 Context 沿 Owner 树（L2/3）；样式事件按 DOM 原生心智但享委托（L4）；异步边界交给 Suspense/ErrorBoundary（L5）；Start 用文件名、"use server"、序列化与渲染形态把这套东西端到端跑起来（L7/8）——**全课皆是同一张细粒度计算图的不同切面**。

## 八、自检清单

- [ ] 能手写最小 signal/effect 实现，指出"读时登记、=== 短路、同步跑一次"三点
- [ ] 能用代码解释"异步丢追踪""动态依赖""memo 返回可订阅的 signal"
- [ ] 说清 Owner 树的两大职责（回收 + Context）与 createRoot 的显式 dispose
- [ ] 讲明白自动 batch + 拓扑序如何做到"每个节点一轮至多跑一次、父不重跑子"
- [ ] 能从 JSX 编译产物角度解释"不解构、用到才读"，以及 "use server" 的编译期抽离

🚀 **下一站**：React → Solid 迁移方法论（react-to-solid-migration）——把这套内核反向对照回你最熟的 React。
