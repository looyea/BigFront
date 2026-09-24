# CRUD 看板：分页 / 乐观 / 批量 / 回滚

## 一、归一化 store

看板/列表用「ids + entities」结构（呼应 redux 归一化）：

```ts
interface Board {
  ids: string[];
  entities: Record<string, Task>;
  addTask: (t: Task) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
}
```
列表顺序放 ids，数据放 entities，更新单条 O(1)。

为什么不用 `tasks: Task[]`：数组里改一条 = map 新数组 = 全列表引用变，行级 selector 全部失效（呼应 za-selectors-deep 的行级订阅）。ids/entities 下改一条只换 `entities[id]` 引用，其余行的订阅者纹丝不动。

## 二、乐观增改删 + 回滚

```ts
updateTask: (id, patch) => {
  const snapshot = structuredClone(get().entities[id]);
  set((s) => { s.entities[id] = { ...s.entities[id], ...patch }; }); // 乐观
  api.patch(id, patch).catch(() => set((s) => { s.entities[id] = snapshot; }));
},
```
先本地改，失败恢复快照（呼应 pinia-optimistic）。

三个升级点：① 回滚恢复的应是「请求发出前的最新值」而非陈旧快照——连点场景对同一 id 存 pending 队列；② 成功后用服务端返回值覆盖本地（ID 生成、计算字段）；③ 给行加 `_pending` 标志渲染半透明，明示「这条还没落库」。

## 三、分页 loadingMore

列表数据其实更适合 TanStack Query（server 态，呼应 za-layers）；store 只放「当前筛选/排序/乐观覆盖」。infinite 分页与 store 用 select 组合。

协作模式：Query 拿分页数据 → selector 合并 store 里的乐观补丁表（overrides）→ 渲染。服务端真相 + 客户端覆盖层，两者互不污染，回滚 = 删 overrides 一条，比在列表数组里改来改去干净得多。

## 四、批量操作
patch 多 id：一次 set 更新多个 entities，只触发一次订阅通知；undo 栈中间件可整批回滚（呼应 za-middleware-chain）。

```ts
archiveMany: (ids) => {
  const prev = ids.map((id) => [id, structuredClone(get().entities[id])]);
  set((s) => { for (const id of ids) s.entities[id].archived = true; }); // 单帧
  api.batch(ids).catch(() => set((s) => { for (const [id, t] of prev) s.entities[id] = t; }));
}
```

## 五、选择与拖拽
选中集 selectedIds:Set 放 store；跨列拖拽改 task.columnId + 重排 ids，用 immer 简化（呼应 za-immer-devtools）。

拖拽中的浮影坐标走 transient subscribe 直接改 DOM，松手才 set 进 store——每帧进 store 是看板性能事故的头号原因（呼应 za-store-api 第四节）。

## 六、并发与竞态

两个 tab 同时改一张卡：后端用 version/updatedAt 乐观锁，409 冲突时拉服务端最新值覆盖并 toast 提示。客户端 store 不解决冲突，只负责把冲突**呈现**出来——这是面试里把「乐观更新」讲深的加分段。

## 小结
归一化 ids/entities + 乐观快照回滚 + 批量单帧 set + 服务端分页交给 Query + 冲突交后端版本号——看板类 store 的完整骨架。

## 部署预告
本地做一个 3 列 Todo 看板：行级订阅 + 乐观改列 + 断网验证回滚；用 Profiler 确认改一张卡只重渲一行。
