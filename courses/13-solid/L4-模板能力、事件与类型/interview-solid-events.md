# solid-events 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) Solid 的 `onClick` 和 `on:click` 有什么本质区别？
**来源**：委托 vs 原生题的转述。

`onClick`（`on__`）是**委托**：Solid 在 document 挂一个该类型监听，事件冒泡时派发给对应元素，全页同类型只一个监听器。`on:click` 是**原生**：直接对该元素 `addEventListener`。区别延伸到大小写敏感性（委托归一、原生原样）、`stopPropagation` 行为、以及"监听器落点"带来的一切差异。

### 2. (A) 事件委托对性能有什么好处？在什么场景才划算？
**来源**：委托收益题的转述。

把"每个元素各挂一个监听"降为"document 上一个监听 + 分派"，元素越多省得越多——大列表/表格（成千上万行都监听 click/input）收益巨大。对**偶发**事件（偶尔一次 mousemove）反而不划算：白占一个常驻 document 监听，此时用原生 `on:mousemove` 更好。

### 3. (B) 子元素委托 `onClick` 里 `event.stopPropagation()` 拦不住父元素的原生监听，为什么？怎么修？
**来源**：stopPropagation 失效题的转述。

委托监听器挂在 document、不在中间元素上，`stopPropagation()` 只阻断 DOM 冒泡链上更外的原生监听，管不到"父元素自己 addEventListener 的原生监听"。官方例子：父 div 原生 click + 子 button 委托 onClick+stopPropagation → 仍先打 "div native" 再 "button"。修：把 button 改成**原生 `on:click`**，此时它真在元素上、stopPropagation 生效，只输出 "button"。

### 4. (A) "事件处理器不是响应式的"是什么意思？想让点击用到最新值怎么写？
**来源**：handler 非响应式题的转述。

把 signal 或会变的引用直接当 handler（`onClick={props.onClick}`）——Solid **不会**因它变化去重绑监听（增删监听开销大）。要"每次点击都拿最新的 `props.onClick`"，包一层现读：`onClick={() => props.onClick?.()}`。同理，用到最新 state 也在回调里现读，而非指望 handler 换绑。

### 5. (B) 委托下为什么不能在异步里引用 `event.currentTarget`？
**来源**：currentTarget 生命周期题的转述。

委托事件里 `currentTarget` 在分派给该元素期间有效，**分派结束被置 null**。你在 `setTimeout`/`await` 之后读 `event.currentTarget` 会拿到 null。要么同步里取出所需引用（`const el = event.currentTarget;` 再用），要么改用 `event.target`（但那是最深层触发元素），要么对该元素用原生 `on:`。

### 6. (C) `<input>` 上 `onInput` 和 `onChange` 分别在何时触发？与 React 习惯差在哪？
**来源**：input/change 语义题的转述。

Solid 尊重 DOM 原生：`onInput` 值一变即触发；`onChange` 在 `<input>` 里**失焦后**才触发。React 的 `onChange` 实为原生 input（每次输入都触发），所以从 React 迁移的人常把 `onChange` 当"每次输入"用、在 Solid 里就"要失焦才更新"。受控输入默认想每次输入响应就用 `onInput`。

### 7. (A) 说说 `onClick={[handler, "data"]}` 这种数组绑定，它解决什么？
**来源**：绑定优化题的转述。

Solid 允许把 handler 写成 `[函数, 附加参数]`：触发时以该参数作 handler 第一参、event 作第二参（`handler(data, event)`）。它替代 `handler.bind(null,data)`，让 Solid 避免为传参而每次渲染新建闭包/bind，尤其配合委托时保持 handler 引用稳定、少造垃圾。

### 8. (C) Solid 的委托和 React 的合成事件系统像吗？有什么关键不同？
**来源**：跨框架事件模型对比题的转述。

形似神不同。都在顶层（document/root）挂监听做委托、都让事件"看似"绑在元素上。不同：① React 造了一整套 SyntheticEvent 包装与 `e.persist`/`currentTarget` 归一历史；Solid 更薄，多数就用原生事件对象、只是分派点不同。② React `onChange`≈原生 input，Solid `onChange`=原生 change(失焦)。③ Solid 明确区分委托(`on__`)与原生(`on:`)两套，React 只有 `on*`（个别 `onCapture`、`on:双事件` 走非委托）。

### 9. (D) 一个 5000 行的表格，每行有"编辑/删除"按钮。怎么组织事件既省监听又能定位到行？
**来源**：大列表事件设计题的转述。

靠委托天然适配：在容器上（或每行按钮的 `onClick` 走委托，本质都是 document 一个 click 监听）统一接收，用 `event.target.closest('[data-id]')`/从 `<For>` 的 item 直接闭包拿 id 定位行。优先让每个按钮 `onClick={(e)=>del(row.id)}`——委托下这仍共享一个 document 监听，不是 5000 个。避免每行手动 `addEventListener`。

### 10. (B) `<Portal>` 里的 input 触发的 onInput，能被外层 `<div onInput>` 收到吗？为什么这反直觉却有用？
**来源**：Portal 事件传播题的转述。

能。委托事件按**组件/JSX 树**冒泡，不按真实 DOM 树——即便 Portal 把 input 挂到 body，只要它在 JSX 里是那层 div 的后代，`onInput` 就能收到。这让"模态/下拉挂到 body 但仍想被父级统一处理事件"变得自然，无需手动转发。

### 11. (A) 哪些事件 Solid 会委托？给一两条判断"该用 on: 原生"的准绳。
**来源**：委托清单与选型题的转述。

委托清单（DelegatedEvents）含：beforeinput/click/dblclick/contextmenu/focusin/focusout/input/keydown/keyup/mousedown/mousemove/mouseout/mouseover/mouseup/pointer(down/move/out/over/up)/touch(start/move/end)。准绳：**自定义事件、不在清单里的事件、或需要精确 stopPropagation/只在特定元素生命周期内存在的偶发事件** → 用原生 `on:`。

### 12. (D) 场景：拖拽中要 `stopPropagation` 且拖拽事件频繁，滚动事件又想委托——怎么在同一个组件里混用两种事件？
**来源**：委托/原生混用设计题的转述。

可以按事件分别选形态：需要精确阻断冒泡/自定的用原生 `on:pointermove`（元素级监听、stopPropagation 生效），而点击类高频共享的用委托 `onClick`。注意原生监听随元素卸载自动移除、委托监听常驻；对频繁 pointer 事件若想用捕获阶段可 `on:pointermoveCapture` 或在 onMount 里手动 `addEventListener(...,{capture:true})` + `onCleanup`。按"是否需要元素级精确控制"逐事件决定，而非全局二选一。

🚀 实操请去做 L4 作业：复现 stopPropagation 失效、handler 非响应式、currentTarget 异步 null、onInput/onChange 差异四条线。
