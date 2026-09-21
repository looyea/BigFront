# 组件与端到端测试：Vitest 打单元，Playwright 打全流程

> 目标：掌握 Svelte 5 组件测试的完整闭环——测试环境接线（Vitest + jsdom + vite-plugin-svelte）、`render` 的挂载/卸载契约、事件与异步等待的正确姿势、runes/全局态怎么测；再划清单元测试与 Playwright E2E 的边界。对照 react-testing、vue-testing 与 node-testing 的分层思想（呼应 svelte-reactivity-internals、svelte-global-state）。

---

## 一、环境接线：三行配置决定一切

```
npm create vite@latest my-app -- --template svelte
npm i -D vitest jsdom @testing-library/svelte @testing-library/jest-dom @testing-library/user-event
```

`vite.config.js` 里挂 `test: { environment: 'jsdom', globals: true }`，并确保 `svelte()` 插件在 test 下也生效——**组件测试走的就是打包时同一条编译管线**，`.svelte` 才能被 import。Svelte 5 早期需 `@testing-library/svelte@next` 的时代已经过去，现版本原生支持 runes（对照 vue-test-utils 之于 SFC、React Testing Library 之于 JSX，本质都是"让测试解析器认识组件文件格式"）。

## 二、render 的契约：挂载、返回值、cleanup

```js
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import Counter from './Counter.svelte';

afterEach(cleanup);   // 多数配置下 auto-cleanup 已开，写出来保平安

test('点击加一', async () => {
  render(Counter, { props: { initial: 5 } });
  const btn = screen.getByRole('button');
  await fireEvent.click(btn);
  expect(screen.getByText('6')).toBeInTheDocument();
});
```

Svelte 5 的三个契约点：

1. **`render` 第二参是 `{ props }`**——不是 v4 时代的顶层散落对象；组件实例通过返回值的 `component` 句柄拿（`component.$set` 已废，改 prop 要**重渲**或走回调）。
2. **返回的 `unmount()` 真正销毁组件**——`$effect` 清理、action destroy 都会跑；漏 cleanup 的用例集会让"定时器幽灵"跨用例串门（呼应 svelte-lifecycle 第五节）。
3. 查询优先 `getByRole/getByLabelText` 这类**可访问性语义查询**，`getByText` 兜底——三家 Testing Library 同一套哲学（呼应 svelte-forms 的 aria 话题）。

## 三、异步与"等 DOM 追上状态"

组件里有 fetch/`await tick()` 时，`fireEvent` 的 await 只覆盖一个微任务轮次，**不等 Promise 链**。正解二选一：

```js
import { waitFor } from '@testing-library/svelte';
await fireEvent.click(loadBtn);
await waitFor(() => expect(screen.getByText(/已加载/)).toBeInTheDocument());
```

- `waitFor` 轮询到超时（默认 1s）；配合 `userEvent.setup()` 模拟真实键入/点击序列（逐字符、带 focus），比 fireEvent 更贴用户。
- 定时器用 Vitest 假定时器（`vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync`），**Async 版**才能推动微任务里的 effect flush（呼应 svelte-reactivity-internals 第二节：Svelte 的更新在微任务）。

## 四、测 runes 与全局状态模块

`.svelte.js/ts` 模块是**单例**——测试间状态串味是头号坑：

```js
import { resetUser } from './store.svelte.js';

beforeEach(() => resetUser());        // 模块必须导出重置入口（L4 就立的规矩）
```

- 工厂形态（`createCounter()`）直接 new 新的测；单例形态必须有 `reset`/`init` 钩子暴露给测试。
- **不能绕过 getter 断言内部 `$state`**——断言行为（渲染出的文本、导出的派生值），别断言实现。
- 依赖 context 的子组件单独 render 会拿不到 provider（呼应 svelte-context 独立 mount 陷阱）：包一层壳组件 `<Provider><Child/></Provider>` 再 render 壳。

## 五、分层：什么归单元，什么归 E2E

| 层 | 工具 | 测什么 | 例 |
|---|---|---|---|
| 纯函数 | Vitest node 环境 | 校验器/格式化 | `parseForm(values)` |
| 组件 | Vitest + jsdom | 交互→DOM 映射 | 表单报错显隐、列表过滤 |
| 集成 | Vitest + mock fetch | 数据流全链 | 加载态→成功/失败态 |
| E2E | Playwright | 路由/真实浏览器 | 登录跳转、动画后可见性 |

- 过渡/动画在 jsdom 里**不可测**（无合成器）：断言"最终态"而非"过程"；动画本身的验收放 Playwright（`toHaveCSS`/截图基线）。
- Playwright 用 `getByRole` web-first 断言自动重试，别 `waitForTimeout` 硬等；CI 里与 Vitest 并行，各跑各的。
- 金字塔比例维持：**多单元、少 E2E**——组件测试启动快（Svelte 无 runtime diff，挂载成本比 React 还低），全量毫秒级。

## 六、断言增强与覆盖率

- `@testing-library/jest-dom` 注入 `toBeInTheDocument/toHaveValue/toHaveFocus`——可读性即维护性。
- 覆盖率 `vitest --coverage`（v8 provider）；盯**分支覆盖**而非行覆盖：`{#if}` 的 else 分支、`$derived` 的空态才是 bug 高发区。
- 快照测试只对**纯展示 snippet** 谨慎使用——runes 驱动的模板快照一改全红，噪音大于信号（业界对快照普遍转保守，React 社区教训同样适用）。

## 七、自检清单

- [ ] 能默写 Vitest+jsdom+vite-plugin-svelte 接线三步与 render({props}) 契约。
- [ ] 分得清 fireEvent 的 await、waitFor、假定时器 Async 版各自解决什么异步。
- [ ] 全局态模块测试前先 reset，context 子组件用壳组件包。
- [ ] 能给出四层测试金字塔并把"动画不可测"归位到 E2E。
- [ ] 知道 unmount 会走 $effect/action 清理，串用例的幽灵定时器从何而来。

---

🚀 **下一关**：`svelte-tooling`——vite-plugin-svelte、svelte.config.js 全景、eslint/prettier 插件与 `sv` 命令行：把工程侧的"为什么这样配"讲透（呼应 10-vite）。
