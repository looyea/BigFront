# next-server-actions 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点 Server Actions 高频面经，中文重述。

---

## A. 机制与安全

**1. Server Action 和'自动生成类型的 Route Handler'的本质区别？**
**来源**：知乎《Server Actions 是 RPC 还是表单后端》；SegmentFault（Action 端点形态）
机制上 Action 就是一个 Next 管理的 POST 端点（函数 ID 路由），区别在契约：返回值面向"重渲染/导航"而非 HTTP 响应、入参是 FormData/序列化克隆、CSRF 保护由框架 Next 版本内置。适合"本应用 UI 的变更"；对外 API（其他消费者）仍该 Route Handler（呼应 next-route-handlers 面试 5）。

**2. 'use server 函数里忘了鉴权，攻击者怎么利用？**
**来源**：CSDN《Server Actions 越权案例集》；HackerOne 相关公开披露（Next.js 应用类）
从页面 JS/网络面板拿到函数 ID，直接 POST 构造参数——等价于打一个无鉴权 API：改他人数据（缺资源归属校验）、刷库（无限流）。防御清单：每 Action 首行 session+owner 校验、zod 入参、限流在网关（呼应 next-server-actions 第五节模板、exp-auth 的 IDOR 话题）。

**3. Action 的 CSRF 问题历史上有过争议，现在怎么看？**
**来源**：InfoQ《Next.js CSRF 缓解机制演进》；知乎（Origin 校验补丁讨论）
Next 14.2+ 对 Action POST 增加 Origin 校验缓解，但结论不变：**框架补丁不是应用防线**——同源表单提交照样带 cookie 打你，业务级校验（幂等、归属）仍需自己做。答题姿态：知道机制演进+坚持应用层防御纵深（呼应 exp-security）。

---

## B. 状态与体验

**4. useActionState 替代了旧 useFormState 的什么？prev state 设计好在哪？**
**来源**：掘金《useActionState 的三个升级》
签名从 (action, initialState) 变为 reducer 式 (async(prev, formData)=>state, init)：Action 返回值即状态流，错误/成功无需异常通道；prev 让"第 N 次失败计数、上次的字段回填"成为一行代码（呼应 next-server-actions 第四节、react-usestate）。

**5. 提交成功后 revalidatePath 和 redirect 都会刷新数据，差别与选择？**
**来源**：SegmentFault《变更后导航的三种收口》
revalidatePath：留在本页、服务端重渲染合并（列表加完项原地更新）；redirect：跳走（新建后进详情页——PRG 模式，防刷新重提）。两者可同用。PRG 这个 20 年的表单老药在 Action 时代复活，这题在考古+新知双线（呼应 next-forms-mutations、es-promise 的“工程轮回”视角）。

**6. 表单里有文件 input，Action 怎么拿到？大文件注意什么？**
**来源**：CSDN《FormData 传文件实践》
`formData.get('file')` 得到 File（Web 标准），可直接 arrayBuffer/stream 处理或转存。注意：请求体上限（平台/反代）、内存占用（边收边写）、以及 Action 里 await 大文件会拖长该次导航的 pending——超大文件走 handler+直传签名（呼应 next-route-handlers 面试 8、exp-upload）。

---

## C. 架构思辨

**7. Server Actions 是不是让'前后端分离'名存实亡？**
**来源**：InfoQ《全栈融合下的分离之争》评论；知乎高赞讨论
物理分离（独立部署、独立团队）在大型组织仍是主流；Action 改变的是**小团队/产品早期**的成本结构——契约从"OpenAPI 文档+两套仓库"变成"同文件类型"。更准的说法：从"前后端分离"走向"前后端**分层**"：领域后端仍独立，BFF/UI 服务层融进视图框架（呼应 next-architect、react-architecture）。

**8. 用了 Actions 后，还需要 React Query/SWR 吗？**
**来源**：掘金《Action 时代的数据层重组》
读的一侧需要（客户端交互期数据、缓存/重试/乐观 UI 这些 Action 不管）；写的一侧 Action 接管表单类变更。乐观更新与 Action 的结合模式：useOptimistic（下关）保留"本地先行"，提交失败回滚。答题关键：分清"变更通道"与"读缓存系统"两件事（呼应 next-forms-mutations、react-data-fetching、L4 面试 11）。

**9. 有观点称 Action 是'回到 JSP/PostBack'，反驳的要点是什么？**
**来源**：知乎《Web Forms 既视感》；InfoQ（同类比较专栏）
形似神不似：类型端到端、组件级状态模型、无整页 postback（MPA 级刷新 vs Payload 级更新）、函数粒度而非页面粒度。诚实的补充：ASP.NET WebForms 的教训是**抽象泄漏**（把 HTTP 假装成桌面事件），Action 的纪律是文档明确告诉你"这是端点、要鉴权"——它不骗你（呼应 next-server-actions 第二节）。

---

## D. 综合设计

**10. 无 JS 环境（低配设备/极端网络）下，Action 表单的完整链路描述。**
**来源**：CSDN《渐进增强链路审计》
浏览器原生 POST（含 form 字段+$ACTION_ID）→ 服务端执行 Action → 成功 redirect（3xx）→ 浏览器 GET 新页（SSR HTML）；失败则重渲染当前页含错误文案的 HTML。全程无 hydration 依赖、React 状态为初值。加分：如何测试——DevTools 禁用 JS 走查 + curl 模拟提交（呼应 next-testing、lighthouse）。

**11. 设计：删除确认弹窗（拦截路由 modal）+ Action 删除 + 乐观列表，三个失败点（网络断/校验败/服务器 500）各自的 UI 终态？**
**来源**：SegmentFault《乐观更新的回滚剧本》
网络断：useOptimistic 本地已删、Action 未达 → 捕获后恢复行+提示重试；校验败：Action 返回 state.error → 弹窗内联展示，列表不动；服务器 500：error 边界/全局 toast，行恢复并保留撤销入口。考点：乐观层的**真相回滚线**设计（呼应 next-forms-mutations、mp-interaction 的反馈分级）。

**12. 你负责 code review 一个 Next 仓库的 Action 规范，列出会打回的五种写法。**
**来源**：知乎《团队 Action 军规》
① 无 auth()/归属校验的变更；② 顶层 'use server' 文件混放纯工具/查询函数；③ 吞错（catch 后 return null 无文案）；④ 在 Action 里跑长任务同步 await（应 after()/队列）；⑤ 返回值塞不可序列化对象（Date/Map/class 实例）。每条对应本课一、二、四、五节（呼应 next-boundaries、react-effect-patterns 的纪律文风）。
