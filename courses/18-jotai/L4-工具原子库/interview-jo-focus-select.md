# 面试题：focus / select / split（jo-focus-select）

### 1. (实战类) selectAtom 如何做「仅选中值变化才重渲」？
**来源**：https://jotai.org/docs/utilities/select

它对选中结果浅比较，源其它字段变但选中值不变则不通知订阅者。

### 2. (对比类) focusAtom 与直接读写深层对象差异？
**来源**：https://jotai.org/docs/utilities/focus

focus 产生独立子原子，只订阅该子路径、双向读写，避免整对象订阅。

### 3. (设计类) 为什么大对象 atom 需要 focus/split？
**来源**：https://jotai.org/docs/advanced/atom-patterns

整对象 atom 一改全体重渲，聚焦/拆分把订阅粒度降回字段/元素级。

### 4. (实战类) 用 splitAtom 实现可增删 ToDo 列表？
**来源**：https://jotai.org/docs/utilities/split

splitAtom(itemsAtom) 得 itemAtoms 列表，逐项渲染、removeItem 删除，天然行级订阅。

### 5. (对比类) 与 Zustand 靠 selector 控粒度对比？
**来源**：https://jotai.org/docs/utilities/select

Zustand 每次渲染重跑 selector；Jotai selectAtom 派生可复用且浅比较缓存。

### 6. (TS类) focusAtom optic 类型安全吗？
**来源**：https://jotai.org/docs/typescript/typescript

optic 链基于 TS 类型推导路径，错路径编译期即报错。

### 7. (性能类) 深层对象用 focus 相比整对象读写收益？
**来源**：https://jotai.org/docs/utilities/focus

只有相关组件订阅该子原子，改别的字段不牵动它。

### 8. (综合类) 给嵌套设置页选三种 utils 的组合。
**来源**：https://jotai.org/docs/

整体 configAtom，各分区 focusAtom，列表项 splitAtom，展示派生 selectAtom。

### 9. (坑类) focus 写回深层时对象引用如何处理？
**来源**：https://jotai.org/docs/

Jotai 用不可变更新重建被改路径（类似 immer），未变分支引用保持。

### 10. (设计类) splitAtom 与参数化 atom 谁更适合可增删列表？
**来源**：https://jotai.org/docs/utilities/split

split 直接随数组增删同步子 atom，省去手动 Map 失效。

### 11. (实战类) 如何只让提交的字段组件重渲？
**来源**：https://jotai.org/docs/utilities/focus

每字段 focusAtom，其它字段改动不通知本字段订阅者。

### 12. (对比类) selectAtom 的浅比较够用吗？
**来源**：https://jotai.org/docs/utilities/select

单层选中值够；返回新对象需自定义 isEqual 或聚焦更原始值。

### 13. (趋势类) lens/focus 与编译器/信号的关系？
**来源**：https://github.com/tc39/proposal-signals

细粒度派生正是 signal 生态方向，focus 思路可能被原生 effect 支持。

### 14. (综合类) 把一个大 settingsAtom 重构为 utils 组合。
**来源**：https://jotai.org/docs/advanced/atom-patterns

拆 focus 子路径 + split 列表 + select 派生，粒度回归组件需求。

### 15. (设计类) 三剑客选用口诀？
**来源**：https://jotai.org/docs/

读选中→select；读写深层→focus；数组拆行→split。
