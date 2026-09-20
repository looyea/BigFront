# 面试题 · React 生态与工程

1. **受控组件与非受控组件的差别？**
   - 受控：value 走 state，React 掌握真值源。
   - 非受控：ref 读 DOM，浏览器掌握真值源。
   表单验证严 → 受控；纯输入框性能/富文本 → 非受控更简单。

2. **Context 的性能问题？**
   任何 Provider value 变化都会让**所有消费组件**重渲。缓解：拆分多个 Context、value 用 useMemo、下沉到叶子或使用 Zustand/Jotai 这类 atom 库。

3. **Redux Toolkit 相比传统 Redux 好在哪？**
   createSlice 自动生成 action creators + reducer； immer 让你写「可变」代码；内置 configureStore 免去中间件模板；重 boilerplate 大幅减少。

4. **Zustand vs Jotai vs Recoil 你会怎么推荐？**
   - Zustand：小而全、外部可 store.getState()、心智接近 Vue。
   - Jotai：原子化、天然依赖派生、细粒度重渲染最好。
   - Recoil（Meta）：功能强但维护热度下滑。
   新项目一般 Zustand / Jotai。

5. **React Query（TanStack Query）解决什么？**
   服务端状态管理：缓存、去重、失效重取、分页、乐观更新、后台刷新。把「异步数据」从全局 store 里解耦出来。

6. **Suspense 和 lazy 的使用？**
   ```jsx
   const Heavy = React.lazy(() => import('./Heavy'));
   <Suspense fallback={<Spinner/>}><Heavy/></Suspense>
   ```
   代码分割 + loading 边界；React 19 起数据获取也能配合 use() 挂 Suspense。

7. **Next.js 与纯 React SPA 的取舍？**
   - SEO / 首屏 / 边缘渲染 → Next；
   - 后台管理/内网系统/纯交互 SPA → Vite + React Router 更轻。

8. **性能优化你怎么讲？**
   React DevTools Profiler → 定位重渲染源 → memo/拆分 state/lazy 路由分割/virtual list → 减少不必要 reflow → 关键路径的 Web Vitals 监控。
