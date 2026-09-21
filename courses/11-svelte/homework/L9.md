# L9 课后作业：特殊元素、错误边界与 Effect 深水区

> 本阶段关键词：svelte:window/document/body / 点号动态组件 / boundary failed·pending·onerror / transformError / $effect.pre·root·tracking·pending / untrack / $state.snapshot / tick·flushSync / $memo 四替代。
> 判分口径：Bug 题必须点出"错误属于哪个域（渲染事务/命令流/事件流/生命周期）"才给分；时序题画图或列表标明 flush 段位。

---

## 一、Bug 找错（10 小题，指出根因并修）

1. runes 工程里从旧仓库抄来的 `<svelte:window on:keydown={fn}/>` 编译直接失败。报错本质与两种走向。
2. 弹层用 `<svelte:body onclick={close}>` 关得掉，但点弹层内部也会关。补哪一行？还有哪种不依赖 stopPropagation 的写法？
3. `{#each fields as f}<svelte:element this={f.component} />` 页面空白。字段里存的是组件引用，错配在哪，正确写法是什么？
4. 有人在 `{#each}` 里写 `<item.widget />`，Svelte 4 环境渲染出一个名叫 `item.widget` 的未知标签。两代语义各是什么？
5. boundary 包住了取数逻辑，接口 500 时 failed 却没出现，控制台是 unhandled rejection。解释为什么，错误该由谁接。
6. `<svelte:boundary>` 里 `{#snippet pending()}` 只在首屏出现过，用户切筛选后又转圈需求落空。pending 不重播的原因与正确工具。
7. 列表更新后读取 `listEl.scrollTop` 总是"错一拍"的值，有人用 `setTimeout(..., 0)` 绕。指出两拍时序病根与两个正规解（一个用 .pre、一个用 tick）。
8. 组件卸载五秒后，$effect.root 里的定时器 effect 抛 `Cannot read properties of null`。root 的哪条契约被违反了？
9. 同事在 $effect 里写 `count += delta(count)`，页面卡死后控制台报 `effect_update_depth_exceeded`。画出读写环并给两种重构方向。
10. 把含 Set 与方法的草稿对象 `$state.snapshot` 后存库再恢复，功能时灵时不灵。snapshot 的边界是什么？"可序列化状态设计"怎么救。

## 二、手写题（5 题）

1. **全局快捷键单入口**：`<svelte:window onkeydown>` + context 注册表（handler+优先级），实现 `?` 弹帮助、`Esc` 栈顶优先关闭；卸载自动 unregister（返回解绑闭包）。
2. **卡片级容错**：给三个独立取数卡片各包 `<svelte:boundary>`：failed 里展示错误编号+重试按钮；onerror 统一 report(带卡片 id)；重试包一层 `invalidate(key); reset()`。
3. **useAutoSave**：按面试第 8 题骨架实现（清理函数式 debounce + snapshot 出网 + 卸载取消在途请求 AbortController），并补 3 条 fake-timers 测试。
4. **滚动锚点保持器**：`$effect.pre` 存 scrollTop + 更新后 `$effect`（或 tick）恢复；在"数据替换"与"仅追加"两种变化下都验证不跳飞。
5. **动态图标系统**：`{#each}` 渲染 `<icon.set[name] {...props} />`（点号语法），name 来自后端配置；用 `svelte:element` 造一个标签名也可配的 `<Tag>` 包装器，说清两者分工边界。

## 三、场景评审（1 题）

某表单页 PRD：三 tab 切换、崩溃隔离、自动保存。技术方案节选，逐条"采纳/拒绝/讨论"并说理（≤250 字）：

> A："tab 切换用 {#if}，卸载干净省内存——状态丢了用户反正要重填。"
> B："整页套一个顶层 boundary 就够了，崩了全页重试，公平。"
> C："自动保存放 $effect 里监听整个 draft，每次键入立刻 POST，最稳。"
> D："错误信息原文直接渲染进 failed，用户能自助报障。"
> E："全局事件（Esc/粘贴）统一挂 <svelte:window>，组件内不许散落 addEventListener。"

## 四、简答题（3 题）

1. 默写 flush 时间轴四段，标出 $effect.pre / $effect / await tick / flushSync 各自岗位与一条禁地。
2. untrack、$state.snapshot、状态提升分别切掉反应式的哪个维度（依赖登记/对象身份/所有者）？各配一个场景。
3. boundary 能接什么、不能接什么？对照 React/Vue 各一句话。

## 五、挑战题 🏆

**给 L6 挑战题 VirtualList 做"生产化改造"**：①滚动状态用 `bind:scrollY` 或容器方案重写并解释粒度选择；②数据热替换时保持视口锚点（.pre 抢救 + 恢复，写回归测试）；③组件内部异常用 boundary 隔离到"行级"而不是整列表塌；④渲染完成信号用 tick 暴露给调用方；⑤README 附一页"本组件 effect 全家桶使用表"（哪个原语、站哪一拍、为什么不用别的）。跑 `sv check` 零报错 + 测试全绿交卷。

---

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L10（收官阶段）**：`svelte-web-components`——编译器多目标的第三次兑现：`customElement` 把组件编译成框架无关的自定义元素，Shadow DOM、事件与 props 的跨界三套规则。
