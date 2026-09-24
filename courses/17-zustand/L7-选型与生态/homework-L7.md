# L7 作业：选型与生态（收官）

## 一、知识回顾
1. Zustand / RTK / Jotai / Context 各自适用象限。
2. store 纯测与组件集成的分工。
3. 团队规范四要素：封装、命名、边界、清单。

## 二、代码实操
1. 封装一个带 devtools+persist+immer 的 createStore 工厂，并用它重建前几关的 store。
2. 给 cartSlice 写一套纯测（工厂隔离 + msw 测异步 + 回滚断言）。
3. 输出一页纸状态归属规范（server/client/form/url 各归谁）。

## 三、思考题
1. 封装固定中间件顺序，牺牲了什么、换来了什么？
2. 若团队同时用 Zustand 与 Jotai，边界如何划？

## 四、延伸阅读
- Zustand 生态、Valtio、TanStack Query、React Compiler

## 五、自查清单
- [ ] 所有 store 走统一工厂
- [ ] 无组件内 setState、无 server 数据入 store
- [ ] 关键 action 有纯测
- [ ] 毕业清单逐项可答
