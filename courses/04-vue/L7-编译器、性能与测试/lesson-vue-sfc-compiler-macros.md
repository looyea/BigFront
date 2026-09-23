# SFC 与 `<script setup>` 编译器宏

> 目标：`.vue` 单文件组件（SFC）里的 `<script setup>` 是一层**编译期语法糖**——`defineProps`/`defineEmits`/`defineModel`/`defineExpose`/`defineOptions` 这些"编译器宏"会被编译成真正的组件选项。本课看懂这些宏的用法、**类型声明式 props + `withDefaults`**、SFC `<style scoped>` 的 `:deep()`/`:global()` 与 CSS `v-bind`，以及宏"必须写在顶层、是编译期产物"的本质（呼应 vue-component-basics、vue-refs-expose、02-ts、ts-decorators 的编译期魔法、10-vite 插件）。

---

## 一、什么是"编译器宏"

`<script setup>` 里的 `defineXxx` **不是运行时函数**，而是 `@vue/compiler-sfc` 在编译期识别、转译的**宏**：

```vue
<script setup>
const props = defineProps({ msg: String });
const emit  = defineEmits(['change']);
</script>
```
编译后大致等价于：
```js
export default {
  props: { msg: String },
  emits: ['change'],
  setup(props, { emit }) { /* 你的代码 */ }
}
```
**规则**：宏必须在 `<script setup>` **顶层**直接调用（编译期静态分析，不能放进条件/循环/回调）；无需 import（编译器注入）。

---

## 二、类型声明式 props + withDefaults

用 TS 类型字面量声明 props，编译期"编译"成运行时声明（呼应 02-ts）：

```vue
<script setup lang="ts">
interface Props { title: string; count?: number; tags?: string[] }
const props = withDefaults(defineProps<Props>(), {
  count: 0,                 // 默认值
  tags: () => [],           // 引用类型默认值仍需工厂
});
</script>
```
- `defineProps<T>()` 纯类型声明 → 自动得到 `props.title: string` 的类型（模板里也有类型检查）；
- **默认值用 `withDefaults`** 包一层（或 3.3+ 的 `props.xxx = 默认` 的 `withDefaults` 替代写法）；
- 运行时校验也从类型自动生成（`String`/`Number`/`Array` 映射）。

---

## 三、defineEmits / defineModel / defineExpose（回顾+宏视角）

```vue
<script setup lang="ts">
// emits 类型化：声明事件签名
const emit = defineEmits<{ change: [id: number]; submit: [] }>();
emit('change', 1);        // 第二参受类型约束

const model = defineModel({ type: String });           // v-model（3.4+），一个可写 ref
defineExpose({ focus: () => el.value.focus() });       // 开放给父（呼应 vue-refs-expose）
</script>
```
`defineModel` 把"`modelValue` prop + `update:modelValue` 事件"两个宏**合并成一个**，省样板。多值 `defineModel('x')`、修饰符 `const [m, mods] = defineModel()`（呼应 vue-component-basics 第五节）。

---

## 四、defineOptions 与其它宏

```vue
<script setup>
defineOptions({ name: 'UserCard', inheritAttrs: false });  // 给 <script setup> 补组件选项
</script>
```
`<script setup>` 本身不写 `export default {}`，需要 `name`/`inheritAttrs`/自定义选项时用 `defineOptions`（KeepAlive include 匹配 name 就靠它，呼应 vue-lifecycle 第五节）。相关宏还有 `defineSlots`（类型化插槽）、`defineProps` 的 `props` 响应式解构（3.5+ `props: { msg }` 保持响应）。

---

## 五、`<style scoped>`、:deep()、CSS v-bind

SFC 可写多个 `<style>`，`scoped` 让样式只作用于**本组件**（编译期给元素加 `[data-v-xxxx]` 属性 + 选择器改写）：

```vue
<style scoped>
.title { color: red; }             /* 只命中本组件的 .title */
:deep(.child-class) { color: blue; }   /* 穿透到子组件内部元素 */
::v-deep(.x) { }                   /* :deep 的旧别名 */
</style>
```
- **`:deep()`**：scoped 默认不命中子组件根之外的元素，`:deep()` 显式"下沉"选择器（穿透子组件、改第三方库内部类名常用）；
- **`:global()`**：包裹的选择器不加 scope，写全局样式；
- **CSS `v-bind()`**：把组件响应式状态注入 CSS：
```vue
<template><p class="t">hi</p></template>
<script setup>const color = ref('red');</script>
<style scoped>
.t { color: v-bind(color); }        /* 相当于绑定一个 CSS 变量 */
</style>
```
`v-bind` 底层是 `useCssVars` 设 `--xxxx` 变量（呼应 vue-class-style-transition 第二节绑定 CSS 变量）。

---

## 六、宏的"编译期"心智（和 ts-decorators 对照）

编译器宏与 TS 装饰器一样，都是**写在源码里、编译时被转成另一段代码**的语法：
- 宏 → `@vue/compiler-sfc` 转成 `props/emits/setup` 等选项；
- 装饰器 → TS 转成对类/成员的元编程调用（呼应 02-ts ts-decorators）。
理解"它是编译产物而非运行时黑魔法"，才能解释：为什么宏**必须顶层**（静态分析）、为什么 `<script setup>` 里 `import` 的组件自动注册（编译期收集）、为什么 props 能纯类型声明（编译期把类型翻成运行时校验）。Vite 的 `@vitejs/plugin-vue` 就是驱动这套编译的插件（呼应 10-vite 插件、vue-performance 编译期优化）。

---

## 七、自检清单

- [ ] 编译器宏和普通函数有何本质不同？为什么必须写在顶层？
- [ ] 类型声明式 props 怎么写？默认值用什么？引用类型注意什么？
- [ ] `defineModel` 合并了哪两个东西？多值/修饰符怎么用？
- [ ] `<script setup>` 里要设组件 name/inheritAttrs 用什么宏？
- [ ] `scoped` 下改子组件样式要什么？CSS `v-bind` 底层是什么？

---

## 🚀 部署预告

- `<script setup>` 的编译期优化（静态提升、`patchFlag`）是 **vue-performance（L7 下一关）** 的核心——宏用得对，编译器才能生成更高效的 render；
- `defineProps`/`defineEmits` 就是 vue-component-basics 里 props/emits 的糖；`defineExpose` 对应 vue-refs-expose；`defineModel` 对应单向数据流的 v-model；
- SFC 编译依赖 `@vitejs/plugin-vue`，产物如何被打包/分包见 **10-vite / vue-deploy（L8）**。

下一关进入 **vue-performance**：编译期静态提升/patchFlag、`v-memo`/`v-once`、`shallowRef` 大列表、虚拟滚动与生产构建分析。
