# Vitest 体系：单元、组件与覆盖率

> 目标：Vite 包的测试缺口一次补齐——Vitest 为什么是 Vite 项目的天然搭档（共享配置与 transform 管道）、mock 体系 vi 家族、组件测试两路线（jsdom vs Browser Mode）、覆盖率工程与 watch 模式，最后给出与 node:test 的选型分工（呼应 vite-intro 双模型、node-testing、vue-testing/react-testing/svelte-testing 三框架实战课）。

---

## 一、Vitest 的红利：测试跑在 Vite 的世界里

一句话定位：**Vitest = 用 Vite 的解析与 transform 管道跑的测试**。这带来 JIT 编译的 TS/JSX/Vue SFC **零额外配置**直接测：

```ts
// vite.config.ts —— alias、插件、define 在测试里原样生效
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    globals: true,                 // describe/it/expect 免 import（配 tsconfig types 补类型）
    environment: 'jsdom',          // 默认 node；组件测试要 DOM
    include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'], thresholds: { lines: 80 } },
  },
})
```

`import.meta.env.VITE_*`、`?raw` 导入、路径别名——webpack 时代要"测试配置和构建配置两套对齐"的痛苦在此消失。`vitest --run`（CI）与默认 watch 两种形态；`npx vitest related --run` 只跑"受影响文件"（pre-commit 神器）。

## 二、写测试：expect 断言族与 vi mock 家族

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

test('异步与断言扩展', async () => {
  const data = await fetchUser(1)
  expect(data).toMatchObject({ id: 1 })          // 子集断言（快照的克制版）
  await expect(badCall()).rejects.toThrow('403') // 异步异常
  vi.useFakeTimers(); vi.advanceTimersByTime(1500)  // 假定时器：防抖测试不用真等
  vi.useRealTimers()
})

// mock 三件套
vi.mock('@/api', () => ({ fetchUser: vi.fn().mockResolvedValue({ id: 1 }) }))  // 模块 mock（提升 hoist）
const cb = vi.fn()          // 函数 mock：cb.mock.calls / cb.mock.calls[0][0] 查调用
const obj = vi.spyOn(utils, 'format').mockReturnValue('stubbed')  // 局部窥探不拆全家
```

纪律两条：`beforeEach` 里 `vi.resetAllMocks()`（mock 状态跨测试泄漏是"单独跑绿、一起跑红"的头号成因）；模块 mock 的工厂函数**不会自动继承真模块**，部分替换用 `importOriginal`。并发/隔离心智：Vitest 默认**文件间并行、文件内串行**，每个测试文件是独立 worker 环境（与 node:test 的进程模型不同，呼应 node-event-loop）。

## 三、组件测试：DOM 模拟与 Browser Mode 两条线

```ts
// 路线 A：jsdom/happy-dom + @testing-library（04/05/11 包学的 API 原封搬来）
// vitest.config: environment: 'happy-dom'（比 jsdom 快，覆盖面略窄）
import { render, screen } from '@testing-library/vue'
test('计数按钮', async () => {
  render(Counter)
  await userEvent.click(screen.getByRole('button'))
  expect(screen.getByText('1')).toBeInTheDocument()
})
```

```ts
// 路线 B：Browser Mode——真浏览器（Playwright 驱动）里跑
// vitest.config: test: { browser: { enabled: true, name: 'chromium', provider: 'playwright' } }
// 组件、截图比对、真实布局（ResizeObserver/IntersectionObserver/滚动）才测得到
```

选择轴：**快与 CI 省 → jsdom 够跑 90% 逻辑断言；涉及真实渲染/图形/滚动/截图回归 → Browser Mode**。happy-dom 的坑位：缺的观察器 API 静默不报——测试通过≠浏览器能过（呼应 vue-testing、svelte-testing 的 render 契约各表）。

## 四、覆盖率与工程参数

- provider：**v8**（快，默认）vs istanbul（细到分支、报告一致性好）——前端项目 v8 起步；
- `thresholds: { lines: 80 }` 门禁进 CI，但**指标是仪表盘不是 KPI**：给 utils 定 95% 不如给"这次 MR 的 diff"定（`coverage.all:false` + diff 覆盖工具思路）；
- 提速三板斧：`isolate: false`（同 worker 复用，内存换速度）、`pool: 'threads'` 按 CPU 配、测试文件拆小让并行粒度细；
- watch 三模式：默认（改动相关文件重跑）、`--changed`（对比 git diff，PR 门禁）、UI Mode（`vitest --ui` 可视化面板）——名字与行为面试常混，别答反。

## 五、与 node:test 的选型分工

| 场景 | 选择 | 理由 |
|---|---|---|
| 前端应用（组件/框架插件/env 变量） | Vitest | 共享 Vite 管道，jsdom/组件库生态 |
| Node 服务端小工具/零依赖库 | node:test | 免装依赖、CI 镜像更小（node-testing 学过） |
| monorepo 混合 | Vitest projects | `test.projects` 一个配置管 web+node+e2e 多项目 |

monorepo 里 projects 配置让 Vitest 变"测试编排器"——Vitest 与 workspace 的关系恰如 Vite 与 L5 monorepo（呼应 vite-deploy）。

## 自检清单

- [ ] 说得出"Vitest 红利=共享 transform 管道"具体省下哪些配置。
- [ ] vi.mock 提升、resetAllMocks、importOriginal 三件事讲得清。
- [ ] jsdom 路线与 Browser Mode 路线的选择轴脱口而出。
- [ ] coverage provider 两派差异与 thresholds 门禁会配。
- [ ] --changed 与 watch 的关系、isolate:false 的权衡说得出。

---

## 🚀 部署预告

- 本关是 **vue-testing/react-testing/svelte-testing** 三包实战的"工具层总纲"——框架 render 契约各异，Vitest 内核同一；
- 覆盖率门禁与 diff 策略进入下一关 **vite-ci-perf** 的流水线拼装；
- `vitest related` 挂 pre-commit（02-ts 包 lefthook 配置位）是本地反馈回环的标准件；
- Browser Mode 依赖 Playwright 浏览器层，CI 镜像体积账在 **vite-ci-perf** 一起算。

下一关进入 **L6 vite-deps-perf**：optimizeDeps 与冷启动——把"dev 慢"从玄学变成可测可调的工程问题。
