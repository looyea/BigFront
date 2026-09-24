# 面试题：乐观更新与错误回滚（pinia-optimistic）

### 1. (概念类) 什么是乐观更新？适合什么场景？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html#optimistic-navigation

乐观更新：假设操作一定成功，先改本地 UI，后台异步提交——失败再回滚。适合：① 幂等或可逆操作（点赞、收藏、拖拽排序）；② 网络延迟明显（移动端）；③ 用户期望"即时反馈"。不适合：转账、删除不可逆资源。

### 2. (实战类) Pinia 里回滚的正确姿势是什么？
**来源**：https://github.com/vuejs/pinia/discussions/1622

操作前 `const snap = JSON.parse(JSON.stringify(store.$state))`（深拷贝）；失败时 `store.$patch(snap)`。Setup Store 推荐只拷贝受影响的字段（如 `posts.value[idx]` 单条）避免全量深拷贝性能问题。

### 3. (坑类) 用引用做快照为什么不能正确回滚？
**来源**：https://vuejs.org/guide/extras/reactivity-in-depth.html#reactive-objects

`const snap = { items: store.items }` 里 `snap.items` 和 `store.items` 指向同一个 Proxy——后续 store.items 被改了，snap.items 也变。必须深拷贝（JSON.parse/stringify 或 structuredClone）。

### 4. (架构类) 全局错误捕获：$onAction 插件 vs Vue errorCaptured？
**来源**：https://pinia.vuejs.org/core-concepts/actions.html#partial-middleware

$onAction 插件：拦截所有 store action 抛出的错误——适合"log + toast + rollback"统一处理。errorCaptured：Vue 组件级生命周期——只能捕获组件 setup/render/生命周期里的错误。action 由组件触发时两者都能捕获，但 $onAction 更集中。

### 5. (设计类) 乐观更新后如何避免 UI 闪烁（回滚→旧值→再重试成功→新值）？
**来源**：https://tkdodo.eu/blog/keeping-websockets-http-requests-in-sync-with-react-query

重试期间保持乐观态不变（不回滚），只在最终失败（所有重试耗尽）才回滚。UI 上可加一个小的 "pending" 标记（灰色勾选）表示"尚未确认"。TanStack Query 的 optimisticUpdate 内置了此模式。

### 6. (测试类) 怎么测乐观更新的回滚路径？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#testing-actions

mock API 返回 reject → 调 action → await → 断言 state 恢复。示例：`vi.mocked(api.like).mockRejectedValueOnce(new Error('fail'))` → 测完后 `expect(store.posts[0].liked).toBe(false)`。

### 7. (对比类) Pinia 乐观更新和 Zustand 的 transient update 有什么异同？
**来源**：https://github.com/pmndrs/zustand#subscribe-with-selector

相同：都是"先改本地再异步确认"。不同：Pinia 改 state 立即触发所有订阅者重渲染（可回滚）；Zustand transient（subscribe outside React）用于"不触发渲染的后台更新"——场景是 WebSocket 心跳、日志等。

### 8. (实战类) 离线队列与乐观更新怎么组合？
**来源**：https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API

乐观改 state → API 调用失败（网络错误） → 把操作推入 `queue: ref<Op[]>` → UI 上标注"待同步" → online 事件/后台同步触发批量 replay。Pinia $subscribe 可持久化队列到 IndexedDB。

### 9. (规范类) 乐观操作后用户刷新页面，如何保证状态一致？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

① 乐观改后立刻 $subscribe 存 localStorage/IndexedDB；② 请求成功后服务端返回 canonical 数据覆盖本地；③ 页面加载时先拉最新数据再水合。避免"本地乐观态与远程永久不一致"。

### 10. (性能类) 大量条目（10000 条）的乐观更新，快照该怎么做？
**来源**：https://github.com/vuejs/pinia/discussions/1940

只拷贝受影响条目：`const snap = deepClone(items.value[idx])`——不是全量 `store.$state`。如果只改一个 boolean：`const oldVal = item.liked` → 回滚时 `item.liked = oldVal`。

### 11. (原理类) Pinia 里 `store.$state` 和直接 ref 是什么关系？
**来源**：https://pinia.vuejs.org/core-concepts/state.html

`store.$state` 是 Pinia 内部用 `reactive()` 包装的 ref 集合——修改 `store.$state` 与修改各独立 ref 等价（同一 Proxy 目标）。`$patch` 对 `$state` 操作，`$subscribe` 监听 `$state`。

### 12. (综合类) 请手写一个带乐观+回滚+重试的完整 Pinia action。
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html#optimistic-navigation

```ts
async function updateItem(id: string, data: Partial<Item>) {
  const idx = items.value.findIndex(i => i.id === id);
  if (idx === -1) return;
  const old = { ...items.value[idx] };
  Object.assign(items.value[idx], data);
  for (let i = 0; i < 3; i++) {
    try { await api.patch(id, data); return; }
    catch (e) { if (i === 2) { Object.assign(items.value[idx], old); throw e; }
      await new Promise(r => setTimeout(r, 1000 * 2**i)); }
  }
}
```

### 13. (实战类) 多人协作时乐观更新如何与服务端冲突解决？
**来源**：https://martinfowler.com/articles/partial-update.html

乐观更新用版本号/ETag：请求头带 `If-Match: version`，服务端 409 Conflict 表示他人已修改。Store 里 catch 409 → 拉取最新 → 合并（CRDT/LWW）→ 更新本地。比盲目回滚更智能。

### 14. (对比类) Pinia 乐观更新与 TanStack Query 的 onMutate 有何不同？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates

TanStack Query onMutate 内置了「快照 + 回滚 + invalidate」三件套且与服务端缓存失效联动。Pinia 需手动写（深拷贝+catch恢复）。如果项目已有 TanStack/colada，用其乐观模式；纯 Pinia 则手写。

### 15. (设计类) 乐观更新的状态机怎么画？
**来源**：https://xstate.js.com/docs/examples/optimistic-ui

Idle → Optimistic(已改UI, 请求中) → 分支：Success(确认) / Retry(保持乐观+重发) / Failed(回滚→Idle)。Pinia 可用一个 `syncState: ref<'idle'|'pending'|'confirmed'|'error'>` 字段驱动 UI 标注（灰色勾/绿色勾/红色感叹号）。
