# 面试题：queryKey（tq-query-key）

### 1. (原理类) 为什么 queryKey 用数组而不是字符串？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

数组天然分层表意、可前缀匹配、可携带结构化参数；字符串要靠拼接约定，重构与匹配都脆弱。

### 2. (原理类) queryKey 如何变成实际缓存键？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/hashKey

深度遍历、对象键排序后 JSON 序列化；所以对象属性顺序不影响命中。

### 3. (坑类) 数组放进 key 要注意什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

数组是有序比较：同一集合两种顺序=两条缓存；入 key 前先 sort 或用稳定结构。

### 4. (坑类) 把 token/时间戳塞 queryKey 的后果？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

每次值不同导致永不命中、缓存条目疯长；身份信息放 meta/header，不进 key。

### 5. (设计类) 如何设计一个「项目-任务」两层的 key 树？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

['projects']、['projects',id]、['projects',id,'tasks']、列表加 'list' 段——失效项目相关全部只需前缀 ['projects',id]。

### 6. (实战类) invalidateQueries 的匹配规则有哪些档？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

全量、前缀(partial 默认)、exact、predicate 谓词四档，语义在 refetch/remove 等 API 通用。

### 7. (实战类) key 工厂模式解决什么问题？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

字面量单点、类型收敛、避免拼写漂移；mutation 回调里失效用同一工厂，编译期即安全。

### 8. (对比类) 同 key 不同 queryFn 会怎样？为什么这样设计？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults

首个注册的 queryFn 生效。key 是身份，身份先占先得；函数是实现细节，允许被忽略。

### 9. (设计类) 分页列表的 key 里放什么？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

页码/游标/筛选排序全放对象段：todos 主段 + {page,filter} 参段——每个组合各自一条缓存。

### 10. (实战类) 前缀匹配能「向上」匹配吗（子 key 失效父 key）？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-invalidation

不能。失效 todos,id 不会命中父级 todos 列表；需要时退一级用 todos 前缀全失或 predicate。

### 11. (坑类) queryKey 变了但旧组件还在渲染，缓存会串吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

不会；不同 key 是独立查询，旧渲染读旧 key 快照，新订阅读新 key——这也是竞态安全的根基。

### 12. (对比类) GraphQL 场景 key 怎么设计？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-functions

按 query 文本+variables 做 key（或 hash 文档），让不同选择集天然分开，勿共用一条缓存。

### 13. (实战类) 怎么用 predicate 做「只失效列表不失效详情」？
**来源**：https://tanstack.com/query/latest/docs/framework/react/reference/functions/partialMatchKey

predicate: (q) => q.queryKey[0]==="todos" && q.queryKey[1]==="list"——匹配函数可检任意 key 结构。

### 14. (开放类) key 设计失误（太粗/太细）分别是什么症状？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

太粗：两视图互相打架、无谓重取；太细：碎片化、失效打不中、缓存条目爆炸。以「一起变化的数据同 key」为轴。

### 15. (设计类) 为什么 Query 不建议 queryKey 省缺（default query function）？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/default-query-function

省 key 的「全局默认函数」只利原型；真实应用身份不清、无法失效，官方教程直接劝退。
