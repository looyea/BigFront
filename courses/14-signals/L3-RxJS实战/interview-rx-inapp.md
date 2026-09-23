# rx-inapp 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 RxJS 与现代前端的集成、分工与退场边界。

### 1. (B) 手写一个生产可用的 useObservable hook，说出每一行的防御点。

**来源**：转述自 rx-inapp React 桥三坑

```js
function useObservable(obs$, initial) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState(null);
  useEffect(() => {
    const s = obs$.subscribe({ next: setState, error: setError });
    return () => s.unsubscribe();
  }, [obs$]);
  return [state, error];
}
```
防御点：① 订阅进 useEffect（SSR 安全+可清理）；② error 进状态并返回给消费方（不许静默死流）；③ 依赖数组含 obs$——配套规约『流必须引用稳定』（模块顶层或 useMemo），否则此 hook 会放大重建事故。加分：指出冷流多组件各订一份的语义提醒。

### 2. (A) 为什么 React 官方不内建 Observable 支持，而 Angular 把它当一等公民？

**来源**：转述自两家设计哲学公开论述

React 的模型是『UI=f(state)』+ 自己的调度器（并发、优先级）——外部推流直灌 setState 会绕过它的节奏控制，桥永远只能是辅助件；Angular 的模型是 DI+RxJS 贯穿全家（HTTP/路由/表单都吐流），async 管道就是官方绑定层。引申：RxJS 在 React 世界的正确位置是『数据编排层』，渲染层交给 hooks 状态或 signal 桥——位置放对两家都是好搭档。

### 3. (B) 线上页面切走再切回三次后越来越卡，怀疑 RxJS 泄漏，给出排查动线。

**来源**：转述自 rx-inapp 内存泄漏治理清单

① Chrome Memory 拍 Heap Snapshot 对比：detached DOM 节点/组件实例数量随切换单调涨→泄漏实锤；② 全局计数器：每个 subscribe 出口打 activeSubs++/--（或 RxJS 层加钩子日志），切走时断言归零；③ 重点嫌疑名单：裸 subscribe 无归属、takeUntil 的 destroy$ 忘 complete、share() 无 refCount 的源头永生、事件监听在 useEffect 外重复注册；④ 修复后补测试：模拟挂载卸载循环断言订阅数。动线核心：先证伪（订阅数归零断言）再定位。

### 4. (C) fetch+AbortController、AsyncIterator、RxJS 三套异步方案，各在什么需求密度下回本？

**来源**：转述自 rx-inapp 分工对照表

fetch/await：单值、线性流程——永远的首选默认。AsyncIterator：有背压的顺序流（分页拉取、文件流）——for await 的节奏天然匹配。RxJS：出现『事件之间的关系』才开始回本——去抖+竞态+合并+时序断言任意两项组合即回本（手写这些的状态机样板膨胀得快）。一句话：单值→Promise、顺序→迭代器、关系→流。面试官爱听的是『回本曲线』而不是站队。

### 5. (D) 产品需求：表格里每行一个『保存』按钮，要求防连点、失败重试、另一行保存时本行不许并发写。用 RxJS 设计。

**来源**：转述自 rx-inapp 综合练习

每行 saveClick$.pipe(
  exhaustMap 或 throttleTime(0, {leading:true, trailing:false})——防连点（旧请求未完时忽略新点击，exhaust 的正牌场景）；
  switchMap 不适用（不能作废进行中的保存）；
  跨行互斥：merge 各行的保存请求流 → mergeMap(fn, 1)（并发=1 的全局串行闸）或 concat 队列；
  失败重试：retry({count:2, delay:退避}) 包在行内管道。
要点：三个 map 兄弟的选型论证就是本题的分数分布——exhaust 防连点、concat/merge(1) 做互斥、retry 配退避。

### 6. (A) 为什么『流的错误即终局』让 error 通道成为团队规范的必争之地？

**来源**：转述自 rx-inapp 治理清单

一次未处理的 error 不是崩页而是『静默瘫痪』：流死了、内存正常、无红字——用户看到界面永久定格。这比崩溃难发现一个数量级，所以规范要制度化：subscribe 必须传 error 或管道内 catchError 显式接管；关键管道加 tap(err$) 上报；监控侧对『流活性』打点（心跳流超时告警）。把『error 覆盖率』纳入 code review 硬指标是唯一解。

### 7. (C) Angular 把 RxJS 挪回编排层、React 生态把服务端态交给 React Query——这两个动作的共同信号是什么？

**来源**：转述自 rx-inapp 与 sig-server 趋势

状态管理的大分层共识成形：『异步编排（流擅长）』『客户端状态（signal/store 擅长）』『服务端缓存（专用 query 层擅长）』各归各位，一库通吃的时代结束。RxJS 没输，它从『全家桶』退位成『编排专家』。面试金句：2015 年选 RxJS 是信仰问题，2025 年选它是分工问题。

### 8. (B) 组件卸载时 fetch 请求还在飞，switchMap 管不管？怎么让『作废』落到连接层？

**来源**：转述自 rx-inapp AbortController 各管一层

unsubscribe 只退订 Observable，fetch 连接照飞——要真取消得桥接：`from(new Promise((res, rej) => { const ac = new AbortController(); fetch(url, {signal: ac.signal}).then(res, rej); return () => ac.abort(); }))` 或用封装好的 rx-fetch。这题的深层考点：RxJS 的 teardown 是语义层合同，底层资源回收要创建方履行——『取消』的正确姿势是分两层设计。

### 9. (D) 为低频事件（订单支付成功）设计跨组件通知：EventEmitter 单例 vs Subject vs signal，给三方评审。

**来源**：转述自 rx-inapp 与 L1 范式对照

EventEmitter：裸事件、无当前值、注册时机漏听即永久丢；Subject（RxJS）：同带退订合同+可 upgrade 成 BehaviorSubject 补历史，但引入整个流库为一次通知太重；signal 方案：事件语义用『计数器/令牌 signal』表达（paidTick.set(t=>t+1)），订阅天然带当前值，跨端复用最好。结论常是『事件密度决定工具』：全 app 事件总线多→值得上流；零星通知→signal 或原生 EventTarget 就够。

### 10. (A) firstValueFrom 的超时控制怎么做？它适合替代整个 RxJS 吗？

**来源**：https://rxjs.dev/api/index/function/firstValueFrom

firstValueFrom(obs$, { defaultValue: 兜底值 }) 配合 timeout（rxjs 操作符）或 Promise.race 做超时。它解决『从流里取一个值回到 await 世界』——是桥不是替代品：一旦你需要第二个值及其关系（第二个、最新、合并），就该回到管道。滥用信号：代码里出现十几处 firstValueFrom(手动包装的流) 时，往往说明那个模块根本不需要 Observable。

### 11. (B) 老项目把 Redux 所有异步 action 改写成史诗级 RxJS epic 链，新人完全读不懂，复盘三条教训。

**来源**：转述 redux-observable 社区长期批评

① 表达力越强的工具越需要团队公约：epic 里 switch/merge/concat 混用无规范，每人一种人格；② 抽象层次错配：业务 CRUD 的关系复杂度撑不起响应式编排，复杂度是搬回来的不是长出来的；③ 可读性税没被计入选型成本——管道是写给人读的，debugger 跟不动的链=黑盒。教训：RxJS 引入要配『操作符白名单+分层边界（只在数据层）+结对上手期』三件套。

### 12. (C) WebSocket 场景，AsyncIterator（for await）和 RxJS webSocket 流谁更顺手？

**来源**：转述自 rx-inapp 顺序与关系对照

收消息→逐条处理：for await 极顺手（拉模型自带背压、与 await 生态无缝）；一旦要重连+心跳+按类型分发+多订阅共享一条连接（关系密度上来了），RxJS 的 merge/retry/share/分组操作符优势立现。混合方案也常见：底层用 webSocket 流管连接策略，对业务暴露 async iterator。这题答『看关系密度』即及格，给出混合架构是优秀。

### 13. (D) 设计『一个搜索页』的现代分工：RxJS 管什么、React Query 管什么、URL 状态放哪？

**来源**：转述自 rx-inapp 与 sig-scenarios 分层

RxJS：输入流治理（debounce+distinct+竞态策略）→ 产出『稳定查询参数』；React Query：拿参数发请求、缓存、加载/错误态、翻页 keepPrevious；URL（searchParams）：查询词与分页是一等状态，可分享可回退，流与 query 都从 URL 派生。边界口诀：编排归流、缓存归 query、可分享状态归 URL——三层各司其职互不偷地盘。

### 14. (B) 项目里 RxJS 版本从 6 升 7，CI 全绿但线上偶发 `You provided an invalid object where a stream was expected`，最可能踩了什么迁移坑？

**来源**：https://rxjs.dev/deprecations

subscribe 传了普通对象做回调（v6 容忍部分形态）或 fetch 结果/AsyncIterable 被直接塞进 combineLatest/zip 等高阶位置——v7 对可订阅对象的校验更严；另外旧 fetch 结果对象被当 Observable 用的猴子补丁时代残留也集中爆雷。迁移纪律：跑官方 codemod、对全部 combineLatest/merge 入参做『是否 Observable』类型收紧（TS 泛型别用 any 糊过去）。

### 15. (D) 面试官问：『你们项目为什么没用 RxJS？』——用本课框架给一个体面的两分钟回答。

**来源**：转述自 rx-inapp 裁决公式

示范答案骨架：① 我们的异步关系密度集中在服务端缓存（React Query 整层代劳）与少量输入治理（30 行自研 debounce+latest-token 足够）；② 引入 RxJS 的团队心智税（review 能力、调试门槛）在当前人力结构下不划算；③ 边界清晰：若未来出现『多源实时合并+时序策略』（如协作光标、行情推送），RxJS 或同类流库会重新上桌——届时它进数据编排层，不碰 UI 状态。考核点从来不是用没用，而是选型有无声称过的代价模型。
