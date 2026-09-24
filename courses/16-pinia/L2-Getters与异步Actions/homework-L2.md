# L2 作业：Getters 与异步 Actions

## 一、知识回顾

1. Pinia computed getter 的求值策略是什么？和 Zustand selector 有何不同？
2. 带参数 getter 为什么用"computed 返回函数"而不是"直接传参"？
3. 为什么不能在 getter 里调用 useOtherStore()？
4. async action 中竞态问题用 AbortController 解决的原理？
5. 乐观更新的三步核心是什么？

## 二、代码实操

### 练习 A：带参 getter + 筛选列表

```ts
// stores/product.ts
// state: products (ref<Product[]>), category (ref<string>)
// getter: filtered (computed 按 category 筛选)
// 带参 getter: searchByPrice (computed 返回函数 (min,max)=>Product[])
```

### 练习 B：Async Action + 竞态处理

```ts
// 在 product store 里加 async fetchProducts(keyword: string)
// 要求：
// - 维护 loading/error ref
// - 用 AbortController 取消旧请求
// - 用请求序号双保险
```

### 练习 C：乐观更新完整实现

```ts
// stores/todo.ts
// async function toggleDone(id):
//   1. 深拷贝受影响 item 做快照
//   2. 乐观改 done
//   3. try: await api.toggle(id)
//   4. catch: 恢复快照 + throw
// 注册全局 errorPlugin 捕获 onError 弹 toast
```

## 三、思考题

1. 如果 getter 链过长导致性能瓶颈，你会怎么重构？（提示：合并/移到 action）
2. useFetch 的数据如果确实需要跨组件共享，你会怎么设计？（提示：Nuxt useState vs Pinia）
3. 乐观更新 + 离线队列 + 网络恢复重放，三者如何衔接？画出状态机。

## 四、延伸阅读

- Pinia Getters 文档：https://pinia.vuejs.org/core-concepts/getters.html
- AbortController 规范：https://developer.mozilla.org/en-US/docs/Web/API/AbortController
- TanStack Query 乐观更新模式：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
- Pinia $onAction 插件 API：https://pinia.vuejs.org/core-concepts/actions.html#partial-middleware

## 五、自查清单

| 检查项 | 通过标准 |
| --- | --- |
| 带参 getter 可调用 | 组件里 `store.searchByPrice.value(10,100)` 返回筛选数组 |
| 竞态处理有效 | DevTools Network 中快速切换关键词，只有最后一次结果留存在 UI |
| 乐观更新回滚 | 断网后点 toggle → UI 立即变 → 5s 后回滚 + toast "失败" |
| 全局错误插件 | 所有 action 抛错自动弹 toast，无需组件级 try/catch |
| loading 状态正确 | 并发多请求时 loading 不闪烁（计数器方案） |
