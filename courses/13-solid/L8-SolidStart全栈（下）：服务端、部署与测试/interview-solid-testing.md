# 测试 · 面试题

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) @solidjs/testing-library 的 render 为什么收一个函数而不是元素？

`render(() => <App />)`——Solid 的 JSX 是**编译进真实 DOM 构建**的副作用代码，把组件包在函数里延迟到库控制的容器/Owner 作用域中执行，才能管好创建与清理生命周期。这也是它与 react/preact 版签名上最显眼的一处差异。
**来源**：官方 README「key differences」render 条目转述。

### 2. (A) 为什么这个库没有 rerender 方法？想更新被测 UI 怎么办？

Solid 不重渲染组件——响应式状态变化触发的是改 DOM 的副作用。测试里把要变的量做成（全局）signal，setter 一调 DOM 即更新，不存在"再渲染一遍"的概念。
**来源**：README 对 no rerender method 的原文解释转述。

### 3. (B) 同事每个断言前都套 waitFor，你按官方口径怎么纠？

Solid 响应式变化相当即时，rarely need waitFor/findBy——只有 transition、Suspense、Resource、路由导航这类真异步边界才等。滥用 waitFor 是 React 肌肉记忆平移，掩盖真实时序问题还拖慢测试。
**来源**：README 异步查询适用段落转述。

### 4. (A) location 选项解决了什么？用了它为什么必须配 findBy？

render 的扩展 `location` 参数直接起一个指向该路径的**内存路由**（依赖 @solidjs/router），免手写 Router/Route 样板。路由搭建非即时，官方示例即 `await findByText(...)`。换别的路由库要改用 wrapper 选项。
**来源**：README location 用法与注意事项转述。

### 5. (B) Vitest 里 "dispose is not a function"、router 死活加载不上，官方点名的根因？

`solid-js`（及 `@solidjs/router`）**被装载了两份实例**——vite 内部 server 一份、node 一份，单例假设破裂。方向是保证依赖单实例；插件 2.8.2+ 已代配多数测试所需，剩余按 globals/coverage 微调。
**来源**：README Known issues 一节转述。

### 6. (B) Jest 跑组件测试报 Solid 服务端版本相关错误，缺了什么？

Jest 在 Node 里默认解析到 Solid 的**服务端构建**；官方推荐装 `solid-jest` 修正为浏览器版本。另配 `@testing-library/jest-dom` 可用 DOM 断言匹配器。
**来源**：README Installation 段 jest/solid-jest 建议转述。

### 7. (A) renderHook 在 Solid 版为什么"没有 container/queries、但有 owner"？owner 拿来干嘛？

纯响应式逻辑不需要 DOM 宿主即可运行，所以不给容器与查询；返回的 `owner` 配合 `runWithOwner` 把后续 effect/computation 挂回被测作用域，cleanup 测试后自动执行。不需要组件上下文的 hook，官方说 createRoot 就够。
**来源**：README renderHook API 说明转述。

### 8. (C) testEffect 和 waitFor 都能测异步，机制差别是什么？

waitFor 是**轮询**——不搭 Solid 响应式的车；testEffect 在受控 owner 里跑真 createEffect，靠响应式驱动下一步、`done()` 交付 Promise。测"effect 链式推进"这类逻辑，testEffect 语义更准也不浪费时间。
**来源**：README testEffect 引入段转述。

### 9. (D) 给一个 use: 自定义指令写测试，用什么、怎么断言？

`renderDirective(myDirective, { initialValue, targetElement })`——返回常规结果外加 `arg/setArg`；改 `setArg("x")` 后断言 `asFragment()` 的 DOM 变化即可。这是官方为 Solid 指令文化开的专门后门。
**来源**：README renderDirective 段与示例转述。

### 10. (C) 用这套库测 createResource / Suspense 组件，与测普通组件有何不同？

普通组件：同步断言、signal 驱动更新即可；Resource/Suspense 属官方点名的真异步边界——要 `findBy*`/waitFor 等解析，必要时以全局 signal 或 mock fetch 控制完成时序。分层上这类也可下沉到 E2E 更真实。
**来源**：README 异步例外清单延伸的对比题转述。

### 11. (D) 给一个 SolidStart 全栈项目设计测试金字塔。

底层：纯响应式/store/hook 用 createRoot+renderHook+testEffect（快、无 DOM）；中层：组件用 testing-library（render 函数式、location 测路由页、renderDirective 测指令）；顶层：Playwright 级 E2E 覆盖导航、服务端函数往返与水合后链路；Vitest 管前两层并盯死双实例坑。
**来源**：testing-library 定位语与官方模板生态归纳的分层实践转述。

### 12. (A) 库 wrapper 配 Context 测依赖上下文的组件，README 特意警告的坑是什么？

wrapper **必须永远返回 props.children**——尤其内层有异步代码套 `<Show>` 时：hook 的值只在同步阶段取一次，children 一旦缺席就只拿到 undefined 且原因难猜。这是官方原文点名的行为。
**来源**：README renderHook wrapper 警告段转述。

---

## 补充（新专题 13-15）

### 13.  服务端函数调用链（RPC 桩）在测试里 mock 什么层最合理？ 

 mock 被导入的服务端模块本身（编译桩与其等价），不 mock 底层 fetch——保留参数序列化验证但绕开网络；集成层再用真实 server 函数跑端到端，两层职责分清。 

**来源**： https://vitejs.dev/guide/ ； https://github.com/solidjs/testing-library 

### 14.  什么时候值得起 Playwright 端到端，而不是组件测试？ 

 跨页导航+cookie/重定向链、水合正确性、无 JS 渐进增强路径这三类只有 e2e 能覆盖；金路径一两条+关键异常各一，其余下沉到组件与函数层，防慢测拖垮 CI。 

**来源**： https://playwright.dev/docs/intro 

### 15.  SSR 水合错误怎么在 CI 里捕获？ 

 e2e 里监听 console/pageerror 断言零 hydration 警告；单测侧对同一组件分别跑 renderToString 与客户端渲染对比 HTML 快照，服务端分支（isServer）逻辑的测试矩阵要显式枚举。 

**来源**： https://docs.solidjs.com/ 
