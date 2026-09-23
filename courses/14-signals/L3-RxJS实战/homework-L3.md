# L3 阶段作业：RxJS 实战

> 覆盖：rx-basics / rx-operators / rx-inapp
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（终局误解）
某同学写完 `obs$.subscribe(() => render())` 后说："error 回调可以不写，出错了流会跳过这个值继续吐下一个。"
指出对三通道协议的两处错误理解，说明不写 error 的实际后果。

**Bug 2**（重订阅事故）
```js
function Timer() {
  const secs$ = interval(1000);           // 组件体内造流
  const n = useObservable(secs$);
  return <b>{n}</b>;
}
```
页面每次重渲秒数归零。定位根因（引用稳定性），给出两种修法。

**Bug 3**（冷热错判）
```js
const data$ = from(fetch('/api/config'));
// 组件 A、B 各 subscribe 一次，以为共享一条请求
```
Network 面板出现两次 /api/config。指出这条流是冷是热，给出不改组件代码的库侧修法。

**Bug 4**（操作符选错）
搜索框用 `throttleTime(300)` 实现'停止输入后才搜'，结果用户快速输入时丢掉尾词、搜索词永远不完整。指出 debounce/throttle 谁才是正主，说明另一个的正确使用场景。

**Bug 5**（竞态复发）
```js
input$.pipe(
  debounceTime(300),
  mergeMap((q) => from(search(q))),
).subscribe(setResults);
```
偶发旧结果覆盖新结果。指出 mergeMap 在此场景的语义缺陷，换什么、为什么连请求都能作废。

**Bug 6**（catchError 吞 bug）
```js
pipe(
  map((row) => row.profile.name.toUpperCase()),
  catchError(() => of([])),
)
```
某次后端字段改名后列表永远为空且无任何报错。指出 catchError 位置/范围的设计错误与兜底值语义问题。

**Bug 7**（retry 幻觉）
对一条 `share()` 后的热流挂 `retry({count: 5})`，断网重连后依然收不到数据。用『retry 的本质是重新 subscribe』解释为什么热流上它形同虚设。

**Bug 8**（combineLatest 冷启动）
```js
combineLatest([user$, prefs$]).subscribe(render);   // user$ 是事件流，从未吐值
```
render 永远不执行。指出 combineLatest 的前置脾气，给两种修法。

**Bug 9**（泄漏漏点）
```js
ngOnInit() {
  this.sub = this.route.params.subscribe(...);
  this.svc.events$.subscribe(handle);   // 第二条没接住
}
ngOnDestroy() { /* 只写了 this.sub?.unsubscribe() */ }
```
组件反复进出后事件处理翻倍执行。指出泄漏点与 Angular 侧更现代的两种免手动姿势。

**Bug 10**（桥的 error 通道）
useObservable 桥只写了 `next: setState`。组件在网络错误后永远转圈。补全 hook 的三个缺失设计（error 呈现、cleanup、引用约定）。

## 二、手写题（5 题）

**手写 1**：默写打字机搜索管道（map→debounce→distinct→switchMap→catchError）并给每一节配一行注释说明它在防什么。8 分钟内完成为标准。

**手写 2**：用 scan 实现'点击累计+每 5 次打包上报'的管道（提示：scan 累计数 + filter 整除 + tap 上报），禁止任何闭包外部变量。

**手写 3**：写 `toAsyncIterator(obs$)` 或口述其骨架：把 Observable 桥成可用 `for await` 消费的对象（提示：订阅入队 + 队列挂起协议，写出关键 15 行即可）。

**手写 4**：用三元组速记回答：日志全发并并发→？；消息按序不丢→？；表单校验只要最新→？（各填一个 map 兄弟并各配一句场景理由）。

**手写 5**：给『订单支付成功』事件分别用 EventEmitter 单例与 BehaviorSubject 实现跨组件通知，并写出 Subject 版比 EventEmitter 多出来的两个保障。

## 三、场景题（1 题，20 分）

实时行情大屏：3 个 WebSocket 源（价格/新闻/汇率）、12 块面板、要求断线自动重连（指数退避）、价格每秒最多刷一次 UI、K 线面板每 30s 聚合、整页要能被 React Query 拉取历史补充数据。给出：① 分层架构图（连接层/编排层/状态层/渲染层各用什么）；② 每层内至少 3 个具体操作符/工具及其职责；③ 冷热流决策：哪些流必须共享一条连接、哪些允许每订阅各生产；④ 泄漏与 error 覆盖的两条团队规范。

## 四、简答题（3 题）

**简答 1**：用『点歌 vs 直播』解释冷热流，并说明 share 与 shareReplay({refCount:true}) 分别做了什么。

**简答 2**：『见 subscribe 先问谁退订，见 pipe 先问错误归谁』——分别对应 RxJS 的哪类静默故障？各自的发现成本为什么高？

**简答 3**：Angular 为什么在 signal 化之后依然保留 RxJS？用『编排 vs 状态』给出现代分工的答案。

## 五、挑战题 🏆（+10 分）

不 import RxJS，用 ≤80 行手写一个 mini-rx：`observable(fn)`（返回带 pipe 的对象）、`subscribe({next,error,complete})` 协议、`map/filter/take/debounceTime/switchMap` 五个操作符（take 需自动退订、switchMap 需真退订旧内层）；附 8 行测试证明 take 后 teardown 被调用、switchMap 作废旧内层。（分项合计 ≤10 分：协议正确 4 + 五操作符 4 + 测试证明 2——做完你会 permanently 理解『操作符只是函数工厂』。）
