# 面试题：测试深化（za-testing-deep）

### 1. (设计类) 为什么 store 逻辑应优先于组件测？
**来源**：https://zustand.docs.pmnd.rs/limitations

store 是纯函数集合，脱离 React 快稳可测；组件测留给渲染/订阅联动。

### 2. (实战类) 工厂 + beforeEach 如何保证隔离？
**来源**：https://github.com/pmndrs/zustand/discussions

makeStore() 每用例新实例，或 reset 到 initialState，杜绝跨用例残留。

### 3. (实战类) 用 msw 测一个乐观更新失败回滚？
**来源**：https://mswjs.io/

mock patch 返回 500，调用 action 断言先乐观变更、catch 后恢复快照。

### 4. (坑类) 模块级 create 单例在测试里的问题？
**来源**：https://github.com/pmndrs/zustand/discussions

所有用例共享同一份 state，顺序依赖、脏数据、flaky。

### 5. (对比类) renderHook 测 selector 与纯 store 测差异？
**来源**：https://testing-library.com/docs/react-testing-library/api/#renderhook

纯测只验证状态逻辑；renderHook 验证订阅是否按预期重渲。

### 6. (实战类) persist 测试怎么避免真写 localStorage？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

传自定义 storage（内存 Map 实现 getItem/setItem）注入。

### 7. (设计类) 测 async 竞态（后发先至）要点？
**来源**：https://mswjs.io/

用 msw 控制响应延迟顺序，断言最终 state 是最新请求结果（呼应 za-transition）。

### 8. (综合类) 给 cartSlice 写一条纯测。
**来源**：https://zustand.docs.pmnd.rs/limitations

const s=makeCart(); s.getState().add(item); expect(s.getState().items).toHaveLength(1)。

### 9. (坑类) 测 SSR 水合逻辑要注意什么？
**来源**：https://nextjs.org/docs/app

模拟无 window 环境、验证 skipHydration 下初始值与 rehydrate 后值（呼应 za-hydration）。

### 10. (对比类) 单测 selector 与快照测试谁更合适？
**来源**：https://vitest.dev/guide/

selector 断言精确值更稳；快照易脆、用于渲染结构兜底。

### 11. (实战类) 如何测跨 slice 调用？
**来源**：https://github.com/pmndrs/zustand/discussions

组合完整 store，调 A action 断言 B slice 结果，验证 get() 协作（呼应 za-slices）。

### 12. (设计类) 测试该测实现还是行为？
**来源**：https://testing-library.com/docs/guides/about-guides

测对外行为（输入 action→输出 state/渲染），别锁死内部字段结构。

### 13. (综合类) 中间件 undo 如何测？
**来源**：https://zustand.docs.pmnd.rs/integrations/middleware

连续 set 后 store.api.undo()，断言回到上一个快照（呼应 za-middleware-chain）。

### 14. (趋势类) Vitest 相比 Jest 在 Zustand 测试的优势？
**来源**：https://vitest.dev/

与 Vite 共享配置、更快 ESM、内置 jsdom/coverage，体验更统一（呼应 vite-vitest）。

### 15. (综合类) 制定 store 测试覆盖率策略。
**来源**：https://zustand.docs.pmnd.rs/limitations

每个 action 正常+异常路径必测，selector 断言引用稳定，异步测竞态，组件层最小必要。
