# Store 工厂与多实例

## 一、问题：全局单例不够用

模块级 `create` 是单例。但弹窗、向导、表格每个实例需要**独立状态**——多个相同组件不能共享一份 count。

典型场景清单：可折叠面板的展开态、页面里 5 个各自翻页的表格、双开弹窗的草稿、多人协同时每个文档一份编辑器状态。硬用单例就得手动给每个实例加 id 前缀字段——那是把 store 写成字典，复杂度反超。

## 二、工厂函数统一中间件

```ts
import { createStore } from 'zustand';
const makeTableStore = (init) =>
  createStore((set) => ({
    page: 1, rows: init,
    next: () => set((s) => ({ page: s.page + 1 })),
  }));
```
`createStore`（vanilla）返回纯 store，不带 hook。

工厂参数化初始值（页大小、权限档位、租户 id），中间件在工厂里统一挂好（devtools/persist），调用方无感——「配置一次，实例化 N 次」。

## 三、多实例：Context 注入独立 store

```tsx
const TableCtx = createContext<StoreApi<TableState>>(null);
function TableProvider({ children, init }) {
  const ref = useRef();
  if (!ref.current) ref.current = makeTableStore(init);
  return <TableCtx.Provider value={ref.current}>{children}</TableCtx.Provider>;
}
const useTable = (sel) => useStore(useContext(TableCtx), sel);
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
