# solid-components 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 编译器把 `<MyComp a={x()} />` 编译成什么？组件到底执行几次？
**来源**：createComponent 机制题的转述。

编译成 `createComponent(MyComp, { get a(){ return x(); } })`：新建一个子 Owner、把 props 包成 getter/Proxy，然后 `untrack(()=>MyComp(props))` **调用一次**。之后的更新不发生在组件调用层，而在它读 signal 时建立的那些 DOM 绑定上。所以组件函数只跑一次。

### 2. (B) `function C({title}){return <h1>{title}</h1>}` 为什么标题不更新？
**来源**：解构冻结 props 题的转述。

props 的每个键是 getter，`{title}` 解构相当于在组件执行那一瞬对 getter 求值、把结果存进普通变量 `title`。此后父级改了 title，也没人去重跑这段函数，`title` 永远是首次快照。正确：JSX 里 `{props.title}`（用到的地方惰性读，触发 getter 订阅）。

### 3. (A) props 读起来是 `props.x`，signal 读起来是 `x()`，为什么手感不同？
**来源**：props Proxy vs signal getter 题的转述。

props 是编译器生成的 **Proxy/带 getter 的对象**，访问属性 `props.x` 这个动作本身就被拦截、从而订阅上游；而 `createSignal` 返回的 getter 就是那个函数，必须**调用** `x()` 才算"读"。两者都是"读时订阅"，只是订阅的触发形态一个是属性访问、一个是函数调用。

### 4. (C) 和 React 函数组件相比，Solid 组件在"重执行"上的根本区别是什么？
**来源**：跨框架组件模型对比题的转述。

React 函数组件是"给定 props/state → 返回 UI"的纯渲染函数，每次状态变化都**重新执行**整函数、产出新虚拟 DOM 再 diff。Solid 组件**只执行一次**建立真实 DOM 与订阅，变化由细粒度 signal 直接驱动到具体绑定，不重跑组件。代价是必须理解"读要惰性、别解构"，收益是没有 re-render、没有 diff（呼应 svelte 编译派）。

### 5. (B) 为什么不能 `props.count = 5` 或 `props.onChange = fn`？子要给父传数据怎么办？
**来源**：单向数据流题的转述。

Solid 强制 one-way flow，props 是从父到子的**只读/不可变**值，改它既不符合模型也拿不到响应。子回流父：① 父传 `onXxx` 回调、子调用；② 状态提升到共同父级；③ 经 context 共享 signal/store。三条都保持"读走 props、改走 setter/回调"。

### 6. (A) mergeProps 和 `{...a, ...b}` 的区别？它怎么"合并"多个来源？
**来源**：props 合并工具题的转述。

展开运算符会**立即求值**每个 prop、丢掉 getter 惰性；`mergeProps` 返回一个 Proxy，get 时**逆序**遍历各来源、返回第一个有定义的属性（函数来源经 memo 解析以保响应）。所以它能"传默认值 + 覆盖"且保持响应式：`mergeProps({size:'md'}, props)`。

### 7. (A) splitProps 解决什么问题？给个"吃掉几个 prop、其余转发到根元素"的例子。
**来源**：props 拆分题的转述。

普通解构 `{type, ...rest}=props` 会破坏 rest 的响应式。`splitProps(props,['type','onClick'])` 返回 `[local, rest]` 两个 Proxy，订阅关系不丢：`const [local,rest]=splitProps(props,['type']); return <input {...local} {...rest}/>;` 等价 React 的 `...rest` 但保惰性。

### 8. (B) `props.children` 在哪个作用域求值？想让"子把数据回填给父渲染"该怎么做？
**来源**：children 求值时机与 render prop 题的转述。

children 在**父作用域**作为 prop 传入时就已求值，子组件只是把它插入某 DOM 位置，不会每帧重算。要"子回填值给父"，React 的 `Children.map` 克隆不适用，Solid 用 **render prop / 回调函数 prop**：`<List items={data} render={item=><Row .../>}/>`，List 内部调 `props.render(item)`。

### 9. (C) `Component` / `ParentComponent` / `VoidComponent` / `FlowComponent` 各约束什么？
**来源**：组件类型家族题的转述。

`Component<P>`：`(props:P)=>JSX.Element`，基础。`ParentComponent<P>`：可接可选 `children`。`VoidComponent<P>`：禁止 children。`FlowComponent<P,C>`：要求特定形状 children（如 `<For>` 的回调）。用类型能在编译期挡掉"给不该有 children 的组件塞 children"。

### 10. (B) 同事把 signal 直接当 prop 传：`<C n={count}/>`（少写了 `()`），会怎样？
**来源**：传函数 vs 传值题的转述。

`count` 是 getter 函数本身，`{ get n(){return count} }` 传进去的是**函数引用**，子组件里 `props.n` 拿到的是函数不是数字，`{props.n}` 渲染会出错/显示函数。要么 `<C n={count()}/>`（但那样 n 变化时靠父组件的 getter 重取——props 编译器已把 `count()` 变成 getter，会更新），要么用 `mergeProps`/直接传 accessor。要点：JSX 属性 `n={count()}` 会被编译成惰性 getter，故能更新；传裸 `count` 则语义错。

### 11. (D) 设计一个 `<DataTable>`：列定义由父传、每格渲染可自定义、行数据响应式。用哪些组件层机制？
**来源**：组合式组件设计题的转述。

列/行用 props 传入（父作用域求值），"每格自定义渲染"用 **render prop**（`renderCell={(row,col)=>...}`）或 children 插槽；内部用 `<For each={props.rows}>` keyed 遍历、`<Show>` 处理空态；`splitProps` 把组件自己的配置 prop 和要转发给 `<table>` 的 rest 分开；响应式行数据走 store/`<For>` 保证"改一格刷一格"。

### 12. (C) 从 React 迁一个用了大量 `useMemo/useCallback` 稳定 props 的组件到 Solid，这些还必要吗？
**来源**：迁移心智减负题的转述。

大多不必要。React 用 memo/useCallback 是为对抗"父重渲→子重渲/props 引用变导致子重渲"。Solid 组件不重渲、props 是 getter、子只在读到 signal 变化时更新，没有"引用相等防止重渲"这回事。迁移时删掉这批稳定化包装，改成正确的惰性读 + signal/memo 即可（react-to-solid-migration 展开）。

🚀 实操请去做 L3 作业：复现解构冻结、mergeProps/splitProps、render prop 回填、传裸 signal 四道题。
