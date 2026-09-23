# sig-vs-streams：signal 与 stream——当下值与时间序列

> 目标：用同一批需求（搜索去抖、跨源合并、限流）分别以 signals+async 和 RxJS 各写一遍，把『寄存器 vs 磁带』的透镜钉死；认识两家的互相借鉴（firstValueFrom/toRawSignals），最终能脱口而出『事件间的关系交给 stream，状态的最新快照交给 signal』（呼应 tc39-core、rx-operators、rx-inapp）

## 一、一句话世界观

- **signal 回答：现在是什么？**——它是个寄存器：永远持有当下值，任何时刻 `.get()` 拿到的就是事实；变化通知是『值换了，重算依赖』；
- **stream 回答：发生过什么序列？**——它是磁带：值是一个个刻度推过来的事件，意义在**顺序与间隔**里（这个跟在那个后面 300ms 内出现算连击）；

L1 建的这组坐标系，到本关要做成正反两方面的肌肉：看一段代码，先问『它关心当下值，还是关心事件之间的关系？』——问对这一句，两家的选型错不了大方向。

## 二、同一需求两遍：搜索框去抖

需求：输入停止 300ms 后发请求，新输入作废旧请求。

**RxJS 版（rx-operators 的原样回收）**：

```ts
fromEvent(input, 'input').pipe(
  map((e: any) => e.target.value),
  debounceTime(300),
  distinctUntilChanged(),
  switchMap((q) => from(fetch(`/search?q=${q}`).then((r) => r.json()))),
).subscribe({ next: (data) => (results = data), error: (e) => (err = e) });
```

**signals 版（Preact/@preact/signals 语义，effect+watch 手写节奏）**：

```ts
const query = signal('');
const results = signal([]);
input.addEventListener('input', (e) => query.set(e.target.value));

let latest = '';                      // 手写『作废』：自己记下最新一轮

effect(() => {
  const q = query.get();              // 读即订阅：只依赖 query
  latest = q;
  const t = setTimeout(async () => {
    const data = await (await fetch(`/search?q=${q}`)).json();
    if (latest === q) results.value = data;   // 写 results 不建依赖；已被新输入超越则丢弃
  }, 300);
  return () => clearTimeout(t);       // 退订=清理，effect 重跑前自动执行
});
```

并排看差异就三行字：**RxJS 的『作废旧请求』是 switchMap 白送的，signals 版要手写 latest 比对**；RxJS 把『300ms 静默』『同值吞掉』都表达成管道上的算子（事件间关系是头等公民），signals 版里时间和序列是**你用 setTimeout 自造的**（它的世界观里只有当下值）。反过来，需求改成『把 results 显示出来+别的地方随时能读当前结果』——signals 版完胜：`results.get()` 随处可取；RxJS 版你得自己再造一个变量存『最后一个值』（这正是 BehaviorSubject 存在的理由——流的『当下值』是补丁不是本性）。

## 三、各自的主场清单

| 需求形状 | 赢家 | 为什么 |
|---|---|---|
| 表单联动、计数、UI 态 | signal | 全是一元『当下值』，get 即答案 |
| 搜索去抖+竞态作废 | RxJS | debounce/switch 是序列代数 |
| 双源合并（WebSocket+轮询）取最新 | RxJS merge/combineLatest | 『多输入一输出』拓扑是流的语言 |
| 跨组件共享的派生统计 | signal computed | 惰性+缓存+随处 get |
| 限流/退避重试 | RxJS throttleTime/retry | 又是间隔与次数——时间轴属性 |
| 需要被任意代码读取的状态 | signal | stream 不存值，读要订阅（快照税） |

经验法则：**需求里出现『在 X 之后』『X 时间内没发生 Y』『连续 Z 次』这类短语→ stream 的主场；出现『现在的 X 是多少』『谁在读 X』→ signal 的主场**——rx-inapp『编排归流、缓存归 query、可分享状态归 URL』其实早给过判据，今天补上『状态』这一极。

## 四、互相借鉴：两家正在换装

- **stream 向 signal 借『当下值』**：RxJS 的 BehaviorSubject/Signal（v7.2+）、`firstValueFrom`/`lastValueFrom` 把流拉回 Promise/signal 世界；Angular 双栈并行（RxJS 管 HTTP 编排、signals 管模板态）是最活的标本；
- **signal 向 stream 借『序列操作』**：提案生态的 utility——`toValues(signal)`（把 signal 变成异步迭代器）、`signal.from(iterable)`（把迭代器灌成 signal）、TC39 讨论里的 `watch`（观察不建细依赖，tc39-control 三控制阀之一）本质都是给寄存器接磁带接口；
- **闸门家族是两家握手的地方**：`computed` 的 memo、`distinctUntilChanged`、signal 的 `equals`、Zustand selector 比较、MobX 的 `comparer`——全是同一个抽象『值→变化闸门』（rx-operators 埋的锚在此收拢）：**只要两个系统之间传值，就要判『这一下算不算新』**，闸门函数是跨库通用语。

## 五、异步夹在中间：signal 的异步与流的异步

signals 派处理异步的『正规姿势』其实是**配对出现**：`signal(未加载态) + effect/资源层触发写入`（Solid 的 resource、Vue 的 useFetch 都长这样）——异步的『序列性』（竞态、重试、进度）仍然被让渡给专门的抽象。换句话说：**signal 生态解决异步的方式往往是『别硬扛，请出对应的流/资源原语』**，而 RxJS 的方式是『全都进管道』。这也解释了两家谁也没吃掉谁：2016 年大家都以为 RxJS 统一天下，2024 年 signals 成了框架响应式的最大公约数——**因为 UI 状态的本质是『当下值』，而网络事件流的本质是序列**。

## 六、一个混合实战形状

生产应用最常见不是二选一，而是：**RxJS（或 fetch+AbortController）做编排层 → 结果落到 signal/store → UI 订阅状态层**。管道里的世界（序列、作废、重试）出水管后立刻登记成寄存器世界（`responseSignal.set(data)`）——两个世界的边界就是那个 `subscribe(next => signal.set(next))` 的一行。把这行当海关记下来：**过海关时，事件变成状态**。

> 🚀 部署预告：本关实验=把 rx-inapp 的打字机 demo 用 Preact signals 重写一遍（或反向），数一数两边各删掉了多少样板、又各自多出了什么手写的东西——那本增减账就是你选型时的依据。
