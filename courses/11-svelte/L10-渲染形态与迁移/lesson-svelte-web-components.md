# 编译为 Web Components：一份组件，全框架通吃

> 目标：把编译器多目标（L8 第一节预告的 customElement）真正用起来——`customElement` 编译选项与 `<svelte:options>` 标签声明、Shadow DOM 带来的样式/插槽规则改写、props 与属性的反射协议、`$host` 与 extend 的逃生舱，以及那张**必须背下来的坑表**（呼应 svelte-compiler-architecture、05-react/04-vue 的 Web Components 互操作话题）。

---

## 一、开箱：三行变 `<my-widget>`

```svelte
<svelte:options customElement="my-widget" />

<script>
  let { name = 'world' } = $props();
</script>

<h1>Hello {name}!</h1>
<slot />
```

编译侧开 `customElement: true`（vite 的 compilerOptions 或 svelte.config——L7 旋钮的第三个出口），import 这个文件时**自动 `customElements.define`**，之后它就是标准自定义元素：

```html
<my-widget name="everybody"><p>slotted</p></my-widget>
```

不想自动注册？省略 tag，拿静态属性 `MyWidget.element`（构造器）自己 `customElements.define('x-y', MyWidget.element)`——库作者控名必备。**内部组件不用全暴露**：没写 customElement 的子组件照常当普通 Svelte 组件用。

## 二、props 跨界协议：属性名、类型与显式声明

自定义元素的世界只有字符串属性，跨界翻译规则：

- **prop → DOM property 直读直写**：`el.name = 'everybody'` 立刻驱动 shadow DOM 更新（下一 tick 反映，wrapper 帮你批处理）；
- **attribute 通道默认是小写 prop 名**、类型是 String——驼峰 `maxLength` 收不到、数字 `"5"` 变字符串。在 options 里点名改造：

```svelte
<svelte:options customElement={{
  tag: 'my-widget',
  props: {
    name:     { reflect: true, type: 'Number', attribute: 'my-name' },
    items:    { type: 'Array' }
  }
}} />
```

`type` 决定 attribute↔prop 的 JSON 翻译档位（String/Boolean/Number/Array/Object），`reflect: true` 让 prop 变化写回 DOM（默认不回！查元素时别慌"属性怎么没更新"）；`attribute` 自定义属性名。
- **显式解构是前提**：`let props = $props()` 不点名属性的写法，编译器不知道要暴露哪些 prop——DOM 属性同步直接失效（文档原话级陷阱）；
- **`on` 开头的属性名是禁区**：`<my-widget ondone={fn}>` 会被解释成 `addEventListener('done')`——想传回调 prop 请改名或用 property 赋值。

## 三、事件与 $host：往外说什么话

Svelte 5 的回调 prop（`onchange={...}`）在自定义元素场景的跨界形态就是**标准 CustomEvent**：宿主侧 `<my-widget onchange={handler}>`（Svelte 宿主）或 `el.addEventListener('change', ...)`（原生/其他框架）都能听到——编译器把 `on{event}` 属性直接落成事件监听。组件内部要主动外发时，用 `$host` rune——**组件内访问宿主元素本体的官方通道**：

```svelte
<script>
  let { ondone } = $props();
  function finish() {
    $host.dispatchEvent(new CustomEvent('done', { detail: { ok: true } }));
  }
</script>
```

配合宿主判断状态、读宿主 class、表单集成（下一节的 ElementInternals）。

## 四、Shadow DOM 改写的四条规则

`shadow` 默认开（open），这不是"多一层 DOM"的小事，是**四套语义换轨**：

| 习惯 | Shadow 世界里 |
|---|---|
| scoped CSS（编译器加类名） | 变成**真隔离**：全局样式进不来（`:global(...)` 也穿不进 shadow），组件样式也出不去 |
| CSS 文件抽包 | 样式**内联成 JS 字符串**注入 shadow root——CSS 预算/提取插件的账要重算 |
| slot 惰性渲染（Svelte 的 `{#if}` 包住 slot 才渲染） | DOM slot **急渲染**：无论 `<slot>` 在不在 `{#if}` 里，slotted 内容一定被创建；`let:` 数据回传无通道（自定义元素没法给 slot 传数据） |
| context 穿组件树 | 只在一个自定义元素**内部**有效，跨元素断链（`<my-a>` setContext，`<my-b>` 收不到） |

逃生舱：`shadow: "none"` 关 shadow（样式裸奔、slot 不可用，但换回全局 CSS 亲和力——设计系统场景常见取舍）；`shadow: { mode: import.meta.env.DEV ? 'open' : 'closed' }` 调开发体验。

## 五、extend：接管包装类的时刻

默认 wrapper 的生命周期够日常：**connectedCallback 的下一 tick 才建组件**（提前赋的 property 会被缓存不丢）、短暂脱离 DOM 不触发销毁、disconnected 下一 tick 才 destroy。要更深控制就 `extend`——拿 Svelte 生成的构造器再继承：

```svelte
<svelte:options customElement={{
  tag: 'my-field',
  extend: (Base) => class extends Base {
    static formAssociated = true;
    constructor() { super(); this.internals = this.attachInternals(); }
    validate() { return this.internals.checkValidity(); }
  }
}} />
```

价值位：ElementInternals 进原生表单校验体系、挂载前就可用的方法（内部组件还没建时 property 方法不可用——extend 的类方法是即时的）。注意 TS 限制：extend 函数只吃 erasable 语法（文档明示）。

## 六、什么时候真的该用它（判据收束）

- ✅ 组件要进**不可控宿主**（政企老页面、第三方 CMS、邮件模板后台）、设计系统跨组织分发、微前端 UI 层——"框架无关"是买的东西；
- ✅ 浏览器原生能力（form association、内置可访问性语义）比 bundle 数字重要；
- ❌ SSR 首屏依赖它——**shadow DOM 在 JS 落地前是隐形的**（文档明言不适合 SSR），要 SSR 走 L10 第二关或上 Kit；
- ❌ 只是自家 SPA 内复用——普通组件零税，customElement 的每个跨界协议都是一道税（呼应 svelte-sveltekit-bridge 判据同款句式）。

体积账：customElement 产物=组件编译 JS + 内联样式串 + wrapper，比 library mode 产物多一层；但它**去掉了宿主框架的适配层**——React 项目包 `createCustomElement` 胶水、Vue 的 defineCustomElement 同理，Svelte 原生一等是相对优势（三家 WC 化对照的面试常客）。

## 七、自检清单

- [ ] 写出 tag 声明、`.element` 手动注册两条路。
- [ ] props 三件套：显式解构前提 / type+reflect+attribute 翻译档 / on 前缀禁区。
- [ ] Shadow 改写的四条规则各举一句现象（含"slot 急渲染"反直觉点）。
- [ ] $host 与 extend 各自解决什么（事件外发/表单集成）。
- [ ] 给出"该 WC 化 / 不该 WC 化"判据与 SSR 红线。

---

🚀 **下一关**：`svelte-ssr-hydration`——WC 的短板（服务端隐形）正是下一关主场：纯 Svelte 的 render()/hydrate 手搓 SSR 全管线，把 Kit 帮你编排的东西逐件拆开看。
