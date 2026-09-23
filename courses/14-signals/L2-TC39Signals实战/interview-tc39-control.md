# tc39-control 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖订阅控制：watch / untrack / equality。

### 1. (A) 『读即订阅』为什么是自动依赖追踪的核心，也是它的代价？

**来源**：https://github.com/signaljs/proposal-signals

核心：运行期记录函数读过的每个 signal，依赖数组从此消失，条件分支依赖也能动态收窄。代价：读取无法区分『要用这个值』和『顺便看看』，任何一次读取都升级成永久订阅。控制阀三件套（watch 浅观察、untrack 免记账、equality 判等）全部是为这个代价打的补丁。

### 2. (A) untrack 的三种正当使用场景各举一例。

**来源**：转述自 Solid 文档与社区最佳实践 https://docs.solidjs.com/

① 埋点/日志：effect 里想带出当前上下文值但不想因此订阅（analytics 读 pageId）；② 防循环：读取可能与本 effect 写入形成回环的 signal；③ 事件化订阅：只关心『它变了』不关心值细节，配合手动读取实现浅观察。反例警戒：为了『性能』随手 untrack 业务依赖 = 制造静默失联 bug。

### 3. (A) signal 默认判等是什么？为什么不是 ===？

**来源**：https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is

Object.is。与 === 的分叉在两点：NaN 与 NaN 判相同（写 NaN 不再风暴）、+0 与 -0 判不同。选 Object.is 是为语义直觉服务——『值真的换了吗』。对象仍比引用，所以内容相同的新对象照样触发更新，这正留给自定义 equality 解决。

### 4. (B) 画布应用每帧写入坐标对象，发现即使坐标没变下游也在重跑，给三层修法。

**来源**：转述自 tc39-control Equality 成本账

① 写入端节流：帧循环里先手动浅比较，没变就跳过 set（最便宜）；② signal 配自定义 equals 逐字段判等（注意每帧都要跑判等，坐标这种小对象合算）；③ 拆粒度：x、y 各一个原始值 signal，Object.is 天然命中，免去判等函数（最优——粒度本身就是最好的 equality）。

### 5. (B) 同事把业务逻辑全部包进 untrack 说『这样就不会多余渲染了』，怎么说服？

**来源**：转述自社区对 untrack 滥用的讨论

untrack 关掉的是『依赖登记』，不是『执行』——包多了得到的是手写 deps 的心智负担加静默失联的 bug 面：值变了不联动、排查时看不出哪里本该联动。正确路径是用粒度拆分与 computed 收窄依赖面，untrack 只留给埋点/防循环这类旁路读取，且每处必须带注释。性能问题优先怀疑粒度而不是先关追踪。

### 6. (B) 深比较 equality 在什么情况下反而让应用变慢？

**来源**：转述自 MobX 社区历史教训（computedFn/derive 相关讨论）

对象大、写入频、下游轻的组合：equals 每次写入遍历全子树 O(n)，而它保护的下游可能只是渲染一小段文本——『为了省一次重算先付一次深遍历』。当写入本来就该触发重算时，equals 是纯浪费；只有『写入频繁但多数内容相同』的场景深判等才回本。先量再调，别无脑开。

### 7. (C) Solid 的 equals 选项、Vue watch 的 deep 选项、提案的判等语义，三者定位差异？

**来源**：https://docs.solidjs.com/reference/components-utilities/reactivity-utilities 与 https://vuejs.org/guide/essentials/watchers.html

Solid：signal 构造期注入自定义 equals，替换默认 Object.is，发生在『写入判定』源头；Vue 的 deep：watcher 主动递归追踪/比较，发生在『观察端』扩大订阅面换变化发现；提案：只约定『存在可自定义的相等判定这一契约』（SIG_EQUALS 等细节在演进），把前两者的位置都留给实现。三层：源判等、观察策略、标准契约。

### 8. (C) 『浅观察（watch）』与『不订阅（untrack）』的区别用一句话讲清。

**来源**：转述自本课姿态对照表

浅观察是『订阅容器被替换这个事件、不再深入字段』——仍有响应；untrack 是『这次读取彻底不记账』——毫无响应。一个是把订阅面收窄到一层，一个是把这行读取踢出依赖图。

### 9. (C) RxJS 的 distinctUntilChanged 和 signal 的自定义 equals 是同一件事吗？

**来源**：转述自 L3 rx-operators 与本课的合流讨论

判定目标一致（吸收无变化的传播），作用位置不同：equals 在状态源头的写入闸门——判等不过，整个依赖图根本不惊动；distinctUntilChanged 在流管道的中段——上游风暴照旧，只过滤这条管道的下游。前者是『不让噪音出生』，后者是『不让噪音过境』。

### 10. (D) 为一个编辑器设计 signal 状态图的订阅控制方案（文档、光标、选区、脏标记）。

**来源**：转述自本课练习

原始文档 signal 只由用户操作写；选区、光标各自小粒度 signal（拆粒度=最好的 equality）；脏标记用 computed(对比保存快照版本)，判等用布尔（原始值天然免风暴）；自动保存 effect 只订阅脏标记与文档，埋点 effect 用 untrack 读光标；全局 undo 栈由命令层维护，绝不用 effect 反向同步（防循环）。要点：每条订阅都能说出『谁读谁、为什么』。

### 11. (A) 为什么 effect 里读、computed 里也读，untrack 却常出现在 computed？

**来源**：https://github.com/signaljs/proposal-signals

两者都建依赖，但爆炸半径不同：computed 的依赖面决定『昂贵派生链何时重算』，一处顺手读取会污染整条下游图；effect 通常已是末端（跑副作用），多订阅一个 signal 一般只是多跑一次回调。治理重心放在中间层 computed 上，收益最大。

### 12. (B) 生产环境发现某个 effect 永远不再执行，排查发现上游某处有个 untrack，讲讲断链是怎么形成的。

**来源**：转述自社区排障案例

untrack 包裹的读取不登记——若那正是 effect 唯一依赖的 signal，effect 成了『首跑之后无人订阅』的孤儿：初始化值拿到了，后续变化一概不知。排法：把 untrack 逐个摘除观察唤醒面；预防：untrack 注释规约 + 测试里对关键联动写『写入-断言响应』冒烟用例。教训：untrack 关掉的是响应性，不是读取本身，最容易骗过的就是未来的自己。

### 13. (C) Vue 的 watch(source, cb) 显式依赖 vs Signals 的隐式追踪，各自适合什么团队？

**来源**：https://vuejs.org/guide/essentials/watchers.html

显式：依赖写在脸上，新人可 grep、review 成本低的团队友好；漏写 deps 是 Vue 新手第一大坑。隐式：依赖跑出来才有，代码极简但必须建立 untrack/粒度审查规约的中高级团队发挥更好。没有宗教答案，只有团队工程成熟度答案——这题面试官想听的是权衡而不是站队。

### 14. (D) 线上 CPU 飙高，火焰图显示某 computed 每秒重算上百次，用本课工具给出排查-治理路线。

**来源**：转述自 L7 sig-perf 预热

排查：在 computed 体打点，找出每次重算前是谁写了它的依赖（多半是高频 effect 或定时器写入粗粒度对象）。治理四选一按序尝试：拆细粒度（大对象拆成原始值 signals）→ 写入端判等闸门（自定义 equals）→ 把该 computed 的读取方收窄（别人在循环里读它）→ 确认『只需末态』的话把消费端从 effect 挪到按需 .get。每一步都要带回退开关。

### 15. (A) 提案里 SIG_EQUALS 这类 Symbol 钩子的意义是什么？为什么说互操作比 API 名字更重要？

**来源**：https://github.com/signaljs/proposal-signals（互操作章节）

Symbol 钩子让任意实现间传递『怎么判等、谁是 owner』等元约定，而不用统一构造函数签名——A 库的 computed 能安全读 B 库的 signal，语义宪法通过 Symbol 协议落地。API 名字（.get/.value/函数调用）可以各美各的，互操作契约才是让『signal 生态』从一堆孤岛变成一张网的承重墙。
