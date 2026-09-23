# sig-server：客户端状态 vs 服务端状态

> 目标：把『把接口数据塞进 Zustand』这个最普遍的架构错位连根拔掉：讲清服务端状态的『缓存+失效』模型为何碾压『复制+手同步』，画出两条状态的四职责边界（缓存/失效/加载态/乐观更新谁管），并对照框架数据方案（SvelteKit load、Solid resource）看这条分工线的行业终态（呼应 za-patterns、rx-inapp、sig-scenarios）

## 一、一个事实：你的『全局状态』一半是别人的缓存

拉一个真实 SPA 的 store 看：user、permissions、列表页数据、文章详情、配置项——全是**服务端数据在浏览器里的临时 copies**。它们的共同点：你改不了真身（改了也要回源确认）、别的标签页/别的用户随时让它过期、刷新后必须重新对账。而 Zustand 们的设计目标是**客户端事实源**（主题、抽屉——没人跟你抢着改）。用管理『我家传家宝』的柜子去管『图书馆借来的书』，错配就开始了。

## 二、塞进 Zustand 的三段式堕落史（每个项目都会重演）

第 1 段，甜蜜：`useEffect(fetch → setState)`，读快、写顺。第 2 段，长毛：新页面要同一份数据→复制；A 页改了 B 页显示旧的→加同步 effect；要下拉刷新→手搓 loading；竞态来了（后发先至）→手搓 requestId 比对。第 3 段，坍塌：『刷新后 store 里残留上一用户的数据』事故一场，于是补登录时 `store.reset()` 全家桶、补 `invalidate('users', id)` 手写总线——**恭喜，你重新发明了 React Query 的 80%，用了三倍代码且没测过竞态**。

Query 模型的降维打击在于它承认『服务端状态=缓存』这个本质，然后把缓存的四大职责全接管：

| 职责 | Query 的答案 | 手塞 Zustand 的下场 |
|---|---|---|
| 缓存 | queryKey 归一化去重，多组件共享一份 | 复制 N 份或自造 byId |
| 失效 | staleTime/gcTime + invalidate 语义（『脏了』不是『删了』） | 手广播刷新事件，漏一处旧数据永生 |
| 加载态 | isLoading/isError/keepPreviousData 一等公民 | 每个请求三件套 useState 样板 |
| 乐观更新 | onMutate 回滚快照白送 | 自己存旧值、自己 catch 自己还原 |

za-patterns 那句『双事实源三宗罪』在这里升级为正面教材——**组件从 useQuery 读，和从 store 读一样短，但生命周期完全不同**。

## 三、边界协议：两条状态怎么握手

共存规范三条（写进 sig-scenarios 第 2 条的执行细则）：

1. **请求参数进 store、响应数据不进**：筛选条件/分页游标是客户端事实（Zustand/URL 的地盘），Query 的 key 引用它们（`queryKey: ['articles', filters]`）——参数变→key 变→自动重取，**同步方向永远是客户端→服务端**，反向数据流只走 Query；
2. **乐观更新的归属**：改『远端会接受』的值走 onMutate（Query 的地盘）；改『只有 UI 在乎』的值（本地草稿、已读标记的即时反馈）进 store 再异步落库——分不清哪个是哪个时，问『服务器拒绝这次更新后，UI 该不该退回？』该退的归 Query；
3. **登出清场协议**：`queryClient.clear()` + 各 UI store 的 reset action **成对出现在同一个 logout 函数**——只清一边是『A 用户看到 B 用户数据』事故的标配成因（服务端缓存残留在客户端坟场里）。

## 四、框架数据方案的终态：这条线正在被上移

SvelteKit 的 `load()`、SolidStart/Nuxt 的 resource、Next RSC fetch——框架把『服务端状态』进一步上移到**路由加载层**：数据在服务器取好、序列化进首屏 HTML、客户端 hydrate 成响应式源（Solid resource 的『信号+Promise』形态正是 sig-vs-streams 海关的框架内置版）。对状态库选型的影响：**『拉数据放哪』的答案越来越是『框架数据层』**，第三方库的保留地进一步收缩到跨路由客户端态与域模型（sig-scenarios §四的保留地清单再削一城）。但注意上移不等于消失——失效/竞态/乐观这些问题跟着数据进了新层，只是换了 API（`invalidateAll()`、`rerun`）——**Query 模型是思想不是那个包**。

## 五、SSR 特供注意三条（L8 后半段与 sig-server 的接口）

1. **模块单例在 Node 里=跨请求共享**——Zustand 的 create 在服务端要请求级实例化（`createStore` per request+Context 注入，za-core 面试 q4 的正式处决）；Query 自带 per-request client，框架数据层天然免疫——这是『塞 store 方案』在 SSR 下多出的独家债；
2. **水合序列化**：服务端取的数据要能过 HTML——函数/Proxy/class 实例出局（『存储只过值』的水合分册）；persist+SSR 的 skipHydration 时序（za-middleware q6）在数据层同理重现；
3. **失效级联**：服务端渲染时一个 mutation 成功该刷哪些 load 函数/queries，是比客户端更麻烦的显式命题（`+revalidate`/`invalidate` 路由级控制）——设计上少一格自动兜底。

> 🚀 部署预告：本关保留实验：把 za-patterns 实验里那个假 store 中的『用户列表』字段整个搬去 React Query，删掉你写的 loading/竞态/同步代码——统计删行数，那本账就是这个架构决策的全部理由。
