# mobx-stores 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖多 store 组织、边界协议与建模哲学。

### 1. (A) MobX 的『对象图建模』与 Redux 的『规范化扁平 store』各解决什么问题？

**来源**：转述自 https://mobx.js.org/ 与 Redux 范式化文档

Redux 规范化解决的是不可变更新下的共享引用与查询一致性：实体存 byId Map、关系存 id，更新一处全局可见——代价是 join 全手工、样板多。MobX 对象图解决的是关系密集领域的表达力：实体即对象、行为即方法、关系即引用，Proxy 追踪替你保证一致性——代价是序列化/回放要边界协议补。两者分别是数据库思维与领域模型思维，题目本质问的是『你的业务更像哪边』。

### 2. (D) 设计一个在线商城的 MobX store 树：用户、购物车、商品目录、订单。

**来源**：转述自本课练习

RootStore 组装 { userStore, cartStore, catalogStore, orderStore }；Cart=observable 数组装 CartItem 实体（每个持有 product 引用——对象图红利：item.product.price 直读）；总价=computed（reduce 读 item.price 与 count，天然字段级依赖）；下单 action 从 cart 生成 Order 快照并存 orderStore 列表。考点：实体引用不要 id join（图内直接引用）、派生全 computed、跨 store 写只有下单这一处要重点 review。

### 3. (B) 购物车总价组件意外地『改任意商品描述都重算』，用读取面分析定位问题。

**来源**：转述自本课粒度纪律

总价 computed 里读了 item.product（整个对象）再取 .price，或直接展开对象——追踪落在 product 代理的每个被碰到的字段上，但 observer 渲染若还读了 name/desc 就全订了。修法：总价 computed 只读 price/quantity 两字段；展示组件与计价 computed 分离，各读各的。MobX 的『哪都变哪都算』排查永远从『谁读了不该读的字段』开始——读取面=订阅面。

### 4. (A) onPatch 的 patch 结构长什么样？它能直接当撤销栈用吗？

**来源**：https://mobx.js.org/actions-and-reactions.html 与 spy 事件文档

JSON Patch 家族：{ op:'add'|'remove'|'replace', path:'/todos/2/done', value:true }。做撤销需『逆 patch』：replace 的逆是旧值回填（patch 事件自带 oldValue 可取）、add 的逆是 remove、remove 的逆是 add——按栈序反向应用逆 patch 即成 undo。注意：撤销栈要的是『用户动作粒度』，一次 action 可能产生几十个 patch——正确姿势是按 action 边界（spy 的 action 事件）分组再入栈，不是逐 patch 入栈。

### 5. (B) 同事把 observable 对象直接 JSON.stringify 后 postMessage 给 Worker，对端报数据巨大且行为诡异，两个问题各在哪？

**来源**：转述自 toJS 边界纪律

① observable 直接 stringify 会带上 Proxy 包装的隐藏结构与派生字段——先 toJS 出境再序列化（官方明确：observable 漏过边界=带病传输）；② 『诡异行为』来自只传了数据没传行为：Worker 端收到的纯 JSON 需要注水（类构造器重建），否则实体方法全无。边界协议一句话：出境 toJS、入境 fromJS，代理不过界。

### 6. (C) mobx-state-tree（MST）解决了核心 MobX 的哪些痛点？为什么本课默认不推它？

**来源**：https://mobx-state-tree.js.org/

MST 在 observable 之上加了类型系统、快照/patch 一体化、内置 undo/时间旅行、action 中间件——协作与回放类刚需场景的省心方案。不默认推的理由：包体与心智成本上一个台阶、类型学习与核心 MobX 社区势能错配（MobX 核心自身在往 signal interop 走）、中小项目边界协议+约定已够用。选型句：MST 是『把运维成本一次买断』的选项，评估看回放/协作需求强度，别看功能清单。

### 7. (D) 路由级临时 store（页面离开即销毁）与全局 store 怎么分层管理生命周期？

**来源**：转述自本课组织纪律

全局层（RootStore 挂应用根 Provider）只放跨页存活：登录态、主题、服务端缓存桥；路由级 store 在路由组件 mount 时 new、unmount 时 stop() disposer 数组并置空引用——可用 useLocalStore（React 生命周期内私有 observable）或路由守卫手动管。反模式：路由 store 挂到全局 root 上『以后好复用』——复用没等到，内存和脏数据先到。考点：每份状态都要能回答『我生于何时、死于谁手』。

### 8. (C) Zustand 的 selector 比较语义与 MobX 的字段追踪，对『更新写法』分别有什么硬约束？

**来源**：转述自 https://zustand.docs.pmnd.rs/ 与本课

Zustand：变化判定=selector 产物与上次比较（默认 Object.is）——逼你『替换式更新+派生值 memo/useShallow』，就地 mutate 等于没改（且 React 并发下可变值有撕裂风险，呼应 mobx-react 并发题）。MobX：字段读写即事实，必须就地改（产生新快照反而丢追踪）——逼你守 action 纪律与读取面克制。两套硬约束背后是『不可变快照比较』vs『可变字段订阅』的机制根源——L6 sig-mutability 的主菜。

### 9. (B) 项目里出现『一个 patch 丢失导致协作端状态永久漂移』，围绕 onPatch 设计三道防线。

**来源**：转述自协作同步工程实践

① 序号+ack：patch 流打标号，收端按序应用、缺号请求重发；② 周期对账：定时互发 toJS 校验和（或结构 hash），不一致即以快照重置（慢路径保底）；③ 应用层幂等设计：patch 尽量用 set-to-value 语义（replace/add）避免累加式操作——丢一条尚可收敛。结论句：patch 是增量账，任何增量方案都必须配快照对账，没有例外。

### 10. (A) store 树怎么做到可测试？给出 mock 策略与断言风格。

**来源**：转述自 MobX 测试最佳实践（https://mobx.js.org/testing.html）

组装点唯一带来的红利：测试注入 fake root——`new CartStore({ catalogStore: fakeCatalog, userStore: fakeUser })`，依赖全可换。断言风格：行为测试直接调 action 后读 observable（同步即断，无需等渲染）；派生测试读 computed 即证惰性正确；副作用测试 reaction 返回 disposer 手动触发断次数。MobX 的单测体验常优于 Redux（无中间件管道、无异步 thunk 测试脚手架）。

### 11. (C) 比较 MobX 与 Vue 在『多 store/模块化组织』上的官方方案差异。

**来源**：转述自 Pinia 文档（https://pinia.vuejs.org/）与 MobX 社区模式

MobX 无官方 store 容器——RootStore 类组装+context 注入是社区约定，自由但也要求各团队自订纪律；Pinia 提供 defineStore 官方化每模块（组合式函数形态）、按需 use 即取即订、devtools 集成。哲学：MobX 信 OOP 组装、Pinia 信函数模块化——但两者都『多 store 平权』（对比 Redux 单一 store 传统）——L5 za-core 会看 Zustand 的第三种答案。

### 12. (D) 设计『编辑器自动保存+版本历史』：MobX 文档对象图，要求可回滚到任意版本点。

**来源**：转述自综合场景题

文档=observable 对象图（实体即内容节点）；onPatch 流按事务聚合为版本组（一次粘贴=一个版本组，组边界用 action 边界）；落盘策略=初始全量快照+每版本组的 patch 增量（空间换历史）；回滚=正向重放至目标版本组（冷路径）或反向 apply 逆 patch（热路径），回滚本身也是 action（生成新历史分叉或截断，产品选语义）；自动保存=debounced reaction 读 dirty computed 落盘。考点：patch 聚合粒度、正反重放两条路径、保存副作用的退订。

### 13. (B) 老 MobX 项目升 React 18 后出现并发过渡中的『数据比新 UI 旧』，简述根因与两种缓解。

**来源**：转述自 React 并发与外部可变源的撕裂问题

根因：useTransition 的低优先级渲染可能跑几十毫秒，期间 MobX 字段已被新 action 就地推进——可变源没有版本快照，慢渲染读到的是『渲染中途的现在』。缓解：① 过渡涉及的数据先 useSnapshot/复制成不可变局部值再渲染（用复制换一致性）；② 该数据路径退出并发特性（降级为同步渲染）。深层结论：可变全局源与并发渲染是天敌，不可变快照天然免疫——L6 sig-mutability 的实战证据。

### 14. (C) 『状态该放组件 state、store 还是服务端缓存层』——用本课视角给 MobX 项目的三问判据。

**来源**：转述自 L1 状态分层与本课落地

一问『有谁在别的组件同时读吗』——无则 useState（折叠开合、焦点）；二问『它是领域事实还是接口副产物』——领域事实（购物车总价）进 MobX computed，接口副产物（列表原始响应）进服务端缓存层（React Query，MobX 只做薄桥）；三问『销毁时机谁定』——页面级用 useLocalStore，业务域活过路由才进 RootStore。三问背后是同一句话：store 是数据的家，不是数据的收容所。

### 15. (D) 面试官让你对比 MobX 对象图路线与 signal 系显式容器路线的『团队长期成本』，怎么答？

**来源**：转述自本课与 L6 选型预热

MobX 成本模型：上手快（写普通对象+observer）→ 中期靠纪律（读取面克制、action 边界、disposer 收纳）→ 新人要学『隐式追踪的禁忌清单』（解构、外读、深拷贝）。signal 成本模型：上手慢一点（处处 .get/.set 容器）→ 依赖关系肉眼可读（显式引用即文档）→ 新人半天会 API、没有魔法要背。一句话：MobX 把复杂度藏在约定里，signal 把复杂度摆在语法里——选哪种=选你们团队愿意为哪种纪律买单。
