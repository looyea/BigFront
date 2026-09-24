# 面试题：Write-only Atom（jo-write-only）

### 1. (设计类) write-only atom 解决了什么？
**来源**：https://jotai.org/docs/primitives

把「跨多原子的变更 + 副作用」封装成一个可复用 action 原子，状态与行为分离。

### 2. (实战类) 用 write atom 做 addTodo？
**来源**：https://jotai.org/docs/advanced/atom-patterns

addTodoAtom=atom(null,(get,set,text)=>set(todos,[...get(todos),{id,text}])); 组件 useSetAtom 触发。

### 3. (对比类) 与 Redux thunk/action 的对应？
**来源**：https://redux-toolkit.js.org/

write atom 类似 thunk：接收 dispatch(=set)、可读 state(=get)，但更轻无 type。

### 4. (原理类) write 里 get 与 set 的边界？
**来源**：https://jotai.org/docs/core/atom

get 只读其它 atom 当前值，set 写目标 atom，二者组合实现原子化变更。

### 5. (性能类) 一个 write 写 5 个 atom 会渲染几次？
**来源**：https://react.dev/reference/react-dom/client/createRoot

同次事件内被 React 批处理，相关组件一次渲染（呼应 za-transition）。

### 6. (TS类) write 的第三个参数类型怎么来？
**来源**：https://jotai.org/docs/typescript/typescript

由 set(atom, value) 的调用参数推断 write 的 arg 类型。

### 7. (坑类) 在只读派生上 set 会怎样？
**来源**：https://jotai.org/docs/core/atom

无 write 函数，运行期/类型报错，应改源 atom 或提供可写派生。

### 8. (综合类) 设计一个含校验的登录 write atom。
**来源**：https://jotai.org/docs/primitives

login=atom(null,async(get,set,c)=>{if(!c.pwd)return set(err,"required"); await api(c); set(token,...)})。

### 9. (对比类) Jotai action 与 Zustand action 谁的测试更轻？
**来源**：https://jotai.org/docs/

都轻；Jotai 可用独立 store.get/set 直测 write atom 纯函数（呼应 jo-perf-test）。

### 10. (实战类) 如何编排异步多步 action？
**来源**：https://jotai.org/docs/advanced/async-atoms

write 里顺序 await 并分步 set，loading 用单独 atom 标记。

### 11. (设计类) write atom 应集中还是分散？
**来源**：https://jotai.org/docs/advanced/atom-patterns

按业务域集中相关 action，避免碎片化难追踪。

### 12. (坑类) write 里对同一 atom 连续 set 两次？
**来源**：https://jotai.org/docs/core/atom

以最终值为准，中间态不触发渲染；用 get 计算避免覆盖。

### 13. (趋势类) Signals 的 effect/action 与 write atom 关系？
**来源**：https://github.com/tc39/proposal-signals

write atom 即「可写派生/副作用入口」，与 signal 的 writable effect 思路一致。

### 14. (综合类) 把购物车 clearCart 写成 write atom。
**来源**：https://jotai.org/docs/primitives

clearCartAtom=atom(null,(get,set)=>{set(items,[]);set(coupon,null);set(total,0)})。

### 15. (对比类) 为何 write atom 比 useEffect 监听更清晰？
**来源**：https://jotai.org/docs/

action 是显式调用触发，可组合可测；effect 监听易造成隐式回环。
