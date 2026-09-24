# 面试题：持久化与跨标签同步（tq-persist）

### 1. (原理) persistQueryClient 的工作机制？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

注册后周期性/事件驱动地把 dehydrate(client) 的结果经 persister 写入存储；client 启动时经 persister 异步读回并 hydrate。maxAge 给持久快照设保质期，过期即弃；默认只持久已完成的查询与 mutation 快照。

### 2. (选型) createSyncStoragePersister 与 createAsyncStoragePersister 怎么选？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/createSyncStoragePersister

看存储介质的 API 形态：localStorage/原生 FS 同步读写用 Sync；IndexedDB、RN AsyncStorage、SQLite 等 Promise 接口用 Async。异步版多一次「恢复完成」的等待，UI 可订阅 isRestored 决定首帧策略。

### 3. (控制) 怎样只持久化部分查询？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/defaultShouldDehydrateQuery

dehydrateOptions.shouldDehydrateQuery 返回 false 的条目不进持久快照（默认排除错误与进行中）。典型白名单：用户资料、配置类持久；股价、搜索建议排除——持久化的陈旧比没有更危险。

### 4. (机制) broadcastQueryClient 的同步策略？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/broadcastQueryClient

基于 BroadcastChannel：成员标签定期/事件驱动广播自家缓存变更，新成员入网请求全量快照；一个标签取数写入，其他标签缓存同步更新。本质是「多页面共享一个 QueryCache 的视图」，官方标记 experimental。

### 5. (对比) Query persist 与 zustand persist、jotai atomWithStorage 的粒度差？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

zustand 整棵 state 树浅合并持久；jotai 逐原子自带 storage 原语；Query 以「每条查询」为单位，且带 maxAge/新鲜度语义与 shouldDehydrate 钩子。三者可并存——server state 归 Query 持久化，client state 归状态库持久化，别交叉搬。

### 6. (风险) 把 token 类查询持久化进 localStorage 的风险？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

localStorage 是明文、同源任意脚本可读，XSS 直接偷走。缓解：HttpOnly Cookie 承载会话（压根不进缓存持久层）、shouldDehydrateQuery 挡敏感条目、App 侧 CSP。安全评审必问项。

### 7. (坑) queryKey 改版后旧持久数据怎么处理？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

旧条目按旧 key 灌回，新代码按新 key 读取——表现为「改了没生效」或两份缓存并存。方案：大变更时 bump 一个全局 store version（存 key 前缀或持久化根对象里），版本不符清 store；或 removeClient 后重注册。

### 8. (坑) SSR 应用里注册 persist 的两个注意事项？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

① 仅客户端执行（typeof window 守卫），服务端跑既报错又跨用户串数据；② persist 灌回与 SSR 水合同时可触发同一条查询的两次填充，通常让水合优先、persist 只覆盖水合没有的条目，或干脆二选一。

### 9. (机制) 持久化里会有 mutation 吗？默认策略是什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/defaultShouldDehydrateMutation

dehydrate 可带 mutation 快照，默认只持久「pending 中的 mutation」（供恢复后提示进行中状态），已完成的写结果默认不持久。真正离线写重放要另上 createPersister 离线方案，不是打开 dehydrateOptions 就行。

### 10. (实战) 冷启动体验优化：persist 灌回的数据该显示吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister

可以且应该——前提是配合 staleTime 与后台验证：先显示持久数据（标注可能陈旧），isFetching 时出小指示器。异步 persister 提供 isRestored（HydrationBoundary 场景另有排队），恢复完成前渲染骨架，避免「空列表闪一下」。

### 11. (边界) gcTime 和持久化的 maxAge 是什么关系？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

两条独立时间轴：gcTime 管内存条目回收，maxAge 管持久快照存活。灌回的条目按正常生命周期走（灌回即出生，stale 与 GC 时钟重转）。想「离线一周仍可用」要 staleTime:Infinity + 合理 maxAge 配合，单调一个都不够。

### 12. (对比) 为什么 Query 不提供内置的离线写队列？v5 前
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

写重放的语义太依赖业务（幂等性、顺序、冲突合并），内置等于替所有人决定策略。v5 提供 createPersister 原语 + 官方 offline 示例，把「排队、重放、放弃」做成可组合件——库给机制不给默认策。

### 13. (坑) 多标签同时启动都 restore，会冲突吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/broadcastQueryClient

restore 各读各的快照灌各自的 client，互不干扰；配 broadcast 后成员间同步收敛到一致视图。真正的冲突在写侧：两标签同改一条数据，后落库者胜——需要服务器 version/ETag 兜底，非前端持久层职责。

### 14. (原理) persister 接口协议的三件套是什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister

persistClient(state)、restoreClient() 返回 state 或 null、removeClient()。任何能实现这三个方法的介质（加密存储、云端 KV）都能当 persister——依赖倒置做得好，换介质不动业务一行。

### 15. (架构) 什么项目该上 persist，什么项目不该？
**来源**：https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient

该上：移动弱网、列表 App 回访率高的「秒开」诉求、离线可读缓存。不该上：数据强一致要求（金融行情）、含大量敏感信息且过等保、首屏全靠 SSR 已秒出——persist 只解决「冷启动空窗」，不是万能加速器。
