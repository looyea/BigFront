# Refs、指令与样式绑定

> 目标：讲清"组件不重渲时如何安全地拿到 DOM 并操作它"——refs 的**三种形态**（变量赋值 / 回调 / signal 作 ref）、赋值发生在**元素进 DOM 之前**这一关键时序、**转发 ref** 时子组件收到的永远是回调、`use:` 自定义指令的签名与能力；再把 Solid 的样式绑定讲透：`class`/`classList`/`style` 如何因为"属性绑定=一个响应式 effect"而天然细粒度更新，以及 Solid **不内置 CSS 方案**这一事实（呼应 solid-lifecycle 的 onMount/onCleanup、solid-components、solid-events）

## 一、为什么别用 querySelector 拿 DOM

官方直接不推荐 `document.querySelector`/`getElementById`：Solid 里元素会**随状态增删**，同一个选择器可能匹配到"你现在不想要的那个"，且你得等它挂载完。正确工具是 **ref**——它在 JSX 模板里直接引用那个元素，保持结构完整，不受"重复选择器"污染。

> 也正因为元素可能"先不存在"，任何"挂载后才能做"的 DOM 操作都要放进 `onMount`（solid-lifecycle），或用 ref + signal 形态处理"以后才出现的元素"。

## 二、ref 的三种形态

**① 变量赋值**（最常用）：
```jsx
let myElement;                       // TS 里写 let myElement!: HTMLDivElement（明确赋值断言）
return <p ref={myElement}>Hi</p>;
```
关键时序：赋值发生在**元素创建时、把它加入 DOM 之前**。所以想在"入 DOM 前"就用它（比如加属性/监听），要用回调形态。

**② 回调形式**（要入 DOM 前访问，或元素可能反复增删）：
```jsx
<p ref={(el) => { myElement = el; /* el 已创建但尚未加入 DOM */ }}>Hi</p>
```

**③ signal 作 ref**（元素首次渲染时可能不存在、或被 `<Show>` 卸载再挂）：
```jsx
const [element, setElement] = createSignal();
<Show when={show()}>
  <p ref={setElement}>条件里的元素</p>   // 挂载时 setElement(el)，卸载时 setElement(undefined)
</Show>
```
把 setter 直接当 ref，元素生命周期就映射进这个 signal——这是"引用一个会消失的节点"的标准解法。

## 三、转发 ref：子组件拿到的永远是回调

想让父组件操作子组件内部的某个 DOM，把 ref 当 prop 传下去：
```jsx
// 父
let canvasRef;
<Canvas ref={canvasRef} />
// 子
function Canvas(props) {
  return <canvas ref={props.ref} />;    // 直接把自己元素的 ref 指向父给的（回调）
}
```
官方要点：**无论父传的是"简单变量赋值"还是"回调"，子组件收到的 `props.ref` 都以回调函数形式呈现**。所以转发时把它直接挂到要暴露的元素上即可，不必判断类型。

## 四、指令 use:：可复用、能吃响应式的 DOM 行为

`use:` 前缀是自定义指令，给元素附加可复用行为。签名固定为 `(element, accessor)`：
```ts
function highlight(element: Element, accessor: () => any) {
  createEffect(() => { element.style.background = accessor() ? 'yellow' : ''; });
}
// <div use:highlight={active()} />
```
它和"回调 ref"像，但多两个能力：① **一个元素可挂多个指令**；② **第二参是 accessor，能接收响应式数据**。指令在渲染时、元素入 DOM 前调用——因此能安全地建 signal、起 effect、加事件监听（用 `onCleanup` 回收，solid-lifecycle 讲过）。`use:model`（双向绑定）就是社区常见指令。

## 五、样式：Solid 不内置 CSS 方案，但绑定天然响应式

先破一个 React 带来的惯性：**Solid 没有自带的 CSS-in-JS/作用域样式系统**，它对这个话题保持中立——你照样用普通 CSS、CSS Modules、UnoCSS/vanilla-extract 等。而"动态样式"在 Solid 里根本不需要重渲，因为**任何读了 signal 的 JSX 属性都会编译成一个只更新该属性的响应式 effect**：

```jsx
const [active, setActive] = createSignal(false);
const [w, setW] = createSignal(100);

<div
  class={active() ? "btn on" : "btn"}     // 条件类名：active 变→只改 class 这个属性
  classList={{ on: active(), disabled: locked() }}  // 多布尔开关，推荐用它切类
  style={{ width: w() + "px" }}           // style 对象：Solid 逐项设置样式属性
/>
```

- **`class`/`className` 都支持**，Solid 社区惯用 `class`；
- **`classList={{ key: bool }}`** 是"按布尔批量开关类"的推荐写法，每个值都是响应式的；
- **`style={{...}}`** 传对象时 Solid 逐个属性应用，读到的 signal 变了只动对应样式，不碰其他 DOM；
- 想稳定加/删单个 class 用 `classList` 而非字符串拼接，能避免"手写空格/覆盖"的坑。

> 为什么"改一下 active 就刷 class"不需要组件重跑？因为这行 `class={active()?...:...}` 被编译成一个 `createRenderEffect` 绑定（solid-control-flow 里 `untrack+memo` 的同族机制）——它订阅 `active`，变化时 `el.setAttribute('class', ...)`，仅此而已。

## 六、够用就好的 DOM 工具

- `<Dynamic component={...}>`：把标签名/组件当数据渲染（做通用 `<Box as="section">`）。
- `<Portal mount={document.body}>`：把子树挂到别处，事件仍按**组件树**传播（solid-events 详述）。
- 拿 ref 后需要"挂载后初始化 + 卸载清理"，一律配 `onMount`/`onCleanup`，别在组件顶层直接摸 DOM。

## 七、自检清单

1. 官方为什么不推荐用 `querySelector` 访问 Solid 里的元素？ref 解决了什么？
2. ref 的赋值发生在"元素创建时、入 DOM 前"——据此说明：想在入 DOM 前配置它该用哪种形态？元素可能随 `<Show>` 反复增删又该用哪种？
3. 转发 ref 时子组件收到的 `props.ref` 是什么形态（无论父怎么传）？为什么这让你不必判断类型？
4. `use:` 指令相比回调 ref 多哪两个能力？它的 `(element, accessor)` 第二参为什么是 accessor 而不是值？
5. Solid 自带 CSS-in-JS 吗？`class={active()?'on':''}` 为什么能"不重渲就更新 class"？`classList` 与 `style` 对象各自适合什么动态样式？

🚀 下一关：solid-events——`onClick`（委托）与 `on:click`（原生）不只是一个冒号：它们决定监听器加在 document 还是元素上，进而影响 stopPropagation、大小写、性能与"事件处理器根本不响应式"这条铁律。
