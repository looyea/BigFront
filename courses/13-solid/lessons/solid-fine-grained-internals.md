# 细粒度响应式内核：Signals、Observers 与依赖图

> 目标：能讲清 Solid 响应式的两大原素（signal 与 observer）、订阅如何"读时自动登记"、依赖的动态与同步本质、几类 observer 的时序差异、嵌套 effect 的隔离——从而理解为什么它快、以及哪些写法会"弄粗"这张依赖图。呼应课业「说清 Solid 更新到属性级别而非组件级别」。

## 一、两大原素：signal 与 observer

整个系统就两类角色：
- **Signals**：指向值的可变单元，一对函数——getter（读）+ setter（写）。
- **Observers**：会"订阅"信号的副作用（effect、memo、render effect 等）。

其余原语都是在它们之上组合：
- **Stores**：Proxy，内部按需创建/读写 signal；
- **Memos**：像 effect，但**返回一个 signal**并缓存计算，用于计算优化；
- **Resources**：建立在 memo 之上，把异步网络请求"变成同步"、结果嵌进 signal；
- **Render effects**：**立即执行**的特制 effect，专门管理渲染。

## 二、订阅是"读时自动登记"的

官方用"从零搭一个响应系统"讲透机制（观察者模式）：
- 全局维护"当前正在执行的 observer"引用（`currentSubscriber`）；
- **getter 被读到时**：把当前 observer 加入自己的 subscribers 集合，然后返回值——**这就是自动依赖收集**；
- **setter 被调用时**：先比较 `value === newValue`，**没变就不通知**（短路），变了才逐个通知 subscribers 重跑。

关键结论：**依赖不是声明出来的，是"运行过程中实际读了哪些信号"动态确定的**。

## 三、同步 & 动态：两个必须内化的性质

1. **同步登记**：系统"登记订阅者 → 运行函数 → 注销订阅者"是线性同步完成的。所以：
   ```ts
   createEffect(() => {
     setTimeout(() => console.log(count()), 1000); // ❌ count 不会被追踪
   });
   ```
   等 setTimeout 回调真正跑时，已没有登记的 subscriber——**异步里读信号默认不建立依赖**（要手动用 `on` 指定依赖）。
2. **动态依赖集**：只有"本次实际执行到的读取"才成为依赖。官方温度例子（`createMemo` 早返回）最能说明：
   ```ts
   const displayTemperature = createMemo(() => {
     if (!displayTemp()) return "Temperature display is off"; // 关掉时不读 temperature/unit
     return `${temperature()} degrees ${unit()}`;
   });
   ```
   `displayTemp` 为 false 时，改 `unit` **不会**触发重算（它当前不是依赖）；重新打开才纳入。

## 四、几类 Observer 的时序差异

| 原语 | 何时跑 | 用途 |
| --- | --- | --- |
| `createRenderEffect` | **立即**（渲染期） | 写 DOM，保证属性在元素进 DOM 前设好 |
| `createComputed` | 拓扑序、随源更新 | memo 的内部基础，**不面向普通用户** |
| `createMemo` | 惰性 + 缓存，返回 signal | 派生值、收敛重复计算 |
| `createEffect` | **延迟到渲染后**、批处理 | 与外部系统交互（日志/订阅/异步） |

时序总则：**更新父组件不会更新子组件、memo 先于它下游的 effect**——Solid 按依赖图拓扑序保证"所有计算在下一次更新前完成"。

## 五、嵌套 effect 是相互独立的

```ts
createEffect(() => {
  console.log("Outer starts");
  createEffect(() => console.log(count())); // 内层订阅 count
  console.log("Outer ends");
});
```
**内层 effect 里读的信号不会登记为外层的依赖**；`count` 变化只让内层重跑、不碰外层。这强制每个 effect 彼此独立，避免意外耦合。

## 六、Owner 树与"节点"生命周期

响应图是一堆互连的"节点"（signal / effect / 其它原语）。节点变动会重算与之相连的部分。组件销毁沿 **Owner 树**（不是渲染的 DOM 树）：子 Owner 总在父之前销毁；**清理用 `onCleanup`**，否则卸载后仍有引用在后台跑就是**内存泄漏**（effects 官方专门点出）。

## 七、这套内核"何时会不划算"

- 依赖图本身有内存/调度开销：**给每个原始值都配一个 effect** 是浪费（官方点名 memo 若只是直接返回一个 store 属性、无过滤/排序，反而多一次订阅——不如直接用那个属性）。
- **把信号解构 / 提前求值**会把细粒度"弄粗"（丢掉 getter 的按需追踪）。
- **在 effect 里 set 信号**可能造成额外渲染甚至无限循环（官方建议：派生用 memo，别用 effect）。

## 八、自检清单

- [ ] 能说出 signal = getter+setter、订阅是"getter 被读时自动登记"、setter `===` 短路
- [ ] 能解释异步里读信号为何不建依赖（同步登记本质），何时用 `on` 手动指定
- [ ] 能用温度例子说明"动态依赖集"（早返回改变依赖）
- [ ] 能区分 render effect / computed / memo / effect 的时序与用途
- [ ] 知道嵌套 effect 互相隔离、清理沿 Owner 树、避免在 effect 里 set 信号

🚀 **下一站**：状态组织（solid-state-patterns）——把这套内核用起来，选好 signal / store / 派生的边界。
