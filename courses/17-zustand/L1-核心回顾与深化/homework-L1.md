# L1 作业：核心回顾与深化

## 一、知识回顾
1. 用一句话说明 create 返回值的双重身份。
2. v5 selector 默认相等判定是什么？为什么改？
3. 函数式 set 与对象式 set 各自适用场景？

## 二、代码实操
1. 用 TypeScript 写一个 `useTodoStore`，含 `todos`、`addTodo`、`toggle`、`removeDone`，全部使用函数式 set。
2. 在某个非组件的 `window.addEventListener('keydown')` 回调里，用 getState 读取当前 todos 长度并打印。
3. 故意让一个 selector 返回 `{count}` 新对象，观察无限重渲，再分别用 useShallow 与返回原始值两种方式修复。

## 三、思考题
1. 为什么 Zustand 可以没有 Provider 而 MobX 的 Reaction 也不需要？二者共享机制有何异同？
2. 如果同一 tick 内先后 set 两次互相依赖的值，函数式 set 能保证读到前一次结果吗？为什么？

## 四、延伸阅读
- Zustand 官方 docs：getting-started / typescript / limits
- React useSyncExternalStore 文档

## 五、自查清单
- [ ] create 用了正确的 curried 形式
- [ ] 所有 selector 返回值稳定（原始值或 useShallow）
- [ ] action 内使用函数式 set
- [ ] 非组件处用 getState 而非 hook
