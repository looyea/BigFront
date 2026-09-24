# L1 作业：原子核心

## 一、知识回顾
1. atom 与 useState、与 Zustand store 的本质区别。
2. useAtom / useAtomValue / useSetAtom 的选择依据。
3. 全局 atom 何时够用、何时需 Provider 隔离。

## 二、代码实操
1. 用 atom 实现跨两个组件共享的 counter，一个组件只读、一个组件只写。
2. 写一个 themeAtom=atomWithStorage 并在根组件读取应用主题。
3. 故意在组件内部 new 一个 atom，观察状态无法共享，改正到模块作用域。

## 三、思考题
1. 只写场景为什么用 useSetAtom 而不是 useAtom？
2. 全局 atom 为什么在测试里需要隔离？

## 四、延伸阅读
- Jotai 官方：core/atom、core/use-atom、utilities/provider

## 五、自查清单
- [ ] atom 均在模块作用域创建
- [ ] 只读用 useAtomValue、只写用 useSetAtom
- [ ] 持久化用 atomWithStorage
- [ ] 未把大对象塞成单 atom
