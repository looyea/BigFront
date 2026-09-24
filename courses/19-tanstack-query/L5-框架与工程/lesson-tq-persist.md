# 持久化与跨标签同步

## 一、缓存出院：为什么 Query 也能 persist

Query 的缓存活在内存，刷新即蒸发。persistQueryClient 把「已完成的查询」序列化进 localStorage/AsyncStorage，重启时灌回——配合 staleTime，冷启动首帧就能显示上次数据、后台验证刷新。与 zustand persist（整棵 state 树）、jotai atomWithStorage（单原子）相比，Query 的粒度是「每条查询自己说了算」：shouldDehydrateQuery 挑值得出院的（比如只持久化用户资料，不持久化股价）。

## 二、最小接线

```ts
const queryClient = new QueryClient();
const persister = createSyncStoragePersister({
  storage: window.localStorage,     // 同步存储走这个；异步(IndexedDB/FS)用 createAsyncStoragePersister
});
persistQueryClient({ queryClient, persister, maxAge: 24 * 60 * 60 * 1000 });
```

`maxAge` 给持久数据二次保质期（过期条目灌回即弃）；`dehydrateOptions: { shouldDehydrateQuery }` 做白名单。两个 persister 对应两类存储介质，接口都是 { persistClient, restoreClient, removeClient } 三件套。

## 三、多标签页一份缓存：broadcastQueryClient

```ts
const unsub = broadcastQueryClient({ queryClient, broadcastChannel: 'TQ' });
```

基于 BroadcastChannel：同源的多个标签页共享一条缓存总线——A 页 invalidate/写入，B 页立即可见；一个标签页取数，另一个直接用（官方定位 experimental，但机制简单：变更全量广播 + 新成员入网求快照）。与 persist 正交：persist 管「穿越刷新」，broadcast 管「穿越标签页」。

## 四、危险边界

① **别在服务端 persist**：window 不存在，且多用户共享存储=串数据事故；② 敏感数据（token、隐私资料）落 localStorage 前先想 XSS——持久层是明文；③ 结构漂移：改版后 queryKey 语义变了，旧持久条目会顶着老数据出现在新 UI 里，大版本变更记得升 key 或清 store；④ 持久化 mutation 一般没意义（写操作不可重放），默认也不带。

## 五、和「离线 mutation」的边界

本关是「读缓存出院」。真正的离线写排队重放（mutate 时离线→入队→上线自动发）是 v5 新 persister API（createPersister + 离线示例）的领地，React Native 场景居多——Web 常规业务到 persistQueryClient 为止够用；真要做先读官方 offline 示例再动手。

## 小结
persistQueryClient+两 persister 让查询缓存穿越刷新（shouldDehydrateQuery 精选+maxAge 保质），broadcastQueryClient 让多标签共享一条缓存；两者正交、都有安全红线（服务端禁用、敏感数据谨慎、key 漂移要清）。

## 部署预告
给 L2 的 todo 页接 localStorage 持久化：刷新后首帧直接出列表、DevTools 里看灌回条目数；再开两个标签改一条数据，接 broadcastQueryClient 前后对比第二标签的响应。
