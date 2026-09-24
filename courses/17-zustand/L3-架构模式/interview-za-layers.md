# 面试题：状态分层（za-layers）

### 1. (设计类) 为什么服务端态和客户端态要分开管？
**来源**：https://tkdodo.eu/blog/putting-js-in-react-states 或 TanStack

服务端态是远端的缓存副本，需要失效/重试/竞态处理；客户端态是本地真相，二者生命周期与更新模型完全不同。

### 2. (对比类) Zustand 与 TanStack Query 的分工线？
**来源**：https://tanstack.com/query/latest

Query 管 server-cache（数据获取/缓存/失效）；Zustand 管 client-state（UI/业务/草稿）。

### 3. (坑类) 把接口数据拷进 Zustand 后常见 bug？
**来源**：https://tkdodo.eu/blog/you-might-not-need-an-effect

两处真相不同步、缓存/竞态/加载态需手搓、mutation 后忘记回填，最终代码越写越脆。

### 4. (实战类) 一个页面同时用两层怎么写？
**来源**：https://tanstack.com/query/latest

Query 拉列表渲染；用户勾选/筛选草稿放 Zustand；提交用 mutation 成功后 invalidate 列表。

### 5. (设计类) 为什么禁止跨层直写？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

单一写路径保证可追踪、可测试、可回滚；绕过层入口会制造隐性耦合。

### 6. (实战类) UI 偏好该在哪持久化？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

UI 层 store 用 persist，partialize 只存偏好字段。

### 7. (对比类) 客户端派生数据（computed）算哪层？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

属客户端态，用 selector/derived 即时算，不必也不该写回服务端缓存。

### 8. (综合类) 如何界定“业务态”和“UI 态”边界？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

与渲染无关、跨页面存活的是业务态；纯交互反馈（hover/开合）是 UI 态，尽量局部。

### 9. (性能类) 分层对重渲粒度有何帮助？
**来源**：https://zustand.docs.pmnd.rs/integrations/auto-render-optimizations

更新频率不同的数据分 store，避免高频 server 更新牵连低频 UI 组件重渲。

### 10. (坑类) 登录用户信息算服务端态还是客户端态？
**来源**：https://tkdodo.eu/blog/

profile 来自后端→服务端态用 Query；据此派生的 token/权限标志是客户端态放 Zustand。

### 11. (设计类) 三层各举一个目录命名？
**来源**：https://zustand.docs.pmnd.rs/

store/ui、store/biz、api/(queries,mutations) —— 让新同事一眼看出数据归属。

### 12. (对比类) 没有 TanStack Query 时服务端态怎么办？
**来源**：https://tanstack.com/query/latest

至少单独一个 serverStore 隔离，别混进 UI，手写 loading/error/缓存，但仍建议引入专用库。

### 13. (趋势类) RSC 对状态分层的影响？
**来源**：https://react.dev/reference/react/server-components

服务端态更多在 RSC 层直接读取下发，客户端 Zustand 更聚焦交互/业务态，边界更清晰。

### 14. (综合类) 给一个“文章列表 + 收藏 + 主题”分层方案。
**来源**：https://zustand.docs.pmnd.rs/

列表=Query 服务端态；收藏本地待同步=Zustand 业务态 + mutation 回填；主题=Zustand UI 态 persist。

### 15. (设计类) 如何用一条规则防止团队乱塞 store？
**来源**：https://zustand.docs.pmnd.rs/limits/optimal-composition

先问“这份数据是远端镜像还是本地真相、谁负责失效”，再决定归层，禁止先写进大 store 再拆。
