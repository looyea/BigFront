# solid-context-composition 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) Solid 的 context 是怎么被后代找到的？沿什么树解析？
**来源**：context 解析机制题的转述。

`createContext(defaultValue?)` 返回带 `.Provider` 的上下文对象。`<Ctx.Provider value>` 把值挂到自己这一子树，后代 `useContext(Ctx)` 沿**组件/Owner 树**往上找**最近的** Provider 取其 value。它依附的是渲染所有权结构，而非 React 那种"每次 value 变触发消费组件重渲"的订阅模型。

### 2. (B) `useContext(Ctx)` 拿到 undefined，排查了什么却还漏一个关键可能？
**来源**：context 取值排坑题的转述。

常见：忘了在祖先放 `<Ctx.Provider>`、Provider 和 useContext 用的不是同一个 createContext 返回对象（各自 new 了一份）、拼错导入。关键还漏：**没有 Provider 且 createContext 未给默认值时，useContext 会直接抛错**（不是静默 undefined）——如果你"拿到 undefined"往往是 Provider value 本身传了 undefined，或默认值就是 undefined。

### 3. (C) 和 React Context 相比，Solid context 在"值变化 → 消费者更新"上的根本差别？
**来源**：跨框架 context 对比题的转述。

React：Provider 的 value 一变，**所有** `useContext` 消费者重渲（要自己 memo/split 才减轻）。Solid：context value 本身不是响应式源，正确做法是**往里放 signal/store**，消费者读到哪个 signal 就订阅哪个——`count` 变不会惊动只读 `todos` 的消费者。所以 Solid 靠"共享响应式引用"而非"广播重渲"，天生细粒度。

### 4. (A) 什么是 Local Context 模式？它解决什么？
**来源**：Local Context 设计模式题的转述。

让一个组件成为"自己的状态容器"：组件内部 `createSignal`/`createStore` 建状态，通过 `createContext` 把这些响应式（连同 setter）作为 value 提供给子树，再导出一个 `useXxx = () => useContext(Ctx)` 收口。解决"一组协作子组件要共享状态、又不想污染全局、也不想 prop drilling"，且消费者仍细粒度更新。

### 5. (D) 设计：主题(theme)+语言(locale)全站共享，切换时只让真正用到它的文字/组件更新。怎么做？
**来源**：全局主题语言设计题的转述。

顶层建 `const [theme,setTheme]=createSignal(...)`、`const [locale,setLocale]=createSignal(...)`（或合并进一个 store），用两个 Provider（或一个持有 signal 的 Provider）把 **signal 本身**放进 context；深处 `useTheme()` 拿到的仍是 signal，`{theme()}` 只在用到处订阅。切主题只重算读了 theme 的绑定，没读的文字不动。

### 6. (A) 为什么"逻辑复用"在 Solid 里就是一个普通函数，而不是有特殊规则的 Hook？
**来源**：可复用逻辑=函数题的转述。

React Hook 有"只能在顶层调用/顺序不能变/依赖数组"等规则，因为它的正确性建立在"每次重渲按同序重放"上。Solid 不靠重渲驱动——一个普通函数里 `createSignal`/`createMemo`/`createEffect` 只要在**某个 Owner 作用域内**被调用即可，靠 signal 订阅 + Owner 回收运作，没有调用顺序魔法。命名成 `useXxx`/`createXxx` 只是约定。

### 7. (B) `useMouse` 里 `window.addEventListener` 却忘了 onCleanup，会怎样？为什么这跟 React 里很像但成因不同？
**来源**：复用函数清理题的转述。

组件销毁/该 effect 重跑时监听器不摘除 → 事件泄漏、回调持有已销毁作用域。React 里表现为 useEffect 忘 return 清理（靠依赖数组）；Solid 里 `createEffect` 每次重跑前会自动调用上一轮的 `onCleanup`、Owner dispose 时也调——**但你得注册** `onCleanup(()=>removeEventListener(...))`。成因都是"建立没配对拆除"，Solid 把配对点显式交给 onCleanup。

### 8. (C) 组合(children/render prop) vs 配置(一个组件收一堆 props/插槽对象)，Solid 官方为何偏向前者？
**来源**：组合优于配置题的转述。

因为 Solid 组件只执行一次、拆分几乎零成本（多一个 Owner 节点而已），用 children 插槽、render prop、专用小组件能把结构决定权交给父级、职责单一、可树摇；而"配置驱动的大组件"往往把一堆可选渲染逻辑塞进一处、难以类型化、复用粒度粗。倾向组合=倾向"用 JSX 本身当组合语言"。

### 9. (A) 想给一段子树临时"换一套 context 值"（如局部 dark 主题、局部只读态），怎么表达？
**来源**：局部覆盖 context 题的转述。

直接在那段子树外面再包一层同名 `<Ctx.Provider value=新值>`——按"最近 Provider"规则，其内 `useContext` 就拿到新值，出了这层又回到外层值。这就是嵌套 Provider 的作用域覆盖，常用于"这块区域强制某主题/权限/尺寸"，无需给组件加透传 prop。

### 10. (D) 一个复杂表单，字段组件分散在多层，既要共享表单 store、又想让某些字段能"往父注册校验器"。怎么组织？
**来源**：表单共享+反向注册设计题的转述。

用一个表单 store（createStore）经 context 提供给整棵表单树，字段组件 `useForm()` 拿到 store 直接读写各自 path（细粒度、不炸全树）；"往父注册校验器"用一个放在 context 里的**回调**（`registerValidator(fn)`，内部把 fn push 进一个 store/数组）或共享的 signals 列表——保持单向流：读走 store、注册走 Provider 暴露的 setter/回调。

### 11. (B) 团队把整个大 store 塞进一个 context、结果任何小改动全页都抖，是不是 Solid context 的锅？
**来源**：过度订阅归因排坑题的转述。

不是 context 的锅，是**用法**：把"一个大对象当不透明值传下去、大家都在顶层读它/或每次 spread 成新引用"会退化成粗粒度。正解是传 **createStore 的 store 本身**、消费者**按 path 读**（`store.user.name`）让 Proxy 只订阅那一路；别在 Provider 里每次 new 新对象当 value。细粒度是消费者的读法决定的，不是 context 决定的。

### 12. (C) 从 React 迁 context 相关代码，哪些"防御性优化"可以删掉？
**来源**：迁移减负题的转述。

可删：给 Provider value 套 `useMemo` 防全体重渲、把消费者 `React.memo`、拆 `useContextSelector`/多个细粒度 context 来减少重渲波及——这些是为对抗 React"value 变→消费者重渲"模型。Solid 里换成"把 signal/store 放进 context + 消费者惰性按路径读"，广播重渲问题不存在，上述包装大多多余。保留的是"把响应式引用放进 value"这一条正解。

🚀 实操请去做 L3 作业：复现 useContext 无 Provider 抛错、往 context 放快照 vs 放 signal、Local Context 收口、复用函数漏 onCleanup 四条线。

---

## 补充（新专题 13-15）

### 13.  为什么 Solid 里 context 共享大对象不像 React 那样引发全树重渲染？ 

 React 痛点源于 Provider value 引用变化即广播所有消费者；Solid 的 context 只是构造期注入的引用，其后谁读谁订阅、变化只通知触达路径——前提是值里放 signal/store 而非裸对象。 

**来源**： https://www.solidjs.com/docs/latest/api#createcontext 

### 14.  给依赖 context 的组件写单测，你的标准夹具？ 

 渲染工具函数包一层 Provider（或 Local Context 模式的 createXxx+useXxx+Provider 三件套），测试注入内存版实现；断言只针对行为，避免 mock useContext 内部——夹具即接缝。 

**来源**： https://www.solidjs.com/docs/latest/api#createcontext 

### 15.  一个复杂表单：字段组件分散多层，既要共享表单 store 又要局部覆盖，怎么设计？ 

 表单 store 进 context 供全树路径读写；字段私有校验用 Local Context 在字段子树内再包一层 provider 覆盖同名 key；全局默认与子树覆写两层语义清晰，避免把每字段状态上提大 store。 

**来源**： https://www.solidjs.com/docs/latest/api#createcontext 
