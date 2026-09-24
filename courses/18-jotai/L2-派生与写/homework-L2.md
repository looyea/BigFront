# L2 作业：派生与写

## 一、知识回顾
1. 派生 atom 的惰性缓存与依赖追踪机制。
2. write-only atom 作为 action 的定位与触发方式。
3. 自动批处理与依赖图传播对渲染次数的影响。

## 二、代码实操
1. 用 itemsAtom + filterAtom 派生 visibleAtom，实现列表过滤。
2. 写一个 loginAtom(write-only)：含空值校验，async set token 与 user。
3. 同一次点击里 set 三个相关 atom，用 Profiler 观察渲染次数，验证批处理。

## 三、思考题
1. 派生 atom 的 getter 为什么绝不能写状态？
2. 与 Zustand 相比，Jotai 的自动依赖在什么场景更省心、什么场景更需警惕？

## 四、延伸阅读
- Jotai：core/atom、primitives、advanced/atom-patterns
- SolidJS 自动依赖追踪对比

## 五、自查清单
- [ ] 派生只读、无副作用
- [ ] action 用 write-only atom 集中多原子写
- [ ] 高频 atom 已隔离/节流
- [ ] 无循环依赖
