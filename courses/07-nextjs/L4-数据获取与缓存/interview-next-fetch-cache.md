# next-fetch-cache 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点 Next.js 缓存体系高频面经，中文重述。

---

## A. 机制理解

**1. Next 的 fetch 缓存和浏览器 HTTP 缓存、CDN 缓存是什么关系？能叠加吗？**
**来源**：InfoQ《一份数据的四段旅程》；掘金《从 fetch 到 CDN 的缓存链路》
可叠加且应该叠加：Next Data Cache（服务端进程/平台 KV）→ Full Route Cache（服务端/CDN 边缘）→ HTTP 强缓存/协商缓存（浏览器）。同一接口可能四层都命中。面试要点：画出链路、说清每层键与失效手段各不同（呼应 node-deploy-perf 的 CDN 分层）。

**2. 为什么 Next 选择'扩展 fetch 第三参数'而不是提供 useFetch 之类的 hook？**
**来源**：知乎《为什么是 fetch 拦截而不是数据请求库》
fetch 是 Web 标准全局 API，拦截它即可无侵入获得跨框架/跨库统一缓存点（SWR/React Query 是客户端 hook 思路，管不了服务端渲染期取数）；这也让"组件即数据消费者"的 RSC 模型成立。代价是"魔法参数"可读性争议与默认值反复变更（呼应 next-fetch-cache 第二节的锁策略建议）。

**3. 请求记忆化（memoization）和 Data Cache 的本质区别？**
**来源**：SegmentFault《两个容易混淆的去重》
记忆化作用域=单次渲染（同参数只发一次，省重复 await），随请求结束消失；Data Cache 作用域=跨请求持久（按 URL+选项为键，TTL/tag 失效）。前者解并发组织问题，后者解存储问题（呼应 next-fetch-cache 第二、三节）。

---

## B. 策略设计

**4. 商品详情页（价格分钟级波动、库存秒级、评价十分钟）怎么配缓存策略？**
**来源**：掘金《一页多 TTL 的 tag 设计》；CSDN《Next 电商缓存实践》
按新鲜度拆 fetch：价格 revalidate:60+tag price-{id}；库存不进 Next 缓存（no-store 由客户端小件轮询/推送）；评价 revalidate:600。页面整体 ISR 出静态壳+动态 hole（配 PPR/流式）。评分点：缓存粒度=数据新鲜度粒度，不是页面粒度（呼应 next-context-streaming 面试 9）。

**5. revalidatePath 和 revalidateTag 的区别与适用面？**
**来源**：知乎《精确失效与广播失效》
Path：让某条路由的整页缓存过期（重渲染代价大、影响该页所有数据）；Tag：让"用了这批 fetch 的所有页"过期（数据维度精确）。原则：数据驱动变更用 tag（价格变了失效 price-*），页面级重排/运营改文案用 path（呼应 next-revalidate 主讲、L5 Server Action 实战）。

**6. 多实例部署（3 台 Node）下，revalidateTag 为什么可能'只生效一台'？怎么解？**
**来源**：InfoQ《自托管 Next 的缓存一致性坑》；SegmentFault（单机内存缓存讨论）
默认 Data Cache 是**进程内**的：tag 失效只作用于收到请求的那台。解法：① 平台缓存适配（Vercel/Hermes 等把缓存层外置成 KV，跨实例共享）；② 失效走广播（Redis pub/sub 触发各实例）；③ 或改用 CDN 级 purge+短 TTL 容忍。这题筛掉只在单机 dev 模式思考的候选人（呼应 next-deploy）。

---

## C. 陷阱与排查

**7. 改了上游数据页面却不变，按什么顺序排查？（考缓存金字塔排障）**
**来源**：CSDN《Next 缓存不刷新排查手册》
① fetch 是否真带 revalidate/tags（默认策略锁死了吗）→ ② 失效调用是否执行且传对键（tag 名拼写）→ ③ 多实例/平台缓存层是否同步（上一题）→ ④ CDN/Router Cache：客户端预取的旧 payload（refresh 或降 cacheLife）→ ⑤ 浏览器 HTTP 缓存（no-store 头是否被网关吞）。展示分层定位能力比背 API 更重要（呼应 mp-network 五层拦截器的排障美学）。

**8. 'use client 组件里直接 fetch 会进 Data Cache 吗？**
**来源**：掘金《执行环境决定缓存归属》
不会——缓存扩展只在**服务端**的 fetch 上生效；客户端 fetch 就是浏览器原生行为（HTTP 缓存而已），且它发生在水合后，不参与预渲染。这是"位置决定语义"的又一例（呼应 next-server-client、react-data-fetching 的库分工）。

**9. unstable_cache 的 keys 数组写错（漏了 userId）导致什么后果？API 名字本身说明什么？**
**来源**：知乎《手搓缓存键的串号事故复盘》
所有用户共享一份缓存——比不缓存更糟。名字里的 unstable 是官方诚实：语义仍在演进（后与 cacheComponents 方向整合），生产依赖要盯 changelog、写测试锁行为（呼应 next-fetch-cache 第五节、es-coercion 式的'键即契约'思维）。

---

## D. 思辨与综合

**10. 有人批评'Next 把缓存做进框架是过度魔法'，你怎么两边都说?**
**来源**：InfoQ 评论《缓存进框架之争》；SegmentFault（框架默认值讨论）
正方：缓存是大站刚需，框架统一编排四层才可能默认快（Vercel 商业模式也建立于此）；反方：隐式行为多、跨实例需外置、心智负担转嫁团队。公允结论：内容/电商站收益显著；强事务后台/高度自定义基础设施则可能选"路由框架+自建缓存"。给出**场景判据**才是高分（呼应 react-architecture 权衡法）。

**11. 客户端的 React Query 和 Next 的 Data Cache 冲突吗？混合架构怎么分工？**
**来源**：CSDN《RSC 与 React Query 共存指南》
不冲突，分工清晰：首屏/SEO 数据走服务端 fetch+Data Cache 随 Payload 下发；交互期数据（无限滚动、变更轮询、乐观更新）归 React Query 在客户端管理。交接点：服务端初始数据作为 dehydrate 的 seed，避免两边同键双份真相（呼应 react-data-fetching、react-state-mgmt 单一数据源律）。

**12. 给新项目定《缓存军规》，写你认为最重要的三条并说明理由。**
**来源**：知乎《团队 Next 缓存规范长什么样》
参考骨架：① 禁止裸 fetch——每个取数必须显式 cache 策略常量（lint 规则强制），默认值漂移是事故源；② 进缓存的数据必须"与请求者无关"，用户态一律 no-store+服务端鉴权（安全线）；③ 所有写操作必须声明其失效半径（tag 清单写进 lib/api 的函数签名旁），失效半径不明=数据延迟不可知（呼应 next-forms-mutations、exp-validation 的军规文风）。
