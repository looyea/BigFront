# 事件：委托 vs 原生，以及"处理器不响应式"

> 目标：把 React 那套 `onClick` 心智升级成 Solid 的**双形态事件系统**——`onClick`（驼峰/`on__`，**委托**到 document）与 `on:click`（带冒号，**原生**加在元素上）不只是差一个冒号，它决定监听器落在 document 还是 element，进而影响大小写敏感性、`stopPropagation` 是否如你所愿、性能取舍；再钉死一条铁律：**事件处理器不属于响应式系统**，传 signal 进去不会随其更新，得自己包一层。掌握数组绑定省 `bind`、`currentTarget`/`target` 区别、`onInput` vs `onChange`、Portal 按组件树传播（呼应 solid-refs-styles、solid-components、svelte-events）

## 一、两种绑定方式：`on:` 原生 vs `on__` 委托

```jsx
<button onClick={handleClick}>点我</button>        // 委托：监听器加在 document，冒泡时分派给本元素
<div on:scroll={handleScroll}>很长的内容</div>      // 原生：监听器直接 addEventListener 在这个元素上
```

- **`on:eventName`（驼峰，或全小写 `onclick`）= 委托事件**：Solid 不为每个元素各挂监听，而是在 document 挂一个该类型监听、事件冒泡时派发给相关元素。
- **`on:eventName`（带冒号）= 原生事件**：`element.addEventListener`，你说了算，适合委托不支持的（自定义事件、非常用事件）。

## 二、大小写敏感性 —— 由"是否委托"决定

- **委托事件不区分大小写**：`onClick` 和 `onclick` 都行（Solid 内部按标准事件名归一）。
- **原生事件区分大小写**：`on:` 会**原样**把名字交给 `addEventListener`，所以自定义事件的大小写必须对上：
  ```jsx
  <button on:Custom-Event={handleClick}>…</button>   // 事件名就叫 "Custom-Event"
  ```

## 三、委托事件清单 + 何时改用原生

Solid 只为**高频常用事件**做委托，完整清单（源码 `DelegatedEvents`）：
`beforeinput、click、dblclick、contextmenu、focusin、focusout、input、keydown、keyup、mousedown、mousemove、mouseout、mouseover、mouseup、pointerdown、pointermove、pointerout、pointerover、pointerup、touchend、touchmove、touchstart`。

**不常发生的事件用原生更好**（如偶发的 `mousemove`）：委托的性能收益来自"处理大量同类事件"，冷门事件享受不到、反而白占一个常驻 document 监听：
```jsx
<div on:mousemove={handleMove} />     // 偶发 → 原生
```

## 四、委托的三大坑（务必记牢）

1. **每类型只挂一次、元素删了监听还在**：委托监听是针对"事件类型"加在 document 的，即使挂 `onMouseMove` 的那个 div 已被移除，document 上的 mousemove 分派仍活跃（怕别的元素还在听）。所以别指望"元素卸载=监听消失"来省资源。
2. **`event.stopPropagation()` 常常不如你所愿**：因为监听器在 document 而非中间元素上，你在子元素委托 `onClick` 里调 `stopPropagation()` **拦不住**已在 DOM 上另加的原生监听。官方例子——父 div 用原生 `addEventListener('click')`、子 button 用委托 `onClick`+`stopPropagation`，点 button 仍先触发父 div（输出 `div native` 再 `button`）；把 button 改成**原生 `on:click`** 才真正阻断（只输出 `button`）。**要精确控制冒泡停止，就在相关元素上用原生 `on:`。**
3. **Portal 按组件树而非 DOM 树传播**：`<Portal>` 把子树挂到 body，但委托事件仍沿 **JSX/组件树**冒泡——所以外层 `onInput` 能收到 Portal 里 input 的事件，比直觉更好用。

## 五、`onInput` vs `onChange`（跟原生行为走）

Solid 不加自己的语义，尊重 DOM 原生：
- `onInput`：值**一变即触发**；
- `onChange`（在 `<input>` 上）：仅**失焦后**才触发。

做受控输入框记住这条差别（和 React 里 `onChange≈每次输入` 的习惯**不同**，是迁移高频坑）。

## 六、处理器不是响应式的 —— 第二号铁律

事件处理器**不属于响应式系统**。你把一个 signal 直接当 handler 传，它**不会随 signal 变化而更新**（因为增删监听器开销大，Solid 不把它做成响应式绑定）：

```jsx
<div onClick={props.onClick} />                 // 若 props.onClick 这个"引用"会变，这里不跟
<div onClick={() => props.onClick?.()} />      // ✅ 包一层箭头函数：每次触发时才现读最新 props.onClick
```

同理，绑定的数组参数 `[handler, data]` 里的 `data` 若需响应，也得走函数现读。**口诀：需要"用到最新值"就在回调里现读，别指望处理器本身会重绑。**

## 七、省开销的数组绑定 + currentTarget/target

```jsx
const handler = (data, event) => console.log(data, event);
<button onClick={[handler, "Hello!"]}>…</button>   // "Hello!" 作为第一个参数，event 为第二
```
这替代了 `handler.bind(null,"Hello!")`，Solid 借此**避免每次渲染造闭包/bind**。

`currentTarget` vs `target`（委托下尤其要分清）：
- **`currentTarget`**：处理器**所挂的元素**（类型稳定，TS 里 `JSX.EventHandler<T, E>` 的 `currentTarget` 恒为 `T`）；
- **`target`**：**真正触发**事件的最深层元素（类型更泛）。`input`/`focus` 这类直接绑定输入框的事件，`target` 才被特化为 `HTMLInputElement`。
- 委托场景**别把 `event.currentTarget` 存起来异步用**（分派结束会置 null），要用就在处理器同步里取。

## 八、自检清单

1. `onClick` 和 `on:click` 分别把监听器加在哪？这一差别如何解释"为什么委托大小写不敏感、原生大小写敏感"？
2. 为什么"偶发的 mousemove"该用原生 `on:mousemove` 而不是委托？委托的收益在什么场景才成立？
3. 举一个 `stopPropagation()` 在委托下失效、改原生 `on:click` 才生效的场景，说清监听器落点导致的差异。
4. "事件处理器不是响应式的"这条铁律：为什么传 signal 当 handler 不更新？要让点击用到最新值该怎么写？
5. `<input>` 上 `onInput` 与 `onChange` 触发时机分别是什么？这与 React 的习惯差在哪？委托事件里为什么不能异步引用 `event.currentTarget`？

🚀 下一关：solid-typescript——`jsx:"preserve"`+`jsxImportSource:"solid-js"` 为何必须、`Component<P>`/泛型组件/`JSX.EventHandler` 怎么标、以及 Solid 的 accessor 为什么不能用 `&&` 收窄、`on:` 原生事件为何默认报类型错。
