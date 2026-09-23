# vue-testing 面试题精选

> 共 15 题，覆盖 A 工具与理念 / B 挂载与查询 / C 交互与异步 / D mock 与快照类。

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

---

## 补充（新专题 13-15）

### 13. 组件测试的「查询优先级」：getByRole 在 Vue 测试环境怎么落地？无障碍属性在模板里的多缺失对测试意味着什么？

Vue Testing Library 提 供 角 色 查 询（getByRole/findByRole），但 它 的 有 效 性 完全 取决 于 组 件 的 **语义 地 基**：按钮 用 `<button>` 不 是 `<div @click>`、输入 配 `label for/aria-label`、图 标 按 钮 有 可 访问 名——这 些 缺 一，测 试 只 能 退 化 回 class/test-id 查 询，「按 用 户 视 角」变 成 伪 命 题。所 以 **测 试 写 不 动 = a11y 缺 陷 的 报 警 器**：给 「删 掉 类 名 测 试 还 活 吗」一 个 机 器 判 据（类 名 查 询 出 现 在 PR diff = code smell）。操 作 顺 序：role → label/placeholder → text → test-id（最 后 手 段 且 test-id 命 名 要 业 务 语 义 而 非 样 式 语 义）；断 言 端 同 理：`toBeDisabled` 断 言 「按 钮 disabled」比 断 言 「出 现 了 .disabled 类」抗 重 构——行 为 断 言 的 第 一 公 民 是 **可 访 问 性 API**（ARIA 就 是 测 试 的 稳 定 公 开 契 约，与 「公 开 接 口 测 试」理 论 同 源，本关 查询 理 念 题 的 理论 终 点）。

**来源**：Testing Library query priority 文档；Vue Testing Library 角色查询实现。

### 14. 测试金字塔在 2020s 前端还成立吗？给一套 Vue 项目的现实测试配比、各层验收标准与「不测什么」。

修正 版 形 状：组 件 集 成 测 是 主 体（Testing Library 天 然 「通 过 UI 断 言 行 为」，单 元/集 成 合 流）、纯 函 数/组合 式 轻 单 测（无 mount 快 节 奏，覆 盖 复 杂 逻 辑 与 边 界）、E2E 很 少 且 只 打 关 键 旅 程（下 单/登 录，Playwright 带 真 后 端 或 契约 mock 的 选 择 要 显 式 表 态）。配 比 经 验 值：30 组 件 测 / 10 逻 辑 单 测 / 3-5 E2E，**倒 三 角（E2E 主 力）的 病 是 反馈 循 环 分钟 级 + 失败 诊 断 成 本**（排 查 一 条 红 的 E2E 时 间 够 写 五 条 单 元）。验 收 标 准 分 层：单 测 追 覆 盖 分 支、组 件 测 追 行 为 场 景 清 单（每 个 组 件 的 状 态 机 路 径 有 没 有 全 打 到）、E2E 追 业 务 健 康 度。不 测 什 么：第三 方 库 自 身（组 件 库 的 渲 染 快 照）、纯 样 式、编 译 器 包 治 的 样板（getter 同 款）——「测 试 是 给 未 来 改 代 的 放 心 券」，发行 决 定 哪 些 未 来 改 得 起：低 频 + 低 危 险 的 不 补 测（追 求 全 覆 盖 的 团 队 最 后 集 体 弃 疗，本关 快照 态度 题 的 经济 学 版）。

**来源**：Testing Pyramid 在 RTL 时代的修正论述（testing trophy 等）；Playwright 官方最佳实践。

### 15. CI 里的测试工程：并行、分层跑、失败归因、偶发红治理四件事的 Vue 项目实操。

并 行：Vitest 按 心 数 切 worker（`--max-workers` 控 CI 容 器 内 存 爆 炸，小 项 目 反 要 关 闭 isThread 类 隔 离 换 速）；分 层 跑：PR 只 跑 受 影 响 用 例（`--changed` 基 于 依 赖 图，组 件 测 主 体 的 红利），main 全 量 + 定 时 E2E 深 夜 跑。失败 归 因：统 一 报 告 格 式（junit 进 CI 面 板 按 套件 聚 合）、异 常 带 「场 景 说 明」（测 试 名 = Given/When/Then 句 子，「偶 发 红 的 诊 断 速 度」十 倍 于 断 言 详 情）；Vue 特 有：hydration/teleport 类 断 言 失 败 优 先 怀 疑 时 序 而 非 逻 辑（挂 载 操 作 忘 await 是 第 一 嫌 疑，本关 flushPromises 题 的 CI 规 模 化 版）。偶 发 红 治 理 三 刀：① 禁 时 间 相 关 裸 操 作（全 局 装 fake timers 基 线，只 有 主 动 释 放 才 走 真 时 钟）；② 禁 测 试 间 共 享（每 用 例 新 mount 与 新 pinia/router，全 局 事 件/URL 的 修 改 afterEach 复 位）；③ 隔 离 跑 复 现 器（`--no-isolate` 复 现 污 染、shard+重 跑 定 位 顺 序 敏 感）——超 过 三 个 月 未 治 的 红 名 单 直 接 删（测 试 债 也 是 债，本包 架构 关 工 程 纪 律 的 收 尾）。

**来源**：Vitest 并行/changed 模式文档；CI 偶发测试失败的隔离与复现通行策略。
