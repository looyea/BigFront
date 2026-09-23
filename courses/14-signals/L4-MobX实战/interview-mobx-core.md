# mobx-core 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 MobX 四件套与自动追踪心智。

### 1. (A) 用一句话讲清 MobX 的工作模型，再展开三步循环。

**来源**：https://mobx.js.org/the-gist-of-mobx.html

一句话：让普通可变对象变得可观察，读取自动建依赖，写入精准唤醒订阅者。三步循环：① observable（Proxy/defineProperty 包装字段）成为依赖图的源；② 追踪上下文（computed/reaction/observer 渲染）执行时登记读到的字段；③ action 修改字段→沿依赖图把下游标脏→结算通知脏的 reaction 重跑。它把『谁依赖谁』完全交给运行期读取行为决定。

### 2. (A) MobX 6 为什么默认 makeAutoObservable 而不是装饰器？

**来源**：https://mobx.js.org/annotations.html

装饰器（@observable）长期停留在 Stage 2 且有两套语法版本，绑死 Babel/TS 编译链；MobX 6 转向无编译依赖的 makeAutoObservable/makeObservable 函数式标注——装包即用、JS 原生可写、未来装饰器定型也不冲突。这个迁移本身就是一门『别把库押在提案语法上』的工程课（呼应 tc39-core 对提案语法的谨慎）。

### 3. (A) action 的『批量事务』语义解决什么问题？与 signal 系的批处理差异在哪？

**来源**：https://mobx.js.org/actions.html

一次 action 内的多次写入不逐条发通知，结束统一结算——消除中间态暴露与重复唤醒（glitch-free 的 MobX 实现），也给严格模式一个可审计的改动单元。与 signal 派差异：signal 以微任务/调度器划批，MobX 以显式 action 边界划批——前者自动、后者由『你声明的事务』决定，await 切断事务正是这条边界的代价（runInAction 补票的由来）。

### 4. (B) 同事把接口数据在 then 回调里直接赋值给 observable 字段，控制台告警，三步讲清原因与两个修法。

**来源**：https://mobx.js.org/actions.html（asynchronous-actions）

原因：action 是同步事务，then/await 之后的代码已掉出事务边界，严格模式（enforceActions observed/always）判定为违规裸写。修法一：回调里包 runInAction(() => this.user = res)；修法二：用 flow 生成器写法（function* + yield），flow 帮你把每个 await 段重新包成 action。要点：告警不是报错——值改成功了，丢的是事务批处理的保障。

### 5. (B) computed getter 里读了一个数组又 map 出对象数组，为什么每次渲染新数组引用不触发无限重渲？MobX 靠什么拦住它？

**来源**：https://mobx.js.org/computed-values.html

computed 的缓存语义：依赖未脏直接返回**同一个缓存值**（含引用），下游拿到的是稳定引用。若确实要比较新产物（如自定义对象），computed 默认用 Object.is 判『值变化』再决定是否通知下游——与 signal 的 equals 闸门同族。坑位提醒：computed 里主动 new 出依赖外的对象、或在 reaction 里读非 computed 的临时数组，仍可能风暴——缓存红利只属于声明正确的 computed。

### 6. (C) MobX 的 observable 数组和 signal 派『signal(数组)+整值替换』相比，追踪粒度差在哪？

**来源**：转述自 MobX 集合文档与 L1 粒度论

MobX：数组本身是 observable 集合，读 length、读 3 号位、迭代分别建立不同订阅——push 一项只唤醒碰过 length/迭代 的观察者（结构级粒度）。signal 派：数组是容器里的一个值，push（原地改）默认无感知，必须 arr.set([...arr, x]) 整值替换——订阅粒度=容器粒度，细了要靠原子拆分或 immer 式结构。一句话：MobX 帮你把『集合内部』的依赖图切开了，signal 把这刀留给使用者。

### 7. (C) autorun、reaction、when、observe——副作用家族的分工表背一下。

**来源**：https://mobx.js.org/reactive-api.html

autorun：回调内读取全建依赖，立即+变化重跑（简单、易过度订阅）；reaction：数据函数（唯一建依赖处）+效果函数分离，盯 A 做 B（精确依赖面）；when：数据函数返回布尔，首次 true 跑效果并自动 dispose（一次性放闸）；observe：观察单个字段/集合项的变化账（最窄，审计与联动用）。记忆：全家按『依赖面从宽到窄』排 autorun→reaction→observe。

### 8. (D) 给一个表单引擎设计 MobX 状态图：字段值、校验规则、联动（A 选是→B 必填）、脏标记。

**来源**：转述自本课练习

FormField 类（value/visible/required/errored 皆 observable，validate 为 action）；FormStore 聚合 fields Map，errors=computed（收集各字段 errored）、isDirty=computed(对比 toJS 快照与初始值)；联动用 reaction(() => a.value, v => b.setRequired(v==='yes'))（数据函数钉死在 a，避免 b 变化反噬成环）；提交 action 里 await 校验→runInAction 收尾。评分点：联动是否用 reaction 的依赖分离防成环、派生是否全 computed 不存字段。

### 9. (A) MobX 如何做到『没人读的 computed 不重算』？它的惰性边界在哪？

**来源**：转述自 MobX 惰性求值机制（https://mobx.js.org/whats-observable.html）

computed 维护脏标记：上游变化只把自己标 dirty；被读取时若 dirty 才重执行并缓存新值，否则直返缓存——与 signal 系同款惰性。边界：一旦有 autorun/observer 订阅了该 computed，订阅者会在依赖变化时被调度器安排读取，此时惰性表现为『跟着订阅者节奏重算』——生产上所谓『computed 不重算』排查，第一步永远是确认谁还在读它。

### 10. (B) 升级 MobX 5→6 后，项目里所有 @observable 装饰器类全部变成普通对象不响应了，最可能的两个原因？

**来源**：https://mobx.js.org/migrating-from-4-or-5-to-6.html

① MobX 6 弃用旧装饰器且默认不启用 makeObservable 自动调用——类没在 constructor 里补 makeObservable/makeAutoObservable，字段不再是 observable；② TS 5 原生装饰器与旧 legacy 装饰器语义分叉，编译配置 useDefineForClassFields 让类字段定义覆盖（define 而非 assign）破坏标注时机。迁移手册的标准动作：全局补 makeAutoObservable + 核对 tsconfig 两开关。

### 11. (C) Vue 3 的 reactive 与 MobX 都基于 Proxy，两者最显眼的语义差别是什么？

**来源**：转述自 https://vuejs.org/guide/essentials/reactivity-fundamentals 与 MobX 文档

解构：Vue 的 reactive 对象解构即丢追踪（要把整个对象留作代理），toRefs 是官方补丁；MobX 的 observable 数组/对象属性访问即追踪，`const {a} = store` 同样是丢追踪的坑但社区更习惯 store 实例方法化。另一处：Vue 深响应是默认（整个对象图自动 observable），MobX 也默认深包裹但可显式 observable.ref/shallow 控粒度。共同哲学：Proxy 自动追踪的『隐式魔法』都靠约定与 lint 兜住误用面。

### 12. (D) 评审这段 store 写法：把接口数据存进 MobX、同时用 useState 镜像一份、又往 localStorage 手写一份同步。给出 MobX 原生的收敛方案。

**来源**：转述自本课与 mobx-stores 预热

一份真相+派生记账：接口数据直接存 observable（setUser action），UI 读 computed 派生，不再 useState 镜像（镜像即双账，永远会漂）；localStorage 用 toJS+autorun/reaction 写、启动时 fromJS 注水——持久化是反应不是平行真相源。方案关键词：observable 单源、computed 派生、action 改、reaction 落盘——四件套各就各位，三处同步塌缩成一条链。

### 13. (A) MobX 的 untracked(fn) 与 signal 的 untrack 语义相同吗？它治的是什么病？

**来源**：https://mobx.js.org/reactive-api.html#untracked

同款语义：执行 fn 期间读取不建依赖。治的病也同款：追踪作用域里『顺便读』导致的过度订阅（日志、埋点、取快照）。MobX 场景示例：observer 组件渲染时想读 store 里一个巨大数组的 length 打调试日志但不想因此订阅它——untracked 包住这次读取。两派补丁一一镜像，正是『共享同一部宪法』的证物。

### 14. (C) 『MobX 是可变路线』意味着它放弃了 Redux 的哪些能力？又换来了什么？

**来源**：转述自 https://mobx.js.org/overview.html 与 L6 对比预热

放弃：action 流水可序列化重放（时间旅行需 patch/onSnapshot 补丁）、纯函数 reducer 的机械可测性、状态更新即新引用带来的浅比较红利。换来：就地改的样板归零（无 reducer/无展开运算符/无 action type 表）、结构级依赖粒度、对象图建模（store 里有方法、有引用关系，像正常 OOP）。天下没有免费的响应式——两条路线在 L6 sig-mutability 正面决战。

### 15. (D) 面试官问『MobX 在 2026 年还值得学吗』，用本课视角给一个两分钟回答。

**来源**：转述自 L1 钟摆规律与 sig-roadmap 预热

示范骨架：值得，且理由不是情怀——① 存量：MobX 是中大型 React 老资产的事实标准之一，维护能力就是饭碗；② 语义：MobX 与 signal 派共享响应式宪法，学透 MobX 的追踪/惰性/批处理，再看任何 signal 实现都是平移；③ 趋势：官方 @reactively/mobx 正在把 MobX 接进 TC39 互操作生态，老派与新宪法在握手而不是对撞；④ 边界：新项目选型按数据形态定（对象图就地改→MobX 仍顺），不按新旧定。答题落点：技术判断看语义与资产，不看新闻稿。
