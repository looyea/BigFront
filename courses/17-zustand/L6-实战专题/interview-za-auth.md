# 面试题：登录态 store（za-auth）

### 1. (设计类) token 到底放 store 还是 cookie？
**来源**：https://owasp.org/www-project-front-end-security/

高安全场景用 httpOnly cookie 存凭证，Zustand 只放派生的登录标志与用户信息；纯 SPA 才可考虑 store+persist。

### 2. (实战类) 拦截器为什么用 getState 而非 hook？
**来源**：https://zustand.docs.pmnd.rs/getting-started/non-react-hooks-like-api

拦截器是普通 JS 回调，非组件，不能调 hook，getState 拿瞬时 token。

### 3. (安全类) persist 明文存 token 的风险与缓解？
**来源**：https://owasp.org/www-project-front-end-security/

XSS 可窃取；缓解：httpOnly cookie、缩短有效期、加密 storage、partialize 少存。

### 4. (实战类) 401 统一登出如何实现且不刷新页面？
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

响应拦截器捕获 401 调 store.logout() 清态，守卫检测到 token 空即渲染重定向，无需硬刷新。

### 5. (坑类) SSR 首屏误判已登录导致什么问题？
**来源**：https://nextjs.org/docs/messages/hydration-failed

服务端无 token 渲登录页、客户端有 token 渲主页，水合 mismatch；用 skipHydration + 骨架。

### 6. (设计类) refresh token 轮换放哪？
**来源**：https://datatracker.ietf.org/doc/html/rfc6749

凭证与刷新逻辑贴近 httpOnly cookie + 拦截器；store 只反映 access 有效性与 user。

### 7. (实战类) 多标签页登录/登出一致性方案？
**来源**：https://developer.mozilla.org/docs/Web/API/BroadcastChannel

登录登出走 BroadcastChannel/storage 事件广播，各 tab rehydrate 或 setState 对齐。

### 8. (综合类) 写一个带 persist 的 auth store 骨架。
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

create(persist((set)=>({token:null,user:null,login:async c=>set(await api.login(c)),logout:()=>set({token:null,user:null})}),{name:"auth",partialize:s=>({token:s.token}),skipHydration:true}))。

### 9. (对比类) canAccess selector 与组件内 if 判断差异？
**来源**：https://react.dev/reference/react

selector 集中权限逻辑、可复用、随 store 更新自动重算；散落 if 难维护。

### 10. (坑类) 登出忘了清 Query 缓存会怎样？
**来源**：https://tanstack.com/query/latest

下个账号看到上个账号残留数据；登出应 queryClient.clear() 一并处理。

### 11. (设计类) 用户信息算服务端态还是客户端态？
**来源**：https://tkdodo.eu/blog/

profile 来自后端属服务端态用 Query；token/登录标志是客户端态放 Zustand（呼应 za-layers）。

### 12. (性能类) 守卫频繁读 token 会重渲吗？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

selector 只订阅 token 布尔，值不变不重渲，粒度可控。

### 13. (实战类) 如何“记住我”与自动登录并存？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

记住我→持久化 refresh；会话模式→仅内存 token，关闭即失效。

### 14. (趋势类) OAuth/OIDC 与 Zustand 登录态如何配合？
**来源**：https://openid.net/developers/how-connect-works/

令牌交换由后端 cookie 承载，前端 store 镜像会话标志，避免在前端长期持有敏感令牌。

### 15. (综合类) 团队 auth store 规范要点？
**来源**：https://zustand.docs.pmnd.rs/getting-started/introduction

① 凭证优先 httpOnly ② 拦截器 getState 注入 ③ 401 统一登出 ④ 登出清 store+Query ⑤ 跨 tab 同步。
