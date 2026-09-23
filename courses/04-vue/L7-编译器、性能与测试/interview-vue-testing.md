# vue-testing 面试题精选

> 共 12 题，覆盖 A 工具与理念 / B 挂载与查询 / C 交互与异步 / D mock 与快照类。

## 一、工具与理念（A 类）

### 1. 前端组件测试常用哪些层次？各解决什么？
大致金字塔：**单元**（纯函数、composable、store 逻辑）、**组件**（单组件渲染与交互，Vue Test Utils / Testing Library）、**集成/端到端**（Cypress/Playwright 跨页流程）。越往下越快越稳、越多；别把大量 E2E 当主力（呼应 node-testing 的分层）。
**来源**：Testing JavaScript — Testing Pyramid、Cypress 文档

### 2. 为什么 Vitest 在 Vite 项目里比 Jest 更顺手？
Vitest 直接复用 Vite 的转换管线与配置：天然支持 `.vue`（配 plugin-vue）、TS、路径别名、ESM，无需额外 babel/ts-jest 桥接，watch 与冷启动更快；API 又兼容 Jest，迁移成本低。
**来源**：Vitest 官方文档 — Why Vitest、与 Vite 共享配置

### 3. "按用户能看到的东西查询"是什么理念？为什么比绑 class 好？
这是 Testing Library 的核心：优先用文本、role、label 查询，断言用户可感知的行为，而非内部实现。绑死 `.btn-primary` 这类样式类，重构 CSS 会让测试全线变红——测的是"行为契约"而非"实现细节"（呼应 vue-testing 第三节）。
**来源**：Testing Library 理念 — So what are great tests?、getByText

## 二、挂载与查询（B 类）

### 4. `mount` 与 `shallowMount` 分别适合什么场景？
`shallowMount` 把子组件替换为桩，隔离被测单元，适合单组件的 props/事件/渲染逻辑；`mount` 渲染完整子树，适合验证父子协作的集成行为。默认优先 shallow，测协作再 mount（呼应 vue-testing 第二节）。
**来源**：Vue Test Utils 文档 — mount / shallowMount

### 5. `find`、`get`、`findAll`、`findComponent` 有何不同？
`find` 找不到返回空 DOMWrapper；`get` 找不到直接抛错（适合断言前置）；`findAll` 返回数组用于遍历；`findComponent` 返回子组件的 VueWrapper，可进一步拿它的 props/emitted/vm（呼应 vue-testing 第三、五节）。
**来源**：Vue Test Utils API — find、get、findComponent

### 6. 挂载后什么时候组件的 DOM 才真正可用？测试里如何体现？
Vue 组件在 `mounted`（onMounted）后 DOM 才完整可用，`mount` 会同步走挂载流程，但**数据驱动后的更新是异步**的。所以挂载后初值可读，交互后需 `await nextTick()` 再看 DOM（呼应 vue-lifecycle、vue-testing 第四节）。
**来源**：Vue.js 官方文档 — 挂载阶段、Vue Test Utils 异步更新

## 三、交互与异步（C 类）

### 7. `trigger` 和 `setValue` 分别用来做什么？
`trigger('click'/'input'/…)` 派发 DOM 事件模拟交互；`setValue` 是设置 `input`/`textarea`/`select` 值并自动触发对应 input/change 事件的便捷法，配合 v-model 尤其方便（呼应 vue-testing 第四节）。
**来源**：Vue Test Utils — trigger、setValue

### 8. 为什么很多"偶发红"的组件测试加上 `await flushPromises()` 就好了？
Vue 更新 DOM 走微任务队列（nextTick），若组件里有 `await` 的接口请求，trigger 后 Promise 尚未 resolve 就断言会读到旧 DOM。`flushPromises()` 冲刷所有挂起的微任务，等异步链路走完，DOM 才稳定（呼应 vue-reactivity-theory nextTick、node-testing async）。
**来源**：Vue Test Utils — 测试异步、flushPromises 技巧

### 9. 如何断言子组件向父 emit 了某个事件并携带正确参数？
用 `wrapper.emitted()`：`expect(w.emitted().submit).toBeTruthy()` 判断有没有触发，`w.emitted().submit[0]` 是第一次调用的参数数组，比对内容即可。这样验证父子契约而不依赖子内部实现（呼应 vue-component-basics emits、vue-testing 第五节）。
**来源**：Vue Test Utils API — emitted()

## 四、mock 与快照（D 类）

### 10. 测 Pinia store 时为什么要每个用例重建 pinia？怎么隔离路由和 fetch？
store 是单例，跨用例复用会把上一个用例改过的状态带过来（"串味"）。用 `setActivePinia(createPinia())`（常放 `beforeEach`）保证干净初始态。路由用 `createMemoryHistory()` 或 mock `$router.push`，网络用 `vi.mock` 或 msw 拦截（呼应 vue-pinia-advanced、vue-testing 第六节）。
**来源**：Pinia 文档 — Testing、Vue Router — Testing memory history

### 11. 快照测试的价值和陷阱分别是什么？
价值：快速锁定整体输出结构、改动时给出 diff 提醒，防手滑回归。陷阱：它只保证"和上次一致"，不保证"正确"——若基准本身是错的，错误会被固化；动态内容（时间戳、随机 class）造成脆断。结论：行为断言为主、快照为辅，且快照必须人工 review（呼应 vue-testing 第七节）。
**来源**：Jest/Vitest 文档 — Snapshots 的常见误用、Testing Anti-patterns

### 12. composable（如 useMouse）如何单测，不依赖任何组件？
可用一个极小的宿主组件 `mount` 后读它暴露的 ref，或用 Vitest 直接调用其纯逻辑部分；对含副作用/生命周期（effectScope、onScopeDispose）的，测试里 `mount` 一个临时组件并在 `unmount` 后断言副作用被清理。本质仍是"隔离 + 断言可观测输出"（呼应 vue-composables 的 effectScope、node-testing 的 mock）。
**来源**：Vue.js 官方文档 — 测试组合式函数、Vue Use 测试实践
