# 模板语法与指令

> 目标：模板不是"带魔法的 HTML"，而是会被编译器**转成 render 函数**的语法糖。本课掌握**插值 `{{}}` 与 `v-once`**、**`v-bind`/`v-on` 及其缩写 `:`/`@`**、**指令参数与动态参数 `[attr]`**、**事件/按键/表单修饰符**、**`v-html` 与 XSS 红线**、`v-cloak`/`v-pre`，以及"模板表达式只能是表达式、不能是语句"的约束。（呼应 vue-reactivity-theory 渲染即 effect、Express/OWASP XSS、ES 可选链）

---

## 一、插值 `{{ }}` 与 v-once

```vue
<template>
  <p>{{ msg }}</p>                 <!-- 文本插值，自动转义 -->
  <p>{{ msg.split('').reverse().join('') }}</p>  <!-- 可以是表达式 -->
  <p v-once>{{ staticText }}</p>    <!-- 只渲染一次，之后不再更新 -->
</template>
```

- `{{ }}` 里的内容会被**HTML 转义**后插入，天然防 XSS；
- 想反转义地注入 HTML 用 `v-html`（见第五节，慎用）；
- **`v-once`**：编译期把该节点标成静态，跳过后续 patch——纯静态内容的小优化（呼应 vue-performance 静态提升）。

> 插值能出现代表达式但**不能是语句**：`{{ if (x) ... }}`、`{{ a; b }}`、`{{ var y = 1 }}` 非法；可以用三元 `{{ ok ? 'A' : 'B' }}`、函数调用、可选链 `{{ user?.profile?.name }}`（呼应 ES 包可选链）。复杂逻辑应下沉到 `computed`，模板保持"傻瓜式"（呼应 vue-reactivity 第四节）。

---

## 二、v-bind：把值绑到属性

```vue
<img :src="url" :alt="text" />         <!-- v-bind: 缩写为 : -->
<a :href="link" :target="blank ? '_blank' : null">…</a>
<div :class="{ active: isActive }"></div>   <!-- class 特殊，见 L2 第三关 -->
<input :disabled="isDisabled" />
```

- 值是 **JS 表达式**，能访问组件 setup 作用域里的所有绑定；
- **布尔属性**（`disabled`、`checked`）：值为假值（`false`/`null`/`undefined`）时**自动移除**该 attribute；
- `:attr="null | undefined | false"` → 删除该属性；`''` → 保留空值（对 `class`/`style` 例外，会保留）。

---

## 三、指令参数与动态参数

指令名后 `:` 接的是**参数（argument）**，`v-bind:` 的 `:` 正是"参数分隔符"，所以缩写是 `:src`。参数还能**动态**：

```vue
<a :[attrName]="value" />        <!-- attrName = 'href' → 渲染成 :href -->
<button @[eventName]="doIt" />   <!-- eventName = 'click' → 绑定 click -->
<input v-model:[mod]="text" />
```

动态参数值会被**自动转为小写**，且不能包含空格/特殊字符（需要时用引号 `:['my:attr']`）。

---

## 四、v-on 与修饰符

```vue
<button @click="onClick">…</button>          <!-- v-on: 缩写为 @ -->
<button @click="count++">…</button>           <!-- 内联表达式（语句）也允许 -->
<form @submit.prevent="onSubmit">…</form>    <!-- 修饰符 .prevent 阻止默认 -->

<input @keyup.enter="submit" />              <!-- 按键修饰符 -->
<input @keyup.esc="cancel" />
<div @click.stop="handler"></div>            <!-- .stop 阻止冒泡 -->
@click.once / .capture / .self / .passive   <!-- 常见修饰符 -->
```

修饰符可**串联**且顺序有意义：`@click.stop.prevent.once`。`.passive` 告诉浏览器"不会 preventDefault"，提升滚动性能（呼应 DOM 事件、vue-performance）。

> 内联语句 `@click="count++"` 是 `v-on` 特有的便利，`{{ }}` 插值里则**只能表达式**——两者的边界要分清。

---

## 五、v-html 与 XSS 红线 ⚠️

```vue
<p v-html="userInput"></p>    <!-- 危险：userInput 里的 <script>/onerror 会执行 -->
```

`v-html` 直接插入原始 HTML，**不做转义**。若内容来自用户输入/URL/富文本未清洗，就是**存储型/反射型 XSS** 入口：

- 默认永远优先 `{{ }}` 或属性绑定；
- 确实要渲染富文本 → **服务端/入库前**清洗（如 DOMPurify），或后端返回安全 HTML；
- 这也是为什么框架默认转义插值（呼应 Express XSS 关、OWASP Top 10、vue-sfc 的自动 escape）。

> 编译器还会对 `{{ }}` 与属性插值做 **HTML 转义**；`v-html` 是唯一绕过它的常规手段，团队里应作为"高危 API"审查（呼应 exp-security）。

---

## 六、其它：v-cloak / v-pre / v-memo

- **`v-cloak`**：配合 CSS `[v-cloak]{display:none}`，在 JS 加载完成前隐藏未编译的 `{{}}`，防"原始插值闪一下"（仅无构建/CDN 直挂场景需要）；
- **`v-pre`**：跳过该节点及其子节点的编译，用于含大量花括号字面量（如 Markdown/MathJax）的静态内容，加快编译；
- **`v-memo`**：缓存子树，依赖不变则复用上次渲染结果，大列表优化用（详见 vue-performance）。

---

## 七、模板编译产物（揭开"魔法"）

```vue
<template><p :id="a">{{ b }}</p></template>
```
编译后（简化）：
```js
function render(_ctx) {
  return { tag: 'p', props: { id: _ctx.a }, children: _ctx.b }
  // 真实 runtime-vdom 为 createVNode('p', { id }, toDisplayString(_ctx.b))
}
```
`_ctx` 就是组件实例的代理，读 `_ctx.a/_ctx.b` 即触发 **render effect 的依赖收集**（呼应 vue-reactivity-theory 第二节）——模板里的响应式依赖，是在这段 render effect 执行时收集到的。这就是"改数据→组件重渲染"的完整链路。

---

## 八、自检清单

- [ ] `{{ }}` 里能写语句吗？为什么复杂逻辑该挪进 computed？
- [ ] `:` 和 `@` 分别是哪两个指令的缩写？动态参数怎么写？
- [ ] 假值绑到 `disabled` 会发生什么？`''` 呢？
- [ ] `v-html` 为什么危险？渲染用户富文本的正确姿势？
- [ ] `v-once`、`v-pre`、`v-cloak`、`v-memo` 各解决什么？
- [ ] 模板里的响应式依赖是在哪一步被收集的？（联系 reactivity-theory）

---

## 🚀 部署预告

- 模板 → render 函数 → render effect → 依赖收集，这条线把 **L1 响应式** 与"界面更新"正式打通；`v-once`/`v-memo`/静态提升是 **vue-performance（L7）** 的入口；
- `v-html` 的 XSS 与 **09-express（XSS/安全）**、**OWASP** 同源，富文本清洗要前后端一起看；
- 下一关 **vue-conditional-list**：`v-if` 与 `v-show` 到底怎么选、`v-for` 为什么必须 `key`、`v-if` 和 `v-for` 能不能写在一起。
