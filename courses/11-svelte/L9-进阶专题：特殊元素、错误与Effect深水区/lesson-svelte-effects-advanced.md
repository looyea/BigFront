# Effect 深水区：pre/root/tracking 与 $memo

> 目标：把 L1/L6 打过地基的 `$effect` 全家福补齐——`$effect.pre/.root/.tracking/.pending` 四个变体、`untrack` 与 `$state.snapshot` 两个"离开反应式网"的出口、`tick/flushSync` 的 DOM 时序控制，以及命运多舛的 `$memo` 与"状态保留"的工程替代（深化 svelte-reactive-runes、svelte-reactivity-internals，收束 svelte-error-boundary 预告的 $effect.pending）。

---

## 一、先立时间轴：一次状态变更的完整帧

```
state 写入 → 标记脏 →（微任务边界）flush：
  ① $effect.pre 运行          ← DOM 还是旧值
  ② DOM 更新（effect 驱动的定向修补）
  ③ $effect 运行              ← DOM 已是新值
  ④ await tick() 的续体 resolve
```

背下这条轴，四个变体各站哪个岗就不用说死记：`.pre` 站在 DOM 变更**前**，普通 `.effect` 站在**后**，`tick()` 是"③④ 之间插队等待"的官方出口，`flushSync()` 是"别等微任务，现在就走完 ①→②"的同步闸门。

## 二、`$effect.pre`：在 DOM 被更新碾过之前读它

场景：列表内容即将变化，你要**先**记录当前滚动锚点（更新后位置就变了）；或把用户正在编辑的 DOM 临时态（未同步进 state 的 textarea 拖拽高度）抢救回 state。

```svelte
<script>
  let items = $state([]);
  let listEl = $state(null);
  let anchor = $state(0);

  $effect.pre(() => {
    items.length;                       // 显式声明：内容变化前抢救锚点
    anchor = listEl?.scrollTop ?? 0;
  });
</script>

<ul bind:this={listEl}>{#each items as it (it.id)}<li>{it.text}</li>{/each}</ul>
```

普通 `$effect` 在这就晚了一步（DOM 已按新数据重排）。使用戒律：`.pre` 里**只读 DOM/抢救状态**，别做视觉计算——此刻你看到的画面和用户即将看到的不是同一帧。

## 三、`.root` / `.tracking` / `.pending`：作用域三探针

- **`$effect.root(fn)`**：创建**不自动清理、不参与依赖追踪**的作用域，返回清理函数。给"生命周期比组件长"的东西用（命令式挂出去的子应用、第三方实例池）——里面的 `$effect` 由你手动管（呼应 svelte-lifecycle 的"逃逸对象"清单）。经典用法：class/组合函数里封装响应式状态，root 建图、dispose 拆图。
- **`$effect.tracking()`**：此刻是否在追踪作用域内。自写 rune/工具函数时用来分叉行为：在追踪内返回响应式表达式、在追踪外直接返回值的"两副面孔"函数就靠它（呼应 04-vue 课里 VueUse `toValue` 的归一化思想，这是它的官方原语版）。
- **`$effect.pending()`**：返回"当前作用域是否有未完成 await"的布尔——boundary 的 pending snippet 只管首次，**后续**异步转圈用它（上一关预告的缺口在此补上）。

## 四、离开反应式网的两个出口：`untrack` 与 `$state.snapshot`

**`untrack(() => ...)`**：执行回调但**不登记依赖**——"我现在要读你，但这不构成'你变我动'"。典型：effect 里用某个 config 的当前值但故意不想随它重跑（日志、埋点上报）。滥用预警：untrack 读 state 会让 effect 的行为变成"时机依赖"——review 时见到就该问"为什么不响应"。

**`$state.snapshot(x)`**：把 `$state` 深层对象拍成**普通静态快照**（结构化克隆，函数/类实例会被处理掉）。三处刚需：
1. 喂给**不可感知的第三方**：`postMessage`、IndexedDB、canvas 数据——Proxy 对象直接扔会报错或行为诡异（呼应 04-vue toRaw 同款）；
2. **diff 起点**：手写脏检查时保存"上次的自己"；
3. **测试断言**：对快照 `toEqual` 普通对象字面量（svelte-testing 的实战坑位）。

## 五、DOM 时序双闸：`tick()` 与 `flushSync()`

```ts
import { tick, flushSync } from 'svelte';

await tick();                 // 等本轮 DOM 全部更新完，再测量/聚焦
flushSync(() => { count++; }); // 同步跑完更新，回调返回时 DOM 已是新值
```

`flushSync` 的三个硬规矩：**只能在事件处理器等"帧外"时机调**（effect 内/渲染中调会直接报错）；会**打断批处理**（能用是能力，常用是病——把一次变更拆成 N 次同步 flush 等于自废微任务合并的收益）；主战场是"改完立刻要 DOM 几何"的第三方库喂参（呼应 svelte-actions 里库实例更新的时机问题）。测试环境里它就是 L7 那题"fake timers 后要 flush 微任务"的正解之一。

## 六、`$memo`：命途多舛的"状态保留"之问

问题本体很实在：`{#if tab === 'a'}` 切走再切回，组件销毁重建、`$state` 归零——表单填一半全丢。预发布期 Svelte 曾把 `$memo` 列为"跨挂载保留状态"的官方 rune，5.0 正式版前被撤下（语义与脏检查方案未定型），此后以**实验特性**身份在 5.x 小版本反复进出——**任何 $memo 的具体语法，落码前必查当期官方文档**，本讲只钉"问题与替代方案"这笔确定性资产：

| 策略 | 做法 | 适用 |
|---|---|---|
| 不销毁 | 保持挂载，CSS 隐藏切 tab（`hidden`/`display:none`） | tab 少、成本可接受（默认首选） |
| 状态提升 | 表单值放进 tab 外的 `$state`/context/单例 | 需要跨 tab 共享或持久化 |
| 存根重放 | 卸载前把状态写进 Map（key=实例 id），挂载时初始化 | 列表项级"回来还是刚才那张脸" |
| 持久化 | sessionStorage/IndexedDB + snapshot | 跨刷新级别 |

对照谱系：Vue 用 `<keep-alive>`（组件缓存语义）、React 没有官方答案（社区靠状态提升/卸载前存档模式）——"卸载即失忆"三家同款，是组件模型的公理而非 bug。

## 七、作用域边界：effect 到底"属于"谁

规则一句话：**`$effect` 注册在"执行它的组件/作用域"的生命周期上**，跟它读到的 state 归属无关。跨组件读写（effect 里写父级 state/兄弟单例）合法但要小心成环：A 写 B、B 读后写 A → 运行时对"effect 改自己依赖"有检测上限（`effect_update_depth_exceeded`），触发即图设计错误，回到 `$derived`/事件流重构，别拿 flushSync 硬压（呼应 L6 内核课的死信使话题）。

## 八、自检清单

- [ ] 默写一次变更的四段时间轴，标出 .pre/.effect/tick/flushSync 各站哪格。
- [ ] 说出 .root 的"手动生命周期"用途与 .tracking 的分叉写法。
- [ ] 给 $state.snapshot 列三个刚需场景（proxy 出网/diff 起点/测试）。
- [ ] 说出 flushSync 的一条禁地与一条滥用信号。
- [ ] 讲清 $memo 的问题本体 + 四种稳定替代 + "查当期文档"的纪律。

---

🚀 **下一站（L10 开篇）**：`svelte-web-components`——把编译器的多目标能力用出来：`customElement` 一键把组件变成框架无关的 `<my-widget>`，Shadow DOM、事件外发与 props 反射的三套规则。
