# 数据获取与服务端状态

> 目标：手工 `useState + useEffect + fetch` 只能满足最小场景，真实应用需要**缓存、请求去重、失效重取、分页/无限滚动、乐观更新、错误重试**。本课以 **TanStack Query**（`useQuery`/`useMutation`）为主线，讲清一个关键心智：把**服务端状态**（服务器持有、你只是缓存的只读镜像）从**客户端状态**（UI 态、全局态）里分离出来。呼应 **react-effect-patterns**（治竞态）、**react-state-mgmt**、**vue-state-patterns**（Pinia 手填接口的痛点）。

---

## 一、为什么 useEffect 手 fetch 不够

回忆 **react-effect-patterns**：用 effect 取数要自己处理 `ignore`/`AbortController` 竞态、加载/错误三态、缓存、跨组件重复请求。当多个组件都要"当前用户"，各写一遍 effect 就会**重复请求**、无法共享、没有缓存。问题的根源：把"服务端状态"当成了"客户端状态"来手工管理。

---

## 二、useQuery：声明式数据源

```jsx
import { useQuery } from '@tanstack/react-query';

function User({ id }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user', id],                 // 缓存键（含参数）
    queryFn: () => fetch(`/api/user/${id}`).then(r => r.json()),
    staleTime: 60_000,                       // 60s 内视为新鲜，不重取
  });
  if (isLoading) return <Spinner />;
  if (error) return <Err msg={error.message} onRetry={refetch} />;
  return <Profile user={data} />;
}
```
- `queryKey` 是**缓存与去重的地址**：同 key 的组件共享一份数据、只发一次请求（数组便于含参数 → 换 id 自动新缓存并重取，呼应 react-router-data 参数变化）；
- 返回 `data/isLoading/error/refetch` 等，三态齐全、无需手写 effect；
- `queryFn` 返回 Promise，Query 自动跟踪其 pending/success/error。

---

## 三、缓存、去重、失效

- **去重**：同一 `queryKey` 在 `staleTime` 内多处使用只请求一次，切回来命中缓存"秒开"；
- **新鲜度**：`staleTime`（多久算过期）+ `gcTime`（缓存保留多久）；`refetchOnWindowFocus` 等策略自动重取；
- **失效（invalidate）**：数据变更后 `queryClient.invalidateQueries({ queryKey: ['todos'] })` 标记过期并触发重取——这是"写后刷新"的声明式答案（对比 router 的自动重取，呼应 react-router-data 第四节）；
- 与浏览器 HTTP 缓存互补：Query 是**内存级、按 key** 的服务端状态缓存。

---

## 四、useMutation：写操作

```jsx
import { useMutation, useQueryClient } from '@tanstack/react-query';

function AddTodo() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (todo) => fetch('/api/todos', { method: 'POST', body: JSON.stringify(todo) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),   // 写成功后让列表重取
  });
  return <button onClick={() => m.mutate({ text: '新任务' })} disabled={m.isPending}>添加</button>;
}
```
- mutation 管"发起写 + pending/success/error 态"，**不自动去重**（写本就该每次执行）；
- 惯用 `onSuccess` 里 `invalidateQueries` 让相关查询刷新；
- **乐观更新**：`onMutate` 先 `setQueryData` 本地即时改、失败再 `rollback`——先加 UI 后确认。

---

## 五、服务端状态 vs 客户端状态

| | 服务端状态 | 客户端状态 |
|---|---|---|
| 归属 | 服务器持有，你是只读缓存镜像 | 只有你知（UI/全局） |
| 工具 | TanStack Query / SWR | Context / Zustand / Redux |
| 关注点 | 缓存、失效、去重、重取 | 读改写、跨组件共享 |
| 例子 | 用户列表、文章 | 弹窗开合、主题、登录态 |

**别用 Redux/Pinia 手动缓存接口数据**——那是把服务端状态硬掰成客户端状态。UI 全局态才交给状态库（呼应 react-state-mgmt、vue-pinia-basics）。

---

## 六、自检清单

- [ ] useEffect 手 fetch 有哪些反复要解决的痛点？根源是什么？
- [ ] queryKey 为什么常是数组？它如何影响缓存与去重？
- [ ] staleTime / invalidateQueries 各解决什么？写操作后如何刷新列表？
- [ ] useMutation 和 useQuery 在"去重"上为何态度相反？
- [ ] 什么该放 Query、什么该放 Zustand/Context？

---

## 🚀 部署预告

- 本课确立"服务端状态交给 Query、客户端全局态交给 store"的分离原则，配合上关 loader 覆盖大部分取数场景；
- L6 三关（路由基础 / Data Router / 数据获取）收官。下一关进入 **L7**：状态管理、性能与测试——先讲 **react-state-mgmt**：React 里到底什么时候才需要全局状态、Context / Zustand / Redux 各自定位（呼应 react-context 的"Context≠状态库"、react-performance）。
