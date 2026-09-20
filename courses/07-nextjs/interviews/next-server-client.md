# next-server-client 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点 React Server Components 高频面经，中文重述。

---

## A. 概念本质

**1. 用一段话讲清什么是 React Server Components。**
**来源**：知乎《如何通俗解释 RSC》；InfoQ《RSC：React 的第二次架构分裂》
RSC 是一种在服务器上执行、输出序列化组件描述（Payload）而非 HTML 字符串的组件类型：可 await 数据、可持有密钥与 Node 依赖，其代码不下发到浏览器；浏览器端把 Payload 拼进 UI 树，与客户端组件（可交互岛屿）组成混合树。本质是"把'组件在哪运行'变成架构可编程维度"。

**2. RSC 和 SSR 的区别？面试官想听的关键词是什么？**
**来源**：SegmentFault《SSR vs RSC 辨析大全》；掘金（水合与 payload 相关讨论）
三个关键词：① 产物（HTML 字符串 vs 组件树序列化）；② 代码分布（SSR 全量组件 JS 仍下发再水合，RSC 服务端组件代码物理不下发）；③ 取数粒度（页面级钩子 vs 任意组件 await）。加分句：RSC 减少的是 JS 体积与二次渲染成本，SSR 解决的是首屏可见——正交可叠加。

**3. RSC 出现后，为什么'瀑布式 useEffect 取数'被认为是反模式？**
**来源**：CSDN《RSC 时代的数据获取》；知乎（async 组件相关）
客户端取数天然造成 下载 JS→执行→发请求→再渲染 的串行瀑布；RSC 把取数提到渲染前、且组件级并行（父子 await 由流式渲染调度），首数据即随 HTML/Payload 到达——同类病在小程序表现为 onLoad 里 setData 连环套的白屏链（呼应 mp-performance 的 setData 三查、react-data-fetching 的瀑布话题）。

---

## B. 边界规则

**4. 'use client 加在父组件和只加在交互子组件上，两种写法产物有何差别？**
**来源**：掘金《边界位置与 bundle 体积实测》
标父：父及其整个 import 图全进客户端 bundle；标叶：只有子树进 bundle，父级的 await 取数与重依赖留在服务端。原则"边界尽量下推"（push to leaves）——L3 边界课的核心操作，体积差异可达数十 KB 级（呼应 next-boundaries）。

**5. 服务端组件能把函数作为 props 传给客户端组件吗？**
**来源**：InfoQ（Server Actions 前史的讨论）；SegmentFault《Only plain objects can be passed》
普通函数不行（报 "functions as props" 类错误），序列化不过去。两个正解：把函数逻辑留在客户端组件内部；或用 Server Actions（'use server' 的序列化函数引用是特例，L5 主讲）。同理不可传：类实例、Symbol、闭包捕获的敏感对象（呼应 next-forms-mutations）。

**6. 客户端组件 import 了一个服务端组件，会发生什么？为什么说这是最阴的坑？**
**来源**：CSDN《RSC 方向性铁律》；知乎（静默转换吐槽）
被 import 的组件会**降级为客户端组件**（在浏览器渲染）——不报错、不打日志，只在功能异常时才暴露（比如它内部的 await db 直接崩，或有人偷偷把密钥逻辑挪进了客户端）。防它靠目录纪律（服务端专用模块 server-only）与 code review（呼应 next-server-client 第六节）。

---

## C. 数据与生态

**7. RSC 里 await 一个慢查询，整页会白屏等待吗？怎么优化？**
**来源**：掘金《Suspense 边界与 RSC 瀑布》
默认会——同层父子串行 await 形成服务端瀑布。两板斧：① Promise 先发起后 await（组合式并行）；② 慢块包 `<Suspense>`（或 loading.tsx）流式输出。这题在考"你知道 RSC 只解决位置不自动解决并行"（呼应 next-context-streaming、es-promise 的全家桶思想）。

**8. 老牌的 Context、Redux、chakra 等都要求客户端，团队如何与 RSC 共处？**
**来源**：InfoQ《生态适配现状》；SegmentFault《用 Next 还要不要状态库》
三类策略：provider 收进客户端岛根（边界处一个 provider 文件包住第三方树）；服务端优先——能从 cookies/DB 拿的别放全局 store，Redux/Zustand 缩到交互态；等新范式（Server Actions + revalidate 替代部分全局刷新，L5）。结论：不是"废状态库"，是"状态搬家"（呼应 next-boundaries、react-state-mgmt）。

**9. RSC Payload 是缓存友好的吗？和 Router Cache 什么关系？**
**来源**：CSDN《Payload、静态壳与三层缓存》
Payload 与 HTML 均可按路由/参数键缓存，这就是 Router Cache 与服务端 Data Cache 联动的介质（L4 主讲）。面试价值：说得出"秒开来自 payload 预取命中，而非接口变快"——性能归因准确（呼应 next-link-router）。

---

## D. 思辨与综合

**10. 有人说 RSC 让'前端/后端'的边界重新模糊，你怎么看？**
**来源**：知乎《全栈框架化下的岗位边界》；InfoQ 评论文章
组件文件内一半是 SQL 一半是 JSX，概念上回到"服务器渲染时代+组件化"的合体。分工未消失而是重排：领域服务/数据建模仍属后端心智，RSC 承担 BFF 与视图合成；风险是"人人都碰 DB"造成治理灾难——用 db 访问层收敛（lib/db 单口）+ server-only 锁（呼应 next-fullstack-project、exp-server 的职责论）。

**11. 一个纯内网管理系统（无 SEO、都在登录后），RSC 还有价值吗？**
**来源**：SegmentFault《后台系统用 Next 图什么》
有，但收益排序变化：SEO 归零，首屏白屏仍在（内网也嫌慢）；RSC 的价值转向——服务端直连内网数据库少写一层 API、表单/列表交互的 JS 更小、以及取数样板消失。同时警惕：团队若全员重度客户端心智，边界纪律的学习成本可能盖过收益——这正是"何时不该用 Next"的子问题（呼应 react-architecture 的权衡方法论）。

**12. 设计题：给一个电商详情页画 RSC/客户端边界与 Suspense 边界草图。**
**来源**：掘金《详情页组件分层实战》
参考骨架：页面（Server，并发取商品/评价计数）→ 主图/标题/价格（Server，进 Payload）→ 规格选择器+加购（Client 岛，重交互）→ 评价列表（Server + Suspense，慢查询流式补）→ 推荐位（Server + 独立 Suspense/错误边界）→ 实时库存（Client 小片轮询或流式动态槽）。评分点：边界下推、慢源隔离、交互局部化三原则全部体现（呼应 mp-openapi 的页面自治同理）。
