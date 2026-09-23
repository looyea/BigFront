# svelte-testing 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与测试专项面经高频主题的转述。

---

### 1. (A) Svelte 组件测试为什么必须走 vite/编译管线？这和"测的就是跑的"原则有什么关系？

**来源**：Testing Library 官方指南 — 环境配置动机

`.svelte` 是编译器专有格式，Node/Vitest 直接 import 只会当未知扩展名报错；`@testing-library/svelte` 之所以存在，就是在 Vite 管线内让测试 import 到**与生产同一编译器输出**的组件。推论：跳过 preprocess 的"手工预编译再测"测的是过期产物；配置漂移（测试用 dev 编译选项、生产用 prod）会造成"测试绿线上红"。加分：组件测试挂载的是真编译产物+$effect 运行时，生命周期、清理全部真实发生。

### 2. (B) `await fireEvent.click(btn)` 之后立刻断言 fetch 结果，偶发红；为什么"偶发"？

**来源**：Stack Overflow — testing-library async flaky 经典分析

fireEvent 的 await 只让出**一个微任务轮次**：够 Svelte flush 掉 click 引发的状态更新，但不够走完 `onClick → fetch → then → setState → 再 flush` 的 Promise 链。偶发性来自真实网络 mock 的解析时机在宏/微任务间浮动。稳定解：`waitFor`（轮询到超时）或 userEvent + 显式 await 数据钩子。引申考点：flaky 测试的三类根因（时钟、并发、顺序依赖）与"重试掩盖不是修复"的工程态度。

### 3. (A) render 返回的 `component` 句柄和 `unmount()` 各自的意义？Svelte 5 下改 props 的正确姿势为什么不是 `component.$set()`？

**来源**：@testing-library/svelte v5 迁移说明

句柄用于逃生舱（访问 `export function` 暴露的方法，呼应 svelte-component-composition）；`$set` 是 legacy 实例 API，runes 组件的 props 是**单向输入信号**，外部改它破坏数据流模型。正解：改 props 触发重渲染 → **重新 render**（传新对象）；测响应式联动 → 让"变化的源"进组件（props 传回调/初始值，交互驱动）。这题实际在考古"组件实例可变"到"props 不可变+信号流"的范式迁移。

### 4. (C) 对比 @testing-library/svelte、Vitest browser mode、Playwright 三种"浏览器里/外"测试路线的取舍。

**来源**：前端测试选型圆桌纪要 — Vitest 浏览器模式专栏

- Testing Library + jsdom：快（毫秒级）、覆盖 80% 交互逻辑；盲区是布局/动画/真实事件序列。
- Vitest browser mode：同一套 API 驱动真浏览器（Playwright/WDIO 后端），能测 CSS/动画/焦点，但基建成本与速度介于两者之间。
- Playwright E2E：全链路（路由、网络、多标签），最慢最贵，负责"用户旅程"不负责"分支覆盖"。
答题框架：金字塔比例 + "哪个 bug 只有哪层抓得到"。jsdom 测不了 transition 过程、browser mode 不测部署环境——各层不可替代。

### 5. (B) 全局状态模块（`.svelte.js` 单例）让测试之间互相污染，列举三种治理手段与优劣。

**来源**：状态管理测试面经 — 单例可测性设计

① 模块导出 `reset()`，`beforeEach` 调——最便宜，但要求模块自律（L4 立的规矩）；② **工厂形态**：模块只 export `createXxx()`，应用层持有单例、测试层随意 new——隔离最彻底，是官方推荐方向；③ `vi.resetModules()` + 动态 import 每个用例拿新模块实例——遗留代码无侵入，但 setup 变绕。深层考点：单例是"全局可变量"，可测性设计=依赖注入的轻量实现。

### 6. (D) 给一个"表单页：校验→提交→成功跳转"写测试方案，三层各测什么？

**来源**：高级面前端 — 测试分层设计题

纯函数层：`validate(values)` 的分支表（必填/格式/边界）——最快最多；组件层：render 表单，`userEvent.type` 错误邮箱 → `findByText('格式不对')`（查询用语义、报错用 role=alert）→ 改正 → mock fetch 断言调用参数与 loading 态；E2E：真后端/拦截网络跑全流程 + `expect(page).toHaveURL('/ok')`。判分点：知道**校验规则不要在三层重复测**、提交 payload 在组件层 mock fetch 断言而非留到 E2E——"错误归层"是设计能力。

### 7. (A) 假定时器与 Svelte 的微任务 flush 相撞会出什么诡异现象？怎么破？

**来源**：Vitest GitHub discussions — fake timers + 微任务饥饿答疑

`vi.advanceTimersByTime`（同步版）只拨宏任务队列，若断言夹在"setState → 微任务 flush"之间，DOM 还没更新→查不到元素；更糟的是被挂起的微任务链在下一个用例爆发。破法：① `advanceTimersByTimeAsync` 每步 await，让微任务自然清空；② 或 `vi.useFakeTimers({ toFake: ['setTimeout'] })` 精防过窄/过宽；③ 组件自带时钟注入点最佳。一句话：**假的是表，微任务永远是真的**。

### 8. (C) React Testing Library 强调"不用 act，fireEvent 已内置"，Svelte 测试里有没有对应概念？

**来源**：Testing Library 跨框架 API 差异对比帖

Svelte 5 没有公开 `act`——因为更新由微任务自动 flush，测试库在事件派发后 `await tick()` 语义已并入 fireEvent/userEvent 实现。历史上 React 的 act 存在是因为并发模式下更新可能被调度/插队，需要测试端手动"快进渲染"。追问点：Svelte 测试里手动 `await tick()` 仍合法（如 rAF 回调后），但**不需要每步都包**——这正是"框架执行模型决定测试 API 形状"的实例。

### 9. (B) CI 上组件测试本地全绿、流水线上偶发挂，从测试环境角度列排查清单。

**来源**：前端工程化面经 — flaky CI 诊断

① 并发数：jsdom 用例间若共享全局态（window/单例），worker 并行放大竞态——先 `--no-parallel` 复现定性质；② 时区/locale：断言格式化日期没固定 `TZ`/`Intl` 环境；③ 随机性：mock 数据用 `Math.random` 未 seed；④ 超时阈值：CI 机器慢，`waitFor` 默认 1s 撞线——调 testTimeout 而非加 sleep；⑤ 快照跨平台行尾/路径分隔符。答题结构："本地绿线上红=环境差异"，逐项拆差异源。

### 10. (D) 要测一个用了 `getContext` + `$bindable` + transition 的复合组件，给出可行测试设计与不可测部分的移交方案。

**来源**：组件库维护者面试 — 可测性架构题

可测：壳组件包 provider 喂 context；`$bindable` 用父绑变量后 `fireEvent.input` 断言父变量变化；transition 只断言**最终态**（jsdom 不等动画——`waitFor` 终值或 `style.visibility` 结果）。不可测移交：动画曲线/合成层表现→Playwright `toHaveCSS`+截图基线；无障碍焦点陷阱→ axe 插件（jest-axe）+ E2E 双保险。核心展示"知道边界并把不可测部分降级/上移"的成熟度。

### 11. (A) E2E 里 `await page.locator('#submit').click()` 被反指"脆弱"，可访问性定位器强在哪？

**来源**：Playwright 官方最佳实践 — 定位器策略章节

`#id` 绑定的是**实现细节**（改名/换 UI 库即碎）；`getByRole('button', { name: '提交' })` 绑定的是**用户感知**（屏幕阅读器读到的角色+可及名），顺带持续回归验证无障碍质量：ARIA 角色被删掉时 E2E 变红=自动发现无障碍退化。再上层是 `getByTestId`：给无标签元素的逃生门，但要团队治理命名。考点本质：定位器是"测试与产品的契约面"，契约要立在用户侧。

### 12. (C) "Svelte 测试比 React 简单"这个说法，你能举出三个机制级理由和一个反例吗？

**来源**：跨框架开发者体验讨论汇编

理由：① 无 act/渲染批处理心智——事件后微任务 flush 天然对齐；② 无 memo/stale closure 家族 bug（组件体不重跑）；③ 挂载即真编译产物、无 hydration 双路径分歧（SSR 测试归 E2E）。反例：runes 的位置限制让"测试里直接 new 组件状态"不可能（必须经 props/交互驱动），比 React 直接测 hook（renderHook）少了个快捷通道；Vue 有专属 TestUtils 操作实例，Svelte 的等价物更薄。答题价值在"没有银弹"的边界感。

---

## 补充（新专题 13-15）

### 13.  全局 .svelte.js 单例状态会让测试相互污染，你怎么在测试里隔离它？

问题：模块顶层 $state 单例在所有测试文件/用例间共享（前一个用例改了、后一个读到脏值，且并发跑顺序不定）。隔离手段（从好到差）：① 设计成工厂（createX() 每用例 new 一份，从源头避免单例——与 global-state 工厂题同源），测试直接注入实例；② 提供显式 reset() 并 beforeEach 调用；③ ViTest 的 vi.resetModules() + 动态 import 重载模块（拿干净单例）；④ 若用 store，beforeEach 里 store.set(初始值)。根本原则："可测性驱动状态设计"——一个模块若无法在测试前重置到已知态，说明它的单例设计有可测性问题（对应既有"全局单例让测试怎样"题）。加分句：这条链把"测试"和"架构"连起来了——测试困难常是设计信号（单例过多、隐藏依赖），逼自己写出"每用例可从零装配"的状态层，顺带也解决了 SSR 泄漏与 HMR 清仓的同源问题（一石三鸟，是状态设计质量的统一检验）。

**来源**：测试隔离与模块单例；reset 模式；Vitest 模块重置；既有"全局单例污染测试"深化

### 14.  假定时器与 Svelte 的微任务 flush 相撞导致测试挂起/超时，怎么破？

成因：Svelte 的 DOM 更新在 microtask 里 flush，而 vi.useFakeTimers 若把 queueMicrotask/promises 也 fake 了，await tick()/异步断言会"等一个永不到来的微任务"→超时（对应既有"相撞"题）。破法：① 收窄 fake 范围——vi.useFakeTimers({ toFake: [...] }) 把 queueMicrotask/promises 排除（Vitest 也提供只 fake 定时器不动微任务的配置，呼应 vitest 关 toFake 题）；② 需要推进定时器时用 vi.advanceTimersByTimeAsync（异步版，会顺带 flush 微任务）而不是同步版；③ 涉及 fetch/flush 的断言用 findBy/waitFor（真实微任务）配假定时器要验证二者不冲突。加分句：本质是"两套异步调度器（测试的假时钟 vs Svelte 的微任务队列）必须对齐"——能定位到"卡住的 await 是在等被 fake 掉的微任务"，就跨过了组件测试里最玄学的一类 flaky；解法哲学和 vitest 关一致：假定时器按最小需要 fake，能不 fake 微任务就别 fake。

**来源**：vi.useFakeTimers 与 Promise/microtask；tick/flush 时序；既有"假定时器与微任务 flush 相撞"深化

### 15.  CI 上组件测试本地全绿、流水线偶发挂（flaky），给出你的系统性排查方向。

排查方向按概率：① 时序依赖——用了真实 setTimeout/网络/动画未 fake 或等待不足（CI 更慢更容易超时错位，对应假定时器题），断言靠 waitFor 而非固定 sleep；② 状态泄漏——全局单例/模块状态跨用例污染（本地单文件顺序跑掩盖、CI 并行分片暴露，对应隔离题）；③ 并行竞争——多 worker 共享资源（端口、文件、localStorage、mock 计时）冲突，减并发或隔离资源；④ 环境差异——时区/locale/Node 版本/UI 字体影响快照与格式化断言；⑤ 动画/过渡——transition 未禁用使 DOM detach 延迟（测试里关动画是通用纪律，呼应 transitions 关 reduced-motion/intro）；⑥ 随机/时间相关数据未固定（用 vi.setSystemTime 冻结）。方法：把 flaky 用例单独用 --repeats/--seed 稳定复现，去掉"偶发"才能定位。加分句：flaky 的本质几乎都是"测试隐式依赖了不确定因素（时间/顺序/共享态/环境）"——消除 flaky 不是加重试次数，而是把隐式依赖变显式（冻结时间、重置状态、禁动画、mock 环境），这也是"可测性=可确定性"的实践定义（呼应既有 CI flaky 题的根因层）。

**来源**：测试 flaky 排查；并发与时序；CI 资源差异；既有"CI 偶发挂"深化
