# L5 作业：测试·迁移·选型

## 一、知识回顾

1. 测 Pinia store 的前置操作是什么？
2. Setup Store 为什么没有 $reset？怎么解决？
3. Vuex mutation 迁移到 Pinia 后变成什么？
4. Pinia vs Composable 的判据三问是什么？
5. @pinia/colada 的定位是什么？

## 二、代码实操

### 练习 A：写完整的 store 单元测试
为 L1 的 Todo Store 补齐测试：每个 action 至少一个正常 + 一个异常用例。

### 练习 B：Vuex 迁移实操
找一个 Vuex module（可用 04-vue 包的示例），手动转为 Pinia Setup Store。

### 练习 C：选型决策文档
为你的项目写一份状态管理选型文档：哪些放 Pinia、哪些放 composable、哪些放 colada/TanStack。

## 三、思考题

1. 如果项目同时有 Pinia 和 Vuex，如何设计迁移中间态的测试策略？
2. “一切状态进 store”的反模式有什么坏处？给出 2 个例子。
3. colada 和 Pinia store 的边界在哪里？举一个模糊场景说明你的判断。

## 四、延伸阅读

- Pinia 测试指南：https://pinia.vuejs.org/cookbook/testing.html
- Vuex 迁移工具：https://github.com/posva/vuex-to-pinia
- Pinia Colada 介绍：https://pinia-colada.posva.dev
- 状态管理的本质（理解为什么需要 Pinia）：https://kentcdodds.com/blog/application-state-management-with-react

## 五、自查清单

| 检查项 | 通过标准 |
| --- | --- |
| 单元测试覆盖率 | 所有 action + getter 至少 1 个用例 |
| 迁移完成 | Vuex module 全部转为 Pinia、无报错 |
| 选型文档 | 明确写出了“什么放 store / 什么放 composable / 什么放 colada” |
| 课程毕业 | 15 关全通过、quiz 均可答对 |
