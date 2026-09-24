# 面试题：状态变更与订阅（pinia-mutations）

### 1. (概念类) Pinia 为什么去掉了 mutations 层？
**来源**：https://pinia.vuejs.org/introduction.html#mutations

Vue 3 的 Proxy 响应式在赋值时自动触发更新——不再需要"显式通知 Vue 改了什么"（Vuex 的 mutation 本质是 Vue 2 Observable 时代的产物）。Pinia 直接赋值即可、$patch 做批量、action 做封装，三层满足所有场景。去掉 mutation 让样板代码减少了约 40%。

### 2. (实战类) $patch 的对象形式和函数形式有什么区别？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#patching-a-store

对象形式 `$patch({ count: 1, name: 'x' })` 做浅合并（只赋值顶层 key）。函数形式 `$patch(state => { state.items.push(x) })` 能调数组方法、做条件逻辑。两者都触发一次 DevTools 记录。需要深层修改或调用 push/splice 时用函数形式。

### 3. (对比类) $subscribe 和 Vue 的 watch 有什么区别？
**来源**：https://pinia.vuejs.org/core-concepts/#subscribing-to-a-store

$subscribe 只在 store state 变化时触发（mutation.type 标记来源），不需要指定字段（deep 自动生效）。watch 可监听任意响应式源、需手动 deep。$subscribe 适合"持久化/日志"（不关心哪个字段变了），watch 适合"某个具体派生值变了就跑副作用"。

### 4. (原理类) 直接赋值 store.count++ 在 Setup Store 底层发生了什么？
**来源**：https://pinia.vuejs.org/core-concepts/state.html

Pinia 内部把 setup 返回的 ref 收集后，用 `reactive()` 包一层——`store.count++` 实际上是 `reactiveProxy.count++`。Proxy 拦截 set → 通知依赖该属性的 effect → Vue 调度渲染。与组件里操作 reactive 对象完全一致。

### 5. (实战类) $onAction 能做什么？给出一个埋点例子。
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#partial-middleware

```ts
store.$onAction(({ name, args, after, onError }) => {
  analytics.track(`store-action-${name}`, { args });
  after(result => analytics.track(`${name}-success`, { result }));
  onError(err => analytics.track(`${name}-error`, { error: err.message }));
});
```
类似 Express middleware 的前置/后置/错误三切面。

### 6. (规范类) 什么时候用 $patch 而不是 action？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

$patch 适合"纯赋值回填"（如表单 reset、批量导入数据）——无业务逻辑、无 async。action 适合包含条件判断、HTTP 调用、多字段联动、日志的业务操作。DevTools 里 action 显示函数名+参数，$patch 只显示变更对象——可读性需求也是选择依据。

### 7. (坑类) 组件卸载后 $subscribe 还在跑怎么排查？
**来源**：https://github.com/vuejs/pinia/discussions/1276

如果用了 `detached: true`，$subscribe 脱离组件 scope——需手动 unsub。排查方法：在 subscribe 回调里 `console.trace()` 打印调用栈找到注册位置。正确做法：onUnmounted 里 unsub 或用 effectScope 统一管理。

### 8. (SSR类) $subscribe 在 SSR 阶段会被触发吗？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

如果服务端渲染时 action 改了 state（如 fetch 数据写入 store），$subscribe 确实会在服务端触发。此时 localStorage 不存在——persist 插件的 subscribe 回调必须用 `import.meta.client` 守卫，否则 SSR 报错。

### 9. (性能类) 频繁 $patch 会有性能问题吗？
**来源**：https://vuejs.org/guide/essentials/reactivity-fundamentals.html

Vue 3 同一 tick 内多次赋值只触发一次渲染（scheduler 队列去重）。$patch 批量改多个字段也是单次通知。但如果 $patch 函数里做了循环 push 10000 条，每次 push 都触发 Proxy set——推荐一次性赋值 `$patch({ items: newArr })`。

### 10. (设计类) $subscribe 和 $onAction 能组合做撤销/重做吗？
**来源**：https://pinia.vuejs.org/cookbook/plugins.html#store-middleware-return-value

可以。$onAction 的 after 里记录 $state 快照到 undo 栈；需要撤销时 `store.$patch(undoStack.pop())`。$subscribe 确保快照只记录"最终态"而非每个中间态。完整 undo/redo 需要配 timestamp + 分支策略。

### 11. (TS类) $patch 对象形式能改 ref 的 .value 吗？类型怎么推断？
**来源**：https://pinia.vuejs.org/core-concepts/state.html#typescript

不能写 `{ count: { value: 1 } }`——$patch 作用在 reactive 包装后的 store 上，count 已经是 number 类型（.value 被拆箱）。正确：`$patch({ count: 1 })`，TS 按 store 返回类型检查——传 string 会报错。

### 12. (插件类) 如何用 $subscribe 实现自动持久化插件？
**来源**：https://prazdevs.github.io/pinia-plugin-persistedstate/guide/

```ts
export function persistPlugin({ options, store }) {
  if (options.persist) {
    const key = options.persist.key ?? store.$id;
    const saved = localStorage.getItem(key);
    if (saved) store.$patch(JSON.parse(saved));
    store.$subscribe((_, state) => {
      localStorage.setItem(key, JSON.stringify(state));
    }, { detached: true });
  }
}
```

### 13. (对比类) $subscribe 和 Zustand 的 subscribe 有什么异同？
**来源**：https://github.com/pmndrs/zustand#read-outside-of-react-without-hooks

两者都是"store 外订阅 state 变化"。Zustand subscribe 回调签名 `(state, prevState) => void`，不区分 mutation 来源；Pinia $subscribe 额外提供 mutation.type/storeId/events 元信息。Zustand 不绑定 scope——永远手动 unsub；Pinia 默认跟随组件 scope。

### 14. (实战类) 如何在测试中验证 $patch 确实只触发一次通知？
**来源**：https://pinia.vuejs.org/cookbook/unit-testing.html

用 vi.fn() mock 一个 $subscribe 回调，$patch 多字段后 `await nextTick()`，断言 `cb.mock.calls.length === 1`。对比直接连续赋值（两次）：`store.a=1; store.b=2` 在同一个微任务里 Vue batching 也只一次——但 DevTools mutation 记录是两条。

### 15. (综合类) Pinia 的变更追踪机制与 Redux 的 dispatch→reducer 模式的核心差异是什么？
**来源**：https://pinia.vuejs.org/introduction.html

Redux：action dispatch → reducer 纯函数返回新 state → subscriber 收到新引用比较。**不可变+快照比较**是核心。Pinia：直接 mutate reactive Proxy → Vue scheduler 收集脏依赖 → O(变化量) 精确更新。**可变+依赖追踪**是核心。不需要 reducer、不需要 selector 做引用相等比较。
