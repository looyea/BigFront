# 两大范式：流（stream）与信号（signal）

> 目标：装上本包的核心透镜——**signal 表达"当下的值"，stream 表达"随时间变化的事件序列"**；再用推/拉、细/粗粒度、可变/不可变三组坐标系把 TC39 Signals、RxJS、MobX、Zustand 四家精确放进图里。学完这关，后面每个库的 API 差异你都能从范式层面预判，而不是死记（呼应 solid-signals、rx-basics、mobx-core、za-core）

## 一、一个按钮引发的范式分野

同一个需求："计数器 +1，页面上三处显示要更新，还要记日志。"四种写法四种世界观：

```js
// Zustand：快照比较派 —— 写新值，订阅了相关切片的组件重渲
set(s => ({ count: s.count + 1 }));

// MobX：自动追踪可变派 —— 直接赋值，"谁读过这个字段"框架记账
this.count++;                       // 在 action 里

// TC39 Signals：显式容器派 —— 值装在盒子里，读即订阅
count.set(count.get() + 1);

// RxJS：流派 —— 根本没有"值"，只有"事件依次经过操作符管道"
inc$.pipe(scan(acc => acc + 1, 0)).subscribe(render);
```

前三个都在回答"值现在是多少"；第四个回答的是"**发生过什么**"。这就是两大范式的分界线。

## 二、Signal 范式：以"值"为中心

signal 抽象极其简单：**一个带订阅名单的盒子**。三句话规则：

1. **读**（`s.get()`）：如果发生在一个正在运行的响应式作用域里，把该作用域登记进订阅名单；
2. **写**（`s.set(v)`）：值变了（默认 Object.is 比较），通知名单里所有订阅者；
3. **派生**（`computed(fn)`）：自己是个只读 signal，函数体读过的 signal 就是自己的依赖，上游变则标脏、有人来读才重算。

这个模型的关键气质是**无时间的**：signal 永远只保存最新值，历史被丢弃；订阅者醒来后读到的都是"此刻"。于是派生计算极其省心——`fullName = computed(() => first.get() + ' ' + last.get())` 不需要关心是谁先变、变了几次，读的时候保证即时一致。Solid 的即时一致、Vue 的惰性脏标记、Svelte runes 的编译变体、TC39 提案的标准语义，全是这一模型的家庭成员（呼应 solid-memo、vue-computed-watch、svelte-reactive-runes）。

## 三、Stream 范式：以"时间"为中心

RxJS 的 Observable 把世界看成**事件按时序流过管道**：`clicks$.pipe(debounceTime(300), switchMap(q => fetchJson(q)))`。signal 表达不了的东西，在这里都是第一等公民：

- **事件间的关系**：两次点击间隔小于 300ms 算双击、A 流每个值触发 B 流重新发起并**丢弃上一次的未完成结果**（switchMap 的"-switch"语义就是时间轴上的抢占）；
- **有限窗口**：take(5)、bufferTime(1000)、超时 timeout(3000)——"最近 1 秒内的所有值"这种表述；
- **组合的多种时序语义**：merge（ interleaved 交错）、combineLatest（任一流新值+全体最新值）、zip（严格按序配对）、concat（串行不重叠）。

signal 世界里这些都要手写命令式代码；而 stream 世界里"取当前值"反而别扭（Observable 可能还没发过值），得靠 BehaviorSubject/scan 模拟出一个"伪 signal"。**两种范式各自擅长对方表达不了的语义，这是 L6 sig-vs-streams 整关的主题，这里先立坐标。**

## 四、三组坐标系给四家定位

### 推还是拉（push vs pull）

通知何时发生？MobX/signal 家族是**混合**：写时沿依赖图推标记（"你脏了"），但派生值被读时才拉取计算——所以没人订阅的 computed 变一百次也不重算。RxJS 是**纯推**：源头 `next()` 一路推到终点 subscriber，没人听也在产（这正是背压问题在浏览器里不如 Node 严重、但"白算一场"依然存在的原因）。Zustand/Redux 是**粗推**：store 变了通知所有订阅组件，组件再用 selector 拉自己那块并做引用比较。

### 细粒度还是粗粒度

一次写入惊动多少人？细粒度派（MobX、signal、Solid）：精确到"读了那个字段的哪个 effect"；粗粒度派（Redux/Zustand/React Context）：至少到组件，靠 selector+memo 手工收窄。粒度越细，默认性能越好、心智越反直觉（"为什么解构会丢响应"只有细粒度派会问）。

### 可变还是不可变

更新怎么写？可变派（MobX、signal 内部）：直接改，框架靠代理/ setter 拦截记账；不可变派（Redux/Zustand）：造新对象，靠引用比较发现变化。Immer 是给不可变派套可变语法糖，Zustand 的 persist/immer 中间件因此顺手（呼应 sig-mutability、za-middleware）。

| | 通知模型 | 粒度 | 更新哲学 | 时间维度 |
| --- | --- | --- | --- | --- |
| TC39 Signals | 推标记+拉计算 | 细 | 值装盒（读改写显式） | 无（只有当下） |
| MobX | 推标记+拉计算 | 细（字段级） | 可变+代理 | 无 |
| Zustand | 推（全员通知+比较） | 中（selector 切片） | 不可变 | 无 |
| RxJS | 纯推 | 流级 | 事件序列 | **有（核心卖点）** |

## 五、面试怎么聊"范式"

高频追问："signal 会取代 Redux 吗？"错误答法是站队；正确答法是坐标系："signal 是**原语层**（值+订阅），Redux/Zustand 是**容器层**（单一 store+动作），RxJS 是**时间层**（事件流），它们在不同层竞争——signal 真正竞争的对象是 MobX 的 observable 和 Vue 的 ref，而和 RxJS 是互补关系，所以才有 rxjs-interops 的 toSignals 桥。"能把"层"说清，这题就赢了。另一道："你们项目为什么选 X？"标准答案模板永远是：**状态分层 → 每层的约束（粒度/调试/体积/团队熟悉度）→ 选出该层的工具**，而不是"因为星多"。

> 🚀 部署预告：范式影响测试策略——stream 的"时间"语义要用 marble test 才能断言时序，signal 的即时一致用普通断言就够；CI 里两者跑法不同。L7 sig-debug 会演示 RxJS 的冷流陷阱如何伪装成"偶发失败"的 flaky test。
