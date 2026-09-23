# 列表渲染与 key

> 目标：在 React 里渲染列表靠 `array.map()` 返回元素数组，`key` 则是 diff 算法识别"哪个是哪个"的**身份标识**。本课讲：map 渲染、key 到底为谁服务（reconciliation 复用节点、保持 state）、**为什么别用数组 index 当 key**、key 只需兄弟间唯一、派生列表（filter/sort 不改原数组），以及和 Vue `v-for :key` 的异同（呼应 **react-render-model** 第三节 diff 三假设、**vue-conditional-list**）。

---

## 一、用 map 渲染列表

```jsx
const items = [{ id: 1, name: '苹果' }, { id: 2, name: '香蕉' }];
// JSX 里：
<ul>
  {items.map(item => (
    <li key={item.id}>{item.name}</li>
  ))}
</ul>
```
- `{}` 里放表达式（呼应 react-jsx 第二节），`map` 返回**元素数组**，React 会展开渲染；
- 每个兄弟元素必须带 `key`，否则控制台告警且可能复用错乱；
- 与 Vue `v-for="item in items" :key="item.id"` 思路一致，只是 React 用原生 JS `map`，没有专用指令。

---

## 二、key 到底为谁服务

回忆 **react-render-model**：React 每次渲染重算整棵 Element 树，再 diff。对同一父节点下的子列表，diff 靠 **key 判断"新旧列表里哪两项是同一个"**：
- key 相同 → **复用**已有 DOM 节点与组件 state，只更新变化部分；
- key 缺失/变化 → 当作新元素，**卸载重建**（内部 state 全部丢失）。

所以 key 不是给"人"看的标签，是给 **reconciliation 算法**用的身份。它让"插入/删除/换位"只移动必要节点，而不是整列重建。

---

## 三、为什么别用数组 index 当 key

```jsx
{items.map((item, i) => <li key={i}>{item.name}</li>)}   // ✗ 危险
```
当列表会**增删或重排**时，index 会整体错位：
- 在**头部插入**一项 → 原来的第 0 项变成第 1 项，key=0 现在指向了"新插入的项"，React 认为这是同一个节点，于是**复用错元素**；
- 表现为：输入框/勾选状态"跟着位置跑"而不是"跟着数据跑"、动画错乱、性能反而更差（大量本可复用的节点被错误 diff）；
- 只有当列表**纯粹静态、永不增删重排**时 index 才勉强安全——但这种情况直接用数据自带的稳定 id 更好。

> 正确做法：用**数据里稳定的唯一 id**。没有 id 就设法造一个（后端返回、或入库时生成 UUID）。

呼应 Vue：官方同样警告"不要在生产用 index 作 key"，原理完全相同。

---

## 四、key 的唯一性范围 & 常见陷阱

- key 只需在**同一父节点的兄弟之间**唯一，不必全局唯一（不同列表可重复用 1、2、3）；
- 别在**渲染时**用 `Math.random()`/`Date.now()` 生成 key——每次渲染都变 → 每次都被判为"新元素" → 全量重建，state 永不保留；
- 把 key 放在 `map` 返回的**最外层元素**上；Fragment 需带 key 时用 `<Fragment key={x}>`；
- 组件作为列表项时，key 写在组件标签上（`<Row key={item.id} />`），React 会传给该组件的根元素用于 diff（key 不会作为 prop 传进组件内部）。

---

## 五、派生列表：filter / sort 不改原数组

```jsx
const visible = useMemo(
  () => items.filter(i => i.done).sort((a, b) => a.title.localeCompare(b.title)),
  [items]
);
```
- `filter`/`map`/`slice` 返回**新数组**（不突变原 state，呼应 react-usestate 不可变）；
- `sort` **会原地突变**数组——若直接 `state.sort()` 会改到 state 本体且不触发更新，应先 `[...items].sort()`；
- 昂贵派生用 `useMemo` 缓存，避免每次渲染重算（呼应 react-memo-hooks）。

---

## 六、自检清单

- [ ] React 里渲染列表用什么？`{}` 里放的是表达式还是语句？
- [ ] key 是给谁用的？它如何影响 DOM/state 的复用？
- [ ] 头部插入时 index 作 key 会发生什么？为什么 state 会"跟着位置跑"？
- [ ] 为什么不能在渲染时用 Math.random() 当 key？
- [ ] `items.sort()` 直接改 state 有什么问题？派生列表为何用 useMemo？

---

## 🚀 部署预告

- 本课把 **react-render-model** 的 diff 三假设落到"列表"这一最需要 key 的场景：**稳定唯一 id = 正确复用**，index/random 都会破坏身份；
- 下一关进入 **react-render-control**：条件渲染、early return、`ErrorBoundary` 与 `Suspense`——把"什么该渲染、出错/加载中怎么兜底"补齐，呼应 vue-conditional-list 与 onErrorCaptured。
