# 面试题：表单：Zustand + RHF 分工（za-forms）

### 1. (设计类) 为什么不推荐把每个输入框值放 Zustand？
**来源**：https://react-hook-form.com/

每次击键 setState + 订阅重渲，大表单性能崩塌；RHF 非受控只管校验/提交时机。

### 2. (实战类) 多步向导如何在 store 里组织？
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

step + data 两张结构，patch 合并当前步数据，persist 防刷新丢失，步骤守卫按 data 完成度判断。

### 3. (对比类) RHF 与 Zustand 的能力边界？
**来源**：https://react-hook-form.com/

RHF：字段注册、校验、isDirty、错误；Zustand：跨步骤/跨页/持久化的表单宏观状态。

### 4. (坑类) 把 RHF 值同步回 store 造成循环怎么办？
**来源**：https://github.com/pmndrs/zustand/discussions

避免 onChange 即时双向同步；只在步骤切换/提交时批量写 store，或用 watch 精确时机。

### 5. (性能类) 如何量化表单重渲问题？
**来源**：https://react-hook-form.com/

击键时数组件 render 次数；RHF 应几乎为 0，若每键重渲说明字段进了受控 state。

### 6. (综合类) 设计草稿自动保存策略。
**来源**：https://zustand.docs.pmnd.rs/middlewares/persist-middleware

store.subscribe + debounce 500ms 写 persist；或离开路由/失焦时 flush，避免每键写盘。

### 7. (实战类) 提交乐观 + 回滚怎么落地？
**来源**：https://react.dev/reference/react/useOptimistic

useOptimistic 先展示结果，store action 发请求，失败 catch 恢复并 toast。

### 8. (安全类) 表单里敏感数据进 persist 注意什么？
**来源**：https://owasp.org/www-project-front-end-security/

密码/银行卡等绝不持久化，partialize 白名单，敏感步不落盘。

### 9. (对比类) 与 vee-validate(Pinia) 思路的异同？
**来源**：https://vee-validate.logaretm.com/v4/guide/overview

理念一致：字段级归校验库、跨步骤归 store；不同生态库名。

### 10. (设计类) 校验规则放哪？
**来源**：https://react-hook-form.com/

放 RHF + zod schema，Zustand 不掺字段校验，只存提交/步骤态。

### 11. (坑类) 刷新后草稿恢复了但字段没显示？
**来源**：https://react-hook-form.com/

RHF 需要 defaultValues 从 store 注入或用 reset(data)，非受控值不会自动回填。

### 12. (实战类) beforeunload 提示的实现？
**来源**：https://developer.mozilla.org/docs/Web/API/Window/beforeunload_event

isDirty 时挂 beforeunload，preventDefault + returnValue 触发浏览器原生确认。

### 13. (综合类) 给“注册三步向导”定完整状态归属表。
**来源**：https://zustand.docs.pmnd.rs/

每步字段值=RHF；step/已填草稿=persist store；提交 loading/结果=store；校验=Zod。

### 14. (趋势类) React Compiler 对表单重渲的影响？
**来源**：https://react.dev/learn/react-compiler

自动 memo 减少无关重渲，但非受控 RHF 仍是字段级最佳性能路径。

### 15. (设计类) 团队表单状态规范一句话？
**来源**：https://react-hook-form.com/

字段值归 RHF、跨步骤/草稿/提交态归 Zustand、规则归 Zod，三者不越界。
