# sig-perf 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖四大性能坑的机理、排查手法与防复发工程。

### 1. (A) 『过度订阅』与『漏订』这对孪生病的共同病根是什么？各给一个跨库同构的案例。

**来源**：转述自本关总纲

共同病根=**订阅面与需求面失配**：一个声明『我要什么』的通道（selector/读追踪/subscribe），实际覆盖面大于或小于真实需要。过度订阅同构组：Zustand 多字段 selector 无 useShallow / MobX 渲染体 JSON.stringify(toJS(store)) / Solid 模板里现造新对象——全是『比较面/依赖面永变』的变形；漏订同构组：MobX 解构后读 / React deps 漏字段 / RxJS 管道读快照不订流——全是『读了但没走订阅通道』。分类不是记案例而是认病根，新框架旧案例换皮即中。

### 2. (B) 『一次更新，全页 300 个组件重渲』——给三步定位链与对应的三种修法档位。

**来源**：转述自本关 §五流程的展开应用

三步：① Profiler 记录 commit 内组件数 vs 本次业务变更字段数——比例失衡实锤过度订阅；② 抽一个重渲组件打 `console.count('sel')` 分辨『订阅面宽』还是『比较失败』（selector 被跑的时机与频率会告诉你）；③ grep 该组件的 selector/读取面，对照它真正渲染用到的字段。修法档位：窄化 selector（原子化）→ 加闸门（useShallow/memo/equals）→ 拆 store/组件（频率分层，za-patterns）。顺序不可倒：先修订阅面再动架构。

### 3. (B) MobX 的 autorun 在 useEffect 里注册、cleanup 忘了返回 disposer，半年后一个老用户的页面 OOM。讲清泄漏链与本关两个修法。

**来源**：转述自 mobx-react disposer 纪律与 rx-inapp 清单

链：每次组件挂载新建 reaction（autorun 返回值=disposer），不接住=没人能退订；reaction 持有渲染闭包（含 props/DOM ref）→ 依赖的 observable 数组只增 → 内存锯齿+反应风暴（老值每次变更全量跑）。修法：① 纪律层——effect 第一行 `const d = autorun(...)`、cleanup `return d`，lint 规则匹配『autorun 裸调用』；② 架构层——store 级副作用集中到 RootStore 生命周期统一 start/stop（mobx-react 面试第 13 题的处置终态）。判断句回收：**建立订阅那行往上看三行，有配对退订吗？**

### 4. (A) 坑4 两副面孔（true/false 与 false/true 的 `prev===next, deepEq` 组合）为什么修法方向相反？给统一心法。

**来源**：转述自本关 §四分型

A 面（内容变引用没变）：比较器瞎了——修法是**让引用跟上内容**（新引用纪律/immer 接管）；B 面（引用变内容没变）：比较器过敏了——修法是**让订阅面躲开必然变化的层**（原子化/useShallow 下移到不变叶层）。一个要『造引用』一个要『避引用』，方向恰好相反——不分型就开药是坑4 的二度受伤姿势。统一心法：**内容到引用的映射链要人工设计到底**，哪一段交给 Object.is、哪一段交给 deepEq、哪一段交给人眼（diff 日志），选型时画一遍这张映射表。

### 5. (D) 给『10 万行日志查看器』做性能设计：虚拟列表之外，状态层三刀各砍在哪？

**来源**：转述自本关与 za-patterns 高频通道的合体题

① 入口降频：WebSocket 消息在编排层攒帧（rAF/100ms 批量），一次批量 append 而非每消息一 set；② 存储形态：append-only 数组+渲染窗口切片（不重排不排序除非需求），行内高亮等派生放渲染层 memo；③ 订阅面：虚拟窗口组件只订 `[start,end]` 切片（原子化+useShallow），搜索框状态独立 store 隔离（高频输入不惊动列表）。加分项：引用 `prev===next` 分型日志预埋——10 万行项目里 B 面（白渲）每帧都是肉眼可见的掉帧。

### 6. (C) React 靠 Profiler commit 计数、Solid 靠什么等价物、MobX 靠 spy——三种『渲染次数取证』背后的框架模型差是什么？

**来源**：转述自三家调试链横切（sig-debug 联动）

React：渲染单位=组件，commit 即『组件函数又跑了』，计数天然；Solid：组件函数**只跑一次**，取证单位要下移到 expression/DOM 写操作——看 devtools signals 图或 DOM 层 MutationObserver 数 text 节点变更；MobX：组件重渲与字段反应两层都可计数（spy 分 action/reaction 事件），取证反而最细但要自己拼。模型差决定工具差：**『渲染次数』在不同范式里根本不是同一个量纲**——面试把这层说破即证明跨框架排查能力。

### 7. (B) 一行 `useEffect(() => { const sub = store.subscribe(cb) }, [])` 被 code review 打回，理由『缺的不只是退订』。指出还缺哪两件。

**来源**：转述自本关 §三修法与 React 18 StrictMode 实践

① 缺 StrictMode 双挂载检验：dev 下 effect 跑两遍，subscribe→unsubscribe→subscribe 的幂等性没验证（真实项目里双订阅事故多藏于此）；② 缺 cb 的引用治理：`cb` 来自渲染闭包，effect deps 空数组=cb 永远是第一版的闭包（stale）——要么 cb 进 store action（getState 现取），要么 deps 补齐并用 useRef 防重订。退订只是三缺之一——review 意见值得背下来：**cleanup 完备 ≠ 订阅正确**。

### 8. (A) 『给病灶补回归断言』在四类坑上各长什么样？各给一行伪代码。

**来源**：转述自本关 §五流程图右下

过度订阅：`expect(renderCount).toBe(1)` 包一次无关字段更新（Profiler API 或自增计数）；漏订：改字段→`await waitFor(() => expect(screen.getByTestId('x').textContent).toBe('新值'))`（渲染断言=订阅存在性证明）；泄漏：mount→unmount 后 `expect(store.getReactionCount()).toBe(0)` 或堆快照差集 CI 化（Node 环境可用 global.gc 计数）；引用失效：marble/纯函数用例 `expect(shallowEq(prev,next)).toBe(true)` 钉住『内容没变引用也不该变』的边界。四种断言一个思想：**性能契约可执行化**——本关流程与 sig-debug q7 分层防线在此合流。

### 9. (C) 为什么 Vue/Solid 项目少见坑1 型风暴而 React 项目遍地？这个差异的代价转移到了哪里？

**来源**：转述自三家订阅模型对照（react-render-model 呼应）

Vue render effect 自动追踪模板读到的响应式数据、Solid 细粒度表达式订阅——『订阅面=实际读取面』由机制保证，人没有把比较面写宽的机会；React 的『全组件函数重跑』模型把收窄权交给人（selector/deps/memo）——坑1 是人权模型的税。代价转移：Vue/Solid 把税付在**依赖簿的运行时开销**（proxy/图维护）与**隐式依赖的新坑**（Vue 解构丢响应、Solid 解构丢响应性——恰好是坑2 的换皮）。没有免税范式，只有免税位置不同。

### 10. (D) 面试官现场给一段『页面初始化 47 次重渲』的代码（无网络无流），按本关流程走一遍并给三刀修法。

**来源**：转述自现场题模板（初始化风暴=竞态 set 群）

流程：commit 47 次但与用户操作脱钩 → 怀疑初始化期多个独立 set；定位：render 计数日志+console.trace 看每轮 set 来源——典型病灶：路由参数→store、useEffect 拉数据→store、persist rehydrate→store、主题应用→store 各自 set。三刀：① 初始化收拢（一个 `bootstrap()` 一次 set 全量就位，函数式队列合并）；② 派生别回写（能 computed/memo 推的不许 set 存副本——47 次里常有 5 次是派生链回环）；③ rehydrate 时序（skipHydration+挂载前完成，或骨架期挂起渲染）。本题考流程执行力：症状→取证→归因→分层修，一步不跳。

### 11. (A) immer 结构共享在坑1/坑4 里分别是解药还是帮凶？各给一个具体场景。

**来源**：转述自本关与 sig-mutability §四的双向账

解药场景（坑1）：无 immer 时手改深层必换整链引用、订中间层者全惊动；immer 复制只到路径根，订 `s.profile` 而改 `s.cart` 者 selector 产物同引用→闸门直接放行；帮凶场景（坑4-B）：改叶子后根路径链全换引用，订 `{a, b}` 组合却用默认 Object.is 者『内容九成没变、引用全变』→白渲——此时仍需 useShallow 把比较面下移。总结：**结构共享把『谁变了』的分辨率提高了，但要求你的比较面主动对齐那个分辨率**——它优化的是映射链，不替你设计订阅面。

### 12. (B) 拖拽卡顿排查：Performance 显示每帧都在跑 selector（数量=订阅组件数×60/s），但组件 commit 数正常。定位哪一层、给两针。

**来源**：转述自本关 §三与 za-patterns transient 联动

定位：订阅执行层（比较面）而非渲染层——每帧 set 触发全体 listener 跑 selector，比较通过不渲但**函数调用与比较的固定税照付**（sig-mutability 面试 q2『通知税』的现场显形）。两针：① 坐标拆独立小 store（只有拖拽相关组件订阅它，广播面从全 app 缩到 3 个）；② 拖拽中间帧走 transient 根本不进 set 流（松手 commit），60/s 的 selector 风暴归零。这题的分寸：**commit 正常≠状态层健康**，税单在看不见的地方。

### 13. (D) 为团队设计『性能坑清单』进 code review 的制度：清单条目、触发规则、证据要求三件套怎么定才不死？

**来源**：转述自本关 A4 检查单的组织化

清单=本关四坑各压成一条『提问式规则』（我的 selector 产物现造吗/渲染体真读到字段了吗/建订阅处三行内有退订吗/比较面和引用链对齐吗）；触发规则：PR 含『store 定义文件/新订阅/新 selector』任一项即启用清单审查（全自动 lint 只配给『裸 autorun 无赋值』一条，其余靠模板）；证据要求：触发项的 PR 附 Profiler 截图或计数断言链接。防腐设计：每季度用线上真实事故回填清单（事故→新条目→lint 化候选），**清单的条目必须有出处事故编号**，否则评审时第一个被拖出去的就是它。

### 14. (C) 把『批处理』算不算性能坑修法第五刀？给四家批处理现状一句话与各自主防的坑。

**来源**：转述自各家 batching 文档横向

Zustand/Redux：无自动批处理（React 18 事件内自动合帧兜底），主防坑1 惊动面（连续 set=多次广播）——高频场景自攒 queue 或迁 transient；MobX：action 内天然批处理（一个 action 多次写只通知一轮），防的是风暴也造了坑2 的迷惑（半路同步读是新鲜的、reaction 却是滞后的）；Angular signal：effect 自动批+`untracked` 逃逸，防模板期连环 set；Solid：同步即时更新+渲染队列合帧，细粒度下批处理需求最弱。判词：**批处理治『同一轮多次写的通知冗余』，治不了『一次写的订阅面过宽』**——第五刀管前者，本关四坑仍以订阅面设计为主刀。

### 15. (A) 收官：用一段话向新人讲透『先归因再优化』，各带一个反面案例（四坑各一）。

**来源**：转述自全包精神总结

四句病根各对一个冤案：过度订阅别上虚拟列表（坑1 用 memo 修，案例：万行表格加 react-window 后仍卡，真凶是无 useShallow 的多字段 selector）；漏订别加 setTimeout 轮询救（坑2 修读取姿势，案例：为『UI 不动』写了 200ms 轮询 store，半年后成为性能问题本身）；泄漏别开 Web Worker（坑3 补配对退订，案例：Worker 化拖拽后主线程仍涨，订阅在两边各漏一份）；引用失效别无脑 memo（坑4 画内容→引用映射表，案例：给整棵树套 memo 后 B 面白渲变 B 面白比较，CPU 换个地方烧）。归因=先问 commit 多了少了、内存锯齿有无、订阅面宽窄，再谈工具——顺序反了，一切优化都是在给病灶换止痛药。
