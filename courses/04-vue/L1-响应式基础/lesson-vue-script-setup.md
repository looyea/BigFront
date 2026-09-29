# `<script setup>` 语法糖：现代 Vue 组件的默认写法

> 目标：从这一课往后，**每一个 `.vue` 示例的顶部都是 `<script setup>`**。如果你不知道它是什么，读到 `const count = ref(0)` 会一脸懵——"变量没 return，模板怎么就能用？组件没注册，怎么就能当标签用？" 这一课把这些"魔法"讲成人话：`<script setup>` 是 Vue 编译器提供的**语法糖**，它把组件写成"顶层声明即模板可用"的简洁形态。学完你要能：看懂并写出 `<script setup>` 组件、明白 `defineProps/withDefaults/defineEmits/defineExpose/defineOptions` 这些**编译器宏**在做什么、知道 `defineModel` 简化 v-model、并清楚它的边界与坑（为 L7 深挖编译产物埋伏笔）。

---

## 一、它从哪来：Options API → setup() → `<script setup>`

**① 老的 Options API**：数据写在 `data()`、方法写在 `methods{}`、生命周期叫 `mounted(){}`，靠 `this` 互相访问。逻辑一大就"横切分散"，一个功能的 state/method/watch 被拆到不同选项里。

**② Composition API 的 `setup()`**：把逻辑收进一个函数，用 `ref/computed/watch` 自由组织。但要写 `setup()`、要 `return { 一堆东西 }` 才能暴露给模板，样板不少。

**③ `<script setup>`**：一个**编译时语法糖**。你只管在 `<script setup>` 里写顶层代码，Vue 编译器**自动**把它变成一个带 `setup()` 的组件，并**自动**把所有顶层绑定暴露给模板——省掉手写 `setup()` 和 `return`。

```vue
<!-- 你写的 -->
<script setup>
import { ref } from "vue";
const count = ref(0);          // 顶层绑定
function inc() { count.value++; }
</script>
<template><button @click="inc">{{ count }}</button></template>
```

它**约等于**编译器帮你生成：

```js
export default {
  setup() {
    const count = ref(0);
    function inc() { count.value++; }
    return { count, inc };   // ← 顶层绑定自动出现在这里
  }
}
```

> 心智：**`<script setup>` ≈ setup() 的自动版**。你写的是"普通 JS 模块的顶层"，编译器负责接线。

---

## 二、三条最重要的规则

### 规则 1：顶层绑定，模板直接可用

`<script setup>` 里的**顶层** `const / let / function / import` 都会被暴露给模板。所以 `msg`、`count`、`inc` 不用 return 就能在 `{{ }}` 和 `@click` 里用。

⚠️ **必须是"顶层"**：写在函数体内的局部变量、或 `import` 时改名没导出的，模板拿不到。

### 规则 2：import 组件 = 自动注册

```vue
<script setup>
import MyButton from "./MyButton.vue";   // 引进来就能当标签用
</script>
<template><MyButton /></template>
```

不再需要 `components: { MyButton }`。组件名的解析规则和普通 JS 变量一致（大小写敏感，PascalCase 建议）。

### 规则 3：`defineXxx` 是"编译器宏"，不用 import

`defineProps`、`defineEmits`、`defineExpose`、`defineOptions`、`withDefaults`、`defineModel` 都是**宏**——它们不是从 vue 导入的函数，而是编译器在编译阶段识别并替换的特殊调用。**直接写、别 import**。

---

## 三、props / emits：组件的输入与输出

### 声明 props：`defineProps`

```vue
<script setup>
// 目的：三种声明 props 的写法——运行时数组 / 类型泛型（推荐）/ withDefaults 给默认值
// 运行时声明（数组）
const props = defineProps(["title", "count"]);

// 或 类型声明（推荐，配合 TS 更香）
const props = defineProps<{ title: string; count?: number }>();

// 有默认值 → withDefaults
const props = withDefaults(defineProps<{ title: string; count?: number }>(), {
  count: 0,                       // 父级不传 count 时，props.count 自动为 0
});
// ✅ 应用：读 props.title；❌ const { title } = props 会丢响应（见本末§八）
</script>
```

- `defineProps` 返回 `props` 对象，读 `props.title`；
- **不要解构 props 丢响应性**（`const { title } = props` 会失去联动）——Vue 3.5+ 的 `propsDestructure` 才让解构保持响应（呼应 vue-reactivity 的解构坑）。

### 声明 emits：`defineEmits`

```vue
<script setup>
// 目的：defineEmits 声明子组件向外抛的事件，父用 @like 监听
const emit = defineEmits(["like"]);
// 或带类型：const emit = defineEmits<{ (e:'like', id:number):void }>();
function onClick() { emit("like", 42); }   // ✅ 抛 like 并带参数 42
</script>
<template><button @click="onClick">点赞</button></template>
```

父组件用 `@like="..."` 监听。**props 向下、emits 向上**是组件通信的骨架（呼应 L3 vue-component-basics、L4 provide/inject）。

---

## 四、组件默认"封闭"：`defineExpose`

`<script setup>` 组件的顶层绑定**默认不暴露给父组件**（父组件用 `ref` 拿到子组件实例时，看不到内部方法）。要让某些方法/属性可从外部调用，显式：

```vue
<script setup>
// 目的：默认封闭，显式 defineExpose 后父组件才能通过模板 ref 调用子内部方法
function reset() { /* ... */ }
defineExpose({ reset });   // ✅ 父组件 myRef.value.reset() 才能用
// ❌ 不调 defineExpose：父拿到的实例代理上看不到 reset，调用报 undefined is not a function
</script>
```

这是刻意设计——**默认封闭、按需开放**，避免父组件随意伸手进子组件内部（呼应 L3 vue-refs-expose）。

---

## 五、v-model 的简化：`defineModel`（Vue 3.4+）

老写法要手写 `modelValue` prop + `update:modelValue` 事件。现在一个宏搞定：

```vue
<script setup>
// 目的：defineModel 一个宏同时拿到 prop + 写回事件的双向绑定本地 ref（Vue 3.4+）
const model = defineModel();          // 等价于手写 modelValue prop + update:modelValue 事件
</script>
<template><input v-model="model" /></template>
```

父组件 `<MyInput v-model="text" />` 就自动接上了。可加选项：`defineModel({ required: true })`、多个用 `defineModel("count")`（呼应 vue-component-basics 的组件 v-model、L7 defineModel 深挖）。

---

## 六、`defineOptions` 与其它

```vue
<script setup>
defineOptions({ name: "MyButton", inheritAttrs: false }); // 组件选项（名字/属性继承等）
</script>
```

- `<script setup>` 本身没有地方写 `name`、`inheritAttrs` 这类**组件选项**，`defineOptions`（3.3+）补上这个缺口；
- 还有 `defineSlots`（插槽类型）、`useAttrs()/useSlots()`（拿 attrs/slots）。

**需要"普通 `<script>`"共存**的场景：声明模块级作用域（只 import 一次的常量）、定义需要 `export` 的具名导出、给宏传不了选项的复杂类型——此时可以 `<script>` + `<script setup>` 两段并存（有约束：普 `<script>` 不能是 `setup`）。

---

## 七、它编译成什么 / 为什么更快

`<script setup>` 不只是"少写几行"，编译器能拿到模板与脚本的**全量信息**，做更激进优化：

- 绑定在编译期就知道是"稳定的"（如模块级常量、导入的组件），模板里可**直接引用而非每次从 setup 返回值取**，省去运行时查找；
- 组件是**无实例的 setup 作用域**（没有 Options API 那个 `this` 实例包袱），配合 `inline template` 编译产物更小更快；
- 对 TS：`defineProps<T>()` 类型声明能直接推断出 props 类型，IDE 友好。

> 编译产物的细节（`_sfc_main`、`__name`、props 校验如何生成）留到 **L7 vue-sfc-compiler-macros**，本课只要求"会用 + 知道是编译期替换"（呼应 ts-decorators 的"编译期魔法"）。

---

## 八、边界与坑清单 ⚠️

- **宏只能在 `<script setup>` 顶层用**，不能放进函数体、不能 import；
- **顶层 `await`** 会让组件变成"异步组件"，必须被 `<Suspense>` 包裹（呼应 vue-async-suspense）；
- **默认封闭**：父组件想访问子内部要 `defineExpose`；
- **props 别随手解构**（3.5 前会丢响应性）；
- 一个 `.vue` 里 `<script setup>` 只能有**一个**（可与一个普 `<script>` 搭配）；
- `defineProps` / `defineEmits` 的**参数必须是字面量或同文件导入的类型**，不能传外部变量（编译期限制）。

### 🔧 对照：正确 vs 错误（附编译器/运行时的真实后果）

```vue
<!-- 目的：把本讲每个核心用法配一段「正确 + 错误」，错误处注释写明它到底会报什么 -->
<script setup>
import { ref } from "vue";

// ✅ 正确：顶层声明 ref，脚本里用 .value 读写
const count = ref(0);               // 初始值 0，顶层绑定会自动暴露给模板
function inc() { count.value++; }   // count.value: 0 → 1，视图同步更新为 1

// ❌ 错误 A：脚本里漏写 .value
// function inc2() { count++; }      // 后果：count 是对象，count++ 变 NaN，且没改 .value → 视图不更新

// ❌ 错误 B：把编译器宏放进函数里调用
// function setupP() { defineProps(["a"]); }  // 后果：编译报错——`defineProps` is a compiler macro and cannot be used here（只能在顶层）

// ❌ 错误 C：给宏传运行时变量
// const names = ["a"]; defineProps(names);   // 后果：编译报错——argument must be a literal array/object or type argument

// ❌ 错误 D：用 this
// this.count                                   // 后果：<script setup> 无实例，this 为 undefined → 运行时取不到/报错

// ✅ 正确：import 组件即自动注册（无需 components:{}）
import MyBtn from "./MyBtn.vue";    // 模板里 <MyBtn/> 直接可用

// ❌ 错误 E：props 解构丢响应（Vue 3.5 之前）
// const props = defineProps({ title: String });
// const { title } = props;          // 后果：title 成了静态快照，父级改传 :title 后模板不再更新
</script>

<template>
  <button @click="inc">{{ count }}</button>  <!-- ✅ 正确：初始 0，点一下变 1 -->
  <MyBtn />                                  <!-- ✅ 正确：import 来的组件直接当标签用 -->
</template>
```

---

## 九、自检清单

- [ ] `<script setup>` 里的顶层变量为什么模板能直接用？它约等于编译器生成了什么？
- [ ] `import` 一个组件后还需不需要 `components:{}` 注册？
- [ ] `defineProps` / `defineEmits` 要不要 import？它们是什么？
- [ ] 想让父组件调用子组件的一个方法，该用哪个宏？
- [ ] `defineModel` 省掉了哪两个手写东西？
- [ ] `<script setup>` 里写顶层 `await` 有什么前提？

---

## 🚀 部署预告

- 本关只解决"**会用** `<script setup>`"；它的**编译产物与宏展开**在 **L7 vue-sfc-compiler-macros** 深挖；
- `defineProps/defineEmits` 的完整校验、类型声明、插槽类型在 **L3 vue-component-basics** 展开；`defineExpose` 与模板 ref 的配合在 **L3 vue-refs-expose**；
- 本项目每个 `.vue`（`Lesson.vue`、`Home.vue`…）都用 `<script setup>` 写就，通关后可回 `web/src` 找 `defineProps`、`import` 组件、`defineModel` 的真实用例印证。

下一关进入 **vue-reactivity**：有了 `<script setup>` 这块地基，正式开讲响应式三件套 `ref / reactive / computed`。
