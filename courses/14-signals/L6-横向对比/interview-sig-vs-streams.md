# sig-vs-streams 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 signal/stream 世界观差异、互借与混合架构。

### 1. (C) 用非术语语言解释 signal 和 stream 的区别，并各给一个『用错地方』的例子。

**来源**：转述自本关透镜与两家文档

signal=白板上当前写着的那个数（随时抬头看）；stream=传送带上一件件过去的包裹（价值在顺序与节奏）。用错例：拿 stream 做 UI 状态——组件挂载时传送带已经转完，新来的看不见当前值（要 replay 补丁，等于重造 signal）；拿 signal 做事件序列——两次快速 set 之间没有『过程』，中间值直接蒸发（signal 只保最后落点）。一句话：**状态丢了就是丢了、事件丢一个少一个，两类系统对『错过』的态度相反**。

### 2. (A) BehaviorSubject 常被说成『RxJS 里的 signal』，同在哪三点、差在哪三点？

**来源**：https://rxjs.dev/api/index/class/BehaviorSubject

同：持有当前值、新订阅立刻拿最新值、set 即向全体订阅者广播。差：① BehaviorSubject 完成即死（complete 后不再可写，signal 无此生命周期终点）；② 它是 Observer 全家桶入口（next/error/complete 三通道），signal 只有值通道+异常靠宿主；③ 无惰性图——下游 map 每次广播即推（eager），signal 的 computed 惰性拉+glitch-free。前两点形态像、第三点机制骨头完全不同——这题筛『只背了 API 对照表』的候选人。

### 3. (B) 团队用 fromEvent 包了搜索框，上线后切路由再回来就失效/或重复请求翻倍，两个典型漏订病灶是什么？

**来源**：转述自 rx-inapp 泄漏清单在本关的镜像

① 组件卸载没 unsubscribe（管道活着，事件源还挂着）——回到页面又订一层，请求翻倍；② 把管道建在 render 函数体里（每次渲染 fromEvent 一遍）——同上一病灶的构造版。修法：订阅建在 useEffect/useResource 生命周期、cleanup 退订；或干脆 Angular（Zone+async pipe 托管）。深层：流的世界『订阅是显式资源』，signal 的世界 effect 自动配对清理——**从 signal 思维进 RxJS 世界最容易漏的就是这根退订弦**。

### 4. (D) 『实时价格看板：WS 推送 + 每秒轮询兜底 + 三屏展示取最新』，给出 signal/stream 分工设计。

**来源**：转述自本关海关形状

编排层：RxJS `merge(ws$, poll$)` → distinctUntilChanged(按币种) → 出口 `subscribe(p => priceSignal.set(p))`（海关一行）；状态层：priceSignal + computed(涨跌幅)；展示三屏各自 effect 读 signal 写 DOM（或框架绑定）。加分点：为什么合并不放 signal 层——『两源最新者胜』是事件间关系（带时间戳比较=序列逻辑）；为什么展示不直接订阅流——三屏各订各的会漏『挂载前价格』（当下值税）。答题结构=海关句的完整应用。

### 5. (C) switchMap 与『signal 版手写 latest 比对』在语义上等价吗？给一个不等价的边界。

**来源**：转述自两家机制对照

主干等价：都是『以最新输入为准，旧结果的副作用不落地』。边界三处不等价：① switchMap 会**取消旧内层流**（配合 fromFetch+AbortController 能真的掐掉网络请求），latest 比对只是丢结果——流量与耗时照付；② switchMap 对『旧请求已完成、新请求还没回』的窗口输出由外层决定（结果可能被吞进 switch 的静默），手写法里 setTimeout 竞态更明显；③ mergeMap(1) 才最接近严格串行，switch 语义允许并发在途。能答出『取消 vs 丢弃』一层即高分。

### 6. (A) 说『signal 的相等判定是闸门、stream 的 debounce 是时间阀门』，两个抽象各自的实现骨架是什么？

**来源**：转述自本关闸门家族与 rx-operators 机制节

闸门：`shouldEmit = !equals(prev, next)`——一个二元函数+一个 prev 槽位，状态 O(1)，拦截的是『值』；时间阀门：滑动窗口/定时器组，记录的是『最近事件的到达时刻序列』，拦截的是『节奏』。组合性差异：闸门可串联（equals && memo 各管一层），时间阀门串联会互相 reshuffle 时序（debounce 后 throttle 语义易反直觉）。同一族谱：filter=谓词闸门、distinctUntilChanged=相等闸门、debounceTime=节奏阀门——把三兄弟分进两个抽屉，这题就答完了。

### 7. (C) Angular 同时押注 RxJS 与 signals，官方给两者的分工是什么？这个标本说明什么？

**来源**：转述自 Angular Zoneless 与 signals 互操作文档

分工：RxJS 留在**服务层的异步编排**（HTTP 重试合并、路由参数流），signals 接管**视图层的同步状态**（模板绑定、表单值、计算属性）；互操作桥 `toSignal(rx$)`/`toObservable(sig)` 就是官方海关。标本意义：连『RxJS 亲生框架』都承认 UI 状态该换世界观——两家不是你死我活而是**分层共存**，这直接是本关海关形状题的官方盖章。

### 8. (B) 把 WebSocket 消息流经 shareReplay(1) 当全局状态用，队友反对，列出三宗罪与正解。

**来源**：转述自社区反模式讨论

① 无法同步读取——拿值必须订阅（组件挂载即错过消息，要自己管 replay 窗口）；② 生命周期错配——shareReplay(1) 的 refCount 语义与『谁最后退订』会悄悄断流或永不断流（内存账两难）；③ 错误不可恢复——WS error 后流终止，replay 壳里存的是尸体，重连要整链重建。正解：出口海关进 signal/store（当下值归状态层），重连逻辑在流层带 retry+backoff。这题的判据一句话：**『当下值』的职责别外包给流的补丁原语**。

### 9. (D) 只用 async/await + signal（无任何流库），实现『带取消与重试退避的请求』，说明你会在哪一步开始怀念 RxJS。

**来源**：转述自手写练习（本关实验的正式版）

```js
async function load(url, { retries = 3, signal: ext } = {}) {
  for (let i = 0; i < retries; i++) {
    const ac = new AbortController();          // 取消原语
    try { const r = await fetch(url, { signal: composeAbort(ext, ac) }); return await r.json(); }
    catch (e) { if (i === retries - 1) throw e; await sleep(2 ** i * 200 + jitter()); }
  }
}
```
怀念点：竞态作废要手搭 latest/AbortSignal 组合、进度节流要手写时间戳比对、多源合并要手写订阅簿——每条都是一次性代码，RxJS 里是一个算子。**答案诚实=『能写，但每次都在重演 switch 家族的手写税』**，这题考的就是知难而退的选型诚实。

### 10. (C) 细粒度（signal）与粗粒度（stream+快照）订阅在『状态更新频率远高于渲染频率』场景的表现差？

**来源**：转述自本关与 L7 sig-perf 预告

细粒度：每个表达式一个订阅，拖拽每帧只精确重跑读到的那几个 DOM 写操作（Solid 每帧恒定工作量）；粗粒度：帧帧触发『比较→ setState →协调』，开销与组件树大小相关——但配合 transient（za-patterns）也能做到不渲。公允结论：**拖拽赢家不是 signal 范式而是『绕开渲染层的直写通道』**，三家都有（signal effect/MobX reaction/Zustand subscribe）——粒度影响的是默认成本，直写决定的是上限。

### 11. (A) 『事件流经过海关变状态』之后，哪些信息永久丢失了？举两个设计因此必须提前决策的点。

**来源**：转述自本关第六节延伸

丢：① 中间序列（两次 set 之间的脉冲、到达节奏）——事后想算 QPS/连击无门；② 因果与配对（哪个响应对应哪个请求、错误发生在第几跳）。提前决策：审计/统计类需求要不要在海关前 tap 落日志；去重按事件 id 还是按值（值去重会把合法重发当重复吞掉）。答题价值：证明你理解『状态化=有损压缩』。

### 12. (C) Solid 的 memo 与 RxJS 的 publishReplay/ shareReplay 都叫『缓存』，机制区别一句话各说清。

**来源**：转述自两家惰性/急切模型

Solid memo：**惰性拉**——无人读不重算，上游脏了也只是标脏，读时才按图重算（glitch-free）；shareReplay：**急切推缓存**——源推一次存一份，下游来了给存的，从不重算（它缓存的是『历史事件』不是『推导结果』）。同词两义：推导缓存 vs 事件缓存——用错词的架构讨论一半在鸡同鸭讲。

### 13. (D) 面试官现场出题：『页面顶部倒计时、侧边未读消息数、搜索建议、日志流面板』四项各选 signal/store/stream 路线并说一句理由。

**来源**：转述自综合选型现场题

倒计时：stream 味浓（每秒脉冲）但展示要当下值——interval$ → 海关进 signal，或直接 signal+effect 自管 interval（简单版）；未读数：**signal/store 完胜**（典型的『现在是多少』）；搜索建议：序列主场（debounce+switch）→ 流编排+结果进状态；日志面板：**纯 stream 主场**（要的是序列本身，滚动历史不能合并丢失——signal 的覆盖语义在这里是致命伤）。最后一条最出彩：认出『有的需求就该让状态让位，日志的 value 是流本身』。

### 14. (B) 从 RxJS 迁到 signals 的项目里，三类原来一行算子搞定现在要手写的逻辑是什么？各给补救。

**来源**：转述自迁移社区实践（sig-migrate 预热）

① 竞态作废（switch 家族）→ 手写 latest token+AbortController，或引轻量 utility；② 时间整形（debounce/throttle）→ 引 lodash.debounce 级工具但注意与 effect 清理的挂接（漏清=旧定时器打新值）；③ 多源合流（combineLatest 家族）→ 逐源 effect 订阅再聚合，小心首值缺失（signal 都有初值反而不易翻车——这题的反直觉点）。诚实结论：这三类就是『signal 项目里该保留少量 RxJS 或自研薄 utility』的理由——选型题的真实答案常是 80/20 混编。

### 15. (C) 用『对错过的态度』给 promise/signal/stream 排序，这个排序解释了三者的什么设计差异？

**来源**：转述自三家语义综合（L1 坐标系收拢）

错过即无：signal 永远给当下（历史不可追问，错过=被覆盖）；错过即等：promise 一次性，早到值存住（await 晚也拿到那一个值）、晚到的无处安放（只能再包一层 stream/signal）；错过即补：流可 replay/buffer 重放历史（错过可追）。设计差异全在此投影：promise 无多值、signal 无历史、stream 无快照——三者各自把『时间』切了不同的一刀。金句收束：**问 UI 状态=问当下（signal），问异步结果=等一次（promise），问发生序列=回放全都要（stream）**。
