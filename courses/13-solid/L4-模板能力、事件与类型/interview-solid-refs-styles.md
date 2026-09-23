# solid-refs-styles 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) Solid 里 ref 的赋值发生在什么时机？为什么这个时机决定了你要不要用它？
**来源**：ref 时序题的转述。

赋值在**元素创建时、把它加入 DOM 之前**发生。含义：`let el; <div ref={el}/>` 在组件执行后 `el` 就已指向那个（可能还没进文档的）元素；但"需要元素已在文档里"的操作（量尺寸、聚焦、传给第三方）仍要等 `onMount`。想在入 DOM 前配置它（挂属性/监听），用回调形式 `ref={(el)=>...}`。

### 2. (B) `let el; <Show when={on}><p ref={el}/></Show>`，关掉再打开后 el 指向失效节点，为什么？怎么修？
**来源**：条件元素持有 ref 排坑题的转述。

变量赋值形态只在元素创建那一瞬写 `el`，`<Show>` 卸载时并不会把它置回、重挂时又是新节点——你手里 `el` 是旧的、已脱离文档的引用。修：**用 signal 作 ref** `ref={setEl}`，挂载时 `setEl(新元素)`、卸载时 `setEl(undefined)`，让引用随元素生命周期自动同步。

### 3. (A) 转发 ref 时，子组件收到的 `props.ref` 是什么？为什么这让代码更简单？
**来源**：ref 转发挥手题的转述。

无论父传的是"简单变量"还是"回调函数"，子组件收到的 `props.ref` **一律是回调函数**。所以子只要把自己要暴露的元素写 `<canvas ref={props.ref}/>` 即可，不必 `typeof` 判断该赋值还是调用——React 那套 `forwardRef`/判断 ref 形态的心智在这里被省掉了。

### 4. (C) 官方为什么不推荐 getElementById/querySelector 操作 Solid 的 DOM？
**来源**：选择器不可靠题的转述。

Solid 元素随状态增删，同一选择器可能命中"现在渲染出的另一个同 id/class 元素"、且你必须等它挂载。ref 在模板层就把引用**绑定到这一块具体的 JSX**，不受重复选择器污染、不需要查询、随组件生命周期干净回收。JSX 也能当值（`const el=<p/>`）但会割裂结构——ref 是"保持 JSX 完整性"的正解。

### 5. (A) `use:` 指令和回调 ref 有什么相同与不同？它的函数签名是什么？
**来源**：自定义指令题的转述。

签名 `(element: Element, accessor: () => any) => void`，都在渲染时、元素入 DOM 前被调用，都能对元素做副作用。不同：① 指令可**一个元素叠多个**；② 第二参是 **accessor**，能接收随 signal 变化的响应式值（回调 ref 只给一次 el）。指令内部可自由 `createSignal`/`createRenderEffect`/加监听（配 `onCleanup`）。典型 `use:model` 双向绑定。

### 6. (B) 为什么 `use:directive` 从单独文件导入时 TS 可能把它的 import 树摇掉？怎么处理？
**来源**：指令 import 被误删题的转述。

TS 见指令只出现在 `use:` 里、以为它是类型，就可能在编译期删掉 import。解法：`babel-preset-typescript` 配 `onlyRemoveTypeImports:true`；用 vite-plugin-solid 则设 `solidPlugin({typescript:{onlyRemoveTypeImports:true}})`；或在使用模块里保留一句对指令的引用（`directive`）防止 tree-shaking。

### 7. (C) `class={cond()?'a':'b'}`、`classList={{a:cond()}}`、`style={{width}}` 在 Solid 里为什么会"不重渲就更新"？
**来源**：属性响应式绑定题的转述。

因为**任何读了 signal 的 JSX 属性都会被编译成一个只负责该属性的 render effect**：`cond` 变→只 `setAttribute('class')` / 切某个 class / 只改那条 style 属性。组件一次都不重跑。`classList` 适合按布尔批量开关类（避免手拼空格/覆盖），`style` 对象由 Solid 逐项 setProperty。

### 8. (A) Solid 自带 CSS-in-JS 或作用域样式吗？实际项目里怎么做动态与隔离样式？
**来源**：样式方案中立性题的转述。

不带。Solid 对 CSS 完全中立，把"响应式更新到 DOM 属性"做好即可。隔离靠通用手段：普通全局 CSS + 约定命名、CSS Modules（`styles.btn`）、或 UnoCSS/vanilla-extract 等构建期方案。动态样式优先 `classList`/`style` 绑定，**不是**"每帧重算的内联 JS 字符串拼接"。

### 9. (D) 设计：一个 `<Tooltip>` 需要拿到触发元素的 DOM 计算位置，又要能被父组件转发引用，还希望触发元素可被 `<Show>` 卸载。怎么组织 refs？
**来源**：多形态 ref 组合设计题的转述。

触发元素用 **signal-as-ref**（`const [trigger,setTrigger]=createSignal()`，`ref={setTrigger}`）适配 `<Show>` 增删；位置计算放进 `createEffect(()=>{ trigger() && position(trigger()); })`（读到节点才算），卸载时 signal 自动置 undefined；对父暴露则把收到的 `props.ref`（回调）在 trigger 变化时转发调用。避免任何 querySelector。

### 10. (B) `<div ref={el => { el.offsetWidth }} />` 里量到的尺寸可能为 0 或元素不在文档中，为什么？怎么量才准？
**来源**：入 DOM 前访问排坑题的转述。

回调 ref 在**元素加入 DOM 之前**执行，此时 `offsetWidth` 等布局量还不可用（未进文档流）。要量真实尺寸放进 `onMount`（已过挂载），或 `requestAnimationFrame`/`ResizeObserver`（配 `onCleanup` 关闭）。别在 ref 回调里做依赖"已在文档中"的读取。

### 11. (C) 和 React 的 `useRef`+`forwardRef`+`useImperativeHandle` 相比，Solid 的 ref 体系少了哪些仪式？
**来源**：跨框架 ref 对比题的转述。

React 要 `useRef`、`forwardRef` 包组件、`useImperativeHandle` 暴露方法、还得判断 ref 是对象还是函数。Solid：变量/回调/signal 三选一直接用，转发时子组件只需把 `props.ref` 挂到自己元素上（收到的恒为回调），暴露命令式方法就是"往 ref 元素上挂属性"或用 context 给 setter。没有专用 API、没有重渲时机纠结（呼应 react-to-solid-migration）。

### 12. (D) 场景：一屏虚拟滚动的表格，每行 DOM 会被回收复用。你该用 ref 的哪种形态跟踪"当前第 i 行渲染到的真实元素"，为什么不能用 `let el` 一次性赋值？
**来源**：DOM 回收复用下的引用管理题的转述。

用 **signal-as-ref**（或回调里 `setRowEl(i, el)`），因为虚拟滚动的行元素会不断被替换/回收，`let el` 只在首次创建写一次、之后指向旧节点。signal 能在每次该单元格重新绑定新元素时被 setter 刷新，配合 `<For>` keyed 让每行的 signal 各自独立、回收时置空，引用永远指向当前真实 DOM。

🚀 实操请去做 L4 作业：复现 signal-as-ref 于 Show/虚拟列表、ref 转发、指令双能力、classList vs style 动态。

---

## 补充（新专题 13-15）

### 13.  命令式改过 ref 元素（手动 style/class）后再被响应式绑定更新，会踩什么坑？ 

 细粒度写入按绑定通道覆盖，手动改动同名通道会被无声冲掉；规范是命令式改动与声明式绑定不相交，或统一改到 CSS 变量/类 token 这类受控通道上。 

**来源**： https://www.solidjs.com/docs/latest/guides/ref 

### 14.  class、classList、className、tokenList 四种写法，各自语义与选型？ 

 class 是 Solid 扩展（可函数式/可对象）、className 走原生 attribute、classList 对象逐键、tokenList 逐 token 比对；高频切换选 classList/tokenList 的键级更新，字符串拼接 class 是粗化退化。 

**来源**： https://www.solidjs.com/docs/latest/jsx#class-and-className 

### 15.  实现一个图片懒加载 use 指令：观察、加载、卸载清理与 SSR 怎么设计？ 

 指令内 IntersectionObserver 观察，进入视口赋 src（一次性），onCleanup 里 unobserve+关闭；SSR 输出 loading=lazy 兜底、指令不运行；可配置参数走表达式对象传入，注意其更新会重入指令。 

**来源**： https://www.solidjs.com/docs/latest/api#use%3A 
