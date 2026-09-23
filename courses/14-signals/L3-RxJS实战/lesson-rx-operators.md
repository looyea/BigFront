# rx-operators：日常够用的操作符——一个课说完

> 目标：只讲高频，用一个打字机搜索例子把 map/filter/scan、debounceTime、distinctUntilChanged、switchMap/mergeMap/concatMap、combineLatest、catchError/retry、tap 一次说透（呼应 rx-basics、kit-streaming）

## 一、操作符是什么：管道的标准件

Observable 本身几乎不写逻辑——转换全在 `pipe(...)` 里串操作符。操作符就是纯函数工厂：`(源流) => 新流`，像数组的 map/filter 之于数组，操作符之于时间。今天的学习策略：**不背字典，只学 12 个高频标准件**，它们覆盖日常 90% 的场景。

## 二、单值转换组：map / filter / scan

```js
import { of, fromEvent } from 'rxjs';
import { map, filter, scan } from 'rxjs';

fromEvent(input, 'input').pipe(
  map((e) => e.target.value),           // 事件 → 数据
  filter((v) => v.length >= 2),         // 太短不处理
);

of(1, 2, 3).pipe(
  scan((acc, v) => acc + v, 0),         // 带记忆的累加：吐 1, 3, 6
);
```

`scan` 是 `reduce` 的流版：reduce 给终值，scan 把每一步的中间累计都吐出来。它是『事件流维护状态』的原生方案——计数器、缓冲区、撤销栈都是 scan 一句话的事（与 L1『Zustand 的 set 相当于手动 scan』的对照伏笔）。

## 三、时间与去重组：debounceTime / distinctUntilChanged

```js
import { fromEvent, map, debounceTime, distinctUntilChanged } from 'rxjs';

fromEvent(input, 'input').pipe(
  map((e) => e.target.value),
  debounceTime(300),            // 静默 300ms 才放行最后一个值
  distinctUntilChanged(),       // 与上一个放行值相同则丢弃
);
```

分工要说细：

- **debounceTime**：等手停下来。适合搜索框——用户连打只发最后一次；
- **throttleTime**：固定闸口，到点就放（第一下立刻过、窗口内的丢掉）。适合滚动/resize 埋点——要"及时但别太多"；
- **distinctUntilChanged**：值相同不重复发——默认按 `===` 比，对象要传自定义比较器（与 tc39-control 的 equality 同族！一个在 signal 写入闸门、一个在流管道中段）。

记忆锚：搜索用 debounce、节流用 throttle、省钱用 distinct——**三个操作符解决"事件太吵"的三种吵法**。

## 四、合流三兄弟：switchMap / mergeMap / concatMap（本课主菜）

三者共同形态：`外层每吐一个值 → 内层工厂返回一条新流 → 把内层的值摊平到出口`。区别只在对『内层还没跑完，外层又来了新值』的处理策略：

```text
外层:   --a--------b----c-->          (三个请求)
内层:     [A....]    [B..]  [C.]      (响应时长)

switchMap:  b 到达时掐掉 A → --a[开始但被杀]--b[B..]--c[C.]      只要最新
mergeMap :  全并发摊平     → --a[A....]-b[B..]c[C.]  交错乱序       我全都要
concatMap:  排队串行       → --a[A....]--b[B..]--c[C.]  严格 FIFO   按序处理
```

**打字机搜索一次讲透 switchMap**：

```js
searchInput$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap((q) => from(fetch(`/api/s?q=${q}`))),   // 每次发请求，保留最新
  catchError(() => of([])),
).subscribe(renderResults);
```

场景：用户打了 "re"（发了搜 "re" 的慢请求），又打完 "react"（发搜 "react" 的快请求）。**没有 switchMap**：慢的 "re" 响应后到，覆盖 "react" 的结果——经典竞态事故。**switchMap 的语义就是"新值到来，旧内层流直接 unsubscribe"**——不仅忽略旧结果，连旧请求本身也退订作废。这正是 RxJS 相对手写 `let latestToken` 防竞态方案的结构化优势：令牌比对是命令式的补丁，switchMap 是声明式的语义（呼应 rx-inapp 的 AbortController 对照）。

三兄弟选型表：

| 场景 | 选择 |
| --- | --- |
| 搜索/表单校验：只要最新一次 | switchMap |
| 日志上报/并行下载：多个一起跑 | mergeMap（可传并发上限） |
| 事务队列/消息发送：按序且一个不丢 | concatMap |
| 旧流跑完前新值一律忽略（如高频触发但只在意空闲期） | exhaustMap 等冷门，遇到再查字典 |

内层映射类操作符还有 `concatAll/mergeAll/switchAll`（map 完再摊平的裸形态），三兄弟就是它们带工厂函数的合体，见文档别慌。

## 五、多流组合：combineLatest（与 withLatestFrom）

```js
import { combineLatest } from 'rxjs';

const price$ = ..., qty$ = ...;
combineLatest([price$, qty$]).pipe(
  map(([p, q]) => p * q),
).subscribe(renderTotal);      // 任一源更新 → 用双方最新值重算
```

combineLatest 的脾气：① 每个源至少吐过一个值之前不吐（冷流场景考虑 `startWith(初值)`）；② 它是『多个当下值的最新组合』——这几乎是 signal computed 的流版替身（L6 sig-vs-streams 会正面比）。`withLatestFrom` 则相反：只以主源节奏吐、从源仅供"顺便看一眼"（浅观察的流版，与 tc39-control 的 watch 姿态暗合）。

## 六、错误与杂项：catchError / retry / tap / finalize

```js
pipe(
  tap((v) => console.log('路过看一眼', v)),   // 副作用调试器，不改流
  map(parse),
  catchError((err, caught) => {                // 转成兜底值或换一条流
    return err.status === 401 ? refreshThenRetry : of([]);
  }),
  retry({ count: 3, delay: 1000 }),            // 失败重订阅（指数退避现代写法）
  finalize(() => hideSpinner()),               // 无论终局/退订都跑（teardown 保险丝）
);
```

三条纪律：

1. **catchError 放的位置决定影响面**——包整个管道则后续一切错误都兜底；只包 fetch 则错误不污染下游（"管道末端一个 catch 兜住一切"是新手最常见的设计错误，因为它会吞掉 map 里的编程 bug）；
2. **error 终局后 retry 的本质是重新 subscribe**（冷流才有效——热流 retry 是幻觉，呼应 rx-basics 冷热）；
3. `tap` 是"我只看看"、`finalize` 是"无论如何的善后"——分别对应 signal 世界的 untrack 读取与 try/finally。

> 🚀 部署预告：本课全部操作符在 rxjs 官方文档 https://rxjs.dev/operator-decision-tree 有交互式决策树——收藏它，比收藏十篇速查表有用；体积上按需具名导入即可 tree-shake（RxJS 打包税详论见 sig-size）。
