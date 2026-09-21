# vite-vitest 面试题精选

> 共 12 题，覆盖 定位与配置 / 断言与 mock / 组件测试 / 覆盖率与工程 / 选型对照 五类。

---

## 一、定位与配置

### 1. Vitest 和 Jest 的关系与差异？迁移成本多大？

Vitest 定位 Vite 生态的测试 runner：API 兼容 Jest（expect/describe/it/mock 语义对齐），差异在底层——**用 Vite 的解析与 transform 管道**（ESM 原生、alias/插件共享）、默认 ESM + worker 并发、无 jest.config 那套 transform 胶水。有 Vite 项目迁移基本是改 import 源与配置搬家；Jest 项目没 Vite 就别硬迁（呼应 vite-vitest 第一节）。

**来源**：Vitest — "Milestones from Jest / Why Vitest"

### 2. test.globals、environment、coverage 各配在哪个文件？能独立于 vite.config 吗？

都进 `vite.config.ts` 的 `test` 段（或独立 `vitest.config.ts` 用 `mergeConfig` 继承主配置——插件要复用时后者更清爽）。globals:true 免 import 但要补 tsconfig `types: ["vitest/globals"]`，否则 TS 不认识 describe（呼应 vite-vitest 第一节）。

**来源**：Vitest — "Configuration Files / Global Config"

---

## 二、断言与 mock

### 3. vi.mock 的 hoisting 规则是什么？为什么工厂里不能引用外部变量？

`vi.mock` 被提升到文件所有 import 之前执行（否则 mock 赶不上被测模块的绑定），工厂函数也随之不能引用提升点之后的顶层变量——要引用用 `vi.hoisted()` 显式声明提升。部分 mock（保留真实实现改一个函数）走 `importOriginal`（呼应 vite-vitest 第二节）。

**来源**：Vitest — "mock hoisted / importOriginal"

### 4. vi.fn、vi.spyOn、模块 mock 三者各在什么场景用？

`vi.fn()`：完全无主意的替身，当回调/依赖注入位；`vi.spyOn(obj,'method')`：**保留原实现只窥探调用**（或临时换返回值），测"有没有调用 analytics.track"用它；`vi.mock('./mod')`：整模块级替身（网络层、重型依赖）。滥用模块 mock 会得到"测了个全 mock 世界"的假绿（呼应 vite-vitest 第二节）。

**来源**：Vitest — "Spy / Mock 文档"；测试通识

### 5. 假定时器怎么测防抖？给出关键三步。

```ts
vi.useFakeTimers()
await user.type(input, 'abc')      // 触发输入
vi.advanceTimersByTime(300)        // 时间快进超过 wait
expect(spy).toHaveBeenCalledTimes(1)  // 断言只调了一次
vi.useRealTimers()                 // 收尾归还
```
坑：忘了 `useRealTimers` 污染后续文件；Promise 微任务没 flush 导致"看起来没调用"——用 `vi.advanceTimersByTimeAsync` 或 waitFor（呼应 vite-vitest 第二节、svelte-testing 同款话题）。

**来源**：Vitest — "Fake Timers"

---

## 三、组件测试

### 6. jsdom 和 happy-dom 怎么选？它们的共同天花板是什么？

两者都是 JS 模拟 DOM：happy-dom 更快更轻、jsdom 覆盖更全（历史包袱兼容性好）。共同天花板：**没有真实布局引擎与渲染管线**——getBoundingClientRect 全是 0、观察器 API 缺失或走样、CSS 级联不完整。逻辑断言（渲染结构/事件/类名）够用；布局/滚动/截图回归必须 Browser Mode（呼应 vite-vitest 第三节）。

**来源**：Vitest — "Environment / happy-dom"；Browser Mode 文档

### 7. Vitest Browser Mode 与 Playwright 端到端测试的边界？

Browser Mode：**在浏览器里跑单元/组件测试**——测试代码本身进浏览器（或元素级驱动），粒度细、跑在 Vite dev server 上、HMR 级反馈；Playwright e2e：黑盒打整站、跨页面流程、真实部署形态。组件库选 Browser Mode（含截图回归），业务流程黄金路径选 e2e（呼应 vite-vitest 第三、四节、next-testing）。

**来源**：Vitest — "Browser Mode vs E2E"

---

## 四、覆盖率与工程

### 8. coverage provider v8 和 istanbul 的差异？thresholds 怎么用在刀刃上？

v8：Node/Chrome 原生计数，快、开销小，分支粒度略粗；istanbul：指令级插桩，分支/函数细节与报告一致性更好、稍慢。thresholds 支持 lines/branches/perFile 全局线——但**全局覆盖率是仪表盘不是 KPI**，更好的门禁是对 MR diff 的变更行覆盖（避免"给祖传大文件补 2000 行凑数"）（呼应 vite-vitest 第四节）。

**来源**：Vitest — "Coverage 文档"；diff coverage 工程实践通识

### 9. 测试跑得慢，给出你的提速排查顺序？

①先看结构：单文件巨型测试拆细（并行粒度）；②`isolate: false`（worker 复用，代价是 mock 卫生要求更高）；③pool threads vs forks 按依赖原生模块情况选；④只跑受影响：watch 默认/--changed/`vitest related`（pre-commit）；⑤最后才看环境：mock 掉真实网络/DB。顺序哲学：**先并行度与范围，再隔离性，最后才是硬件**（呼应 vite-vitest 第四节）。

**来源**：Vitest Guide — "Optimizing / 性能参数"

---

## 五、选型对照

### 10. 各框架的组件测试 API 不同，Vitest 层看到的共同面是什么？

vue-testing-library/react-testing-library/svelte 的 `render` 契约各异（04/05/11 包各学过），但共同面是：**查询以可访问性语义为主（getByRole）、断言 DOM 状态、userEvent 驱动交互**——框架差异被 testing-library 家族抹平，Vitest 提供环境（jsdom/browser）、mock、覆盖率与并发编排。一句话：**runner 与查询库解耦，换框架不换测试心法**（呼应 vue-testing、react-testing、svelte-testing）。

**来源**：Testing Library — "Community 跨框架共识"

### 11. monorepo 里 Vitest 怎么组织？每包一个配置还是统一？

两种皆可：每包独立 `vitest.config`（就近原则、包级差异大时用）；或根配置 `test.projects`（Vitest 2.x 起统一入口）声明 web/node/browser 多项目共享过滤与报告。配合 `vitest related` 与 Turbo 的 test 任务图，改哪个包跑哪个包（呼应 vite-vitest 第五节、vite-ci-perf 的 Turbo 线）。

**来源**：Vitest — "Projects 配置"

### 12. 前端库（要发 npm 的）用 Vitest 测，有什么特别注意事项？

①测 **dist 产物**（或 projects 造 build 前后双项目）防"源码绿、产物红"的打包回归；②条件导入/多入口（`.`/`./lite`）各配用例；③环境矩阵：node + jsdom + browser 三环境跑同一套契约测试（Vitest Environments 特性）；④覆盖率对接口层就够，别为 getter 补测试。与发包课程 node-publish、ts-publish 的"产物即被验物"纪律一致（呼应 vite-vitest 第二、五节）。

**来源**：Vitest — "Testing Library Code / multiple environments"
