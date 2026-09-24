# L2 作业：中间件全解

## 一、知识回顾
1. 画出 devtools(persist(immer(fn))) 的分层并说明每层职责。
2. partialize、version+migrate、merge、skipHydration 分别解决什么？
3. set 的第三个参数在 devtools 下有什么作用？

## 二、代码实操
1. 给 L1 的 useTodoStore 加上 devtools + immer 中间件，把 addTodo/toggle 改成 draft 写法并命名 action。
2. 为购物车 store 配置 persist：只持久化 items、设 version=2、写 migrate 把 v1 的字符串数组升级为对象数组。
3. 手写一个 logger 中间件，打印每次 set 前后 diff，并挂到 store 上验证顺序。

## 三、思考题
1. 为什么 immer 让 selector 更容易保持稳定引用？
2. skipHydration 之后，如果忘了手动 rehydrate 会发生什么？

## 四、延伸阅读
- Zustand middleware / persist / immer / devtools 文档
- immer 官方 Immutable Updates 概念

## 五、自查清单
- [ ] 中间件顺序正确（immer 内、devtools 外）
- [ ] persist 用 partialize 剔除瞬态字段
- [ ] schema 变更已升 version 并写 migrate
- [ ] 关键 set 已命名 action
