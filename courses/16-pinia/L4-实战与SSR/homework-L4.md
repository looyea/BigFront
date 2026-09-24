# L4 作业：实战与 SSR

## 一、知识回顾

1. 登录态 store 的 token 持久化与 401 自动踢出怎么实现？
2. 表单状态什么时候放 store、什么时候放组件？
3. 多步向导中为什么数据不丢？（store 全局单例）
4. Nuxt Pinia 模块自动处理了 SSR 的什么？
5. 持久化插件为什么需要 import.meta.client 守卫？

## 二、代码实操

### 练习 A：Auth Store 完整实现
- token / user / permissions state
- login/logout action
- isLoggedIn getter + hasPerm method
- axios 拦截器注入 token + 401 catch logout
- 路由守卫检查 isLoggedIn

### 练习 B：多步向导 Store
- 3 步表单（个人信息 → 偏好 → 确认）
- step / next / prev / reset
- isDirty 检测 + beforeunload
- 草稿 debounce 保存 localStorage

### 练习 C：Nuxt SSR 验证
- 创建 Nuxt 3 项目 + Pinia 模块
- 首页 SSR 渲染一个 store 数据（如文章列表）
- 查看源码确认 __NUXT_DATA__ 含数据
- 验证水合后无双重请求

## 三、思考题

1. token 存 localStorage vs HttpOnly cookie 各有什么安全 trade-off？
2. 如果向导第 3 步提交时网络断了，乐观更新 + 重试 + 草稿保存三者如何配合？
3. SSR 预填充数据 + CSR 交互更新（如无限滚动）如何设计不冲突？

## 四、延伸阅读

- Nuxt SSR 渲染策略：https://nuxt.com/docs/guide/concepts/rendering
- OWASP Token 存储安全：https://owasp.org/www-community/controls/HTTPOnly_cookie
- Pinia SSR 文档：https://pinia.vuejs.org/ssr/nuxt.html
- vee-validate + Pinia 集成示例：https://vee-validate.logaretm.com/v4/examples/

## 五、自查清单

| 检查项 | 通过标准 |
| --- | --- |
| 登录后刷新保持 | token 从 localStorage 恢复 → isLoggedIn=true |
| 401 自动登出 | 手动过期 token → 请求 → 被踢到 /login |
| 向导跨步不丢数据 | 第 3 步 → prev 到第 1 步 → 数据仍在 |
| SSR payload 含数据 | 查看源码 __NUXT_DATA__ 包含 store state |
| 水合不重复 fetch | Network 面板 /api/articles 只有一次请求 |
