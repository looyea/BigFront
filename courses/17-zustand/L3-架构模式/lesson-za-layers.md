# 状态分层：UI / 业务 / 服务端

## 一、三层模型

| 层 | 例子 | 更新频率 | 持久化 | 归属库 |
|---|---|---|---|---|
| UI 态 | 主题、侧栏开合、弹窗 | 低 | 常存偏好 | Zustand persist |
| 业务态 | 购物车、表单草稿、向导 | 中 | 视情况 | Zustand |
| 服务端态 | 列表、详情、用户资料 | 高（随网络） | 缓存 | TanStack Query |

## 二、核心原则：各归其位

- **服务端态不要拷进 Zustand**：那会制造两份真相、同步地狱。交给 Query 管缓存/重试/失效。
- **UI 与业务态不放 Query**：它们不是「远端数据的镜像」。
- Zustand 管「客户端产生的状态(client-derived state)」，Query 管「远端状态」。

反面剧本：把接口结果 `set({ list: res.data })` 存进 Zustand，从此刷新、分页、缓存、竞态、乐观回滚全要自己重写一遍——那就是手搓一个残缺版 Query（成本见 za-crud）。

## 三、禁止跨层直写

业务层可读 UI 层、可触发服务端层 refetch，但不要从组件深处直接改 serverCache 的字段——应通过 Query 的 mutation/invalidate，保持单一写路径。

合法的「跨层」只有一种方向：UI 事件 → action → (store.set | query.invalidate)。任何组件里 `store.setState({ serverField: x })` 绕过来源层都是违例（呼应 za-capstone 的 lint 边界）。

## 四、边界案例判据

- **登录态**：token 本身是服务端签发的（server 派生），但「是否过期/刷新中」是客户端交互态——拆两半：数据走 Query/Cookie，UI 标志走 store（呼应 za-auth）。
- **乐观更新**：临时覆盖值是业务态放 store/Query 缓存，确认后 invalidate 回到单一真相（呼应 za-crud）。
- **URL 态**：tab、筛选条件可分享——放 URL search params 为真相，store 只做镜像订阅。

## 五、命名与目录

```
store/
  ui/useThemeStore.ts
  biz/useCartStore.ts
  server/  (queries + mutations)
```
每层测试策略也不同：UI/业务纯 store 测；服务端层测 mock(msw)（呼应 za-testing-deep）。

## 六、和 Pinia/Jotai 的分层对照

Pinia 的 @pinia/colada、Jotai 的 atomWithQuery 都在解决同一种分层——服务端态与客户端态物理分离。库会换，「按数据来源分层」的思想不变（呼应 pinia-ecosystem、jo-compare）。

## 小结
按「变化来源」分三层，让 Zustand 与 TanStack Query 各司其职；单一写路径、单一真相源；边界用例按「数据为谁产生」拆。

## 部署预告
本地起一个 Todo 应用：列表走 useQuery，弹窗开合与筛选走 Zustand，刷新后观察只有 Query 区出现 loading 骨架——这就是分层生效的直观证据。
