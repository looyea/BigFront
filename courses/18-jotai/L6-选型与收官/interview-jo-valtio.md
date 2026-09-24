# 面试题：Valtio proxy 路线（jo-valtio）

### 1. (对比类) Jotai 与 Valtio 最本质的差异？
**来源**：https://jotai.org/docs/introduction

Jotai 不可变原子 + 显式 get 依赖；Valtio 可变 Proxy 对象 + 自动追踪订阅。

### 2. (设计类) 为什么同作者要出两个库？
**来源**：https://github.com/pmndrs/valtio

覆盖两种心智偏好：原子函数式 vs 面向对象可变，各有所长。

### 3. (实战类) 深层表单嵌套编辑选哪个？
**来源**：https://github.com/pmndrs/valtio

Valtio 直接改 draft 字段省心；Jotai 需 focusAtom 或写回整对象（呼应 jo-focus-select）。

### 4. (对比类) Valtio 与 MobX 异同？
**来源**：https://mobx.js.org/README.html

都 Proxy 可变自动订阅；MobX 更重(OOP/transaction)，Valtio 极简。

### 5. (性能类) useSnapshot 的订阅粒度？
**来源**：https://github.com/pmndrs/valtio

只追踪组件实际读到的属性路径，改未读属性不重渲，类似细粒度。

### 6. (坑类) 在 render 里直接改 proxy state 会？
**来源**：https://github.com/pmndrs/valtio

应改在事件/action；渲染期改易致不一致与循环。

### 7. (设计类) 何时你会反过来选 Jotai 而非 Valtio？
**来源**：https://jotai.org/docs/

强调不可变纯函数、依赖图显式、大量离散原子或异步挂起时。

### 8. (对比类) 数据流可追踪性谁更好？
**来源**：https://jotai.org/docs/

Jotai/Zustand 显式 set 更易追踪；Valtio 可变直改可能散落各处。

### 9. (实战类) 如何在同项目共存？
**来源**：https://github.com/pmndrs/valtio

嵌套密集模块用 Valtio、异步/派生密集用 Jotai，一份数据一个归属。

### 10. (TS类) Valtio 的类型体验？
**来源**：https://github.com/pmndrs/valtio

proxy 保留对象类型，useSnapshot 给只读深 partial 类型。

### 11. (性能类) proxy 的性能开销点？
**来源**：https://github.com/pmndrs/valtio

Proxy 拦截 + 快照生成，超大对象高频改需评估。

### 12. (综合类) 给看板选 Jotai 还是 Valtio？
**来源**：https://jotai.org/docs/

列/卡离散原子 + 乐观 + 异步偏 Jotai；卡内深层可编辑对象偏 Valtio，可组合。

### 13. (趋势类) 信号标准会让 Valtio/Jotai 靠拢吗？
**来源**：https://github.com/tc39/proposal-signals

底层或趋同，但可变 vs 不可变两种 API 风格长期并存。

### 14. (设计类) 团队引入 Valtio 的守则？
**来源**：https://github.com/pmndrs/valtio

改状态集中到 actions、避免渲染期直改、与只读快照边界清晰。

### 15. (综合类) 一句话概括 Jotai/Valtio/Zustand 三角？
**来源**：https://jotai.org/docs/

原子不可变 / 可变 Proxy / 单 store selector——三种数据心智，按团队与数据形态选。
