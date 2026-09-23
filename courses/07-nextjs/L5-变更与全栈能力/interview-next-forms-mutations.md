# next-forms-mutations 面试题（15 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点表单与变更模式高频面经，中文重述。

---

## A. Hook 机制

**1. useActionState 与 useFormStatus 为什么要拆两个 hook？各自站在哪一侧？**
**来源**：掘金《Action 状态机的两半》
useActionState 在**发起侧**编排状态流（prev→action→新 state，含错误文案）；useFormStatus 在**表单内部**任何子组件读父 form 的执行态（提交按钮/字段禁用）。一个管数据流、一个管 UI 感知，组合覆盖旧代码 setLoading 的全部职责（呼应 next-forms-mutations 第一节）。

**2. useOptimistic 的 reducer 为什么必须纯函数？乐观项的 key 怎么设计？**
**来源**：SegmentFault《乐观更新的两个技术约束》
回滚=丢弃 optimistic 状态恢复真实 state，任何副作用都可能与真值冲突（乐观项里起了定时器/发了请求就无法撤销）。key：临时 id（crypto.randomUUID）与真 id 双轨或 React 19 的 useId 技巧，避免回滚时 key 抖动导致整行重挂载（呼应 react-lists-keys、mp-setdata 的 diff 成本）。

**3. 表单提交后组件树发生了什么？为什么 Action 期间页面不会闪 loading 整屏？**
**来源**：CSDN《Action 的 startTransition 底色》
Action 调用被包进 transition：服务端重渲染在后台完成，React 保持旧 UI 直到新 payload 就绪才切换（pending 仅局部）——这是"整页 spinner"消失的机制原因。对比小程序 setData 后同步阻塞的观感管理（呼应 next-context-streaming、mp-performance）。

---

## B. 生态协作

**4. React Hook Form 管 UI 状态、Action 管提交，边界怎么划？给一个反例。**
**来源**：知乎《RHF 与 Server Actions 分工》
RHF：字段注册、即时校验、字段级错误、动态增减行；Action：收到**校验过的 DTO**后做服务端事务。反例：把每个 keystroke 都防抖发去 Action 做"服务端校验独轮车"——交互层职责越位，请求风暴+体验粘滞（呼应 react-forms、exp-validation 两侧分工）。

**5. 上传组件（如 uploader 库拿到的 File 对象）如何进 Action？formNoValidate 之类细节？**
**来源**：掘金《文件上传接入 Action 的三条路》
① 传统 input type=file 随 FormData 直达；② 外置上传先传对象存储、Action 只收 URL/键（推荐大文件）；③ 混合：小图 FormData 直进 + 大图预签名。细节：客户端校验失败要拦提交（useTransition 里手动 throw 或先 return），别依赖 HTML5 validation 单一防线（呼应 next-route-handlers 面试 8、exp-upload）。

**6. after() 与 Server Action 里 fire-and-forget 裸 async（不 await）的区别？**
**来源**：InfoQ《after 语义与生命周期》
裸 async 在响应发出后可能随时被宿主冻结（尤其 serverless）；after() 显式挂到请求生命周期尾段，平台知道"这请求还没结"，并保证在终止前执行。原则：**不 await ≠ 免费并发，语义要声明**（呼应 next-server-actions 面试 12④、node-event-loop 的悬空 Promise 话题）。

---

## C. 一致性与失败剧本

**7. 变更成功但 revalidate 忘了调，用户看到旧数据的完整链路解释？**
**来源**：CSDN《缓存与失效的 36 计之"忘拔管"》
DB 新值 → Data Cache 仍持旧 fetch 结果（TTL 未到）→ Full Route Cache 仍有效 → 浏览器 Router Cache 可能再叠一层。三层都可能"旧"，且相互独立——这是军规③"写侧声明失效半径"存在的理由（呼应 next-fetch-cache 军规、next-revalidate 生命周期）。

**8. 并发编辑：两个标签页对同一资源分别 Action 更新，后写覆盖前写。三种缓解？**
**来源**：知乎《乐观锁在 BFF 层的回归》
① 版本字段+条件更新（updatedAt/version 不匹配则 409，Action 返回冲突文案）；② 字段级 patch 代替整对象覆盖；③ 编辑锁/协作化（重资源）。RSC 时代没消掉这问题——写冲突永远在数据层解决（呼应 exp-rest 的 ETag 段、mp-storage 的并发覆盖）。

**9. 移动端弱网点了提交，App 切后台、请求半途而废。你的乐观 UI 怎么兜？**
**来源**：SegmentFault《不可靠网络下的变更设计》
乐观项标"发送中"视觉态；回前台时查询服务端状态（幂等键 GET 一次）决定保留/重试/回滚；Action 侧幂等键让重试不双单。这题综合：useOptimistic 回滚边界 + 幂等 + 端侧网络心智（呼应 mp-network 竞态、next-server-actions 面试 11）。

---

## D. 综合与观点

**10. 'Action 让表单代码变少'之外，还有什么被系统性改变了？**
**来源**：掘金《变更通道收敛后的连锁反应》
错误通道（返回值即状态）、导航语义（redirect 即 PRG）、CSRF/鉴权面（端点清单化）、加载态设计（transition 局部 pending）、甚至 APM 指标（变更延迟与导航绑定）。谈"一个 API 形态变化如何重排 UI 状态机"是这题的满分路径（呼应 react-architecture）。

**11. 给没有 React 19/Action 的旧栈（React16 + Express）设计等价渐进增强，可能吗？做到几成？**
**来源**：知乎《Server Actions 迁移可行性分析》
可近似：无 JS 时原生 form POST 到 Express 端点 + 302 PRG + 服务端渲染 HTML（老 MVC 本行）；JS 就绪时拦截 fetch 同端点局部刷新——Next 把这些**标准化**了而已。差异在类型贯通与 payload 级更新。承认"魔法不新、整合才新"体现框架史观（呼应 next-overview 第二节、mp-openapi 端点回调对比）。

**12. 评审一句台词："我们把所有业务逻辑都放进 Action 函数，后端只管数据库。"你批不批？**
**来源**：InfoQ《BFF 胖化的滑坡》
分项目体量批：产品早期——可接受（消灭一层胶水是收益）；多端共享/领域复杂后——这是"影子后端"：事务跨团队不可见、权限模型散落、无法独立扩缩与复用。健康线：Action 做**用例编排**（鉴权+组装+失效），领域规则沉到 lib/服务层（同文件可 import 的"进程内后端"），需要共享时同一层独立成服务——演进路径提前画好（呼应 next-fullstack-project、next-architect、exp-server 职责论）。

---

## 补充（新专题 13-15）

**13.  乐观更新的"回滚与解释失败"怎么做才不伤用户信任？给一套完整设计。**
**来源**：React 官方 useOptimistic 文档；InfoQ《乐观 UI 的失败语义设计》
完整设计：① 状态分层——baseState（服务端真相）/ optimistic overlay（本次会话的乐观副本）/ error 队列（哪条失败、原因），别把三者揉进一个数组；② 呈现——乐观条目打"发送中"态（灰度/时钟图标），失败时条目不静默消失：保留 + 标红 + 原因 + "重试/撤销"动作（把回滚变成用户可理解的显式操作），这是信任关键；③ 并发——同键编辑冲突用"最后写入 + 版本号"或干脆禁用并发编辑（对乐观条目再操作要携带乐观版本，服务端 CAS 拒绝则走失败流）；④ 补偿粒度——单条失败只回滚该条（useOptimistic 默认整批回滚是短板，需要按条目拆 action 或自己维护 diff）；⑤ 通知——失败 toast + 条目内联双通道，只有内联会在用户滚过后被错过。反模式："失败静默 + 页面刷新后内容没了"。能讲出"回滚要显式、失败要有解释、补偿要最小粒度"三点即可。

**14.  searchParams、useFormStatus、useActionState、useOptimistic 四个"表单相关"hook 各自的适用边界？**
**来源**：Next.js 与 React 官方 useFormStatus / useActionState 文档；知乎《Next 表单状态四件套怎么选》
按状态归属切：① 值得分享/刷新不丢的结果态（筛选、分页、Tab、搜索词）→ searchParams（URL 是公共 API，服务端可读可预渲染）；② 提交过程的 pending（禁用按钮、骨架）→ useFormStatus（只能在 form 子孙的提交按钮上读，动作无关、粒度对）；③ 提交结果与表单数据（错误文案、成功后重置）→ useActionState（state 由 reducer 式 action 返回驱动，服务端错误进 state 天然渲染）；④ 提交生效前的本地视觉预测 → useOptimistic（只管 overlay 不管解释）。常见错配：用 useState 镜像 URL 态（刷新即丢）、把 pending 塞进 useActionState 的 state（多一次无谓渲染且按钮不在 form 内时拿不到）、用 searchParams 传敏感数据（进历史/日志）。加分句：这四件分别对应"结果/过程/结局/预言"四种时间态，问自己这个状态属于哪一刻即可选对。

**15.  复杂多步表单（分步、草稿保存、字段级服务端校验）在 Action 时代怎么搭架构？**
**来源**：掘金《Next.js 多步表单的草稿架构》；SegmentFault《字段级校验在 Server Action 下的实现》
骨架：① 表单引擎用 react-hook-form/zod（客户端即时反馈），schema 从服务端 lib 导出保持单一权威；② 字段/分组级校验：一个 validateField(id, value) 的 Action 复用同段 schema 的 safeParse——注意这是"查询式调用"，官方语义上 Action 应做 mutation，字段校验可接受但要限流、且不能承载权威（最终仍整表提交时服务端全量校验）；③ 草稿：小表单 localStorage + 提交时合并；长流程草稿存服务端（草稿表 + 用户/匿名 token），onDraftChange 防抖调 upsert Action——把草稿当 mutation 而非查询；④ 步骤状态进 searchParams（可分享"进行到第几步"）但步骤数据的权威在服务端草稿行，防跳步篡改；⑤ 提交 = 对草稿行的状态机迁移（CAS + 幂等），成功后 revalidate 相关页。避坑：别把整个多步表单塞一个巨型 Action——校验、草稿、提交三层职责混在一起，失败补偿无从做起。
