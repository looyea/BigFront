# rx-operators 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖高频操作符与合流三兄弟。

### 1. (A) switchMap / mergeMap / concatMap 分别在『内层未完、外层又来』时做什么？

**来源**：转述自 rx-operators 合流三兄弟与 https://rxjs.dev/operator-decision-tree

switchMap：退订旧内层流、只跑最新（新值到来即作废旧的，请求都省了）；mergeMap：并发共存、结果交错摊平（可限并发数）；concatMap：排队串行、严格 FIFO（旧的不 complete 新值进缓冲）。一句话人格：switch=喜新厌旧、merge=来者不拒、concat=长幼有序。选型全看业务对『旧任务』的态度。

### 2. (A) 为什么 switchMap 能『连请求都取消』？它靠的是什么机制？

**来源**：https://rxjs.dev/api/index/function/switchMap

靠 teardown：内层 Observable 被 unsubscribe 时执行自己的退订逻辑——from(fetch) 的封装若接了 AbortController 就能真取消网络请求，interval 会清定时器。注意措辞：switchMap 取消的是『订阅』，底层资源是否真回收取决于内层流的 teardown 写得是否到位（fetch 默认不因退订而 abort，需配信号桥——这层细节答出来是加分项）。

### 3. (B) 打字机搜索偶发『结果和搜索词对不上』，排查清单给出三条 RxJS 侧根因。

**来源**：转述自 rx-operators switchMap 案例

① 用了 mergeMap 或 forEach+async 裸写——旧响应晚到覆盖新结果（竞态），换 switchMap；② 缺 distinctUntilChanged 导致同词重复请求，与乱序响应叠加成灾；③ switchMap 位置放错——放在 debounceTime 之前等于每个按键都发请求再互相杀，白烧配额。顺序模板：map → debounceTime → distinctUntilChanged → switchMap。

### 4. (B) 管道末端一个 catchError(() => of([])) 兜住一切，被同事批评，错在哪？

**来源**：转述自 rx-operators 错误纪律

影响面失控：fetch 失败、JSON 解析炸、map 回调里的编程 bug 全被转成『空数组』，界面表现为无法定位的『莫名空列表』，真实错误静默消失。正确姿势：catchError 紧贴预期的错误源（包 HTTP 段），转换段的 bug 让它冒到订阅层显式处理；兜底值也要带语义（of({error:true, items:[]})）。原则：只兜你预期并愿意为之设计 UI 的错误。

### 5. (A) debounceTime 和 throttleTime 的放行模型分别是什么？各给一个典型场景。

**来源**：转述自 rx-operators 时间与去重组

debounce：每个值到来重置计时器，静默期满放行最后一个——『等你说完』，适合搜索输入、表单校验。throttle：放行第一个后关闭窗口，窗口内全丢——『限流』，适合滚动/resize 埋点、按钮连击保护。口诀：要末值用 debounce、要首值+限额用 throttle；搜索用 throttle 会漏词、滚动用 debounce 会丢过程采样。

### 6. (A) scan 和『手写的闭包累计变量』比，优势在哪？

**来源**：转述自 rx-operators 单值转换组

scan 把『状态如何随事件演化』声明成纯函数并留在管道里：可测（给定序列断言输出）、可回放（重订阅即重置）、可组合（中间插 tap/buffer/retry 不影响累计语义）；闭包变量是命令式暗账，藏在回调里既测不到也 reset 不干净。React reducer 本质就是 scan 的另一具身体——这题也是 L6 对比题的伏笔。

### 7. (C) combineLatest 常被说成『流版 computed』，它和 signal computed 的语义差异在哪？

**来源**：转述自 rx-operators 多流组合与 L1 sig-paradigms

相同：多个输入的最新值组合出一个输出。差异：computed 是拉模型（无人读不重算、天然 glitch-free）；combineLatest 是推模型（任一源吐就广播给订阅者，无订阅者时值直接蒸发）、且多源同 tick 更新时可能连续吐带中间态的组合（默认不 glitch-free）。选型直觉：要『值的感觉』用 computed、要『事件的感觉』用 combineLatest。

### 8. (C) zip 与 combineLatest 的分岔点是什么？

**来源**：https://rxjs.dev/api/index/function/zip

combineLatest 比的是『当下』（用各源最新值随时重组，快的源会配着慢源的旧值多吐几次）；zip 比的是『第几个』（严格按序号配对，a 的第 3 个值必须等 b 的第 3 个值，双方各自排队缓冲）。场景对偶：股价×数量的实时总价=combineLatest；请求队列×响应队列的严格配对、表单两列导入=zip。面试爱问『哪个会无限缓冲』——zip 若某源永远缺号会攒积压，这是它的暗坑。

### 9. (B) 一个 retry(3) 没起作用，错误还是终结了整条流，给出两种可能。

**来源**：转述自 rx-operators 错误纪律与 rx-basics 冷热

① retry 位置在错误源下游的 catchError 之后——错误已被转成正常值，retry 等不到 error 信号；或者放在了错误发生点的上游（catchError 之上放 retry 不覆盖它下面的段）。② 错误不是来自流的 next 而是 subscribe 回调内部抛出——回调炸了不走流协议，retry 无感。排查习惯：确认『错误此刻正以 error 通道流动且流经 retry 所在段位』。

### 10. (D) 设计『无限滚动列表』的 RxJS 管道，说出零件与顺序理由。

**来源**：转述自 rx-operators 综合应用

```js
scroll$.pipe(
  filter(nearBottom),
  distinctUntilChanged(),
  throttleTime(300),              // 触发节流，别每像素都检查
  switchMap(() => from(fetchPage(nextCursor()))),
  // 或 concatMap()：若『每页都必须加载、不许跳页』
  tap((page) => appendToStore(page)),
  catchError(() => of(ERROR_PAGE)),
)
```
关键决策：切页场景用 switch（用户狂滚只要最新页）还是 concat（瀑布流每页都要）——取决于业务是『看最新』还是『攒全部』，这题的分量就在这个论证。加分：新数据进 store 后列表渲染交给框架绑定层，流只管取数编排。

### 11. (A) bufferTime / debounceTime / auditTime 都带时间窗口，放行策略怎么区分？

**来源**：https://rxjs.dev/guide/operators

bufferTime：窗口内所有值打包成数组一次吐（我全都要，攒批上报）；debounceTime：只吐静默期末的最后一个（等他说完）；auditTime：吐窗口内第一个、其余丢弃（限流采首值）。三句话背完：攒批用 buffer、等停用 debounce、掐头用 audit/throttle。字典类题，答错不丢分答对显功力。

### 12. (C) 现代 async/await 世界还需要 switchMap 吗？AbortController 是不是它的平替？

**来源**：转述自 rx-inapp 分工对照

命令式平替是存在的：每次请求配 AbortController + 组件卸载/新请求时 abort 旧的——能写、但『取消旧任务』的策略散落在手写控制流里（多请求竞态时 latest-token 样板会指数膨胀）。switchMap 的价值是把取消策略变成一行声明式语义，且与管道其他约束（debounce/distinct）同层组合。两者不是敌对：switchMap 的内层 fetch 照样该接 AbortController 才真正省带宽——语义层与执行层各管一段。

### 13. (D) 实时行情页：三个价格流 + 一个汇率流，任意源更新都要重绘四块面板，其中一块要额外做 30s K 线聚合。给操作符方案。

**来源**：转述自 rx-operators 多流组合综合

四基础面板：combineLatest 各接相关源（或独立流各自管道），配 map 算涨跌幅即可；30s K 线：对价格流 windowTime(30_000)/bufferTime(30_000) 聚合 OHLC，汇率流单独 mergeMap 重订阅（汇率变化不该重置 K 线窗口——注意别把它 combine 进聚合支路）。要点：一图多流时『每个面板一条消费管道』优于『一个大 combine 喂全场』，避免无关源互相惊醒（过度订阅的流版，呼应 tc39-control 粒度论）。

### 14. (B) 流每秒吐数据，UI 只需要每 100ms 最多刷一次，怎么接？两个操作符方案与取舍。

**来源**：转述自 rx-operators 与性能议题

sampleTime(100)：每 100ms 取最近值（无新值不吐），节拍均匀；throttleTime(100, {trailing:true})：窗口末保留最后一个。差异在空档行为：sampleTime 在静默期不吐（适合数据驱动 UI），throttle trailing 也只在有值时吐但窗口对齐源头而非计时器起点。再省一步：结合 auditTime 或 distinctUntilChanged 防止同值重绘；渲染层用 requestAnimationFrame 调度则是方案外的第三条路——面试给出操作符方案+承认 rAF 的存在即满分。

### 15. (C) 把『值→变化闸门』家族排个序：distinctUntilChanged、signal equals、React memo、Vue computed 缓存，谁是源头谁是末端？

**来源**：转述自 rx-operators 与 L6 对比预热

按传播链排：signal equals（写入源头，不过闸整图不惊动）→ RxJS distinctUntilChanged（管道中段，上游风暴照旧只滤这条管道）→ React memo（渲染门口，值已变、比较是否重渲）→ Vue computed 缓存（派生端，依赖未脏则给缓存）。共同哲学：变化不是事件而是『被判定为值得传播的差异』。这题是 L6 sig-vs-streams 的期末预告，答出分层即本章通关。
