# ng-signals 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕 Angular signals 全 API、写保护模型、patch/untracked 与跨框架对比的题组。

### 1. (A) Angular signal 的惰性求值模型具体怎么工作？computed 在什么时候真正执行？

**来源**：转述自本关 §一 signal/computed/effect 三件套与 §二写保护

模型：signal 写→标记所有下游 computed 为 **dirty**（不立即算）；下游 computed 被 `.()` 读取时才检查 dirty 标记→脏则重算、不脏则返回缓存值。多层 computed 链：最末端 computed 被读→递归向上确认各层 dirty→只有真正变化的链路才重算（glitch-free）。没有读取者→永远不执行。效果：count.set(1); count.set(2); count.set(3); 期间 doubled 一次都没重算——直到有人读 doubled() 才算一次得 6。与 Solid createMemo 同惰性策略；与 14 包 tc39-core 的推/拉模型中「推标记+拉计算」完全吻合。

### 2. (A) signal 用 === 判断变化，这对对象/数组类型有什么实践影响？patch() 怎么缓解？

**来源**：转述自本关 §三 patch() 段与 §二写保护（呼应 sig-mutability）

影响：`const arr = signal([1,2,3]); arr().push(4);` 外部 `arr()` 的 effect/computed **不会被触发**——引用没变（还是同一数组对象）。必须 `arr.update(a => [...a, 4])` 或 `arr.set([...arr(), 4])` 给新引用。patch 缓解：`arr.patch(a => { a.push(4) })`（v20+ 写法内部自动 structuredClone 产生新引用）——开发者不用手记 spread 规则。代价：patch 内部克隆比手动 spread 多一步深拷贝开销——小对象无感、大嵌套结构要评估。

### 3. (B) 同事在 template 里写 `{{ count }}` 而不是 `{{ count() }}`，页面显示 [object Object]。strictTemplates 为什么不报错？

**来源**：转述自本关 §一 signal 读取语法与 ng-comp-signals 的模板调用方式

strictTemplates 检查的是『count 在组件 class 上存在吗』——存在（它是一个 WritableSignal<number>）；插值 `{{ expr }}` 接受任何有 toString() 的对象→signal 的 toString 返回内部字符串表示（如 `[object Object]` 或 signal 调试格式）。类型层面 strictTemplates 只检查属性存在性不检查『它是不是 signal 需要调用』——因为 TypeScript 类型系统里 `{{ x }}` 的 x 类型是 Signal<number>，插值不强制要求是 primitive。修法：`{{ count() }}`。长期方案：自定义 lint 规则 `@angular-eslint/signal-explicit-changes` 检测模板里 signal 引用漏 ()。

### 4. (C) Angular effect vs Solid createEffect vs Vue watchEffect：三者在『读即订阅』的粒度上有什么差异？

**来源**：转述自本关 §五 effect 与 §六 Solid 对比段（呼应 solid-effect-tracking、vue-computed-watch）

三者都是读即订阅但追踪粒度不同：Angular effect（zoneless v21+）追踪 effect 回调内所有 `.()` 读取的 signal——同 Solid；区别在**调度**：Solid 微任务批处理（同步多次 set→一个 tick 内 effect 只跑一次）；Angular v21 起也微任务+event coalescing。Vue watchEffect 追踪响应式 proxy 访问——粒度等价 signal 读取。关键差异在**清理机制**：Solid/Vue 的 onCleanup 在每次重跑前自动执行（Solid 显式传入、Vue scope.dispose）；Angular effect 的 onCleanup 回调也在重跑前执行——但需要手动注册（v18 起支持）。

### 5. (D) 设计一个 temperature 监控面板：实时显示摄氏度→华氏度转换、趋势箭头（与上次比较）、30 秒无变化自动暂停刷新。用 signal/computed/effect/patch 实现核心逻辑。

**来源**：转述自本关全篇 API 组合应用

```ts
const celsius = signal(25);
const fahrenheit = computed(() => celsius() * 9/5 + 32);
const trend = computed(() => {
  const prev = previousCelsius();
  if (celsius() > prev) return 'up';
  if (celsius() < prev) return 'down';
  return 'stable';
});
const previousCelsius = signal(25);

// 暂停逻辑
let lastChange = Date.now();
effect(() => {
  const c = celsius();
  lastChange = Date.now();
  previousCelsius.set(c);  // 记录上一帧
});
const paused = signal(false);
effect(() => {
  const check = setInterval(() => {
    if (Date.now() - lastChange > 30000) paused.set(true);
  }, 5000);
  return () => clearInterval(check);  // onCleanup
});
```
加分：说清 paused=true 时用 untracked 或条件判断停止 WebSocket push 写 celsius。

### 6. (A) untracked() 在性能上什么时候真正有用？给一个典型场景。

**来源**：转述自本关 §四 untracked 段与 §八 effect cleanup

场景：effect 里需要读一个大 signal（如 1000 条列表的 version counter）做日志/上报但不希望它的每次变化都触发 effect 重跑。不用 untracked：effect 依赖了 version→每次 version 变 effect 重跑→不必要的日志上报。用 untracked：`const ver = untracked(() => bigList.version())`——effect 仍不追踪 version 变化但因追踪了其他 signal 触发时能顺带拿到最新 version。另一场景：computed 内部用 config signal 做阈值判断但不想让 config 变化触发 computed 重算——用 untracked 包 config()。

### 7. (B) 同事用 `count.set(count() + 1)` 做递增，Code Review 建议改成 `count.update(c => c + 1)`——为什么？两者在什么场景下表现不同？

**来源**：转述自本关 §一 signal API set/update 差异

同步执行时两者等价。差异在**异步/并发场景**：如果 count.set 被另一个 microtask/effect 在同一批次里先改了——`count() + 1` 读到的是中间值导致覆盖。update(c => c+1) 的回调在 signal 内部执行、拿到的永远是最新值（signal 内部做了一次同步读取）——减少一个时间窗口。最佳实践：增量用 update、覆盖用 set。加分：patch 在对象场景下比 update 写深嵌套 spread 更短且自动处理不可变。

### 8. (C) Angular signals 在 14 包 sig-paradigms 的『推/拉』坐标系里站哪里？

**来源**：转述自本关 §一与 14 包 sig-paradigms 推/拉模型（呼应 sig-paradigms、solid-signals）

**推标记+拉计算**的混合模型：signal 写（推）只标记下游为 dirty 不执行重算；下游被读取时（拉）才检查 dirty→重算。与 RxJS 纯推（next 立即同步执行整个操作符链）对比：RxJS 的 subscribe 回调在 .next() 的同一调用栈里执行；Angular signal 的 effect 回调在**异步微任务**里执行（v21+）——解耦了写与执行。与 MobX 纯拉（computed 每次读都重算或缓存到下次脏）对比：MobX 更惰性、Angular 的 effect 需要主动调度。一句话：**写是推（标脏）、算是拉（读时）、effect 是调度后拉**。

### 9. (D) 面试官问『你在 Angular 项目里用 signal 替代 RxJS 做了哪些事？哪些留下了 RxJS？』——给一条实际的分界线。

**来源**：转述自本关 §七官方判据与 ng-rx-bridge 的预告

分界线：**数据流拓扑复杂度**。简单线性（HTTP→存值→渲染、按钮点击→状态切换）→signal 够了（一个 set 搞定）；复杂时序（switchMap 取消前请求、debounce+distinctUntilChanged 组合、多源 combineLatest、retryWhen 退避策略）→留 RxJS。具体：HttpClient 搜索框用 `switchMap` 取消过期请求→留 RxJS + toSignal 桥；列表点击选中→signal set 即可。一句话：**signal 管状态、RxJS 管事件流的拓扑变换**。

### 10. (A) effect 的 flush 策略在 v21 zoneless 下与 v18 zone.js 模式有什么不同？为什么这个变化对测试有影响？

**来源**：转述自本关 §五 effect 调度与 ng-zoneless 段预告（呼应 ng-zoneless）

v18 zone.js：effect 在变更检测周期末尾执行（zone microtask drain 后）→测试里需要 `fixture.detectChanges()` 触发一轮变更检测→effect 才跑。v21 zoneless：effect 在**微任务队列**里执行→同一 tick 内多次 signal.set 只跑一次 effect（batching）→测试里 `await fixture.whenStable()` 或 `await new Promise(r => setTimeout(r))` 等微任务 drain 后断言。对测试的影响：原来 detectChanges 后同步断言 effect 结果——现在要 await（effect 不在同一调用栈里完成）。Vitest fake timer 模式可以控制 flush 时机。

### 11. (B) signal 在组件 @Input 是 input() 时做了 `.set()`，运行时报 readonly 错误——分析为什么 input 是 readonly 且正确做法。

**来源**：转述自本关 §二写保护模型与 ng-comp-signals input 类型

input() 返回 `InputSignal<T>`（extends ReadonlySignal）——Angular 设计上输入的所有权在父组件：子组件不能写自己接收的 input（防止数据流倒挂）。要修改必须：① 通过 output 通知父改值；② 用 model() 声明双向 input（子可写、自动同步父）；③ 在子内部 `localCopy = signal(this.parentInput())` 做本地拷贝后操作 localCopy。报错信息：`NG0280: Writing to signals is not supported in a computed or effect...`——识别 input 是 readonly 是 Angular signal 设计的第一课。

### 12. (C) Angular signals 的 glitch-free 语义是什么？给一个多源 computed 的例子说明有 glitch vs 无 glitch 的区别。

**来源**：转述自本关 §一与 14 包 tc39-core/solid-signals 的 glitch-free 讨论（呼应 solid-internals、tc39-core）

Glitch = 一次更新批次里 computed 短暂读到不一致的中间态。例：`a=signal(1), b=signal(2); sum=computed(()=>a()+b()); product=computed(()=>a()*b())`。写 `a.set(10); b.set(20)`。有 glitch：sum 可能在 a 已变但 b 未变时先算一次(10+2=12) 再算最终(10+20=30)——用户看到闪 12。Angular 无 glitch：computed 惰性——同一微任务批次里 a.set 和 b.set 只标脏不触发计算→微任务结束后统一让下游拉最新值→sum 一次得 30 不闪。与 Solid 同（细粒度惰性天然无 glitch）、RxJS combineLatest 天然有（每 .next 立即推整条链）。

### 13. (D) 你的组件用了 5 个 signal + 2 个 computed + 1 个 effect。面试官问『页面打开时这些按什么顺序执行？』给出完整时序。

**来源**：转述自本关 §一 signal/computed/effect 三件套与调度模型

组件实例化→field initializer 依次执行→signal 创建（设初始值、无副作用）；computed 创建（只存函数引用，不执行）；effect 注册（首次调度微任务执行）。变更检测首跑→模板绑定读 signal()/computed()→**此时** computed 首次求值（惰性到首次读取）。effect 在首次微任务 drain 时执行（读到 signal 建立依赖）。之后：signal.set/update→标脏→微任务队列→effect 重跑（若有 signal 依赖）+ 模板绑定重新读取 computed（若其源变了）。一句话：**创建零执行→首渲染拉 computed→effect 异步→更新走微任务**。

### 14. (B) signal 在 SSR（服务端渲染）阶段能用吗？zoneless signal effect 在 server 平台有什么限制？

**来源**：转述自本关 §一与 ng-ssr 关预告（呼应 sig-server）

signal/computed 在 SSR 完全可用（纯值容器+计算、无 DOM 依赖）。**限制在 effect**：v21+ 设计里 effect 默认在 client 平台跑——SSR 阶段 effect 被 skip（`effect.ref` 默认 `onDestroy` 而非 `allowSignalWrites` 在 server 无意义）。若需要 SSR 阶段执行副作用：用 `afterNextRender` 的 `phase: RenderPhase.EarlyRead`（client-only）或 `runInInjectionContext + injector.get(PLATFORM_ID)` 判断 isPlatformServer 走替代逻辑。结论：signal 跨平台、effect 平台敏感。

### 15. (D) 面试官让你比较 Angular signals / Vue ref+computed / Svelte 5 runes 三家的『响应式粒度』——给一张三行表与一句总结。

**来源**：转述自本关 §六 Solid 对比延伸与 14 包 sig-paradigms 横向（呼应 svelte-reactive-runes、vue-reactivity-theory、solid-signals）

| 框架 | 粒度 | 通知模型 |
|------|------|----------|
| Angular | 组件内绑定级（signal→该绑定订阅者） | 推标记+拉计算（微任务批量） |
| Vue ref | 对象属性级（proxy 拦截 .get/.set） | 推（trigger 同步通知）+scheduler 异步批 |
| Svelte 5 runes | 表达式级（编译器插入 $effect 依赖图） | 编译期静态分析+运行期精确订阅 |

总结：三家都在从『粗粒度全组件重渲染』走向『细粒度绑定/表达式级更新』——Angular 靠 signal 订阅者模型、Vue 靠 proxy 拦截、Svelte 靠编译器静态分析——殊途同归但实现路径完全不同（14 包合流趋势在响应式层的证据）。
