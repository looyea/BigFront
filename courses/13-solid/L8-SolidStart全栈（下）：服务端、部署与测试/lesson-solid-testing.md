# 测试：@solidjs/testing-library 与 Vitest 实操

> 目标：会给 Solid/SolidStart 组件与响应式逻辑写测试——记住 testing-library 在 Solid 下的三个特化点（render 收函数、没有 rerender、少用 waitFor），配好 Vitest 的"双份 solid-js"经典坑，并会用 renderHook / renderDirective / testEffect 测纯响应式单元。呼应课业「能为 Solid 应用编写测试」。

## 一、装什么、原则是什么

```bash
npm install --save-dev @solidjs/testing-library
```
官方 solid-testing-library（Ryan Carniato 创建）完全对标 testing-library 家族，口号同宗：
> **你的测试越像软件被真实使用的方式，它能给你的信心就越大。**

查询优先按"用户视角"（getByText/findByRole），别去断言实现细节。Jest/Vitest 下建议再装 `@testing-library/jest-dom` 用它的自定义匹配器。

## 二、三个 Solid 特化点（与 React 版最大的差异）

1. **render 收的是"返回组件的函数"**：
   ```tsx
   const results = render(() => <YourComponent />, options); // 不是 render(<YourComponent />)
   ```
2. **没有 rerender 方法**——Solid 不重渲染，只执行"响应式状态触发的改 DOM 副作用"。要更新被测组件，**用全局 signal 去操纵**它的状态即可。
3. **几乎不需要 waitFor / findBy**——Solid 的响应式变化"相当即时"；只有 **transition、Suspense、Resource、路由导航**这些真异步边界才需要等待。把 React 习惯的 await waitFor 一股脑搬过来是反模式。

## 三、测带路由的组件：location 选项

render 的扩展 options 支持 `location`，起一个**指向指定路径的内存路由**：
```tsx
it("uses params", async () => {
  const App = () => (
    <>
      <Route path="/ids/:id" component={() => <p>Id: {useParams()?.id}</p>} />
      <Route path="/" component={() => <p>Start</p>} />
    </>
  );
  const { findByText } = render(() => <App />, { location: "ids/1234" });
  expect(await findByText("Id: 1234")).not.toBeFalsy();
});
```
注意：这套内置用 `@solidjs/router`——换别的 router 用 `wrapper` 选项；且因搭建非即时，**要配合 findBy 系异步查询**。官方也标注当前 `useNavigate` 在测试内有用不了的老问题（Route 上下文进不去），测导航切换可先用 `<A noScroll>`。

## 四、测逻辑单元：renderHook 与"不需要 DOM 的响应式"

**纯响应式逻辑不需要 DOM**——独立函数用 `createRoot` 就够测；需要组件上下文（context 等）才上 `renderHook`：
```tsx
const { result } = renderHook(createResult);
expect(result).toBe(true);
```
差异点：Solid 版 `renderHook` 返回值**没有 container/baseElement/queries**，取而代之的是可用于 `runWithOwner` 的 `owner`，cleanup 测试结束自动调。用 wrapper 配 context 时**务必让 wrapper 返回 props.children**——尤其异步代码套 `<Show>` 的场景，不返回就只能拿到 undefined（官方点名的大坑）。

## 五、测指令：renderDirective

`use:` 指令是 Solid 特色，库干脆给了配套测试工具：
```tsx
const { asFragment, setArg } = renderDirective(myDirective);
expect(asFragment()).toBe('<div data-directive="works"></div>');
setArg("perfect");   // 改指令参数，副作用即刻反映
```
第一个参数收指令函数，options 里给 `initialValue` 与 `targetElement`，返回里多出读/写参数的 `arg` / `setArg`。

## 六、测异步 effect：testEffect

waitFor 是**轮询**，不借 Solid 的响应式之力；官方补了 `testEffect`：在受控 owner 里跑 effect，用 `done()` 交付结果 Promise：
```tsx
test("effect chain", () =>
  testEffect((done) =>
    createEffect((run = 0) => {
      if (run === 0) { expect(value()).toBe(0); setValue(1); }
      else if (run === 1) { expect(value()).toBe(1); done(); }
      return run + 1;
    })
  )
);
```
第二参数可传 renderHook 拿到的 `owner`，把 effect 精确放进被测作用域。

## 七、Vitest 集成与经典坑

- 官方备有配好 solid-testing-library 的 **Vite 模板**（纯 Solid 与 SolidStart 各一）；
- **Jest 用户**注意装 `solid-jest`：不然 Node 环境会解析到 Solid 的**服务端版本**；
- **Vitest 经典坑**：`solid-js`（用到 router 则连 `@solidjs/router`）**被加载两份**（vite 内部 server 一份、node 一份），症状是"`dispose` 是 undefined"、router 加载失败——要保证单实例（deps.inline/optimizeDeps 方向排查）；
- **testing-library vite 插件 ≥2.8.2 已把测试所需配置全包**，你通常只剩 globals/coverage 这类个性化要配。

## 八、分层测试策略（收尾观点）

| 层 | 工具 | 测什么 |
| --- | --- | --- |
| 纯响应式单元 | createRoot / renderHook / testEffect | 信号派生、hook/原语行为 |
| 组件 | @solidjs/testing-library | 渲染结果与交互（user 视角） |
| 指令 | renderDirective | use: 行为与参数响应 |
| 全栈 E2E | Playwright 等浏览器级工具 | 路由导航、服务端函数往返、hydration 后的真实链路 |

## 九、自检清单

- [ ] 能说出 render 收函数、无 rerender、少 waitFor 三个特化点及原因
- [ ] 会用 location 选项起内存路由并知道要配 findBy
- [ ] 分得清什么时候 createRoot 就够、什么时候要 renderHook(+owner)
- [ ] 知道 Vitest"双份 solid-js"坑的症状与 Jest 要 solid-jest 的原因
- [ ] 能为指令写 renderDirective、为异步 effect 写 testEffect

🚀 **下一站 L9**：终战——响应式源码级内核、React→Solid 迁移方法论与毕业项目。
