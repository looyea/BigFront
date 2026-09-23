# L6 课后作业：响应式原理、生命周期与性能

> 本阶段关键词：信号图 / push-pull / 微任务 flush / effect 清理 / $state.raw / keyed 虚拟滚动。
> 判分口径：Bug 找错每题 1 分；手写题按"能跑 + 无冗余 effect"给分；场景评审看论证质量；简答看"原理→行为"因果链。

---

## 一、Bug 找错（10 小题，说出症状 + 根因 + 修法）

1. `let user = $state({ info: { name: 'A' } });` 之后 `const { info } = user; info.name = 'B';` —— 界面不更新。为什么？
2. `$effect(() => { list = list.filter(t => !t.done); });` 页面直接卡死。指出两条独立错误。
3. `let double = $derived(count * 2); $effect(() => { double = 0; });` 控制台红字报错。什么规则？
4. 组件销毁后 WebSocket 消息到达仍触发 `setRows()`，内存泄漏告警。订阅写在 `onMount` 里，问题在哪、搬去哪？
5. `count++; el.style.height = el.scrollHeight + 'px';` 高度永远慢一拍。给出两种官方解法并说明取舍。
6. `{#each sorted as item (items.indexOf(item))}` 打乱顺序后动画乱飞、输入串行。key 错在哪？
7. 把 ECharts 实例存进 `let chart = $state(null)`，图表越用越卡还有 Proxy 循环警告。改什么？
8. `$effect(() => { if (props.open) sendLog(props.config); });` 父组件每次渲染都重发日志，尽管 config 从未变。包什么？
9. 大字典 `let dict = $state(await fetchBig())` 首屏 JS 耗时暴涨；有人改成 `let dict = $state.raw(await fetchBig())` 后，`dict[key] = newVal` 彻底不更新了。两问：深 `$state` 初始化贵在哪？raw 版为何不响应、正确的更新姿势是什么？
10. SSR 页面水合瞬间 `Welcome, user-7781`（服务端渲的是 `guest`）。同步体里哪类调用是元凶？给两种规避手法。

## 二、手写题（5 题）

1. **微型的"依赖图可见化"**：写 20 行内组件，用 `$inspect` + `$inspect.trace()` 观察"改一个 `obj.a.a1` 时哪些表达式重跑"，把打印面抄进注释，并用 push-pull 术语解释为什么 `{obj.b}` 没动。
2. **自动增高 textarea**：`bind:value` + `$effect`/`tick` 实现内容变化即 `height=auto→scrollHeight`，禁用 watch 镜像反模式；输入中文（IME 合成期）不抖。
3. **可重连的倒计时**：`seconds` prop 变化自动重启；暂停/恢复按钮；销毁与重跑都不漏 `clearInterval`；SSR 导入不炸。
4. **5k 行日志查看器**：raw `$state.raw(rows)` 整体替换刷新 + keyed each + `content-visibility` 行样式；再加一个"仅显示 error"开关，验证切换过滤不重建未变行（用 DOM 节点断言或 devtools 观察）。
5. **迷你 throttle action**：`use:throttle-click={fn}`，60ms 合帧、参数变化走 `update`、destroy 移除监听——三条生命周期纪律全用上。

## 三、场景评审（1 题）

某 dashboard 团队代码评审节选：

> ① 给每个卡片套 React 风格 `createMemo` 式包装（手写 `$effect` 把派生值镜像进 `$state`），理由"防止级联重渲染"；② 全局 3MB 地理数据放 `writable` store 并 `$state` 再包一层求"双保险"；③ 地图打点列表无 key，"反正整块都会重画"；④ resize 监听写在 4 个组件各自 onMount，handler 里互相 setTimeout(200) 去抖。

逐项裁决：哪些是"治不存在的病"、哪些是真问题被掩盖、④ 的正确收敛方式是什么（结合 action/derived/一处理多消费）？写 200 字评审意见。

## 四、简答题（3 题）

1. 用"版本号+脏传播+惰性拉取"三个词，完整叙述 `count++` 到文本节点更新的时序（含微任务边界），并说明同帧两次 `++` 为何只刷一次。
2. `$effect`、action、onMount 的"挂载后"职责如何三分？各给一个只能用它的例子。
3. 为什么 Svelte 5 里"回调 prop 引用不稳定"不再引发子组件性能问题，却仍可能引发 effect 问题？两条链路的机制分别是什么？

## 五、挑战题 🏆

实现 `<VirtualList items rowHeight={28} let:item>`（snippet 渲染行模板），要求：只渲视口±5 行；滚动 60fps（自测 Performance 无 long task 尖峰）；`items` 整体替换时保留 scrollTop 策略可控；内置键盘可达（PageUp/Down/Home/End）；附一段 README 说明"为什么不用 1 万个 DOM + content-visibility 就够了"（提示：内存与初始布局成本）。

---

交卷后对照 `quizzes/svelte-*.json` 批改三道小测，各对 ≥5 题视为本阶段过关。

🚀 **下一站 L7**：TypeScript 姿势、组件测试与工程工具链——把"能写"升级成"能进仓库、能进 CI"。
