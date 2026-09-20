# next-boundaries 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 RSC 边界与数据流高频面经，中文重述。

---

## A. children 与穿透

**1. 为什么官方反复强调客户端组件用 children 接收服务端内容？不这样会怎样？**
**来源**：掘金《children 是 RSC 唯一的后门》；SegmentFault（import 方向性讨论）
import 建立的依赖图决定代码归属：客户端 import 的一切都被拉进浏览器 bundle 并降级渲染。children 是唯一保持"父在服务端渲染、子当纯数据壳"的通道。不遵守的后果：服务端组件静默变客户端、密钥模块被打包（虽然后者会被 server-only 拦下构建）、bundle 膨胀（呼应 next-boundaries 第一节）。

**2. children 穿透时，服务端组件的取数发生在哪一方？**
**来源**：CSDN《RSC Payload 的嵌套序列化》
发生在服务端父级渲染时：作为 children 的元素已被求值成 payload 片段，客户端壳水合时只是把现成结果插进树。所以壳的 loading 状态与内容件的 await 互不干扰——除非你故意用 Suspense 制造分级（L3 下一关主题）。

**3. props 传 JSX 和传函数（回调）在 RSC 里命运为何完全不同？**
**来源**：知乎《为什么 children 可以 onClick 不行》
JSX 元素在服务端已被渲染为序列化描述——传的是"结果"；函数无法序列化（闭包环境无从谈起），传的是"待执行代码"，只有 Server Action 这种"带服务端注册的引用"是合法特例（呼应 next-boundaries 第二节、L5 next-server-actions）。

---

## B. Context 与状态搬家

**4. RSC 时代 Context 的定位发生了什么变化？**
**来源**：InfoQ《Context 的退守与重生》；SegmentFault《provider 只活在岛内》
从"应用级总线"退为"客户端岛内总线"：交互态（主题开关、弹窗栈、表单焦点）仍在岛内用 Context；请求态（session/locale）改由服务端直取传 props；跨岛共享数据交给 URL/缓存层而非全局 provider（呼应 next-boundaries 第三节、react-context 的克制使用论）。

**5. context() API（实验性）想解决什么？你会现在采用吗？**
**来源**：知乎《React context() 与 AsyncLocalStorage》
让服务端组件也能读"请求作用域上下文"（如按 cookie 决定的 locale），底层是 AsyncLocalStorage。立场建议：观察——语义仍有边界（缓存交互复杂），用 cookies()+参数透传足够覆盖当前需求；展示"对新 API 保持距离感"在面试是成熟信号（呼应 next-revalidate 的缓存键话题）。

**6. 团队从 Redux 全家桶迁来 Next，store 里哪些东西该'搬家'？给清单。**
**来源**：掘金《Redux 在 RSC 项目的瘦身实录》
搬去服务端：所有服务端只读数据（列表/详情/字典——RSC await+缓存替代）；搬去 URL：筛选、分页、tab（可分享可回退）；留在客户端：表单草稿、播放器状态、模态栈、乐观更新队列。结论常是 store 缩到原来的 1/5（呼应 react-state-mgmt、next-link-router 第四节）。

---

## C. 三方生态

**7. 老版 react-window/chakra v2 不兼容 RSC，除了包出口还有什么长期解？**
**来源**：SegmentFault《不兼容库的三种寿命策略》
短期：客户端出口文件；中期：next/dynamic（客户端组件内）隔离重灾区；长期：推动库方发 RSC 兼容版（社区有成熟 PR 风向）、或换已适配库（chakra v3、TanStack 系）。评估维度写进依赖引入清单：适配状态、替代成本、维护活跃度（呼应 next-boundaries 第四节、react-architecture）。

**8. 为什么 next/dynamic 的 ssr:false 不能直接在服务端组件里用？**
**来源**：CSDN《ssr:false 的报错与替代路径》
'ssr: false' 需要客户端运行时控制挂载时机，服务端组件渲染阶段本就无浏览器——框架直接抛错。解法：把使用它的组件标成 'use client' 再 dynamic import。这暴露的本质：'use client' 不是污染标签，而是"声明这里需要浏览器"（呼应 next-perf、L7 error 边界）。

---

## D. 综合设计

**9. 画边界：拖拽看板（重度交互）+ 项目信息（SEO 页）同屏，怎么切？**
**来源**：知乎《Next 项目里页面级边界设计》
页面（Server，取项目元数据进 HTML 供爬虫）→ 信息展示区（Server 组件直渲）→ 看板区整块做客户端岛（dnd 库、本地乐观状态、岛内 Context 管拖拽）→ 看板初始数据由服务端 props 注入 → 变更走 Server Action+revalidate 回写。评分点：岛粒度=交互域而非组件树最底层（呼应 next-server-client 第四节、react-composition）。

**10. 'use client 越标越多导致 bundle 回涨，怎么建立防御机制？**
**来源**：InfoQ《RSC 边界的度量与守护》
① build 产物分析对比每路由客户端体积（@next/bundle-analyzer）；② CI 阈值卡口（如首屏路由客户端 JS ≤120KB 超限报警）；③ ESLint 的 react-server-components 规则+限制 'use client' 文件清单需审批；④ code review 问题模板："这块真的需要事件/state 吗？"（呼应 next-perf 度量五步、mp-performance 三查）。

**11. 服务端组件渲染结果能跨用户复用缓存吗？边界位置会影响缓存粒度吗？**
**来源**：掘金《Payload 缓存与边界形状》
能——静态段整页 payload 可缓存；一旦树中出现动态节点（cookies/headers），其**祖先链**都必须动态化。边界画得越深越窄，可缓存面越大；顶层塞一个用户昵称会让整棵静态树陪葬——所以"千人一面沉底、一人一面上浮"（呼应 next-revalidate 三层缓存、node-deploy-perf）。

**12. 你怎么向客户端-only 的团队两周内落地 RSC 边界规范？给培训+工具组合拳。**
**来源**：SegmentFault《团队引入 RSC 的落地计划》
Day1-2 心智课（本课四问决策流+反例演示：静默降级现场复现）；Day3 脚手架预置 server-only/client-only 出口约定与目录模板；Day4-5 结对改造一个真实页；此后 CI 体积卡口+ESLint 强制；沉淀《边界军规》wiki 且每次事故回写一条。关键：让错误在工具里死，而不是靠记性（呼应 ts-strict、exp-testing 的护栏哲学）。
