# 面试题：SSR / Next.js 集成（jo-ssr）

### 1. (原理类) SSR 里为什么必须每请求 store？
**来源**：https://jotai.org/docs/utilities/ssr

默认 store 进程级共享，会跨请求污染；每请求独立 store 才能隔离用户数据。

### 2. (实战类) dehydrate + hydrateAtoms 完整流程？
**来源**：https://jotai.org/docs/utilities

服务端渲染后 dehydrate(store) 得值序列化进 HTML，客户端 hydrateAtoms(map, store) 注入，避免重取。

### 3. (SSR类) async atom 如何做 SSR 无闪烁？
**来源**：https://jotai.org/docs/

服务端 await 完成取数并 dehydrate 结果，客户端水合直接用，不再 pending（呼应 jo-async）。

### 4. (坑类) 不水合 async atom 会看到什么问题？
**来源**：https://jotai.org/docs/

客户端又触发一次取数 + Suspense loading，闪烁且浪费请求。

### 5. (对比类) Jotai SSR 与 Zustand SSR 方案对比？
**来源**：https://jotai.org/docs/utilities/ssr

都 per-request store；Zustand 靠 skipHydration/rehydrate，Jotai 靠 dehydrate/hydrateAtoms。

### 6. (实战类) RSC 下如何把 atom 数据传给交互组件？
**来源**：https://nextjs.org/docs/app

server 组件用 store.get 取好值，作为 props 下发给 client 组件，client 里再注入/使用。

### 7. (设计类) Provider 放得太大有什么代价？
**来源**：https://jotai.org/docs/utilities/provider

整子树变 client、失去 RSC 直出优势、bundle 增大；应下沉到最小子树。

### 8. (综合类) 给 Next App Router 设计 Jotai SSR 骨架。
**来源**：https://jotai.org/docs/utilities/ssr

server 建 store→渲染 client 子树包 Provider store→页面末 dehydrate 值入 script→client hydrateAtoms。

### 9. (坑类) atomWithStorage 服务端访问 window 会？
**来源**：https://jotai.org/docs/utilities/storage

崩溃；Jotai 默认仅客户端读写存储，需 getOnInit/占位处理水合。

### 10. (性能类) SSR 每请求 store 的创建成本？
**来源**：https://jotai.org/docs/

createStore 是轻量对象，成本低；瓶颈在数据取数而非 store。

### 11. (对比类) 与 Redux Next SSR preloadedState 类比？
**来源**：https://nextjs.org/docs

都是每请求 makeStore + 序列化下发 + 客户端 rehydrate，Jotai 的 dehydrate 即对应。

### 12. (TS类) hydrateAtoms 参数类型注意？
**来源**：https://jotai.org/docs/typescript/typescript

需 new Map(dehydrated) 传入，且 store 与取值 atom 对齐类型。

### 13. (设计类) 如何决定哪些数据 SSR 直出、哪些 client 取？
**来源**：https://jotai.org/docs/

首屏可见且服务端可得的直出+水合；交互后才需要的留给 client async atom。

### 14. (趋势类) React Server Components 会弱化 Jotai SSR 吗？
**来源**：https://react.dev/reference/react/server-components

更多数据在 RSC 直读，client store 更聚焦交互态，但水合与隔离仍重要。

### 15. (综合类) 团队 SSR+Jotant checklist？
**来源**：https://jotai.org/docs/utilities/ssr

① 每请求 store ② dehydrate/hydrate ③ 敏感值不落 storage ④ Provider 下沉 client 边界 ⑤ 首屏防闪烁。
