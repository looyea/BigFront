# Pinia 入门：store、state、getters、actions

> 目标：当"跨兄弟/跨页面共享的业务状态"多起来，props/inject 会力不从心。**Pinia** 是 Vue 3 官方推荐的状态库——每个 store 是一个**可组合的、类型友好的、去掉了 mutations 的**响应式单例。本课掌握 **`defineStore`（选项式 vs setup 式）**、**store 的 state/getters/actions**、**`storeToRefs` 保持解构响应**、**action 里同步/异步取数**、**模块化拆分**，以及"和 composables 的分工"。（呼应 vue-reactivity、vue-composables、09-express 前端对接）

---

## 一、安装与一个最简 store

```bash
npm i pinia
```
```js
// main.js
import { createPinia } from 'pinia';
app.use(createPinia());
```

Pinia 提供**两种写法**，选其一：

```js
// A) 选项式（options）
export const useCounter = defineStore('counter', {
  state: () => ({ count: 0 }),
  getters: { double: (s) => s.count * 2 },
  actions: { inc() { this.count++; } },
});

// B) setup 式（更像组合式函数，推荐复杂场景）
export const useCounter = defineStore('counter', () => {
  const count = ref(0);
  const double = computed(() => count.value * 2);
  function inc() { count.value++; }
  return { count, double, inc };
});
```
setup 式能用 `ref`/`computed`/`watch`，组合与类型推导更自然（呼应 vue-composables）。

---

## 二、在组件里用 & storeToRefs 的坑 ⭐

```vue
<script setup>
import { storeToRefs } from 'pinia';
import { useCounter } from '@/stores/counter';
const counter = useCounter();

counter.inc();                 // 直接用，action 不丢 this
console.log(counter.count);    // ✅ 响应式读取
</script>
<template>{{ counter.count }} / {{ counter.double }}</template>
```

**要解构时必须用 `storeToRefs`**：
```js
const { count, double } = storeToRefs(counter);  // ✅ 仍是 ref、保持响应
const { count } = counter;                        // ❌ 拿到的是断开的普通值
const { inc } = counter;                          // ✅ action 可安全解构（自动绑 this）
```
store 本质是 reactive 对象，直接解构 state/getter 会丢响应（与 vue-reactivity "reactive 解构丢响应"同一个坑），而 **action 解构安全**（呼应 vue-reactivity-theory 第六节 toRefs）。

---

## 三、getters：store 里的 computed

```js
getters: {
  double: (s) => s.count * 2,
  byStatus: (s) => (status) => s.todos.filter(t => t.status === status), // 返回函数
  named() { return `${this.count} items`; },   // 用 this 访问其它 getter/state
}
```
- 默认**基于 state 缓存**；入参形式（返回函数）不缓存但灵活；
- 用 `this`（选项式）可组合其它 state/getter。setup 式里直接写 `computed` 即可。

---

## 四、actions：同步/异步都在这里（没有 mutations）

Vuex 的 `mutation`（同步改 state）/`action`（异步）二分被 Pinia 合并成**只有 actions**——直接 `this.xxx = …` 改 state 即可，同步异步都写在一个 action：

```js
actions: {
  async fetchTodos() {
    this.loading = true;
    try {
      const res = await fetch('/api/todos');           // 对接 09-express 后端
      this.todos = await res.json();
    } catch (e) { this.error = e.message; }
    finally { this.loading = false; }
  },
  addTodo(text) { this.todos.push({ text, done: false }); },
}
```
组件只调 `store.fetchTodos()`，不关心内部是同步还是异步——这让 loading/error 等**请求状态**也集中管理（呼应 vue-watch 竞态、vue-composables `useFetch`）。

---

## 五、模块化与"一个 store 一件事"

按**领域/功能**拆多个 store：`useUserStore`、`useCartStore`、`useUIStore`，别造"全局大 store"。store 之间可互相调用组合：
```js
export const useCart = defineStore('cart', {
  actions: { async checkout() {
    const user = useUser();                 // 跨 store
    if (!user.token) return this.$patch({ error: '未登录' });
    await post('/api/orders', { items: this.items, uid: user.id });
  }},
});
```
每个 store 有唯一 `id`（第一个参数），供 devtools 与 SSR 水合识别（呼应 vue-project-architecture 目录组织）。

---

## 六、Pinia vs Composables：什么时候用哪个

| 需求 | 选择 |
|---|---|
| 逻辑复用、但状态是**组件局部**的（每组件一份） | **composable**（呼应 vue-composables 第四节） |
| **跨组件/页面共享同一份**状态 + 集中变更 | **Pinia store**（单例） |
| 只在**一棵子树**内共享、随树销毁 | **provide/inject**（呼应 vue-provide-inject） |

别把"只服务一个组件"的东西塞进 store（污染全局、增加心智）；也别用一堆全局单例 composable 假装 store（丢掉 devtools/SSR 水合）。

---

## 七、自检清单

- [ ] 选项式与 setup 式 store 各长什么样？复杂场景推荐哪个？
- [ ] 为什么解构 state/getter 会丢响应、而解构 action 不会？`storeToRefs` 何时用？
- [ ] Pinia 为什么"没有 mutations"？异步取数写在哪？
- [ ] store 之间怎么组合？`id` 有什么用？
- [ ] 什么该进 store、什么该留在组件/composable？

---

## 🚀 部署预告

- store 就是"可跨组件复用的 reactive + computed + 函数"，完全建立在 **L1 响应式** 与 **vue-composables** 之上；
- action 里的 `fetch('/api/...')` 对接的是 **09-express** 写的后端；loading/error/竞态处理回看 **vue-watch**；
- 下一关 **vue-pinia-advanced**：`$subscribe`/`$patch`/`$reset`、持久化到 localStorage、写插件、SSR 注意事项与 devtools。
