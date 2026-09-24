# queryKey：缓存键即身份

## 一、key 是主键，不是标签

Query 的缓存是一张「hashKey(queryKey) → 查询」的 Map。**queryKey 就是这条数据的身份证**：去重、读写、失效、GC 全按它寻址。两个组件 key 相同即共享一份数据；key 不同即形同陌路——哪怕 queryFn 请求的是同一个 URL。

```tsx
useQuery({ queryKey: ['todos'], queryFn: fetchTodos });        // 组件 A
useQuery({ queryKey: ['todos', { filter: 'done' }], queryFn }); // 组件 B——另一条缓存
```

## 二、数组结构与序列化

key 推荐数组：第一段是「表名/域」，后续段是参数。hashKey 对**对象按 key 排序后**序列化，所以 `{a:1,b:2}` 与 `{b:2,a:1}` 是同一条缓存；但**数组顺序有意义**，`['tag', ['a','b']]` ≠ `['tag', ['b','a']]`。别把 Date.now()、随机 id 塞进 key——那等于永远 cache miss。

## 三、层级化设计：前缀匹配的地基

```ts
['projects']                      // 列表
['projects', projectId]           // 详情
['projects', projectId, 'tasks']  // 子资源
['projects', projectId, 'tasks', { status: 'open' }]
```

这套树形 key 让「变更一条数据，精确失效一片缓存」成为一行代码：

```ts
queryClient.invalidateQueries({ queryKey: ['projects', id] });
// 详情 + 该项目的 tasks 全部命中（前缀匹配，默认非 exact）
```

## 四、key 工厂：规模化项目的标配

```ts
// api/projects/keys.ts
export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, id] as const,
};
```

key 的字符串字面量只出现在工厂里一次，组件与 mutation 回调都引工厂——重命名安全、IDE 可跳转、invalidate 不再拼错。官方称之为 key 的最佳实践起点（essential-query-key 思想，v5 教程单列）。

## 五、匹配规则速查

| 调用 | 命中 |
|---|---|
| invalidateQueries() | 全部查询 |
| { queryKey: ['u'] } | 前缀 ['u'] 的（partial） |
| { queryKey: ['u'], exact: true } | 仅完全等于 ['u'] 的 |
| { predicate: q => ... } | 谓词自定义 |

exact/partial 这套匹配语义同样适用于 refetchQueries、removeQueries、setQueryData 的兄弟们——学一次全局通用。

## 小结
queryKey=缓存身份：数组分层表意、对象序无关数组序有关、Date.now 别入键；树形 key + key 工厂 + 前缀失效三件套齐了，Query 的「增删改查联动」就通了。

## 部署预告
给 L1 的用户页升级：建 userKeys 工厂（all/list/detail），在 console 里先后用「前缀失效」「exact 失效」「predicate 全清」三种方式，在 DevTools 面板观察每回命中几条。
