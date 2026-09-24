# 面试题：Hydration 模式与跨端持久化（za-hydration）

### 1. (原理类) hydration mismatch 在 store 场景为何发生？
**来源**：https://nextjs.org/docs/messages/hydration-failed

服务端 HTML 由初始值渲染，客户端水合时 persist 读到不同值，React 发现文本/DOM 不一致。

### 2. (实战类) skeleton 兜底水合的完整实现？
**来源**：https://react.dev/reference/react/Suspense

ready 标志 + useEffect rehydrate，首帧统一渲染结构一致的 skeleton，水合后再出真实 UI。

### 3. (对比类) Cookie vs localStorage 在 SSR 水合中的差别？
**来源**：https://developer.mozilla.org/docs/Web/API/Document/cookie

Cookie 随请求到服务端可读、能渲真实首屏；localStorage 仅客户端，SSR 无值。

### 4. (实战类) 实现跨标签页登出同步？
**来源**：https://developer.mozilla.org/docs/Web/API/Window/storage_event

监听 storage 事件，auth-storage 变更时各 tab rehydrate 或 clearStorage，保持一致。

### 5. (坑类) storage 事件为什么不触发写它的那个 tab？
**来源**：https://developer.mozilla.org/docs/Web/API/Window/storage_event

规范如此——仅同源其他文档收到，本 tab 已同步无需通知。

### 6. (安全类) persist 存 token 的安全改进？
**来源**：https://owasp.org/www-project-front-end-security/

改 httpOnly cookie 或加密、缩短有效期、partialize 剔除敏感字段、登出 clearStorage。

### 7. (设计类) 什么偏好值得用 cookie 做服务端可读？
**来源**：https://nextjs.org/docs/app

主题/语言等影响首屏外观的，用 cookie 避免闪烁；非首屏可 localStorage。

### 8. (综合类) 设计“主题持久化无闪烁”方案。
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

主题写 cookie，RSC 读 cookie 渲首屏 style，client store 初始化同值，避免闪烁与 mismatch。

### 9. (实战类) BroadcastChannel 相对 storage 事件优势？
**来源**：https://developer.mozilla.org/docs/Web/API/BroadcastChannel

可传结构化数据、低延迟、不受 5MB 限制、消息语义更清晰。

### 10. (坑类) 多 tab 同时 rehydrate 竞态怎么处理？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

以最新写入为准、加时间戳/version 比较，或用 BroadcastChannel 收敛单点写。

### 11. (性能类) 跨 tab 同步会不会过频？
**来源**：https://developer.mozilla.org/docs/Web/API/BroadcastChannel

高频写需 debounce 再广播，避免风暴式 setState。

### 12. (综合类) SSR 项目登出的完整清理步骤？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

store action：清 cookie/token、setState 初始、persist.clearStorage、revalidate/跳转登录。

### 13. (对比类) cookie storage 与 persist 默认 localStorage 的取舍？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

cookie 服务端可读但体积/安全受限，localStorage 容量大仅客户端；按是否需首屏服务端值选。

### 14. (趋势类) RSC + Server Actions 会减少水合负担吗？
**来源**：https://react.dev/reference/react/server-components

更多状态在服务端确定并直出 HTML，客户端注入减少，水合闪烁面收窄。

### 15. (设计类) 团队水合持久化规范要点？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

① 首屏用 skeleton/cookie ② 敏感值不入 localStorage ③ 登出必 clearStorage ④ 跨 tab 定同步策略。
