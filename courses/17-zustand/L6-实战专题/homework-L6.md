# L6 作业：实战专题

## 一、知识回顾
1. 登录态里 token 的安全存放与拦截器读法。
2. 表单中 RHF 与 Zustand 的分工边界。
3. 看板归一化结构与乐观回滚的骨架。

## 二、代码实操
1. 写一个 auth store：persist(只存标志)、axios 拦截器 getState 注入、401 自动 logout。
2. 用 RHF + Zustand 做三步注册向导：字段交 RHF，步骤与草稿 persist。
3. 用 ids+entities 实现看板，含乐观改状态、失败回滚、批量移动。

## 三、思考题
1. 为什么把分页数据放 Zustand 是反模式？
2. 拖拽跨列时 store 的 ids 与 entities 各要改什么？

## 四、延伸阅读
- React Hook Form + Zod
- Redux 状态归一化 / TanStack Query infinite

## 五、自查清单
- [ ] 敏感 token 未明文持久化
- [ ] 表单字段未逐键写 store
- [ ] 更新用 ids/entities，单条 O(1)
- [ ] 乐观更新有快照回滚
