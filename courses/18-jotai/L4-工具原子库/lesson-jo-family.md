# atomFamily：动态创建参数化原子

## 一、atomFamily 概念（v1）
`atomFamily(param => atom(...))` 按参数缓存原子：每个 param 对应一个稳定 atom 实例，用于列表/行级独立状态。

需求原型：50 行的表格，每行有独立的「展开/选中/草稿」态——不可能写 50 个手工 atom，也不能全塞一个对象 atom（一行改动全员重渲，呼应 jo-dependencies 宽订阅病灶）。参数化原子 = 「按需现造、同名同实例」的原子工厂。

## 二、v2 的取舍：官方移除
Jotai v2 移除了内置 atomFamily——因「无限缓存 + 无失效策略」易内存泄漏。官方推荐用 Map 手动 memo 或用 `atomWithStorage` 等，配合显式清理。

这是 Jotai 历史上最著名的一次「砍功能」：v1 的 atomFamily 内部 Map 只进不出，路由切一百次就攒一百批僵尸原子。移除传递的价值观很 Jotai——**生命周期必须有人负责，库不替你藏债**。

## 三、现代替代

```ts
function makeFamily<T>(make: (id: string) => T) {
  const cache = new Map<string, T>();
  return Object.assign(
    (id: string) => cache.get(id) ?? (cache.set(id, make(id)), cache.get(id)!),
    { remove: (id: string) => cache.delete(id), clear: () => cache.clear() }
  );
}
const rowAtom = makeFamily((id: string) => atom({ open: false, draft: '' }));
// 删除行时：rowAtom.remove(id)
```
自己控制生命周期：删除行时 cache.delete(id) 防泄漏。

注意「参数身份」：Map 键用字符串 id 没问题；若参数是对象，每次新引用会 cache miss 造新原子——要么规范化成字符串 key，要么 WeakMap 锁引用。

## 四、列表/表格行级状态
每行一个 atom（选中、展开、草稿）——用上面的 memo 工厂或 focusAtom 聚焦数组元素（呼应 jo-focus-select）。

与 focusAtom/splitAtom 的分工：行状态**与行数据无关**（展开、草稿这种附加态）→ family 造独立原子；行状态**就是数据本身**（编辑 task.title）→ splitAtom/focusAtom 从源数组派生，天然单真相。两者常混用：编辑走 focus、UI 态走 family。

## 五、内存泄漏防控
关键是「可失效」：为每个参数 atom 设回收（引用计数/显式 delete），别无界缓存（呼应 react-performance）。

三档策略按需选：① **显式 delete**（行删除钩子里 remove）——最常用；② **LRU 封顶**（超 N 个弹最久未用）——参数空间不可控（如任意日期）时用；③ **随源派生**：用 splitAtom 让「行原子清单」跟着数组自动增删，根本无缓存可漏——能走这条就走这条（见 jo-focus-select）。

## 六、异步 family：详情加载的标准件

```ts
const detailAtom = makeFamily((id: string) =>
  atom(async () => (await fetch('/api/task/' + id)).json()));
// 卡片组件： const detail = useAtomValue(detailAtom(card.id))
```

「点哪张卡取哪张数据」+ Suspense + 按 id 缓存已取结果 + 关卡即 remove——一个 10 行工厂齐活（对比 Query 的 key 缓存：语义相似，Jotai 版全在你手里，Query 版白送失效策略——小型只读详情用 family 够了，重缓存需求请回 jo-race 分工表）。

## 小结
atomFamily 思想仍在（参数化原子），v2 让你手写 Map + 失效策略，从根源防内存泄漏；行 UI 态用 family、行数据用 focus/split、详情缓存用异步 family——三招覆盖参数化原子全部主流场景。

## 部署预告
本地做一个可增删行的表格：行展开态用 Map-family、标题编辑用 splitAtom、卡片详情用 async-family + Suspense；Performance 面板开 Memory 快照验证删行后原子被回收。
