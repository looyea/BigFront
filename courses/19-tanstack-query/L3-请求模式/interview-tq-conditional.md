# 面试题：条件与依赖请求（tq-conditional）

### 1. (实战类) 「有 id 才查询」的标准写法？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries

enabled: !!id；翻 false 时进行为 paused，翻 true 自动补取。

### 2. (原理类) enabled 挡住的是哪些触发时机？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries

挂载/聚焦/重试全部暂停；invalidate 对 disabled 查询也不立即重取。

### 3. (实战类) dependent queries 的两要素？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

B 用 enabled 等 A 就绪 + B 的 key 含 A 的产物——前者防脏请求，后者保联动重取。

### 4. (坑类) 只写 enabled 不写 key 依赖会怎样？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

依赖值变了 key 不变→不重取，UI 拿着旧依赖的数据；enabled 管「能不能取」不管「变了要重取」。

### 5. (实战类) skipToken 与 enabled 怎么选？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

v5 倾向 skipToken：TS 下不必为不执行分支编造参数类型；enabled 适合整查询级开关。

### 6. (对比类) placeholderData 和 initialData 的语义差？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data

placeholder 借「别的查询」的值占位（可被标记可回退）；initialData 是「本查询」的出生值，首帧即真相候选。

### 7. (实战类) keepPreviousData 的引入动机？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data

翻页/切 tab 时新 key 无缓存导致骨架闪屏；v5 把它降级为 placeholderData 的函数用法。

### 8. (坑类) isPlaceholderData 期间直接提交表单的风险？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data

用户以为改的是新页，操作落在旧页占位数据上——要么禁用要么醒目标识。

### 9. (实战类) SSR 注入的值进 initialData 还是 placeholderData？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/initial-query-data

initialData——它属于这条查询自己的首帧真值；配 staleTime 决定何时后台刷新。

### 10. (设计类) 「点开 Tab 才取」用 lazy 组件还是 enabled？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries

代码分割归 lazy；「Tab 激活才发数据请求」用 enabled 配 active 状态，两件事分开。

### 11. (坑类) enabled 函数里读 props 对象每次新引用，会有问题吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/disabling-queries

无——enabled 每次渲染求值，只看布尔结果；有问题的只会是 key 里的不稳定序列化。

### 12. (对比类) dependent queries 与 queryFn 内 await 依赖接口？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/dependent-queries

前者声明式、缓存独立、UI 可分层 loading；后者一个函数两请求，全量重试、缓存耦合——除非原子性必需，选前者。

### 13. (实战类) 列表页搜索词防抖进不进 queryKey？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/query-keys

进，但用防抖后的值做 key：输入即时 UI 走局部 state，300ms 稳定后才产生新 key 触发请求。

### 14. (开放类) 占位数据体验怎么调优？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/placeholder-query-data

placeholder 配 300~500ms 最小显示防「闪变」；数据差异大时加「数据更新中」蒙层而非硬切。

### 15. (原理类) disabled 查询会被 GC 吗？
**来源**：https://tanstack.com/query/latest/docs/framework/react/guides/caching

从未执行就没有数据可回收；它只是注册在 cache 的 pending 观察者，enabled 翻开才有第一份数据。
