# 模板引用与 defineExpose

> 目标：Vue 是"数据驱动"，但某些场景必须**直接拿到 DOM 元素或子组件实例**命令式操作（聚焦、滚动、调用 `validate()`/`play()`）。本课掌握 **模板 `ref` 绑定 DOM/组件**、**`useTemplateRef`（3.5+）**、**ref 与时机（onMounted 才有值、v-for 里的数组 ref、函数 ref、动态 ref 名）**、**组件默认封闭 + `defineExpose`**，以及最重要的判断准则：**能用数据/props 解决就别用 ref**。（呼应 vue-lifecycle 时机、vue-component-basics）

---

## 一、绑定模板 ref

```vue
<script setup>
import { ref, onMounted } from 'vue';
const inputEl = ref(null);           // 指向 DOM 元素
onMounted(() => inputEl.value.focus());  // ✅ 挂载后才有实例
</script>
<template>
  <input ref="inputEl" />            <!-- ref 名要和 setup 里的变量对应 -->
</template>
```

- `ref="xxx"` 的特殊字符串会与 `<script setup>` 中同名 `ref` 变量绑定；
- **值在 `onMounted` 之前是 `null`**——DOM 还没建（呼应 vue-lifecycle 第一、二节）；
- 用 `v-if` 控制的元素，隐藏时对应 `ref.value` 变回 `null`。

> 传统选项式在 `this.$refs`；`<script setup>` **没有** `this`，全靠声明式 `ref` 变量名匹配（也可用 `getCurrentInstance()` 兜底，但不推荐日常使用）。

---

## 二、useTemplateRef（Vue 3.5+）

```vue
<script setup>
import { useTemplateRef, onMounted } from 'vue';
const el = useTemplateRef('input');   // 明确"拿模板里 ref=\"input\" 的对象"
onMounted(() => el.value?.focus());
</script>
<template><input ref="input" /></template>
```
`useTemplateRef` 把"取模板引用"变成显式 API，好处：与同名普通变量不会混淆、**TS 能自动推断元素类型**（`Ref<HTMLInputElement | null>`）。新项目推荐用它替代"同名 ref 变量"的隐式魔法（呼应 02-ts）。

---

## 三、v-for 里的 ref、函数 ref、动态 ref 名

```vue
<!-- 数组 ref：Vue 把每个元素塞进数组（3.5 起自动，需给 :ref 用同一函数或数组 ref） -->
<input v-for="n in 3" :key="n" :ref="els => (inputs[n] = els)" />

<!-- 函数 ref：完全掌控拿到/释放元素的时机 -->
<div :ref="(el) => { if (el) mountWidget(el); else unmountWidget(); }"></div>
```
函数 ref 在元素挂载时以 `el` 调用、卸载时以 `null` 调用——正好用来做第三方实例的 init/dispose（呼应 vue-lifecycle 第二节）。列表虚拟滚动、动态增删的项常用它。

---

## 四、组件 ref 与 defineExpose ⭐

给**组件标签**加 ref，拿到的是该组件的**公开实例**。但 `<script setup>` 编译出的组件**默认是封闭的**——父拿不到子内部的任何绑定：

```vue
<!-- Child.vue -->
<script setup>
import { ref } from 'vue';
const count = ref(0);
function reset() { count.value = 0; }
defineExpose({ reset, count });   // 显式开放给父
</script>

<!-- Parent.vue -->
<script setup>
const child = ref(null);          // 或 useTemplateRef('child')
</script>
<template>
  <Child ref="child" />
  <button @click="child?.reset()">重置</button>   <!-- 调子的公开方法 -->
</template>
```

- **默认封闭**：不 `defineExpose` 的话，`child.value.reset` 是 `undefined`（保护封装、防止父乱动子内部）；
- `defineExpose` 的"公开 API"应尽量窄——只暴露方法而非一堆内部状态；
- 选项式组件不用 `defineExpose`（默认可访问），这是 `<script setup>` 的新约束（呼应 vue-component-basics）。

---

## 五、什么时候该用 ref，什么时候不该 ⚠️

**该用（imperative 场景）**：`focus()`/`scrollTo()`、驱动 `<video>.play()`、接入第三方（编辑器/图表 `init(el)`、`getInstance()`）、调用子组件 `validate()`/`open()`。

**不该用（应数据驱动）**：
- 想改样式 → 用 `:class`/`:style`，别 `el.style.xxx`（呼应 vue-class-style-transition）；
- 想改文本/显隐 → 用插值/`v-if`，别 `el.innerText=`/`el.hidden=`；
- 想同步父子两个值 → 用 props/emits/v-model，别 `child.value.xxx=`（呼应 vue-component-basics 单向流）；
- 想拿"渲染后 DOM 再做事" → 优先 `watch(flush:'post')`/`nextTick`，别堆 `onUpdated`（呼应 vue-lifecycle 第三节）。

> 心智：**ref 是"逃出声明式模型的逃生门"**，用多了说明设计还在命令式思维。能用状态表达的，一律用状态。

---

## 六、异步与 v-for 的坑

- `v-if` 使元素从有到无：`ref.value` 会在 `null ↔ 元素` 间变化，用前判空（`el.value?.focus()`）；
- `v-for` 动态列表：数组 ref 的顺序/长度需自己维护（函数 ref 里按 key 存 map 最稳）；
- 拿子组件方法要在**其挂载后**（`onMounted` 或 `nextTick` 之后），过早是 `null`（呼应 vue-lifecycle）。

---

## 七、自检清单

- [ ] 模板 ref 在什么时机才有值？`v-if` 隐藏时它是什么？
- [ ] `useTemplateRef` 相比同名 ref 变量好在哪？
- [ ] 函数 ref 的调用时机与用途？
- [ ] `<script setup>` 子组件的实例，父为什么默认拿不到？怎么开放？
- [ ] 列举三个"应该数据驱动、不该用 ref"的例子。

---

## 🚀 部署预告

- `defineExpose` 划出的"组件公开边界"，与 **vue-component-basics** 的 props/emits 共同构成组件契约；调用子方法常配 `onMounted`/`nextTick`，回到 **vue-lifecycle** 的时机；
- 组合式函数里"要拿到某 DOM 元素初始化"往往返回一个 ref 给模板绑定——见 **vue-composables（L4）**；
- 测试里用 `wrapper.find`/`vm.$refs` 触发命令式方法，见 **vue-testing（L7）**（呼应 @vue/test-utils）。

下一关进入 **L4 vue-provide-inject**：当 props 一层层"钻取"太累时，用依赖注入跨层传递响应式状态与函数。
