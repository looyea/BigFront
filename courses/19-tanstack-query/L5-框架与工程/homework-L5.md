# L5 阶段作业：框架与工程

本阶段把 Query 从「浏览器里的缓存」升级为「全栈数据层」：SSR 水合、持久化出院、devtools 与测试工程化。以简明为主，三关作业各打一个穿。

## 一、知识回顾

1. 默写 SSR 三板斧的三步（每请求 new client + ？→ ？→ ？），并说明每步丢了会出什么事故。
2. persistQueryClient 的两个 persister 各适配什么介质？shouldDehydrateQuery 为什么是安全/体验双料守门员？
3. 测试三件套是什么？分别各治一个什么问题（退避等待、缓存串扰、mock 失真）。

## 二、代码实操

**实操 1（SSR）**：Next.js（Pages 或 App 均可）跑通官方 ssr 示例改造：首页 prefetch ['profile'] 水合后断网刷新，Network 面板确认零取数请求仍出内容；把 client 改成模块级单例，观察两个用户串数据的复现（本地模拟两账号），改回每请求 new。
**实操 2（持久化）**：给 L2 todo 页接 createSyncStoragePersister：maxAge 1 小时、只持久 ['todos'] 前缀；刷新验证首帧秒出+后台验证小转圈；开两个标签接 broadcastQueryClient，A 标签增删 B 标签是否实时可见；把 store 手改成旧 key 版本，复现「结构漂移」再修复。
**实操 3（测试）**：给 L3 的乐观点赞写三条测试（成功流、失败注入回滚流、请求体断言），要求：每测试新 client、retry:false、MSW 控失败率；跑通后测一下故意去掉回滚断言哪条会挂，验证用例真的测到了回滚。

## 三、思考题

1. 你的业务里有没有「持久化的陈旧比没有更危险」的查询？列出白名单与黑名单各三条并说理由。
2. streaming SSR 把 TTFB 与慢接口解耦，但为什么水合成本反而可能上升？（提示：HydrationBoundary 排队与片段提交）
3. devtools 面板里 inactive 条目显示灰色——从双时钟模型解释它何时会被重取、何时会被回收。

## 四、延伸阅读

- 官方指南：Server Rendering & Hydration（/guides/ssr）与 Advanced（/guides/advanced-ssr）两篇连读，后者讲 streaming/RSC 全案
- 插件篇四连：persistQueryClient、createSyncStoragePersister、createAsyncStoragePersister、broadcastQueryClient 各配最小示例
- Testing 专章（/guides/testing）+ 官方 react-query-testing 系列示例
- 选读：v5 新 createPersister 与 offline 示例（离线写重放的现在进行时）

## 五、自查清单

- [ ] 每请求 new client 的原因能讲成「安全事故」级别
- [ ] dehydrate 只带已完成查询、HydrationBoundary 排队灌回两条都验证过
- [ ] persist 白名单/ maxAge / 版本漂移三件事都有实操复现
- [ ] 服务端环境不会执行 persist 注册（守卫代码在）
- [ ] 三条测试全绿且去掉回滚实现后必有一条变红
- [ ] 多标签 broadcast 收敛在 Devtools 面板观察到
