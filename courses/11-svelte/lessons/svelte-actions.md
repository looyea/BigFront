# Actions：use 指令

> 目标：掌握 Svelte 独有的"行为复用"单元——**action**：`use:xxx` 把一段 DOM 逻辑焊在元素上，随元素挂载而运行、随销毁而清理，参数还能响应式更新。内置 focus/blur 与"过渡当 action 用"、三个必会实战（click-outside、tooltip、长按），并对照 Vue 自定义指令与 React hooks 的等价物。（呼应 svelte-template bind:this、04-vue 自定义指令）

---

## 一、action 是什么：三段式生命周期

```svelte
<div use:clickOutside={{ on_outclick: close }}>…</div>
```

```js
// actions.js
export function clickOutside(node, params = {}) {
  const handleClick = (e) => {
    if (!node.contains(e.target)) params.on_outclick?.();
  };
  document.addEventListener('click', handleClick, true);
  return {
    destroy() { document.removeEventListener('click', handleClick, true); },
  };
}
```

契约极短：**函数 `(node, parameter) => { update?(parameter), destroy?() }`**。

| 时机 | 发生什么 |
|---|---|
| 元素插入 DOM 后 | 立即调用 `action(node, param)`（对比 `$effect` 的 flush 后执行，这里拿到的是**已在文档里的真节点**，可直接测量/聚焦） |
| `param` 变化 | 若返回了 `update(newParam)` 则被调用 |
| 元素移除前 | `destroy()` 清理监听/定时器/observer |

这就是 Vue 自定义指令的 `mounted / updated / unmounted` 三钩子（少了 `created`，Svelte 不需要）（呼应 vue 指令）。

---

## 二、内置 action 与"过渡当 action 用"

`svelte/action` 提供两个极简内置：

```svelte
<script>
  import { blur, focus } from 'svelte/action';
  import { fly } from 'svelte/transition';
  import { animate } from 'svelte/action';
</script>

<input use:focus />          <!-- 挂载即聚焦(替代 onMount+$tick 手动 focus) -->
<textarea use:blur />        <!-- 元素被移除前触发,常用于"离开时保存" -->

<!-- 过渡函数也能当 action 用在"一直存在"的元素上,补播进场(transition: 只服务显隐块) -->
<div use:fly="{{ y: 20, duration: 400 }}">首屏/SSR 水合后的进场</div>

<!-- use:animate: 内容变化时对子元素位移/尺寸变化跑过渡(Svelte 5 签名:回调报告每段) -->
<div use:animate={(seg, { node, from, to }) => ({
  duration: 400,
  css: (t) => `transform: translate(${(1 - t) * seg.x}px, ${(1 - t) * seg.y}px); opacity: ${t}`,
})}>
  {#each items as item}<p>{item}</p>{/each}
</div>
```

路由首屏/SSR 水合时 `{#if}` 进场动画不播的痛点，就用 `use:fly` 这类"过渡当 action"手动补播（Svelte 4 时代的 use:mount 在 5 中已移除，写法升级成直接拿过渡函数当 action）。

---

## 三、实战弹药库：三个最高频 action

```js
// 1) tooltip：悬浮显示,离开销毁
export function tooltip(node, { text = '' } = {}) {
  let tip;
  const enter = () => {
    tip = document.createElement('div');
    tip.className = 'tip'; tip.textContent = text;
    document.body.append(tip);
    const { left, bottom } = node.getBoundingClientRect();
    Object.assign(tip.style, { left: `${left}px`, top: `${bottom + 6}px` });
  };
  const leave = () => tip?.remove();
  node.addEventListener('mouseenter', enter);
  node.addEventListener('mouseleave', leave);
  return {
    update: (p) => (node.title = p.text ?? ''),
    destroy() { node.removeEventListener('mouseenter', enter); node.removeEventListener('mouseleave', leave); leave(); },
  };
}

// 2) 长按出菜单
export function longpress(node, cb) {
  let t;
  const down = () => { t = setTimeout(() => cb(), 600); };
  const up = () => clearTimeout(t);
  node.addEventListener('pointerdown', down);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((e) => node.addEventListener(e, up));
  return { destroy: () => up() };
}

// 3) 元素入场once(IntersectionObserver 曝光埋点)
export function expose(node, onExpose) {
  const io = new IntersectionObserver((es) => {
    if (es[0].isIntersecting) { onExpose(node.dataset); io.disconnect(); }
  });
  io.observe(node);
  return { destroy: () => io.disconnect() };
}
```

注意 `longpress` 的 `cb` 若变化需 `update` 重存——**参数是快照式传入**，闭包旧值不自动刷新，这是 action 与响应式的交界处，最常考。

---

## 四、边界与惯例

- **只能用在元素上**（`<div use:x>` ✓；`<Comp use:x>` ✗ 编译错误）——要作用于组件，在组件内部根元素上写，或把 action 函数作为 prop 传进去。
- 一个元素可叠多个：`<input use:focus use:tooltip={{text}} bind:value={v} />`，执行顺序=书写顺序。
- action 里**不要碰 Svelte 状态来渲染**——它是"命令式逃生舱"，改 DOM 样式/挂监听/测量是他的本行；数据流仍走 runes（一个元素同一属性别让 action 和模板绑竞争，会互踩）。
- SSR 阶段 action 不执行（没有 DOM），涉及 `window` 的都在函数体内访问，模块顶层别摸浏览器全局。
- 命名习惯：动词小写 camelCase；参数对象化以便 `update` 增量接收。

---

## 五、和 Vue 指令 / React hooks 的三方对照

| 维度 | Svelte action | Vue 自定义指令 | React "等效物" |
|---|---|---|---|
| 声明 | `use:x={param}` | `v-x="param"` | 无语法位,靠 ref+effect 手搓 |
| 拿到真节点 | 直接第一参 | `mounted(el)` | `useRef` + effect |
| 参数更新 | `update(newParam)` | `updated(el, binding)` | 重新执行 effect |
| 清理 | `destroy()` | `unmounted` | effect 返回函数 |
| 复用的是 | **DOM 行为** | DOM 行为 | **状态逻辑**(hook) |

深层差异：Vue 指令/Svelte action 都作用于"这个元素"，React hooks 作用于"这次渲染"——所以 tooltip 这类纯 DOM 挂件在 React 里要 `useRef`+多个 `useEffect` 拼，在 Svelte 里一个函数完事（呼应 react-custom-hooks、vue 指令）。

---

## 六、自检清单

- [ ] 背出契约：`(node, param) => { update?, destroy? }` 与三个触发时机。
- [ ] 会 use:focus / use:blur,以及把过渡函数当 action 补播进场、use:animate 的回调签名。
- [ ] 手写过 click-outside / tooltip / 长按,理解参数快照与 update。
- [ ] 知道 action 不能直接上组件、SSR 不执行、别与模板绑同一属性。
- [ ] 能讲 action(Vue 指令系) 与 hooks(状态逻辑系) 的定位差。

---

🚀 **下一站 L6**：`svelte-reactivity-internals`——信号、依赖图、`untrack`/`$inspect` 之下发生了什么，从原理层解释前 15 关的所有"规则"。
