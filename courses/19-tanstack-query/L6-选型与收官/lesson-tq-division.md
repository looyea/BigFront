# 异步状态三层分工总决算

## 一、一张图收四门课

```
        ┌─ Server State ──── TanStack Query（本包）
状态 ───┼─ Client State ──── Zustand / Jotai / Pinia（16-18 包）
        ├─ Form State ────── React Hook Form / VeeValidate（自管或上库）
        └─ URL State ─────── Router（query param / path）
```

判据复习（za-layers 提出、jo-race 强化、本包落地）：**数据是谁的？** 服务器拥有→Query；只有浏览器拥有（主题、抽屉开合、选中项）→状态库；用户正在编辑未提交→表单层；要可分享可回退→URL。

## 二、每层各管到什么程度

- **Query 层**：取数、缓存、新鲜度、失效联动、乐观回滚、SSR 水合——**跨组件共享的异步只读数据**全权代理。
- **状态库**：会话 UI 态、全局偏好、复杂交互中间态（拖拽草稿）、跨页非服务器数据——三家分工沿用 17/18 包结论：细粒度派生选 Jotai，中台重手写选 Zustand，Vue 全家桶选 Pinia。
- **边界工**：表单值是「未提交的 server state 草稿」，RHF 用 ref 抗重渲染管住它，提交成功交给 Query mutation + invalidate 闭环。
- **URL**：列表筛选、页码、tab——把「状态」升格成「可分享的事实」，Query 的 key 从这里取材（tq-conditional 的依赖键）。

## 三、四个反模式（哪层都不许串岗）

① **把 server state 拷进 client state**：useEffect 里 setTodos(data)——多一份真相要手动同步，缓存/新鲜度全丢（本包开篇痛点的变体）；② **用 Query 存 UI 态**：modal 开关也发一次 fake queryFn——工具错配，面板里塞满假条目；③ **表单值进全局 store**：每敲一键全站重渲染（sig-async 说过的受控过度）；④ **能用 URL 的藏进组件 state**：刷新即丢、无法分享、回退行为诡异。

## 四、协作时序（一次点赞走完四层）

URL 的 /posts/42 → useQuery(['posts',42]) 命中缓存渲染 → 用户点zan，useMutation 乐观改 Query 缓存 → 登录态守卫从 Zustand 读 token 决定 enabled → 点赞数由 Query 的 select 派生进 UI。全程**没有一行「把服务器数据 set 进状态库」**——四层各司其职的样板。

## 五、依赖与红线

Query 与状态库零耦合（不同 npm 宇宙），同栈无冲突；唯一红线是**别互相持有**：状态库里存 queryKey 再手动 invalidate 可以，存 query 数据副本不行。测试时两层各测各的（Query 三件套已讲；状态库用 vanilla store/atom 直读）。

## 小结
四层四判据：谁的拥有权归谁——Query 管服务器、状态库管浏览器、表单层管草稿、URL 管可分享；四个反模式全是「串岗」。这门状态管理专题（16-19 包）到这里合龙。

## 部署预告
给你手头任意应用画一张「状态分层图」：每个 store 字段与每条缓存 key 对号入座，找出至少一处反模式并搬迁——搬迁完成后删掉一条 useEffect 同步链，全站行为不变才算过关。
