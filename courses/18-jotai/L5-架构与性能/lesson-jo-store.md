# Store 隔离：createStore + Provider

## 一、全局默认 store 的问题

模块级 atom 挂在「默认 store」上——它是进程/页面级单例。带来三个隐患（呼应 jo-global）：
1. SSR 跨请求共享导致数据泄漏；
2. 测试用例间状态污染；
3. 同页多个相同组件被迫共享一份状态。

第三条最容易被低估：一个页面渲染两个相同的 Widget（比如双栏编辑器），「import 即用」的便捷立刻变成诅咒——两边编辑互相串数据。此时不是 atom 设计错了，而是缺了「同一套原子定义、两份独立值」的机制——这就是 store。

## 二、createStore 造独立实例

```ts
import { createStore } from 'jotai/vanilla';
const store = createStore();
store.set(countAtom, 5);
store.get(doubleAtom);
store.sub(anAtom, () => {/* 变化回调 */});
```
vanilla store 可脱离 React 读写与订阅（呼应 za-store-api）。

三个 API 对应三种消费者：get/set 给纯逻辑层（service、路由守卫、事件处理器里读写状态完全不碰 React），sub 给「只要副作用不要渲染」的 transient 场景（埋点、日志、高频值搬运）。Jotai 的状态因此是「框架无关」的，React 只是其中一种订阅者——这点比 Zustand 的 getState 更进一步：sub 支持任意 atom（含派生），Zustand 的 subscribe 只能盯 store 整体。

## 三、Provider 注入作用域

```tsx
import { Provider } from 'jotai';
<Provider store={createStore()}>
  <Widget/>
</Provider>
```
每个 Provider 建一份独立 store，其内部所有 atom 读写都走这份——弹窗/向导/多标签页互不干扰（呼应 za-factory）。

写法细节：不传 store 的 `<Provider>` 也会自动 new 一个空 store（继承外层值），所以「只想隔离、不想管理实例」时裸 Provider 就够；需要 externally 操作这份 store（imperative reset、跨边界 sub）才显式 createStore 传入。每个 Widget 实例包一层 Provider，多实例问题即消解。

## 四、测试隔离首选
每个测试 render(<Provider>...) 或新建 store.get/set 直测（呼应 jo-perf-test）。

Vitest 里最干净的一档：不 render 任何组件，纯 store 操作原子逻辑——

```ts
it('double 跟随 count', () => {
  const store = createStore();
  store.set(countAtom, 5);
  expect(store.get(doubleAtom)).toBe(10);
});
```

用例之间零共享（每个 it 新 store），不需要 reset 钩子——「隔离的单位从用例缩小到实例」是原子化架构送给测试的红利（对比全局 store 方案里 beforeEach 手动 $reset 的脆弱）。

## 五、scope 层级
Provider 可嵌套，内层未定义 key 回退外层；但同一 atom 在内层 Provider 是独立值——用它实现「可覆写的默认配置」。

准确语义：内层 store 是「写时fork」——读未覆写的 atom 穿透到外层默认值，一旦在内层 set 过，该 atom 就内层独立。经典应用：全局 themeAtom 在 Provider 外包大树，某个「预览面板」子树里 set 覆写 theme——面板内换肤不污染全站。这与 za-factory 的「工厂造实例 + 共享纯逻辑」同构：原子定义是类，store 里的值是实例。

## 六、什么时候不要 Provider

判据反向：默认全局 store 不是缺陷而是首选——单页单实例、绝大多数业务状态根本不需要隔离。上来就给每个组件包 Provider 是自造复杂度。三个升级信号出现才引入：**多实例同组件、SSR 每请求、测试要求纯净**。信号不在，就用全局（呼应 jo-global 第五节的组织法）。

## 小结
createStore + Provider 把全局 atom 升级为「作用域内实例」：vanilla 三 API 让状态脱离 React、裸 Provider 造隔离子树、写时 fork 实现可覆写默认值——一举解决 SSR 泄漏、测试污染、多实例隔离三大问题；但三个信号没出现前，全局 store 仍是默认正解。

## 部署预告
本地做一个双栏编辑器：左右两栏渲染同一个 Editor 组件，各自包裸 Provider，验证一边打字另一边不串；再写一个 store 直测用例（不 render 组件断言派生 atom），体会「无 React 的状态测试」。
