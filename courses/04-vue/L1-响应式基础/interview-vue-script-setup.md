# vue-script-setup 面试题精选

> 共 12 题，覆盖 语法糖原理 / 编译器宏 / props-emits / 边界与性能 四类。`<script setup>` 天天用，面试爱问"它到底编译成什么、和 setup() 有何区别"。

---

## 一、语法糖原理

### 1. `<script setup>` 和 Composition API 的 `setup()` 是什么关系？

`<script setup>` 是**编译时语法糖**，底层仍是 Composition API。它把你在 `<script setup>` 顶层写的代码编译进组件的 `setup()`，并**自动收集所有顶层绑定暴露给模板**，省掉手写 `setup()`、`return`、`components:{}` 注册。二者心智等价，前者更简洁、且给编译器更多优化信息（呼应 vue-script-setup 第一、七节）。

**来源**：Vue.js — "`&lt;script setup&gt;` / Composition API"

### 2. 为什么说 `<script setup>` 是"编译期"的？运行时看得到 `<script setup>` 吗？

运行时产物是一个普通组件选项对象（带 `setup`），浏览器根本看不到 `<script setup>` 标签或宏调用——它们在 `@vitejs/plugin-vue` 编译 SFC 阶段就被展开/替换成常规 JS。这也是"编译器宏不能 import、必须字面量参数"的原因：编译期没有真正的函数执行（呼应第八节）。

**来源**：Vue.js — "SFC Compiler / `@vitejs/plugin-vue`"

### 3. `<script setup>` 与普通 `<script>` 能共存吗？各自用途？

能，一个 `.vue` 可有一个普通 `<script>` + 一个 `<script setup>`。普通 `<script>` 用于：**模块级作用域**（只执行一次的 import/常量）、需要 `export` 的具名导出、`defineOptions` 覆盖不了的复杂选项、或显式写一个非 `setup` 的选项。约束：普通 `<script>` 不能是 `setup` 形式。

**来源**：Vue.js — "SFC: `&lt;script&gt;` and `&lt;script setup&gt;` together"

---

## 二、编译器宏

### 4. `defineProps` 有哪两种声明风格？各自的取舍？

- **运行时（值）声明**：`defineProps(['a','b'])` 或带类型/默认的对象形式，运行时生成 props 校验；
- **类型声明**：`defineProps<{ a: string }>()`，编译期从 TS 类型推断，无运行时开销、IDE 友好，默认值需 `withDefaults`。
真实项目多用类型声明（配合 02-ts），需要动态校验/无 TS 时用运行时声明（呼应第三节）。

**来源**：Vue.js — "SFC Type-Only Props Declaration"

### 5. `defineEmits` 存在的意义是什么？不写会怎样？

不写也能 `$emit`，但**声明后**：① 事件不再作为原生监听器 fallthrough 到根元素（避免 `<div onclick>` 之类副作用）；② 可做校验与类型约束；③ 文档化组件对外契约。良好实践是显式声明 emits（呼应第三节、vue-component-basics）。

**来源**：Vue.js — "`defineEmits` / declared events & fallthrough"

### 6. `defineExpose` 为什么存在？`<script setup>` 组件默认对外是什么状态？

默认**封闭**：父组件通过模板 ref 拿到的实例访问不到 `<script setup>` 内部绑定。`defineExpose({ fn })` 显式开放白名单。设计动机是**封装**——组件对外接口应由 props/emits/slots 定义，而不是让父组件随手伸进内部（呼应第四节、vue-refs-expose）。

**来源**：Vue.js — "`defineExpose` / component encapsulation"

### 7. `defineModel` 解决了什么？和 `useModel` 之类有何区别？

3.4 起 `defineModel()` 用一个宏同时声明 `modelValue` prop 与 `update:modelValue` 事件，并返回一个可读写、双向联动的 ref，消除手写样板。命名 v-model 用 `defineModel('count')`。它编译后内部仍是 props+emit 组合（是宏，不是运行时函数）（呼应第五节）。

**来源**：Vue.js — "`defineModel` (3.4)"、Vue RFC "v-model 改进"

---

## 三、props / emits 与响应性

### 8. 为什么"直接解构 props"会丢响应性？Vue 3.5 改了什么？

props 是响应式对象，`const { x } = props` 取到的是**当前值快照**，之后 props 更新不会回灌这个局部变量。3.5 引入 **props destructure 编译转换**（`propsDestructure`），把解构改写成 `toRef(props,'x')` 之类从而保持响应，但仍要注意别把它当普通 reactive 解构的心智（呼应第三节、vue-reactivity）。

**来源**：Vue.js — "Reactive Props Destructure (3.5)"

### 9. `<script setup>` 里 `import` 的组件，模板用 `<my-button>` 还是 `<MyButton>`？

两种都能解析（编译器做 camelCase↔PascalCase 匹配），但官方**推荐 PascalCase** `<MyButton />`，与"顶层绑定按 JS 变量规则解析"的心智一致，也利于和原生小写标签区分（呼应第二节 规则2）。

**来源**：Vue Style Guide — "PascalCase in SFC/templates"

---

## 四、边界与性能

### 10. `<script setup>` 里能用 `this` 吗？为什么？

不能。它是**无实例（instance-less）**的 setup 作用域，编译后不依赖组件实例代理，`this` 无意义。要访问响应式状态用 `ref.value`、要拿 attrs/slots 用 `useAttrs()/useSlots()`。这正是它能去掉 Options API `this` 包袱、编译更激进的原因之一（呼应第七节）。

**来源**：Vue.js — "`&lt;script setup&gt;` is instance-less"

### 11. 顶层 `await` 在 `<script setup>` 里为什么需要 `<Suspense>`？

顶层 await 会让编译出的 `setup()` 变成**异步 setup**，组件成为一个待解析的异步边界。若不在 `<Suspense>` 内，父级渲染时无法处理这个 Promise，行为不确定。`<Suspense>` 提供 pending/默认插槽切换（呼应第八节、vue-async-suspense）。

**来源**：Vue.js — "async setup / `&lt;Suspense&gt;`"

### 12. 从编译产物角度，`<script setup>` 相比 `setup()` 手写在性能上有什么优势？

编译器同时掌握脚本与模板，能判定哪些绑定**稳定**（模块级常量、导入组件），在渲染函数里**直接引用**而非每次从 setup 返回上下文查找；配合内联模板，减少一层 setup 返回对象的建立与访问。这些是 Options/显式 setup 拿不到的编译期信息（呼应第七节、L7 vue-sfc-compiler-macros）。

**来源**：Vue.js — "SFC Compile Optimization / inline template"
