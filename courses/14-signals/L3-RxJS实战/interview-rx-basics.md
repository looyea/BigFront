# rx-basics 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 Observable / subscribe / teardown 三要素与冷热流。

### 1. (A) 为什么有了 Promise 还需要 Observable？它们各自的世界观是什么？

**来源**：转述自 Ben Lesh《Learning RxJS》与 https://rxjs.dev/guide/observer

Promise 的世界观是『一件未来的事』：单值、一次性、无法取消（词法上就没有 teardown 抓手）、错误即终局。Observable 的世界观是『随时间流动的值序列』：多值、每个值可加工、订阅即开始退订即止、组合维度远多于 then 链。两者不互斥：from(Promise) 与 firstValueFrom(observable) 是官方互认的桥梁。面试金句：Promise 是单张期货券，Observable 是整条传送带。

### 2. (A) 讲清 Observable / Subscription / teardown 三者的所有权关系。

**来源**：https://rxjs.dev/guide/subscription

Observable 是配方（未订阅不产生副作用）；subscribe 返回 Subscription——这次生产的『用电合同』；unsubscribe 触发 teardown——合同里登记的资源回收动作（clearInterval、removeEventListener）。关键设计：teardown 是创建方写死的义务（fromEvent 自带解绑），使用方只负责在正确的时机拉 unsubscribe 这根闸刀。漏了闸刀是用户的锅，teardown 没写清是库的锅。

### 3. (A) next/error/complete 的协议约束是什么？为什么 error 之后不会再有 next？

**来源**：https://rxjs.dev/guide/observer

协议：任意多个 next，之后恰好一个终局（error 或 complete），终局幂等且不可逆。error 后不再 next 的理由：① 语义——错误意味着生产方已无法承诺序列正确性，继续吐只会污染消费者；② 工程——终局即触发整套 teardown 与订阅释放，状态机不允许复活。想恢复要用策略操作符（retry/repeat 重新订阅）而不是原地复活，这也解释了为什么 RxJS 的流天然一次性。

### 4. (B) 线上发现 setInterval 轮询在路由切换后仍每 5 秒打一次接口，RxJS 项目里列出四个可能漏点。

**来源**：转述自 rx-basics 退订姿势

① interval(...).subscribe 的 Subscription 没被任何人持有也没进容器，卸载无从谈起；② takeUntil 的 stop$ 源本身没在组件销毁时 next+complete（subject 忘 finalize）；③ 管道里 switchMap 的内层流正常收口了，但外层冷流被重复 subscribe 多份；④ 流被 share() 成热流后所有订阅者都退了，但源头 interval 是冷的且另有隐形订阅者——share 不 refCount 时源头永生。诊断顺序：谁持有订阅 → 谁负责闸刀 → 闸刀有人拉吗。

### 5. (B) 冷流热流分别对应什么真实世界比喻？给出一个『误把冷当热』的翻车案例。

**来源**：转述自 rx-basics 判断三连

冷=点歌（人手一份完整音轨），热=直播（错过即失）。翻车案例：以为 `const data$ = from(fetch(url))` 是『共享的一条请求』，两个组件各 subscribe 一次——实际发了两次 fetch（fetch 流是冷的，每次订阅重新执行）。修法：包 shareReplay({bufferSize:1, refCount:true}) 或提到单一订阅点转 signal/state 广播。这题考的是『冷热不是流的属性，是订阅与生产的关系』。

### 6. (C) AsyncIterator（for-await-of）与 Observable 都是异步多值，边界在哪？

**来源**：转述自 TC39 AsyncIterator 与 RxJS 官方的互相借鉴讨论

拉 vs 推：AsyncIterator 是消费者 pull（for-await 每轮才要下一个，天然背压）；Observable 是生产者 push（好了就通知，节奏归源头）。表达力：时间组合操作符（debounce/switch/combine）RxJS 一侧倒；简单顺序消费、与 await 生态混编 async iterator 一侧胜。互操作：from（迭代器转流）、observeOn/手动桥（流转迭代器）。选型一句话：要『关系』用流，要『顺序』用迭代。

### 7. (C) RxJS 与 signal 两大范式对『异步/时间』的切入点差异是什么？

**来源**：转述自 L1 sig-paradigms、L6 sig-vs-streams 预热

signal 切入『当下值』：任何时刻一个快照，时间是隐性的（变化事件之间）；RxJS 切入『时间序列』：事件之间的关系是一等公民（先后、间隔、重叠）。同一需求『300ms 内多次点击算一次』：signal 派要在外面自建定时器，RxJS 一个 debounceTime 进管道。互补现状：signal 生态用 toRawSignals、RxJS 生态用 firstValueFrom——两边都在修桥（L6 正面战）。

### 8. (D) 为搜索框设计一条完整 RxJS 管道并解释每一节的选择理由。

**来源**：转述自 rx-basics 三板斧组合

```js
fromEvent(input, 'input').pipe(
  map((e) => e.target.value),
  debounceTime(300),            // 停顿才算输入完
  distinctUntilChanged(),       // 同词不重发
  switchMap((q) => from(search(q))),  // 新词杀死旧请求
  catchError(() => of([])),     // 失败兜底不断流
).subscribe(render);
```
理由链：debounce 省请求、distinct 去重复词、switch 防竞态（旧响应晚到覆盖新结果）、catchError 保证单次失败不终结整条流。这是 RxJS 的『招牌菜』，面试手写级。

### 9. (A) 为什么说『subscribe 之前一切都只是配方』？这个惰性带来哪些工程好处？

**来源**：https://rxjs.dev/guide/cold-observables

没有订阅就没有副作用：fetch 不会发出、事件不会监听、定时器不会启动。好处：① 可安全地组合、传递、暂存 Observable（构造即执行的世界不敢这么玩）；② 重试=再订阅一次，天然支持 retry 语义；③ 冷流惰性是『共享一次执行』（shareReplay）得以成立的前提——先有每次订阅各自生产的默认，才有『要不要合并』的选择权。对比 useEffect 世界：构造即执行，想复用先得包函数。

### 10. (B) Angular 组件里三条订阅分别用：async 管道 / takeUntil / 手动 unsubscribe。评审各自的适用边界。

**来源**：转述自 Angular 官方风格指南 https://angular.dev/style-guide

async 管道首选：模板消费流的当下值，订阅生命周期全托管（销毁自动退），还顺带接 change detection；takeUntil 适合跨多个流统一闸刀（destroy$ 惯例）且订阅在组件类里做副作用；裸手动 unsubscribe 最脆弱——忘一次就是泄漏，只留给生命周期钩子语义（ngOnDestroy 单一出口）的个别场景。加分句：async 管道之于 Angular ≈ useSyncExternalStore 之于 React，绑定层的托管程度决定泄漏面。

### 11. (B) 流报 `Unhandled Error: xxx` 而不是你写的错误分支生效，常见原因？

**来源**：转述自 rx-basics 三通道与 https://rxjs.dev/guide/error-handling

subscribe 只传了 next 回调没传 error 回调——错误冒泡到宿主（zone/全局）。规范：要么 subscribe({next, error}) 显式处理，要么管道内 catchError 转成可消费的值；终局 error 触发后流死亡，后续订阅者一无所知，必须在上游处理而不是指望下游兜。RxJS 7+ 的 onUnhandledError 配置可改全局行为，但那是策略不是药。

### 12. (C) of 与 from 的一字之差在 Promise 输入上会造成什么行为差异？

**来源**：转述自 rx-basics 三板斧

of(fetch(url)) 吐出的值是 Promise 对象本身（单值流，消费者还得 await）；from(fetch(url)) 把 Promise 解开，吐出的是它的 resolved 值然后 complete。数组同理：of([1,2]) 吐一个数组、from([1,2]) 吐 1 再吐 2。记法：of 包壳、from 拆开——面试考的是对『流是序列』的直觉。

### 13. (D) 设计一个『带心跳与自动重连的 WebSocket 流封装』，说出 RxJS 用哪些零件。

**来源**：转述自 rx-basics 冷热与 teardown 综合题

webSocket（rxjs/webSocket）建连接流；merge(interval(30s).pipe(map(() => ({type:'ping'}))), inbound) 注入心跳；retryWhen/rxBackoff 指数退避重连；share() 让多消费者共用一条连接（冷转热）；重连窗口期消息要么丢弃（热语义）要么 buffer 暂存（bufferCount/自定义 replay）——必须显式选一个语义并写进文档。这题的分量在于：冷热、终局、退订、组合四个知识点全用到，是 RxJS 的『期末卷』。

### 14. (A) RxJS 7 之后 `import { map } from 'rxjs'` 与 `'rxjs/operators'` 都合法，历史上经历了什么？

**来源**：https://rxjs.dev/deprecations/lettable-operators

三代同堂：v5 原型链增强（rxjs/add/operator/map，tree-shaking 不可能）→ v6 lettable 操作符（rxjs/operators 具名导入）→ v7+ 操作符并入主入口、旧路径标记废弃。教训：任何被写进教程的 import 路径都是历史地层，读旧文先核年份。对 bundle 的影响见本课部署预告与 sig-size（RxJS 按操作符具名导入才能摇掉没用的）。

### 15. (D) 团队里有人反对引入 RxJS（『学习曲线陡』），有人反对全删（『搜索框离了 debounce+switch 写不动』），给出你的引入决策框架。

**来源**：转述自 rx-inapp 与社区长期论战

决策框架四问：① 需求里『事件间的关系』密度高吗（时序、竞态、合并——密集则 RxJS 回本快）；② 团队愿意投入心智税吗（管道语义需 2-4 周上手期）；③ 有没有轻量替代可分忧（单点 debounce 手写 30 行、服务端态交给 React Query）；④ 圈定使用边界（只允许在数据编排层用流，UI 状态维持普通 state/signal）。结论常是『划边界引入』而不是全收全拒——面试考的是工程判断不是站队。
