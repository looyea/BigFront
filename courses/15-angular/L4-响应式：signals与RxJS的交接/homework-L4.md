# L4 阶段作业：响应式——signals 与 RxJS 的交接

> 覆盖：ng-signals / ng-rx-bridge / ng-zoneless
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（signal 直接赋值）
```ts
count = signal(0);
// 某处：
this.count = 42;
```
视图不更新且 signal 被覆盖。指出问题与修法。

**Bug 2**（computed 里 subscribe）
```ts
combined = computed(() => {
  this.http.get('/api').subscribe(d => this.data.set(d));
  return this.data();
});
```
指出两处违反 computed 纯函数约束的错误。

**Bug 3**（toSignal 在 service constructor 里）
```ts
@Injectable({providedIn:'root'})
export class Svc {
  data = toSignal(this.http.get('/api'));
}
```
内存泄漏风险与正确位置。

**Bug 4**（对象突变）
```ts
state = signal({user: {name: 'A', age: 20}});
// 改值：
this.state().user.name = 'B';
```
视图不更新。给两种修法。

**Bug 5**（effect 里 inject）
```ts
constructor() {
  effect(() => {
    const svc = inject(LogService);  // 这里做什么
    svc.track(this.pageView());
  });
}
```
报 NG0203。指出原因与修法。

**Bug 6**（zoneless 下普通属性突变）
```ts
title = 'hello';
onClick() { this.title = 'world'; }
```
zoneless 工程里点击后视图不更新。给两行修法。

**Bug 7**（signal 在模板漏括号）
```ts
name = signal('Angular');
```
```html
<h1>{{ name }}</h1>
```
显示 [object Object]。指出原因并给修法。

**Bug 8**（untracked 误用）
```ts
const total = computed(() => {
  return this.items().reduce((s, i) => s + i.price, 0) + this.taxRate();
});
// 期望 taxRate 变了 total 也重算
```
同事写成了 `untracked(() => this.taxRate())`。判断这导致什么行为差异。

**Bug 9**（BehaviorSubject 残留）
```ts
private _data$ = new BehaviorSubject<Data>(null);
data$ = this._data$.asObservable();
// zoneless 工程模板里用 data$ | async
```
视图不更新。给两条修法。

**Bug 10**（afterNextRender 在 SSR 报错）
```ts
constructor() {
  afterNextRender({ write: () => { this.chart.init(); } });
}
```
SSR 构建时报 'Chart is not defined'。判断是否该改与改什么。

## 二、手写题（5 题）

**手写 1**：用 signal/computed/effect 实现一个温度计：celsius signal → fahrenheit computed → effect 打印变化 → patch 更新嵌套对象 {temp: {c: 25, unit: 'C'}}。

**手写 2**：用 toSignal + RxJS 管道实现搜索去抖：signal 绑定输入→toObservable→debounceTime(300)→switchMap(HTTP)→toSignal 渲染结果。

**手写 3**：把以下 BehaviorSubject 服务改写为 signal 服务（旧→新对照）：
```ts
_user$ = new BehaviorSubject<User>(null);
user$ = this._user$.asObservable();
loadUser(id) { this.http.get(url).subscribe(u => this._user$.next(u)); }
```

**手写 4**：列出 zoneless 迁移 checklist 五条（本关 §三），每条给一个 blocker 场景与解法。

**手写 5**：用 untracked() 写一个 computed，依赖 a 不依赖 b，并解释 b 变时 computed 为什么不重算。

## 三、场景题（1 题，20 分）

你的团队要把一个 zone.js + RxJS 重度依赖（30 个 BehaviorSubject、50 处 AsyncPipe、20 个 switchMap 搜索流）的 v19 工程迁移到 zoneless + signals。给出：① 迁移分几期、每期改什么类型的代码（codemod vs 人工）；② switchMap 类流是全改 signal 还是保留 RxJS+toSignal 桥——给判据；③ AsyncPipe 批量替换为 toSignal 后测试怎么改；④ 灰度策略：先切哪个模块、怎么验证无回退；⑤ 一处最可能翻车的遗留（如 jQuery 插件回调写普通属性）的治理方案。

## 四、简答题（3 题）

**简答 1**：为什么说『zoneless 不是不需要变更检测，是换了触发机制与范围』？用 signal.set 后的执行路径说明。

**简答 2**：signal 的惰性求值（computed 没人读不算）在实际应用里有什么正面与负面效果？各举一例。

**简答 3**：14 包 sig-vs-streams 说『signal 表达当下的值、stream 表达事件序列』——用 Angular HttpClient 为例说明为什么它更适合 stream 而非 signal。

## 五、挑战题 🏆（+10 分）

设计一个『zoneless 变更检测可视化调试工具』原型：① 当任何 signal 写入时，在浏览器 overlay 上高亮所有受影响的 DOM 节点（绿色闪烁 200ms）；② 面板显示本轮微任务 drain 内 signal 写次数、触发 effect 数、dirty 组件数；③ 可暂停并逐步执行（类似 Chrome DevTools Performance Recorder）。输出：实现思路（hook signal.set 内部还是走公开 API）、数据结构设计（signal→订阅者→DOM 映射）、性能影响评估（生产不能开、dev 下开销多少）。
