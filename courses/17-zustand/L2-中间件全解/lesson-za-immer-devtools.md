# immer + devtools 中间件实战

## 一、immer：写可变，产出不可变

```ts
import { immer } from 'zustand/middleware/immer';
const useStore = create(
  immer((set) => ({
    nested: { list: [] },
    add: (x) => set((s) => { s.nested.list.push(x); }),  // 直接“改”
  }))
);
```
immer 把 `set` 换成 produce 版：回调里对 draft 的可变操作，被翻译成结构共享的不可变更新，未变分支引用保持不变（利于 selector）。

类型上注意：immer 版的 set 回调参数是 Draft 类型，若同时用 devtools 包一层，写 `create(devtools(immer((set) => ...)))` 时记得 curried 泛型（呼应 za-middleware-chain）。

## 二、开销分析

Proxy 有成本：读写深层属性比直接对象略慢，但对多数 UI 完全可忽略；超大数组/每帧高频写才需要评估，或退回函数式展开。

结构共享是收益的另一半：只改 `a.b.c` 时，`a.d`、`a.e` 的引用原样保留——订阅 `s.a.d` 的组件完全不被惊动，这是「immer + 细 selector」组合拳的性能基础（呼应 za-selectors-deep）。

## 三、devtools 中间件

```ts
import { devtools } from 'zustand/middleware';
const useStore = create(devtools((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 }), false, 'inc'),  // 第三参 action 名
}), { name: 'App', features: { jump: true, dispatch: true } }));
```
挂到 Redux DevTools：可看 action 列表、时间旅行、jump、编辑 state。第三参 `action` 字符串给每次 set 命名，调试面板更易读。

多 store 时给每个 `devtools(fn, { name: 'auth' })` 独立命名，DevTools 侧栏按 store 分组；生产构建用 `enabled: import.meta.env.DEV` 关掉采集，省掉每次 set 的快照序列化开销。

## 四、两者一起用的顺序

```ts
create(devtools(immer((set) => ({ /* ... */ }))))
```
devtools 在外记录命名后的最终更新，immer 在内负责产出不可变。

## 五、匿名 set 归因

未给 action 名时 DevTools 显示为匿名 update，难以定位；养成给关键 set 起名的习惯。团队协作可再进一步：action 名统一 `域/动词` 格式（`cart/addItem`），配合 logger 中间件（呼应 za-middleware-chain）在 CI 里校验命名。

## 六、时间旅行的三个边界

1. jump 回旧 state 不会撤销已发出的 HTTP 请求——时间旅行只适合调试纯状态流。
2. 函数属性不可序列化，DevTools 里显示为空——这是预期，不是 bug。
3. persist 水合产生的 set 若被 devtools 记录，回放顺序会令人困惑——把 devtools 放最外即可完整看到（呼应 za-middleware-chain）。

## 小结
immer 提升深层更新可读性且保持引用稳定；devtools 提供时间旅行，记得用 set 第三参命名 action；生产环境关 devtools、大写入路径评估 Proxy 开销。

## 部署预告
本地装 Redux DevTools 浏览器扩展，把带 devtools(immer(...)) 的 store 跑起来，做一次「add → 编辑 state → jump 回退 → 重载」全流程，观察命名 action 与匿名 update 的区别。
