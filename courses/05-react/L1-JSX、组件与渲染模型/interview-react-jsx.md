# react-jsx 面试题精选

> 共 12 题，覆盖 A JSX 本质 / B 语法差异 / C 插值与渲染 / D 编译与安全类。

## 一、JSX 本质（A 类）

### 1. JSX 是什么？浏览器能直接运行吗？
JSX 是 JavaScript 的语法扩展，形似 HTML但不是语言的一部分，浏览器无法直接执行。它经 Babel/esbuild/`@vitejs/plugin-react` 编译成 `React.createElement` 或新运行时的 `jsx()` 调用，返回描述 UI 的普通对象（React Element），再由 React 渲染成真实 DOM（呼应 react-jsx 第一节）。
**来源**：React 官方文档 — Introducing JSX、JSX in Depth

### 2. React Element 和 React Component、真实 DOM 三者区别？
Element 是**不可变的普通对象**（`{type, props}`），描述"要渲染什么"；Component 是返回 element 的函数/类；真实 DOM 是浏览器节点。渲染流程：组件函数执行 → 产出 element 树 → React 协调(diff) → 更新真实 DOM。element ≠ DOM 实例（呼应 react-render-model）。
**来源**：React 官方文档 — Elements and Components、Rendering Elements

### 3. 为什么说 JSX 让"逻辑和视图在一起"更自然？
因为 JSX 就是 JS 表达式：变量、三元、`.map()`、函数调用直接嵌在结构里，不需要模板语言单独的指令语法或字符串拼接。它是"在 JS 里写 UI"，类型检查、复用、IDE 补全全程在线（对照 vue-template-syntax 的模板编译，二者最终都到 render）。（呼应 react-jsx 第三、六节）
**来源**：React 官方 — Thinking in React、JSX 不强制但推荐

## 二、语法差异（B 类）

### 4. JSX 与 HTML 写法的几个主要不同？
`className`/`htmlFor`（避开关键字）、必须自闭合 `<img />`、单一根（否则用 Fragment）、`style` 传对象、事件 `onClick` 驼峰且传函数引用而非字符串、注释 `{/* */}`。根因是 JSX 会被当 JS 解析而非按 HTML 规则（呼应 react-jsx 第二节）。
**来源**：React DOM 元素 — Attributes、JSX Gotchas

### 5. 为什么要 Fragment？什么时候必须用带 key 的 Fragment？
Fragment `<>...</>` 让组件返回多个平级节点而不引入多余 DOM 包裹（避免破坏 flex/grid 布局）。在列表中为每个分组返回多元素、需要 `key` 时，`<>` 不支持 key，必须用 `<React.Fragment key=...>`（呼应 react-jsx 第二节、react-lists-keys）。
**来源**：React 官方文档 — Fragments、JSX 附加片段

### 6. `style="color:red"` 为什么在 JSX 里不合法？JSX 怎么写样式？
JSX 的 `style` 接收**对象**（键驼峰），因为它是传给 `createElement` 的 prop，不是 HTML 字符串属性：`style={{ color: 'red' }}`。也可用 CSS 类、CSS Modules、CSS-in-JS 库。动态值即 `style={{ color: state.c }}`（呼应 vue-class-style-transition 的 :style 对象）。
**来源**：React DOM — Styling & CSS、Inline Styles

## 三、插值与渲染（C 类）

### 7. `{}` 里能放语句吗？要写条件/循环怎么办？
不能放 `if`/`for`/`var` 等语句（无返回值）。条件用三元 `cond ? a : b` 或 `&&`，循环用 `array.map()`。复杂逻辑可先在 JSX 外算好变量再插值（呼应 react-jsx 第三节）。
**来源**：React — Conditional Rendering、List and Keys

### 8. `{false}`、`{null}`、`{0}` 渲染结果有何不同？带来什么坑？
`false`/`null`/`undefined` 渲染为空，但 **`0` 会渲染成字符 0**。坑：`{count && <X/>}` 当 count=0 会显示 "0"。修法：`{count > 0 && <X/>}` 或 `{count ? <X/> : null}`（呼应 react-jsx 第三节）。
**来源**：React Conditional Rendering — caution with numbers、常见 JSX 陷阱

### 9. `{list.map(item => <li key=.../>)}` 里数组为什么不用手动 join？
JSX 里放数组会自动展开逐项渲染，`map` 返回的元素数组天然被渲染。每个元素要唯一 `key` 供协调复用（呼应 react-jsx 第四节、react-render-model）。
**来源**：React Lists and Keys

## 四、编译与安全（D 类）

### 10. 经典 `React.createElement` 与自动 JSX 运行时的区别？
经典编译到 `React.createElement`，要求文件 `import React`。自动运行时（React 17+）编译到 `react/jsx-runtime` 的 `jsx/jsxs`，无需 import React、体积更小、更利于 tree-shaking，对 Fragment 也直接映射。配置项：TS `jsx:"react-jsx"`、Babel preset `runtime:'automatic'`（呼应 react-jsx 第六节、ts-project）。
**来源**：React 17 发布说明 — New JSX Transform、TypeScript 手册 jsx flag

### 11. 为什么直接 `dangerouslySetInnerHTML` 危险？如何安全渲染富文本？
它跳过 React 的自动转义，把字符串当 HTML 注入，若内容含用户输入即为 XSS 通道。安全做法：仅对可信来源使用，对用户/第三方富文本先经 DOMPurify 等白名单清洗再注入（呼应 react-jsx 第五节、vue-template-syntax v-html、exp-security/OWASP XSS）。
**来源**：React — dangerouslySetInnerHTML 文档、OWASP XSS Prevention Cheat Sheet、DOMPurify

### 12. JSX 里事件为什么传函数引用而不是 `onClick="doThing()"`？
JSX 不是字符串 HTML，`onClick` 的值是 JS 表达式。`onClick={doThing}` 传函数引用待触发调用；写成 `onClick={doThing()}` 会在**渲染时立即执行**并把返回值当 handler——这是经典 bug。需要传参用箭头包一层 `onClick={() => doThing(id)}`（呼应 react-jsx 第二节、react-useeffect 闭包）。
**来源**：React Handling Events、JSX 事件绑定常见错误
