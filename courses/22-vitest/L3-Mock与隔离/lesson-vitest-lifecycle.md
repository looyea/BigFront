# 钩子与用例隔离

## 一、四个基本钩子

`beforeAll`（套件开始跑一次）、`beforeEach`（每条用例前）、`afterEach`（每条后）、`afterAll`（套件结束一次）。**建连接/起服务**放 `*All`，**每条要重置的状态**放 `each`。清理遵循**后注册先执行**的栈式逆序。钩子里有异步一定要 `await`，并注意 `hookTimeout`。

## 二、作用域：describe 内的钩子只管内

```ts
describe('A', () => {
  beforeEach(() => { /* 只影响 A 里的用例 */ });
  it('a1', () => {});
});
```

嵌套 describe 时，外层钩子先跑、内层后跑；清理反之。别把 `beforeEach` 写在顶层却指望它只对某个 describe 生效。

## 三、on-test 级钩子

Vitest 支持挂在单条用例上的 `it.beforeEach` / `it.afterEach`（通过 `runner.task` 或 `onTest` 系列），适合「同一套件里个别用例有特殊前置」。多数场景普通 `beforeEach` 足够，别过度设计。

## 四、文件隔离：Vitest 的默认安全网

**每个测试文件默认在独立环境运行（isolate: true）**，全局单例、模块级状态不会跨文件互串。代价是每文件重建环境、略慢。可用 `isolate: false` 复用环境提速，但**共享可变状态会埋下用例互相污染**的雷。文件级并发由 `fileParallelism` 控制。怀疑有异步泄漏时开 `dangerouslyIgnoreUnhandledErrors` 是下策，正解是 `detectAsyncLeaks`/关测试时清理资源。

## 五、setupFiles 与 testContext

- `setupFiles`：**每个测试文件**跑前注入（注册 jest-dom、起 MSW server、polyfill）。
- `globalSetup`：**整个进程**一次（起 mock 后端、准备 fixtures），返回的 teardown 收尾。
- `testContext`（`ctx`）：钩子与用例共享的上下文对象，可用 `ctx.foo` 传数据、`ctx.skip()` 动态跳过。

数据流优先靠显式返回值/参数，`ctx` 用于框架级标记，别把它当全局垃圾桶。

## 小结
beforeAll/afterAll（套件级、放昂贵建连与关连接）、beforeEach/afterEach（每条级、重置状态），清理栈式逆序；describe 内钩子只管内；it.beforeEach 等 on-test 级少用；文件默认 isolate:true 防互串、关隔离提速但易污染、fileParallelism 控并发；setupFiles 每文件注入、globalSetup 进程一次、ctx 传数据。

## 部署预告
建一个含嵌套 describe 的测试，在最外层与内层各放 `beforeEach`/`afterEach`（console.log 打点名），运行观察完整执行/清理顺序；再用 `setupFiles` 注册一个全局 `beforeEach(() => console.log('hi'))`，确认它对每个文件都生效。
