# 面试题：Async Actions（pinia-async）

### 1. (概念类) Pinia async action 与 Redux thunk 的关系与区别？
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#async-actions

两者都封装异步逻辑。区别：Redux 需要 `createAsyncThunk` 注册类型、`dispatch(thunk())` 间接调用、extraReducers 响应 pending/fulfilled/rejected。Pinia 直接 `async function`——await 后改 state，组件 `await store.myAction()` 即可。无额外概念层。

### 2. (实战类) 如何处理多个并行请求的 loading 状态？
**来源**：https://github.com/vuejs/pinia/discussions/1890

用计数器：`const pendingCount = ref(0)`；每次请求 ++，完成 --；`const isLoading = computed(() => pendingCount.value > 0)`。或用 `Promise.allSettled` 整体 await 后统一关 loading。

### 3. (坑类) 竞态问题的典型表现是什么？怎么排查？
**来源**：https://stackoverflow.com/questions/73020725/pinia-async-action-race-condition

表现：快速切换 tab/搜索关键词时，列表内容闪烁回旧数据。排查：Network 面板看请求顺序与响应到达顺序不一致。修法：AbortController cancel / reqId 比对丢弃过时响应 / debounce 减少请求频率。

### 4. (对比类) Nuxt useFetch 和 Pinia async action 怎么选？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#fetching-data-in-a-store

useFetch：页面级首屏、SSR 需要等待完成才能渲染 HTML 的场景。Pinia action：客户端交互触发、不需要 SSR、结果跨多组件共享。两者不混用——把 useFetch 结果塞进 store 是反模式（双重水合）。

### 5. (设计类) 服务端状态该放 Pinia 还是 TanStack Query / @pinia/colada？
**来源**：https://tkdodo.eu/blog/putting-server-state-and-client-state-sides

服务端状态（从 API 获取、会过期、多用户共享）→ TanStack Query/colada（缓存+失效+重新获取）。客户端状态（UI 偏好、表单草稿、全局配置）→ Pinia。混在一起是"一切放 store"的反模式根因。

### 6. (实战类) action 里如何取消正在进行的请求（组件卸载时）？
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#stopping-a-running-action

在组件里 `onUnmounted(() => controller.abort())`——controller 从 store 暴露或用 provide/inject。也可 action 返回一个 cancel 函数。注意：Pinia 5.x 不内置取消——开发者自行管理 AbortController。

### 7. (TS类) async action 的返回类型怎么推断？
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#async-actions

`async function fetchUser(): Promise<User>` → `return userInfo.value` → 调用者 `const user = await store.fetchUser()` 类型为 `User`。如果 action 不 return 则默认 `Promise<void>`。

### 8. (错误处理类) action 抛出的错误怎么在组件里捕获？
**来源**：https://pinia.vuejs.org/cookbook/plugins.html#intercepting-actions

`try { await store.action() } catch(e) { ... }`。或用 `$onAction` 插件的 onError 全局捕获。Vue 3.4+ 的 `onErrorCaptured` 也能捕获 async action（需 action 是组件 setup 调用链触发）。

### 9. (性能类) 大量并发请求（100个）在 action 里怎么处理？
**来源**：https://github.com/vuejs/pinia/discussions/1901

用并发限制库（p-limit）或手写队列——同时最多 N 个 in-flight：`const limit = pLimit(5); await Promise.all(urls.map(u => limit(() => fetch(u))))`。避免打爆服务端和浏览器连接池。

### 10. (调试类) Pinia DevTools 怎么追踪 async action？
**来源**：https://pinia.vuejs.org/introduction.html#devtools

Vue DevTools Pinia 面板 → Actions 列表显示 async action 名 → 展开后有调用参数 → action 完成后 state 变化高亮。可设断点 `debugger` 在 action 内。Network 面板看请求时序。

### 11. (模式类) "乐观更新 + async action + 回滚" 的完整模板？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html#optimistic-navigation

```ts
async function like(id: string) {
  const snapshot = deepClone(todos.value);
  todos.value.find(t => t.id === id)!.liked = true;
  try { await api.like(id) }
  catch { todos.value = snapshot; throw new Error('failed') }
}
```

### 12. (SSR类) SSR 中 await action 的时序？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html#fetching-data-in-a-store

Nuxt 页面 setup 里 `await store.fetchData()` 是顶层 await——Nuxt 会等它 resolve 后才渲染。action 内部的 fetch 在服务端执行一次→数据注入 state→序列化进 HTML→客户端水合不再请求。

### 13. (对比类) Pinia 的 async action 和 SolidJS 的 createAsync 有什么区别？
**来源**：https://docs.solidjs.com/reference/components-primitives/createasync

Solid createAsync 返回 resource 对象——自带 loading/error/data 三态 + 自动追踪依赖 + 支持 Suspense。Pinia 的 async action 是手动管 loading/error ref——更灵活但更啰嗦。

### 14. (实战类) action 里 catch 后不 rethrow 和 rethrow 的区别是什么？
**来源**：https://github.com/vuejs/pinia/discussions/1522

不 rethrow：错误被吞——全局 onError 不触发、组件 try/catch 进不到 catch 分支。rethrow：错误冒泡——让 $onAction 插件或调用方决定处理方式。最佳实践：action 里 catch 只做 log，rethrow 让全局统一处理。

### 15. (架构类) 如何设计一个"API 层 → Store 层 → 组件层"的三层架构？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

API 层（`api/users.ts`）：纯 fetch/axios 封装，不含业务逻辑。Store 层（`stores/user.ts`）：async action 调 API 层、管 state/loading/error、业务规则。组件层：useXxxStore + 展示。组件不直接 import api 函数。
