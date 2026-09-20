# 响应式核心：ref、reactive 与 computed

> 目标：Vue 3 的灵魂是**响应式**——你声明"数据 → 视图"的映射，改数据时框架自动、精准地更新 DOM。这一课建立最核心的三个 API：**`ref`**（包装任意值、靠 `.value` 读写）、**`reactive`**（对对象的深度代理）、**`computed`**（有缓存的派生值）。理解它们各自的**心智模型与坑**（解构丢失响应性、`.value`、可选链），是后面 watch、组合式函数、Pinia 的地基（呼应 ES 包的 Proxy/Reflect/getter，下一关进入 vue-watch）。

---

## 一、为什么需要"响应式"

命令式更新 DOM（手动 `el.textContent = ...`）在大应用里难以维护。Vue 让你**只描述状态与视图的关系**，状态变了框架自动重渲染。要做到"变了就知道"，就得**拦截对数据的读写**——这就是响应式系统的职责（本课先讲用法，原理在 vue-reactivity-theory 用 Proxy/effect 拆解）。

---

## 二、ref：万物皆可 .value

`ref` 把**任意值**（基本类型或对象）包成一个带 `.value` 的响应式对象：

```vue
<script setup>
import { ref } from "vue";
const count = ref(0);            // Ref<number>
const user = ref({ name: "Amy" }); // 对象的每个属性也会被深层代理

function inc() {
  count.value++;                 // ⚠️ 在 <script> 里必须写 .value
  user.value.name = "Bob";       // 改嵌套也要 .value
}
</script>

<template>
  <p>{{ count }}</p>             <!-- 模板里自动解包，不写 .value -->
  <p>{{ user.name }}</p>
</template>
```

- **`<script>` 中读写用 `.value`**；**模板里 Vue 自动解包**，不写 `.value`（这是新手第一大坑）；
- `ref` 里放对象时，内部其实是用 `reactive` 代理那个对象（即 `ref` = "带 `.value` 的 `reactive` + 解包能力"）；
- **为什么基本类型也要包对象？** 因为 JS 传值不传引用，只有包成对象才能被 getter/setter 拦截（呼应 vue-reactivity-theory）。

---

## 三、reactive：对象的深度代理

`reactive` 只能用于**对象**（返回其 Proxy），适合一组相关的状态：

```vue
<script setup>
import { reactive } from "vue";
const state = reactive({ count: 0, list: [] });
state.count++;                   // 直接读写，无 .value
state.list.push(1);
</script>
```

**两个关键坑**：

1. **解构会丢失响应性**：

```js
const { count } = state;         // ❌ count 只是普通 number 快照，不再联动
const { count } = toRefs(state); // ✅ 转成 ref 保持响应
```

2. **不能整体替换**：`state = reactive({...})` 会切断原代理的引用（呼应 vue-reactivity-theory 的 toRef）。要重置用 `Object.assign(state, {...})`。

`ref` vs `reactive` 选择：**单个值、可能被重新赋值→`ref`；一组不需要整体替换的对象状态→`reactive`**。团队常统一"优先 `ref`"以避免解构/替换坑。

---

## 四、computed：有缓存的派生状态

```vue
<script setup>
import { ref, computed } from "vue";
const items = ref([{ price: 10, qty: 2 }, { price: 5, qty: 1 }]);
const total = computed(() => items.value.reduce((s, i) => s + i.price * i.qty, 0));
// 读 total.value；只有依赖(items)变化时才重新计算，否则用缓存
</script>
```

- **缓存**：computed 只在**依赖变化后、被再次读取时**才重新求值（惰性 + 缓存），比放方法里 `{{ total() }}` 每次渲染都跑更省；
- **默认只读**；需要可写用 `computed({ get, set })`；
- 心智：**computed = 派生的"值"，watch = 派生的"副作用"**（下关）——能用 computed 表达的不要放进 watch（呼应 vue-watch、vue-state-patterns"避免同步冗余状态"）。

---

## 五、自动解包与组合

- `ref` 放进 `reactive` 对象、或作为数组元素被模板 `v-for` 使用时，**访问会自动解包**（`state.count` 直接是值）；
- **嵌套 ref 只解包一层**：`ref(ref(1))` 读 `外层.value.value`（再深一层要自己 `.value`）；
- `.value` 也支持可选链？——`obj?.ref.value` 若 `obj` 为空会抛，用 `(maybeRef.value?.x) ?? 默认` 小心（呼应 ES 可选链）；
- 判断是否 ref：`isRef(x)`；强制转 ref：`toRef(state,'k')` / `toRefs(state)`。

---

## 六、最小完整示例：计数器 + 派生

```vue
<script setup>
import { ref, computed } from "vue";
const n = ref(0);
const even = computed(() => n.value % 2 === 0);
</script>

<template>
  <button @click="n++">+1</button>
  <p>计数：{{ n }}（{{ even ? "偶数" : "奇数" }}）</p>
</template>
```

`n++`（模板自动解包）→ 依赖 `n` 的 `even` 失效重算 → 视图更新。这条"改数据→自动更新"的链路就是响应式在日常中的样子。

---

## 七、自检清单

- [ ] `<script>` 与模板里读写 `ref` 分别要不要 `.value`？为什么？
- [ ] `ref` 与 `reactive` 各适合什么？`reactive` 的两个坑是什么？
- [ ] 为什么基本类型也要包成 `ref`？
- [ ] `computed` 相比"模板里调方法"好在哪？它是即时算还是惰性缓存？
- [ ] `toRefs`/`toRef` 解决什么问题？
- [ ] 什么时候用 computed、什么时候（下一关）才用 watch？

---

## 🚀 部署预告

- `.value`、解构丢失响应性、可选链坑都源于 Proxy 拦截机制——**vue-reactivity-theory** 会从原理讲透为什么；
- `computed` 的"惰性+缓存"依赖追踪，与**下一关 vue-watch**（侦听变化执行副作用）形成"派生值 vs 派生副作用"的对照；
- 本项目 `frontend/src` 的每个 `.vue`（如 `Lesson.vue`）都在用 `<script setup>` + `ref/computed`，学完可回去读源码印证；
- 组合式函数（**vue-composables**）本质就是"打包一组 ref/computed 复用"。

下一关进入 **vue-watch**：侦听器 watch 与 watchEffect，在数据变化时执行副作用。
