# 面试题：Store 外部 API（za-store-api）

### 1. (原理类) 为什么 store 能脱离 React 使用？
**来源**：https://zustand.docs.pmnd.rs/getting-started/non-react-hooks-like-api

create 内部是 vanilla store（纯 JS 订阅模型），React hook 只是它的一层适配，getState/setState/subscribe 与 React 无关。

### 2. (实战类) axios 请求拦截注入 token 的完整写法？
**来源**：https://github.com/pmndrs/zustand/discussions

interceptors.request.use(c=>{c.headers.Authorization=`Bearer ${useAuthStore.getState().token}`;return c})，读瞬时值不订阅。

### 3. (性能类) 什么是 transient update，解决什么？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

对高频值用 subscribe 直接命令式更新 DOM/canvas，渲染层不订阅该字段，避免每帧 React 渲染。

### 4. (坑类) 忘记 unsub 会怎样？
**来源**：https://zustand.docs.pmnd.rs/reference/store-methods/subscribe

订阅泄漏：回调持续持有闭包，组件卸载后仍执行，可能操作已销毁 DOM 或内存增长。

### 5. (对比类) setState 直接写 vs 通过 action 写，取舍？
**来源**：https://zustand.docs.pmnd.rs/limits/known-limitations

业务写入应走 action 保证可追踪/复用；setState 直写用于测试注入、SSR 水合、跨 tab 同步等外部场景。

### 6. (实战类) 跨标签页同步 state 怎么做？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

监听 storage/BroadcastChannel 事件，收到后 setState 注入本 tab，配合 persist 的序列化。

### 7. (TS类) getState 返回类型如何保证？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

由 create<T> 的泛型决定，getState():T 完整推断所有字段与 action。

### 8. (原理类) 带 selector 的 subscribe 何时触发回调？
**来源**：https://zustand.docs.pmnd.rs/reference/store-methods/subscribe

store 每次变化都重算 selector，Object.is 判定选中值变了才回调（v4.3+ 选择器式订阅）。

### 9. (设计类) store API 与 action 的职责边界？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

action 封装业务语义写；getState/subscribe 用于读取与副作用观察，避免在组件里散落 setState。

### 10. (对比类) Zustand subscribe 与 Redux store.subscribe 差异？
**来源**：https://github.com/pmndrs/zustand/discussions

Zustand 支持 selector + listener 细粒度；Redux 只有全局 subscribe，需自己 selector 比较。

### 11. (坑类) 在 getState 里拿到的是不是最新值？并发场景有何注意？
**来源**：https://react.dev/reference/react/useSyncExternalStore

getState 返回调用瞬间最新值；但在一次渲染中应使用 useStore 订阅值以保证快照一致，避免 tearing。

### 12. (实战类) 如何在路由守卫（非组件）里判断权限？
**来源**：https://github.com/pmndrs/zustand/discussions

守卫回调 useAuthStore.getState().canAccess(route)，命中则放行否则重定向，全程不依赖 hook。

### 13. (性能类) transient 更新配合什么 API 做拖拽最优？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

pointermove 里 setState 高频值，subscribe 写 transform，配合 requestAnimationFrame 合帧。

### 14. (综合类) 写一段“外部订阅 count 变化打日志并可在卸载时清理”的代码。
**来源**：https://zustand.docs.pmnd.rs/reference/store-methods/subscribe

const off=useStore.subscribe(s=>s.count,(c,p)=>log(p,c)); return ()=>off();

### 15. (综合类) 给团队解释何时用 getState、何时用 hook？
**来源**：https://zustand.docs.pmnd.rs/getting-started/non-react-hooks-like-api

需要触发/跟随渲染→用 hook+selector；一次性命令式读或副作用→getState/subscribe；二者不可混用规则。
