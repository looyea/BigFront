# L1 课后作业：响应式基础

> 覆盖 **vue-reactivity / vue-watch / vue-reactivity-theory** 三关。先读代码找 bug，再动手写，最后场景与简答。环境：Vue 3 + `<script setup>`。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这个计数器点了没反应，为什么？
```vue
<script setup>
let count = 0;
function inc() { count++; }
</script>
<template><button @click="inc">{{ count }}</button></template>
```
> 改成什么才能触发更新？两种写法都给出。（呼应 vue-reactivity 第一、二节）

**2.** 说出 `state` 与 `count` 各自解构后是否还响应，并说明原因：
```js
const state = reactive({ n: 0 });
const { n } = state;               // A
const m = ref(0);
const raw = m;                     // B
```

**3.** 这段 computed 有什么问题？"偶数"文案为什么从不更新？
```js
const isEven = computed(() => count % 2 === 0);  // count 是 ref
```
> 少写了什么？（呼应 vue-reactivity 第四节）

**4.** 预测输出并解释（同一 tick 内）：
```js
count.value++; count.value++; count.value++;
console.log('sync read', count.value);
await nextTick();
console.log('after tick', /* DOM 里显示的值 */);
```
> 为什么组件只重渲染一次？（呼应 vue-reactivity-theory 第五节）

**5.** 这个 watch 为什么"新旧值一样、看不出变了什么"？怎么改？
```js
const state = reactive({ user: { name: 'a' } });
watch(state, (n, o) => console.log(n.name, o.name));
```
>（呼应 vue-watch 第二节、interview 第 4 题）

**6.** 搜索框竞态：输入 `re`→`react`，`re` 的请求慢、后返回，覆盖了 `react` 的结果。补一行代码修好它：
```js
watch(q, async (query, _, /* ? */) => {
  const ctrl = new AbortController();
  /* 在这里注册清理 */
  const r = await fetch(`/api/s?q=${query}`, { signal: ctrl.signal });
});
```
> (呼应 vue-watch 第四节)

**7.** 想初始化时就按当前值取一次数据，watch 缺了哪个选项？
```js
watch(id, (v) => fetchUser(v));   // 首次不触发
```

**8.** 这段代码为什么内存/依赖异常？侦听器不会自动停吗？
```js
onMounted(async () => {
  const res = await api();          // 异步回来后
  watch(res.ref, cb);               // ← 在 setup 异步作用域外创建
});
```
> 要怎么正确清理？（呼应 vue-watch interview 第 8 题）

**9.** 一个大表格数据（2 万行）用 `ref([])` 存，滚动/渲染卡顿。换成什么？改了内部一行数据后如何让它更新？
>（呼应 vue-reactivity-theory 第六节）

**10.** 判断对错并说明：`reactive` 对象整体重新赋值 `state = { ...newObj }` 仍能保持响应。若错，正确重置写法是什么？（呼应 vue-reactivity 第二节）

---

## 二、手写编程题（5 题）

**11.** 用 `ref` + `computed` 写一个"温度换算"：输入摄氏 `c`，派生 `f = c*9/5+32`；再给 `f` 加一个可写的 `computed`（get/set），改华氏能反算摄氏。（呼应 vue-reactivity 第四节、reactivity-theory 第四节）

**12.** 把下面 reactive 状态改造为**可安全解构**的 composable 返回值：用 `toRefs` 暴露 `{ x, y }`，确保在模板里解构后仍响应。（呼应 vue-reactivity-theory 第六节 interview 第 11 题）

**13.** 用 `watch` + `onCleanup` + `AbortController` 实现"防抖搜索 + 取消上一条请求"，并在结果旁展示"加载中/成功/已取消"三态（错误用 `onError` 或 try/catch）。（呼应 vue-watch 第四节、node-async-errors）

**14.** 手写一个极简响应式（不用 Vue）：`reactive(obj)` + `effect(fn)`，要求 `effect` 内读属性时收集依赖、`set` 时重跑 effect。允许只支持一层属性。（呼应 vue-reactivity-theory 第二、三节）

**15.** 用 `customRef` 实现一个"写入后 500ms 才生效"的防抖 ref，并在组件里绑定到输入框的 `v-model`。（呼应 vue-reactivity-theory 第六节）

---

## 三、场景题（1 题）

**16.** 你要做一个"商品列表 + 实时筛选 + 排序 + 分页"页面，商品数据 5000 条、来自接口、基本只读、偶尔局部更新。请给出状态组织方案并说明理由：
- (a) 哪些用 `ref`、哪些用 `reactive`、哪个该用 `shallowRef`？（呼应 vue-reactivity、reactivity-theory 第六节）
- (b) "筛选结果""当前页""总数"分别该用 computed 还是 watch 手动维护？为什么？（呼应 vue-watch interview 第 2 题）
- (c) 筛选关键词变化触发请求，如何避免竞态与频繁请求？（呼应 vue-watch 第四节）
- (d) 用户手动改了某商品的一个字段后，用了 shallowRef 的列表如何正确刷新？（呼应 vue-reactivity-theory 第六节）

---

## 四、简答题（3 题）

**17.** 说清 `ref` 与 `reactive` 的区别：`.value` 心智、模板中自动解包、为什么 reactive 解构会丢响应。（呼应 vue-reactivity 第一、二节）

**18.** "能用 computed 就别用 watch 手动同步"是什么意思？给一个反例并改成 computed。（呼应 vue-watch interview 第 2 题）

**19.** 用你自己的话描述 Vue 3 依赖收集：track/trigger 在什么时机发生、`targetMap` 三层结构、为什么外层 WeakMap、为什么同一 tick 只渲染一次。（呼应 vue-reactivity-theory 第三、五节）

---

## 五、挑战题 🏆

**20.** 🏆 给第 14 题的迷你响应式补齐三块能力，并写一段断言验证：
- 加 `computed`：惰性 + 缓存（依赖不变时 getter 不重复执行，用计数器断言执行次数）；
- 加 `scheduler`：trigger 时不立即 run，把 effect 入队，微任务里批量去重 flush（断言"连续 set 三次只跑一次"，呼应 vue-reactivity-theory 第五节、node-event-loop）；
- 加 effect cleanup：`flag.value ? a.x : b.x` 切换分支后，旧分支属性变化不再触发该 effect（呼应 reactivity-theory interview 第 7 题）。
