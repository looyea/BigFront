# Store 工厂与多实例

## 一、问题：全局单例不够用

模块级 `create` 是单例。但弹窗、向导、表格每个实例需要**独立状态**——多个相同组件不能共享一份 count。

典型场景清单：可折叠面板的展开态、页面里 5 个各自翻页的表格、双开弹窗的草稿、多人协同时每个文档一份编辑器状态。硬用单例就得手动给每个实例加 id 前缀字段——那是把 store 写成字典，复杂度反超。

## 二、工厂函数统一中间件

```ts
// 目的：工厂函数产纯 store——参数化初始值，中间件在工厂里统一挂好，实现「配置一次、实例化 N 次」
import { createStore } from 'zustand';
const makeTableStore = (init) =>
  createStore((set) => ({
    page: 1, rows: init,                              // init 注入初始行，每个实例各一份、互不共享
    next: () => set((s) => ({ page: s.page + 1 })),   // 函数式取最新 s，浅合并只改 page
  }));
// ✅ createStore(vanilla) 返回纯 store 对象，不带 hook——正好塞进 Context 按实例分发
// ❌ 这里若用 create() 会连 hook 一起产，而 hook 绑定的是模块级单例，多实例照样共享同一份 state
```
`createStore`（vanilla）返回纯 store，不带 hook。

工厂参数化初始值（页大小、权限档位、租户 id），中间件在工厂里统一挂好（devtools/persist），调用方无感——「配置一次，实例化 N 次」。

## 三、多实例：Context 注入独立 store

```tsx
// 目的：Context 注入独立 store——每个 TableProvider 建一份，多个表格互不干扰
const TableCtx = createContext<StoreApi<TableState>>(null);   // 存纯 store（StoreApi），不是 hook
function TableProvider({ children, init }) {
  const ref = useRef();                              // 用 ref 而非 state 承载 store
  if (!ref.current) ref.current = makeTableStore(init);   // 惰性建：只首渲染调工厂，之后复用同一实例
  return <TableCtx.Provider value={ref.current}>{children}</TableCtx.Provider>;
}
const useTable = (sel) => useStore(useContext(TableCtx), sel);   // vanilla 绑定 hook，从 Context 取 store 再订阅
// ✅ useRef 保证工厂只跑一次；两个 <TableProvider> 各持 store，翻页互不影响
// ❌ 直接 useState(makeTableStore())→参数每次渲染都求值，工厂被反复调用、state 说没就没
// ❌ 把 // 注释写进 <TableCtx.Provider value=...> 开标签的属性区→JSX 语法报错，行注释只能待在语句级
```
每个 TableProvider 建立一份独立 store，多个表格互不干扰。用 `useStore(store, selector)`（zustand 的 vanilla 绑定 hook）。

`useRef` 惰性创建是关键：直接 `useState(makeTableStore())` 每次渲染都会调用工厂（参数求值），useRef 保证只建一次。SSR 下这正好是 per-request 隔离的雏形（呼应 za-next-app）。

## 四、粒度：实例级 vs 全局级

同一组件树里常两层并存：登录用户走全局单例，表格分页走实例级 Context。经验法则——**状态跟着它描述的实体走**：描述「这个表格」的进工厂实例，描述「这个用户/这个应用」的进单例。别为「统一」把一切塞进一个巨型 store，那是 Redux 时代的遗产思维。

## 五、测试红利

多实例工厂天然可测：每个用例 `makeTableStore(seed)` 新建，无跨用例污染，不需要 reset 钩子（对比 za-testing-deep 里单例 store 的处置）。这也是团队规范推荐「能工厂化的都工厂化」的原因。

## 小结
createStore 产纯 store，Context 注入实现多实例隔离，useStore(vanilla-bind) 在组件里订阅；状态跟实体走，工厂顺带解决测试污染。

## 部署预告
本地做一页放两个 Table 组件、各包一个 TableProvider，翻页互不影响；再对照 Jotai 的 Provider 方案（jo-store）看同一问题的两种解法。
