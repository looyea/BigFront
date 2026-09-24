# Slices Pattern：大 store 拆分标准姿势

## 一、为什么要 slice

单文件 `create` 写久了会膨胀到几百行、耦合多业务域。Slices Pattern 把「一块状态 + 它的 action」拆成独立文件，再组合进同一个 store。

判断信号：一个 store 文件同时出现购物车、用户、UI 三个业务域的字段；或改一个功能要 review 整个 500 行文件——都该切 slice 了。

## 二、StateCreator 定义切片

```ts
// features/cart/cartSlice.ts
import { StateCreator } from 'zustand';
export interface CartSlice {
  items: Item[];
  addItem: (i: Item) => void;
}
export const createCartSlice: StateCreator<
  AppState, [], [], CartSlice
> = (set) => ({
  items: [],
  addItem: (i) => set((s) => ({ items: [...s.items, i] })),
});
```
四个泛型依次是：整体 State、middlewares、自定义 Set、本切片形状。

第一个泛型是「整体」而返回的是「局部」——这正让 slice 内部 `get()` 能看到全量 AppState（跨 slice 调用的类型基础）。若带中间件（如 immer），第二个泛型写 `[["zustand/immer", never]]` 对齐即可。

## 三、组合成完整 store

```ts
export interface AppState extends CartSlice, UserSlice {}
export const useAppStore = create<AppState>()((...a) => ({
  ...createCartSlice(...a),
  ...createUserSlice(...a),
}));
```
每个 slice 拿到同一套 set/get，所以能跨 slice 调用。

`(...a) => ({...})` 把 set/get/store 三元组原样透传给每个 slice 工厂——这就是「同一 store 的多个视角」。中间件版本把 `[], [],` 泛型与 curried 写法对齐（呼应 za-middleware-chain）。

## 四、跨 slice 调用

```ts
// userSlice 里想清购物车
logout: () => { set({ user: null }); get().clearCart?.(); }
```
用 `get()` 访问另一个 slice 暴露的 action —— 这是 slices 模式的核心协作方式。

守则：跨 slice 只调 action、不直写别的 slice 的字段（`get().clearCart()` 可以，`set({ items: [] })` 出现在 userSlice 里就是坏味道）。依赖方向尽量单向：业务 slice → 基础 slice，别写出环形调用。

## 五、导出 selector 做黑盒封装

slice 文件里再导出细粒度 selector，组件只 import selector，不直接依赖 store 结构：

```ts
export const selectCartCount = (s: AppState) => s.items.length;
```

组件用法：`const n = useAppStore(selectCartCount)`。字段改名时改动收口在 slice 文件内部——selector 就是 store 的 public API。

## 六、slice 还是多 store？

| 信号 | 选择 |
|---|---|
| 两块状态经常互相调用 | 同一 store 的 slices |
| 完全独立的业务域 | 各建各的单例 store（import 即用） |
| 需要多实例隔离 | createStore 工厂（见 za-factory） |

slice 的本质收益是「一个 store 内跨域零胶水」，代价是所有类型都耦合在 AppState 上——域间毫无关系时不如拆开。

## 小结
slice = 状态 + action 的内聚单元；用 StateCreator + 组合、get() 跨 slice、集中导出 selector 三板斧支撑大 store；跨 slice 只调 action 不写别人字段。

## 部署预告
本地把 L1 的单文件 counter 拆成 counter + logger 两个 slice，在组件里分别用两个 selector 消费；再写一个「logout 清 cart」的跨 slice action 验证 get() 协作。
