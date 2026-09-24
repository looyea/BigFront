# 面试题：persist 深入（za-persist-deep）

### 1. (实战类) 购物车哪些字段该持久化、哪些不该？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

存 items/coupon；不存 loading/error/瞬时 UI（用 partialize 剔除），避免刷新出假状态。

### 2. (原理类) version+migrate 的完整升级流程？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

读取持久化的 {state,version}，若 version<当前则逐级调用 migrate 升级后回写，保证老用户数据不丢。

### 3. (坑类) migrate 里为什么强调“逐版本”而非一步到位？
**来源**：https://github.com/pmndrs/zustand/discussions

用户可能停在任意历史版本，需 if(v===0)...if(v===1)... 连续升级，跳过中间版本会丢字段。

### 4. (SSR类) persist 在 Next SSR 里为什么会 mismatch？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

服务端无 localStorage 渲染初始值，客户端水合读到存储值不同；用 skipHydration+客户端 rehydrate 或只在客户端挂载后读取。

### 5. (安全类) 用 persist 存 token 有什么风险？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

localStorage 易被 XSS 读取；敏感凭证考虑 httpOnly cookie 或加密 storage，并缩短有效期。

### 6. (实战类) merge 默认浅合并会踩什么坑？
**来源**：https://github.com/pmndrs/zustand/discussions

新增字段有初始值但持久化对象里没有，浅合并可能保留内存初始；反之覆盖顺序也需自定义 merge 深合并处理。

### 7. (设计类) storage 抽象的意义？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

同一 store 逻辑在 Web/RN/测试(MockStorage)间复用，靠可插拔 storage 实现跨端。

### 8. (坑类) clearStorage / 手动改 localStorage 会怎样？
**来源**：https://zustand.docs.pmnd.rs/reference/middlewares/persist

绕过版本机制，可能与预期结构不符；应通过 store.persist.clearStorage() 与 migrate 管理。

### 9. (TS类) persistedState 的类型如何处理？
**来源**：https://zustand.docs.pmnd.rs/typescript/typescript

migrate 参数为 unknown，需自定义“已持久化形状”类型做断言与校验后再升级。

### 10. (性能类) 每次 set 都写 storage 会不会太频繁？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

persist 在 set 后同步序列化写盘；高频 store 应 partialize 缩小体积或自定义 storage 做 debounce。

### 11. (实战类) 如何做持久化的失效/过期？
**来源**：https://github.com/pmndrs/zustand/discussions

存 expiresAt 字段，migrate 或初始化时检查过期则清空；或自定义 storage 包装 TTL。

### 12. (对比类) persist 与手动 useEffect 读写 localStorage 的差别？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

persist 声明式、带版本迁移、partialize、订阅时机正确；手动写易漏边界、无版本管理。

### 13. (综合类) 设计“主题 + 布局偏好”持久化 store。
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

create(persist(...),{name:"ui",partialize:s=>({theme,layout}),version:1})，刷新即恢复且只存偏好。

### 14. (坑类) 多个 store 用相同 name 会怎样？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

共用同一 key 互相覆盖，数据串台；每个 store 必须唯一 name。

### 15. (综合类) 上线后如何安全地大改持久化结构？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

升 version+写 migrate 兼容旧结构，灰度期双读；必要时下发 reset 策略清老数据。
