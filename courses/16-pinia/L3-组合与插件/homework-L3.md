# L3 作业：组合与插件

## 一、知识回顾

1. 为什么只能在 action 里跨 store 调用，不能在 getter 里？
2. 两个 store 互相 import 会循环依赖吗？为什么不会？
3. Pinia 插件的函数签名是什么？context 里有哪些注入？
4. $subscribe 和 onAction 的触发时机区别？
5. acceptHMRUpdate 解决什么问题？不加会怎样？

## 二、代码实操

### 练习 A：跨 store 编排

创建 `stores/cart.ts`（items + total getter）和 `stores/checkout.ts`（submitOrder action 里调 cart.clear()）。验证购物车下单后 items 清空。

### 练习 B：持久化插件

实现 `plugins/persist.ts`，注册后所有 store 自动存 localStorage。通过 defineStore 第四参数 `{ persist: false }` 排除 temp store。刷新后验证状态恢复。

### 练习 C：撤销/重做插件

实现 `plugins/undo.ts`，给每个 store 加 `undo()` / `redo()` 方法。$subscribe 记录历史栈。在组件里测试：改 count → undo → 值恢复。

### 练习 D：HMR

给 cart store 文件加 `acceptHMRUpdate`。开发时修改 increment action 逻辑，保存后验证组件状态不丢、新逻辑生效。

## 三、思考题

1. 如果团队有 20 个 store，全部自动持久化合理吗？怎么设计按需持久化策略？
2. 跨 store 的编排逻辑应该放 action、composable 还是独立 service？各有什么优劣？
3. 撤销/重做在表单场景中有什么边界问题？（提示：undo 后表单 dirty 状态怎么处理）

## 四、延伸阅读

- Pinia 插件文档：https://pinia.vuejs.org/core-concepts/plugins.html
- pinia-plugin-persistedstate 源码：https://github.com/prazdevs/pinia-plugin-persistedstate
- Store 组合最佳实践：https://pinia.vuejs.org/cookbook/composing-stores.html
- HMR 机制详解（Vite 文档）：https://vitejs.dev/guide/api-hmr.html

## 五、自查清单

| 检查项 | 通过标准 |
| --- | --- |
| 跨 store action 正常 | checkout.submitOrder() 里 cart.items 变 [] |
| 持久化插件生效 | 刷新页面后 store state 恢复 |
| persist: false 排除生效 | temp store 刷新后回到初始值 |
| undo 功能可用 | 连续改 3 次 → undo 3 次 → 回到初始 |
| HMR 不丢状态 | 修改 store 文件保存后 DevTools 显示 state 值未变 |
