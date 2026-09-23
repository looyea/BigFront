# next-server-actions 面试题（15 题）

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

---

## 补充（新专题 13-15）

**13.  Server Action 的"安全模型"与 REST 相比多了什么、少了什么？团队要补哪些防线？**
**来源**：Next.js 官方 Server Actions 安全注意；InfoQ《Server Actions 的攻击面》
多出来的：① 隐式公共端点——每个导出的 Action 都是可被直接 POST 的入口，攻击者绕过一切 UI，"按钮没显示"不等于"能力不存在"；② 闭包/参数序列化面——bind 的服务端值会加密进客户端页面（敏感闭包变量有泄露风险），入参全部不可信且类型系统给不了运行时保证；③ DoS 面——Action id 可被重放轰炸。少掉的：URL 路由表不再显式可审（安全评审看不到"接口清单"）、没有 REST 那套现成网关/限流/缓存语义、middleware matcher 默认不匹配 POST 页面路径（Action 请求走 /_serverActions 一类内部路径，传统按路径的防护规则打空）。要补的防线：每个 Action 第一行 runGate（session+RBAC）像审接口一样清单化审查；zod 校验入参；速率限制（中间件按 IP+用户 或平台 WAF）；敏感闭包值改存服务端会话；CR 检查"Action 是否幂等"。

**14.  Action vs Route Handler 的选型？什么信号提示"该拆独立 API"了？**
**来源**：SegmentFault《Server Action 还是 API Route》；知乎《Next 全栈的边界在哪里》
Action 胜出：变更与"当前页面上下文"强耦合（提交后 revalidate 路径/乐观更新天然衔接）、表单原生渐进增强、不想维护序列化协议。Route Handler 胜出：响应要给非 React 消费者（移动端/第三方/webhook 回调）、需要标准 HTTP 语义（状态码/内容协商/缓存头/ETag）、GET 查询（Action 官方定位就是 mutation、GET 语义走 handler 或 RSC 本身）、文件流/大体积自定义响应。"拆独立服务"信号：① 鉴权模型与页面会话不同构（API key/OAuth 给外部）；② 出现非请求驱动的活（队列消费、定时任务、长连接）；③ 接口开始被第二个应用复用、需要版本化契约；④ 性能画像与页面不同（重计算/批处理要独立扩容）。误区是把 Action 当"免费 RPC"塞满查询与跨页编排——Action 的边界是"由 UI 发起的、影响少数页面的变更 + 就近重验证"，超出这个语义就该换形态。

**15.  无 JS 也能用的表单是 Action 的卖点——做一次完整的渐进增强核查，你会测哪些点？**
**来源**：Next.js 官方 Progressive Enhancement 指南；掘金《我按无 JS 标准审了一遍 Server Actions 表单》
核查单：① 基础层（关 JS）：提交真的成功——常见破裂点是"校验反馈靠 React 状态渲染"（原生 POST 后要用 searchParams/useActionState 的回传值渲染）、依赖 window 事件的副作用丢失、乐观更新后没等服务端结果就关弹窗；② 状态层：pending 态在 JS 开启时用 useFormStatus、关闭时退化为"提交后整页跳转前无反馈"——要接受并在文案上兜住；③ 文件与边界：无 JS 下文件上传仍走 multipart 应正常，但客户端预检（体积/类型）必须在服务端重做；④ 幂等与后退：刷新/回退重复提交的表现（浏览器会弹重新提交确认）在关键写操作要用幂等键兜住；⑤ 嵌套交互：dialog/dropdown 若用 <dialog> 原生可无 JS，若靠库则无 JS 全灭——核心路径（增删改查）不允许依赖装饰性交互。判定哲学："JS 决定体验，不决定能力"；能背出这条的候选人说明把渐进增强从口号过成了 checklist。
