# 编译产物与渲染机制：亲手拆开 Svelte 的"魔法"

> 目标：读一遍编译产物，把"编译器派"从口号变成眼见为实——模板如何变成创建 DOM 的 JS、没有 VDOM 的更新代码长什么样、运行时里到底还剩多少"框架"，以及同一个 `.svelte` 文件在 client/server/customElement 三种编译目标下的不同命运（呼应 svelte-tooling 末关预告、svelte-reactivity-internals、04-vue 编译器课、05-react 渲染模型课）。

---

## 一、把玩具打开看：一个组件的产物

去 [svelte.dev/playground](https://svelte.dev/playground)，右侧切到 **client 输出**标签。就这么点代码：

```svelte
<script>
  let count = $state(0);
</script>

<button onclick={() => count++}>加了 {count} 次</button>
```

产物骨架（函数名会被编译器 mangle，以 playground 实时输出为准）：

```js
function Component($$anchor, $$payload) {
  let count = 0;                                    // $state 在 runes 模式下的"编译后真相"
  var fragment = $.template(`<button> </button>`, 3); // 模板 → 字符串模板克隆
  ...
  const render = () => { $.set(text, `加了 ${count} 次`); };
  $.derived(() => count);        // 声明依赖
  $.user_effect(render);         // 状态变了 → 只跑这个函数
}
export default function ($$anchor, $$payload) {
  const store = $.store(() => { Component($$anchor, $$payload); });
  ...
}
```

逐行对号入座：
- **`$.template`**：模板被编译成一段 HTML 字符串，运行时 `cloneNode` 出真实 DOM——**没有"渲染函数返回虚拟节点树"这一步**；
- **`$state` 编译成了普通 `let`**：runes 不是运行时包装器，是**编译器关键字**（呼应 svelte-reactive-runes 第一节"它是语法不是库"）；
- **`$.user_effect(render)`**：更新逻辑被拆成一个个只碰一个文本节点/属性的微函数，脏了谁就执行谁——这就是"targeted updates"在产物层的实证（L6 内核课 `svelte-reactivity-internals` 讲的信号图，在这里落地成代码）。

## 二、没有 VDOM：三家三代同堂对比

| | Vue 3 | React 19 | Svelte 5 |
|---|---|---|---|
| 模板/JSX 的去向 | 编译成 render 函数 + patch flags，运行时 diff | JSX 运行时建对象树，reconciler diff | 编译期直接生成 DOM 操作与 effect |
| 每次更新的成本 | 重新执行 render 函数 + 增量 patch | 重新执行组件函数 + diff 整棵 VDom（编译器优化在补） | 只执行绑定了脏信号的 effect 微函数 |
| 运行时框架体积 | 数十 KB 起步 | react + react-dom 数百 KB 级 | **只剩一小撮 reactivity/helper**（组件自身代码就是"渲染器"） |

一句话版本：**React 把"怎么更新"留到运行时决定，Svelte 在编译时就写好了剧本**（呼应 05-react render model 课的"re-render 是默认、不重渲是优化"——在 Svelte 里倒过来：不重渲组件是默认，跑 effect 才是代价）。

面试官追问"那 Svelte 的组件到底'运行'吗？"——精确答案：runes 模式下组件函数**首次执行建 DOM，之后一般不再整体执行**；更新粒度是 effect，不是组件。Svelte 5.0 预发布曾让组件体随状态重跑，正式版前的关键改动就是把重跑收回 effect 粒度（读 5.0 前后文章遇到两种说法时，这是定盘星，呼应 svelte-overview 的版本嗅觉训练）。

## 三、运行时还剩多少"框架"

产物里 `$.template/$.set/$.derived/$.user_effect...` 全部来自 `svelte/internal/client`——这就是 Svelte 运行时的全量家底：

- **挂载 API**：`mount(Component, { target, props })`、`hydrate(...)`、`unmount(...)`、`flushSync(...)`——组件不再是 class，没有 `new App()`（呼应 svelte-lifecycle 的挂载章）；
- **信号图 runtime**：`$state` 的 Proxy 化、依赖收集、effect 调度都在这层（L6 内核课的源码地图就是它）；
- **没有的东西**：没有 vnode、没有 diff 算法、没有组件 reconciler、没有全局 store——这些活儿被编译器分掉了，或被响应式语义替代了。

推论（性能面试的杀手锏）：**Svelte 的包体积随页面代码增长是"真代码"增长，框架基数几乎不动**；但别把"无 VDOM"听成"无成本"——每个 effect 仍是闭包与订阅，滥用照样炸（L6 `svelte-performance` 数过这笔账）。

## 四、同一份源码，三种编译目标

`svelte.compile()` 的 `generate` 选项（工具链课配置项的底层真身）：

| 目标 | 产物 | 谁在用 |
|---|---|---|
| `client` | DOM 操作 + 信号 effect | 浏览器主包（本课第一节） |
| `server` | 返回 `render()`/`renderString()` 的字符串渲染器 | 纯 Svelte SSR 与 SvelteKit 服务端（L10 `svelte-ssr-hydration` 专关） |
| `customElement` | 产物外包一层 `customElements.define` | Web Components 互操作（L10 专关） |

hydration 不是一个"渲染模式"，是 client 产物的一个开关：编译带 `hydrate: true` 时，`$.template` 克隆改为**认领 SSR 留下的真实 DOM**（用注释锚点对位），只挂 effect 不建节点（呼应 07-next、08-nuxt 里"水合是客户端的接管仪式"的同款叙事）。

## 五、术语考古：为什么老文章都在说 create/update

Svelte 3/4 时代的产物形态是 `create/*_fragment/update/apropos` 一族函数（编译器逐节点生成"定向更新指令"）。Svelte 5 重写运行时后这族函数被 template+effect 模型取代，但 **"编译成定向更新"这个思想从 3 到 5 一脉相承**——读到 `create_fragment` 字样就知道那是 4 及以前的世界（4→5 迁移的不仅是 runes 语法，还有这层心智模型，L10 迁移课展开）。Vue 3 编译器当年受 Svelte 启发加 hoisting/patch flags，是"编译优化"思潮的中间派（呼应 04-vue 编译器课三件套）。

## 六、自检清单

- [ ] 能在 playground 里指认 `$.template`、`$state` 编译成普通 `let`、effect 微函数三件套。
- [ ] 能用"剧本 vs 临场发挥"讲清 Svelte 与 React/Vue 的更新成本差异，并说出 Svelte 的等价成本在哪（effect/订阅）。
- [ ] 说得出 Svelte 5 挂载 API（mount/hydrate/unmount/flushSync）与"组件不再是 class"的关系。
- [ ] 列举 client/server/customElement 三种编译目标及各自消费方。
- [ ] 遇到 create/update 老术语能正确断代。

---

🚀 **下一关**：`svelte-sveltekit-bridge`——组件层学完了，纯 Svelte 却连"路由"都得自己造：它缺什么、SvelteKit 补什么、本包与 12-sveltekit 包的分工地图。
