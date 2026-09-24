# 面试题：单元测试（pinia-testing）

### 1. (概念类) 为什么 Pinia store 的测试比 Vuex 简单很多？
**来源**：https://pinia.vuejs.org/cookbook/testing.html

Pinia store 是纯逻辑对象——setActivePinia(createPinia()) 后直接调用 action/getter。Vuex 需要 createLocalVue + 注入 store + 模拟 commit/dispatch 字符串。

### 2. (实战类) beforeEach 里为什么要 setActivePinia(createPinia())？
**来源**：https://pinia.vuejs.org/core-concepts/outside-components.html

每个测试用例需要干净的 store 状态。如果不重建，上一个用例的状态会污染下一个。

### 3. (实战类) 测 async action 时如何 mock HTTP？
**来源**：https://mswjs.io/docs/getting-started

方案一：vi.mock('./api') 替换整个模块。方案二：用 msw (Mock Service Worker) 拦截网络请求——更真实但更重。

### 4. (对比类) @pinia/testing 的 createTestingPinia 和直接 createPinia 有什么区别？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#stubbing-actions-and-getters-from-stores

createTestingPinia 自动 stub 所有 action（返回 undefined）——适合组件测试隔离 store。createPinia 保留真实 action——适合测 store 逻辑本身。

### 5. (坑类) 为什么测持久化插件需要注入 fake localStorage？
**来源**：https://github.com/vuejs/pinia/discussions/1750

Vitest 默认环境是 Node——无 localStorage。需要用 jsdom 环境或手动注入 mock。

### 6. (实战类) 测 $patch 后的 state 断言：需要 nextTick 吗？
**来源**：https://pinia.vuejs.org/cookbook/testing.html

$patch 同步改 state——不需要 nextTick 即可断言。nextTick 只在需要等待组件 DOM 更新时才需要。

### 7. (设计类) 测试策略：单元测 store 逻辑 + 集成测组件，各覆盖什么？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#单元测试

单元测 store：验证 action 改对 state、getter 算对派生、异常处理。集成测组件：验证模板渲染正确、交互触发正确 action。

### 8. (TS类) 测试里 store 的类型怎么保证？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#typescript

直接 useXxxStore() 后 TS 自动推断。vi.mocked() 注入的 mock 也保留类型。

### 9. (工具类) Vitest 里测异步 action 需要特殊配置吗？
**来源**：https://vitest.dev/guide/

不需要。async test 函数自然支持 await。vi.useFakeTimers() 可测 setTimeout 等待。

### 10. (实战类) 测跨 store 交互（A action 改 B state）怎么写？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#testing-plugins-and-actions

两个 store 都用真实实例：const a = useAStore(); const b = useBStore(); a.actionThatChangesB(); expect(b.count).toBe(newVal)。

### 11. (坑类) vi.mock 提升到文件顶部，但 store 里的 import 已经执行了怎么办？
**来源**：https://vitest.dev/guide/mocking.html#how-it-works

vi.mock 被 Vitest 提升到所有 import 之前执行——无论你写在哪里，mock 都生效。这是 Vitest 的特性。

### 12. (综合类) 如何组织一个 store 测试文件的结构？
**来源**：https://pinia.vuejs.org/cookbook/testing.html#示例

describe('StoreName') → beforeEach(setActivePinia) → describe('state') → describe('getters') → describe('actions') → describe('plugins') 分层。

### 13. (工具类) 测试中怎么获取当前 Pinia 实例？
**来源**：https://pinia.vuejs.org/api/functions/getActivePinia.html

getActivePinia() 返回当前激活的 pinia 实例。可用其 .state 查看所有 store 状态。

### 14. (性能类) 大型 store（50字段）的测试怎么组织？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

拆分多个小 store（每个 <10 字段）。如果不能拆，按功能 describe 分组测试。

### 15. (综合类) 给出一个完整的“测 async action + 错误处理”示例。
**来源**：https://pinia.vuejs.org/cookbook/testing.html#testing-actions

```ts
it('fetchUser error sets error state', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('fail'));
  const store = useUserStore();
  await store.fetchUser('1');
  expect(store.error).toBe('fail');
  expect(store.loading).toBe(false);
  expect(store.user).toBeNull();
});
```
