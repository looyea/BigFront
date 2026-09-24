# L1 作业：入门与核心

## 一、知识回顾

用简洁语言回答以下问题（每题 2-3 句）：

1. Vuex 的三大痛点是什么？Pinia 分别怎么解决？
2. Setup Store 中 ref/computed/function 分别对应 Vuex 的什么概念？
3. storeToRefs 的作用是什么？为什么不直接 toRefs？
4. $patch 对象形式和函数形式的区别？各适用什么场景？
5. $subscribe 和 $onAction 分别在什么时机触发？

## 二、代码实操

完成以下练习，在项目 `stores/` 目录下新建文件：

### 练习 A：Todo Store（Setup Store）

```ts
// stores/todo.ts
// 要求：
// - state: todos (ref<Todo[]>), filter (ref<'all'|'active'|'done'>)
// - getter: filteredTodos (computed 按 filter 筛选), remaining (computed 计数)
// - action: addTodo(text), toggleTodo(id), removeTodo(id), setFilter(f)
// - 未 return 的私有 ref: _nextId (自增 id)
```

### 练习 B：$patch 批量重置

```ts
// 在 Todo Store 里添加 resetAll() action
// 用 $patch 函数形式把 todos 清空、filter 回 'all'
// 确保 DevTools 只记录一条变更
```

### 练习 C：持久化 $subscribe

```ts
// 在组件的 onMounted 里 store.$subscribe((_, state) => {
//   localStorage.setItem('todos', JSON.stringify(state))
// })
// 验证：刷新页面后数据从 localStorage 回填
```

## 三、思考题

1. 为什么 Pinia 不需要 mutations 也能在 DevTools 里追踪变更？（提示：Proxy + $subscribe）
2. 如果团队规范要求"所有状态变更必须走 action"，用 Pinia 怎么实现约束？（提示：strict 模式 + lint）
3. Setup Store 中如果忘记 return 某个 ref，会出现什么症状？如何排查？

## 四、延伸阅读

- Pinia 官方文档 Getting Started：https://pinia.vuejs.org/getting-started.html
- Pinia vs Vuex 官方对比：https://pinia.vuejs.org/introduction.html#comparison-with-vuex-3-x-4-x
- storeToRefs 源码（仅 10 行）：https://github.com/vuejs/pinia/blob/v3/packages/pinia/src/storeToRefs.ts
- Vue 3 响应式原理（理解"为什么直接赋值就能触发更新"）：https://vuejs.org/guide/extras/reactivity-in-depth.html

## 五、自查清单

| 检查项 | 通过标准 |
| --- | --- |
| Todo Store 可运行 | `npm run dev` 后组件能增删改查 |
| storeToRefs 解构 | 组件里 `const { filteredTodos } = storeToRefs(store)` 不丢响应式 |
| $patch 一次记录 | DevTools Pinia 面板里 resetAll 只出现一条 |
| 持久化生效 | 刷新后 todos 从 localStorage 恢复 |
| 严格模式警告 | `createPinia({ strict: true })` 后组件直接赋值有 warn |
