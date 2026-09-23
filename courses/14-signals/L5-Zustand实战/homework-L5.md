# L5 阶段作业：Zustand 实战

> 覆盖：za-core / za-middleware / za-patterns
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（就地改静默失败）
```js
const useStore = create((set) => ({
  count: 0,
  bump: () => useStore.setState((s) => { s.count += 1; }),  // 没有 immer 中间件
}));
```
点击按钮 UI 不动但 getState().count 在涨。指出『快照替换制』下发生了什么，给两个修法（一个改语法一个上中间件）。

**Bug 2**（selector 新对象）
```jsx
const pos = useAppStore((s) => ({ x: s.x, y: s.y }));
```
React 控制台报 'The result of getSnapshot should be cached to avoid an infinite loop'。指出比较机制为何永判『变了』，给三种修法与各自取舍。

**Bug 3**（stale closure）
```jsx
function Editor() {
  const draft = useStore((s) => s.draft);
  useEffect(() => {
    const t = setInterval(() => save(draft), 1000);   // 永远保存第一次的 draft
    return () => clearInterval(t);
  }, []);
}
```
指出闭包捕获与订阅更新为何脱节，用 store 的哪个 API 一行修复。

**Bug 4**（persist 丢行为）
localStorage 里的 store 快照含 `user: { name, greet() {...} }`，rehydrate 后 `store.user.greet` 是 undefined。指出 JSON 往返的边界规则，说明 greet 应该定义在哪、partialize 在此案的作用。

**Bug 5**（version 未 bump）
上线把 `settings.theme` 改名 `settings.mode` 后，老用户开页读 `s.mode` 崩溃。指出 persist 缺的还债机制，写出 migrate 骨架（version 从 0 到 1 逐级搬）。

**Bug 6**（immer 混用双回报）
```js
set((s) => {
  s.count += 1;
  return { count: s.count };
});   // zustand/middleware/immer 中间件下
```
抛错 '[Immer] Cannot use both styles'。指出 immer 回调的语义二选一规则，给两种各自正确的写法。

**Bug 7**（中间件洋葱顺序）
同学写 `immer(devtools(persist(fn)))`，发现 devtools 面板里出现函数无法序列化的警告、且时间旅行恢复的快照绕过了 immer 加工。按『改数据→存数据→看数据』重排三层并说明每一层为什么必须在当前位置。

**Bug 8**（transient 闪回）
进度条用 subscribe 直写 `bar.style.width`，一切正常——直到父组件因别的原因重渲，width 闪回 0%。指出『一个 DOM 属性两个主人』的冲突，给两种修复思路。

**Bug 9**（selector 里做派生）
```jsx
const doneCount = useStore((s) => s.tasks.filter((t) => t.done).length);
```
有同学说『返回的是 number 按值比较，所以这写法完全没问题』。判断这句话对在哪半句、这写法真正的病在哪半句，给收口方案。

**Bug 10**（SSR 单例串用）
Next.js 服务端 `create(...)` 的模块级 store 在并发请求下用户 A 看到了用户 B 的主题设置。指出模块单例在 SSR 下的负债本质，给 zustand 官方的多实例方案名（含 Context 注入思路）。

## 二、手写题（5 题）

**手写 1**：十行写 bears store（bears + addBear + reset），组件里分别只订 bears、只订 addBear。3 分钟内完成为标准。

**手写 2**：给 UI store 组装三层中间件 `devtools(persist(immer(...)))`，persist 要求：只存 { theme, sidebarCollapsed }、version 1、migrate 骨架、devtools 实例名 'UI'。

**手写 3**：用裸 API 实现『变更日志旁路』：不写中间件，`subscribe((s, p) => ...)` 里做浅 diff（列变化字段名），每秒输出到控制台，组件卸载可退订。

**手写 4**：把 800 行 store 的碎片 `playerSlice`（progress/playing/seek）按 slices 模式拆出：给出 slice 函数、组装点、以及一个直接 call slice 传假 set/get 的单测用例。

**手写 5**：拖拽坐标 transient 通道完整骨架：pointermove 里 rAF 合帧 set 坐标 store、subscribe(sel) 直写元素 transform、松手 commit 最终位置回主 store——标注哪几步零重渲。

## 三、场景题（1 题，20 分）

在线播放器前端（React + Zustand + React Query）：播放队列、进度条（250ms 更新）、音量、倍速、歌词滚动（高频）、用户收藏（服务端数据）、均衡器 EQ 偏好（持久化）。请给出：① 状态分层归属表（Zustand 几个 store 各管什么 / React Query 管什么 / 哪些留组件 useState，三问判据逐条应用）；② 高频通道设计（进度与歌词哪些走 transient、哪些必须走渲染，源头-终点降频形状怎么落）；③ persist 边界（哪些字段进 localStorage、version/migrate 策略、多标签页同步要不要、怎么防时间旅行污染）；④ 中间件清单与洋葱顺序及一句理由。

## 四、简答题（3 题）

**简答 1**：『selector 即订阅边界』——用它解释为什么 useShallow 能修多字段订阅、却救不了 filter 派生。

**简答 2**：Zustand 与 MobX 对『什么算一次更新』的判定分别是什么？同一行 `s.count++` 在两家各是什么结局？

**简答 3**：useSyncExternalStore 为外部 store 堵的『撕裂』漏洞具体指什么？为什么并发渲染时代才需要它？

## 五、挑战题 🏆（+10 分）

用 Zustand 实现『跨标签页同步的看板草稿箱』（约 150 行）：卡片可拖拽（transient 通道写坐标、松手 commit）、两标签页同时打开时布局最终一致（persist + storage 事件 rehydrate 或 BroadcastChannel，任选并防回环）、devtools 可观察每次 commit 级更新（拖拽中间帧不入面板记录——用打标签或拆分 store 实现）。交稿附：两标签页并排录屏或关键日志，证明无回声循环。（分项合计 ≤10 分：transient+commit 3 + 跨页一致与防回环 4 + devtools 降噪 3。）
