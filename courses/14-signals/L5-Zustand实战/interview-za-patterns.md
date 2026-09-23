# za-patterns 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 store 组织模式、transient 订阅、选型决策。

### 1. (A) 讲清 slices 模式的实现本质，并给出『slice 函数』可直接单测的原因。

**来源**：https://zustand.docs.pmnd.rs/immutable-patterns/slices-pattern

本质是对象展开拼接：`{...createSliceA(...args), ...createSliceB(...args)}`——create 收到的仍是一个大 config 函数，slices 只是文件组织约定。可单测因为 slice 无闭包依赖框架：`createCartSlice(fakeSet, fakeGet)` 直接调用，传入假 set 断言被调参数即可验证 action 逻辑；连 render 都不需要，比 hook 层测试低两个数量级成本。

### 2. (B) 两个 slice 互相 get() 对方的字段（cart 读 player 状态、player 又写 cart），怎么拆？给出依赖规则。

**来源**：转述自多 store 架构实践

规则：store 内 slice 只准『读下不限、写上收口』的单向纪律执行不了，直接升级为**独立 store+import 图定方向**：cartStore import playerStore（调 getState），反向禁止，lint 规则（import 白名单/eslint boundaries）兜底。跨 store 事件用订阅不用互调（playerStore.subscribe(s=>s.state, st => cartStore.getState().onPlayerState(st))）。答出『循环依赖的信号要换架构层级解决，不是换 API』即到位。

### 3. (A) transient 订阅直写 DOM 绕开了 React，那它绕开了 React 的什么、没绕开什么？

**来源**：转述自 transient subscriptions 文档与 za-patterns 第二节

绕开的是**渲染调度**（state→vDOM→reconcile→commit 整条链），数据源仍是 React 体系内的 store；没绕开的是**生命周期**——订阅注册在 useEffect、退订在 cleanup，组件卸载即停订，且写 DOM 的 ref 归 React 管。风险边界：transient 写的样式若被下次渲染覆盖（组件重渲时 width 回到 props/初始值）会闪跳——所以直写属性要么在渲染输出里也反映最终值，要么选不被覆盖的承载元素。这题考『绕开渲染层』的精确含义。

### 4. (C) 同一个进度条需求：Zustand transient / MobX reaction 直改 / signal effect 直改，三家写法共同的模式是什么？

**来源**：转述自 L2/L4 与本课横向（sig-perf 预热）

共同模式=**副作用通道与渲染通道分离**：状态照常存（store/observable/signal），但消费端不走组件重渲，注册一个订阅者把变化直接落到命令式目标（DOM API）。差异只在登记方式：Zustand 显式 subscribe+selector、MobX 渲染体内读即登记（reaction/effect 语义）、signal 生态 effect 自动追踪。总结句：『高频状态的终点应该是命令式写入，渲染只在两端（初值/终值）出场』——三家共认，L7 展开。

### 5. (D) 设计一个 50 项的看板页：顶栏用户信息、中部筛选器、下部任务列表（每项可勾选）。给出 store 拆分与订阅设计。

**来源**：转述自本课模式综合（sig-scenarios 预演）

拆分：userStore（登录态、persist）、filterStore（筛选条件，URL 同步候选）、tasks 服务端数据归 React Query、勾选态独立 small store（高频更新隔离）。订阅：顶栏订 user.name 原子；筛选器 useShallow 订 {keyword,status}；列表项各订 `s.selected.has(id)` 布尔——勾选一项只有该项 selector 产物翻转变量，其余 49 项零重渲。加分点：勾选若带动『已选计数』，计数放 store 内算好存（selector 派生禁令）。考的就是把三关知识落成一张布局图。

### 6. (B) 组件里 useStore(s => s.tasks.filter(t => !t.done).length) 显示未完成任务数，页面间歇性疯狂重渲，诊断与两种修法。

**来源**：转述自派生 selector 高频事故

诊断：selector 每次返回**新数字？不——number 按值比较**——真正的病根是它在每次任何更新时都执行 filter（O(n) 重算）且当任务增删导致计数恰好不变时也正常；若返回的是数组/对象则永判变。稳妥修法：① 计数算好存 store（完成任务 set 时同步维护 count 字段，selector 只取数字）；② 组件外 useMemo 依赖订 tasks 引用。本题陷阱在『看起来是数字应该没事』——让候选人分清『比较失败』与『计算过频』两类病，这个写法是后者：每次全 store 更新都白算一遍 O(n)。

### 7. (C) React Query（13 包）与 Zustand 共存的官方姿势是什么？重复存服务端数据进 Zustand 有哪三宗罪？

**来源**：转述两家文档的分工建议（rx-inapp 分工句回收）

姿势：Query 管服务端缓存（列表/详情/分页），Zustand 只管客户端状态（主题、抽屉、草稿、选中集），组件从 Query 读数据、向 Zustand 写 UI 态，互不复制。三宗罪：① 双事实源——刷新后 store 里是旧版数据，缓存里是新版，UI 精神分裂；② 失效链断裂——invalidate 不会通知你 copy 进 store 的那份；③ 归一化/去重/竞态全要自带——重造 Query 已解决的轮子。答『把服务端数据 copy 进全局 store 是新 Redux 时代的头号反模式』即到位。

### 8. (A) 为什么 Zustand 官方文档说『store 可以像普通对象一样在 React 之外创建和使用』？这个能力在什么场景成为刚需？举两个。

**来源**：https://zustand.docs.pmnd.rs/getting-started/non-react-usage

vanilla 层（createStore）与 React 绑定（useStore）分层实现：store 本体只依赖订阅协议，不 import React。刚需场景：① 路由守卫/拦截器里读写登录态（不在组件渲染上下文，hook 规则禁止调用）；② Web Worker 消息处理、SDK 内部状态总线（可能整包无 React）。延伸：@reduxjs/toolkit 的 store 同构、MobX 类天然如此——『框架无关状态源』是外部 store 复兴派的公共底线（L6 对比 MobX/signal 的实现路径）。

### 9. (B) 团队把全局状态都塞一个 useAppStore，半年后 devtools 面板卡死、每次 set 全页组件抖动。给重构路线图（非一次性重写）。

**来源**：转述自大型应用演进实践

路线：① 止血——devtools 按 store 拆分后挂 name，面板过滤高频 action；② 切 slice 文件（零行为变化，纯搬家+展开合并）；③ 按更新频率分层：高频域（拖拽/进度/输入联想）剥成独立 store+transient 消费；④ 跨域引用定 import 方向+lint；⑤ 派生收口（算好存/memo selector）。关键纪律：每步可单独上线、每步跑全量测试（slice 可单测让搬家有安全网）。考『重构是楼梯不是电梯』的工程感。

### 10. (D) 选型题：内部表单引擎（字段级联动、上千动态字段）用 Zustand 还是 Jotai？给出论证与反向题（什么情况翻盘选前者）。

**来源**：转述自两家选型讨论（sig-scenarios 预演）

主选 Jotai：字段=天然原子、联动=派生原子图——自下而上模型与需求的形状同构；Zustand 单 store 存 Map<field,value> 时 selector 粒度失控（订整个 map 全惊动、订单键要动态 selector 工厂+每字段一 hook 调用违反 hooks 规则）。翻盘条件：字段结构固定可枚举（编译期已知 20 个输入）→ Zustand 一字段一 selector 就够；或团队 Zustand 滚瓜烂熟、Jotai 学习成本成为风险——工具服从团队。答出『形状匹配优先、团队熟度一票否决』两层即满分。

### 11. (A) subscribeWithSelector 的三参 subscribe(sel, cb, {equalityFn}) 里，equalityFn 的调用时机和默认值是什么？与 useStore 的比较机制是同一条吗？

**来源**：转述自中间件源码（约 30 行）

同一条：每次 set 后执行 sel，产物与上次产物过 equalityFn（默认 Object.is），true（相等）则吞掉不调 cb——与 hook 订阅共用『selector+比较』引擎，一个喂 setState、一个喂回调。易错点：cb 拿到的已是 sel 产物不是全量 state；equalityFn 返回 true=相等=不通知，语义方向与 RxJS distinctUntilChanged 一致（『值→变化闸门家族』再点名，L6 sig-vs-streams 收拢）。

### 12. (B) transient 订阅写的 DOM 在父组件重渲后回到了旧值，两种修复思路与取舍。

**来源**：转述自 transient+渲染打架社区 issue 模式

① 让渲染端也反映真值：组件渲染时从 getState()（非 hook）读当下值写进 style——重渲输出与 transient 写入同源，代价是该组件仍会因别的原因重渲（但至少不闪旧值）；② 把 transient 目标挪出被重渲子树（portal/兄弟节点），渲染与直写物理隔离。取舍：①改动小适合低频重渲组件内的动效，②适合画布/悬浮层这类常驻直写区。根因一句话：**一个 DOM 属性两个主人（React 与命令式写）必打架**——与 13 包『受控/非受控混用』同族。

### 13. (C) Context 把 value 拆成 Provider 嵌套可以逼近 selector 粒度，为什么社区仍说『别拿 Context 硬撑』？

**来源**：转述自 react-context 关结论回收

三层成本：① 组合爆炸——N 个粒度需要 N 层 Provider 嵌套（或 context 分裂工具），样板随字段数线性涨；② 消费端仍是 hook 全量读，细粒度靠『再多订一个 context』，字段增删=改 Provider 树=动结构；③ 依旧困在组件树——getState/subscribe 旁路（Worker、守卫、transient）无解。结论：Context 的正确岗位是**依赖注入通道**（给 zustand/traditional 的多实例 store 递引用），不是订阅粒度模拟器。

### 14. (D) 用 200 行的量级设计『一个 store 管全站主题』的系统：给出 persist、Context 兜底、transient（主题切换动画帧）三者的配合图。

**来源**：转述自本课综合（za-middleware/za-patterns 合体题）

themeStore=devtools(persist(immer(...)))，partialize 只存 {mode, accent}；SSR/首帧防闪：入口前同步读 localStorage 注初始 class（或 skipHydration+手动 rehydrate 时机）；切换动画（View Transitions/进度）走 transient subscribe 直写样式属性，不进渲染流；Context 只做一件事——把 store 实例注入组件树（zustand/traditional 版 createContext）服务多租户页面。考分层直觉：**存储归中间件、动画归订阅、注入归 Context**，各在边界内，没有一锅端。

### 15. (C) 有人主张『Zustand 的 selector 就是 MobX 的 computed 的显式版』，你同意几成？给出机制层反驳点。

**来源**：转述自两家机制对照（sig-mutability/sig-scenarios 预热）

半成：订阅面定义上同构（都是『从 state 到组件可见值』的映射+比较）。反驳点三处：① computed 是**惰性+缓存**的计算节点（无人读不重算，依赖图自动传播），selector 是**每次 set 都执行的谓词**（不惰性、无图，缓存靠你手写 memo）；② computed 产物可变式追踪（下游 computed 嵌套自动接线），selector 嵌套全靠人肉；③ 触发端不同：MobX 变更→字段通知→自顶向下标脏，Zustand 变更→广播→各 selector 自比较。公允版：selector 是『订阅过滤器』不是『计算图节点』——把这层差异说清，L6 开庭时你已经有立场。
