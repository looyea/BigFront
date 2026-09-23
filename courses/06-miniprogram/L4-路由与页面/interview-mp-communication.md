# mp-communication 面试题精选

> 共 15 题，覆盖 A 通道机制 / B eventChannel 深水区 / C 全局状态与总线 / D 跨框架与架构。

## 一、通道机制（A 类）

### 1. 小程序页面间通信方式全列举，并各给一句适用场景。
① url query：去程传 id；② globalData：登录态等全局低频；③ Storage：跨启动持久（草稿/偏好）；④ getCurrentPages 拿实例：相邻栈页应急回写；⑤ eventChannel：A↔B 定向回传；⑥ 事件总线/store：一对多广播与共享响应状态（呼应 mp-communication 第一节矩阵）。
**来源**：微信小程序官方文档《页面间通信》；开放社区通信方案精选

### 2. 为什么 globalData 改值后，正在显示的页面不会自动更新？
globalData 只是普通对象，没有响应式，也不在页面 data 里——渲染层只认页面的 setData。要么页面 onShow 重读，要么 bus/store 通知后再 setData（呼应 mp-setdata 第一节、mp-lifecycle onShow）。
**来源**：微信小程序官方文档《getApp / globalData》

### 3. getApp() 什么时候不能调？
App 实例创建完成前——即 app.js 自身（onLaunch 里 getApp() 为 undefined，官方明确）；此时直接用 this（App 实例本身）。页面/组件里调用安全（呼应 mp-directory、mp-lifecycle）。
**来源**：微信小程序官方文档《getApp 注意事项》

## 二、eventChannel 深水区（B 类）

### 4. eventChannel 的双向能力怎么用？和 events 选项是什么关系？
A 在 navigateTo 传 `events: { xxx }` 收 B 的 emit；B 里 `this.getOpenerEventChannel()` 既可 `emit('xxx', data)` 回传，也可 `on('yyy')` 收 A 主动 `eventChannel.emit`（B 未 onLoad 前 A 也可 `getEventChannel()` 拿通道发消息）。通道寿命=本次跳转（B 销毁即止）（呼应 mp-communication 第三节）。
**来源**：微信小程序官方文档《eventChannel / navigateTo events》

### 5. A→B→C 三级，C 的结果要回到 A，有哪些解法？
① 逐跳 eventChannel 转发（显式但繁琐）；② C 里 getCurrentPages 找到 A 直接调其方法（快但脆）；③ bus/store 广播（解耦但要管订阅生命周期）；④ 重新设计：C 完成 reLaunch/多跳 back + A onShow 重拉。面试亮点是说明"没有银弹，按耦合预算选"（呼应 mp-communication 第二、四节）。
**来源**：微信开放社区多级回传问答；官方文档组合推导

### 6. redirectTo 之后还能用 eventChannel 吗？
不能依赖——通道建立在"打开关系（opener）"上，redirectTo 替换栈顶后原 opener 已销毁，回传目标不存在；navigateBack 前必须完成 emit（B 销毁后通道关闭）。跨"非亲子"页请用其他通道。
**来源**：官方文档 eventChannel 生命周期描述；社区实测帖

## 三、全局状态与总线（C 类）

### 7. 手写事件总线要注意什么？给出最小实现的要点。
① Map/Set 存 handler、on 返回退订函数；② emit 里 try/catch 防单个订阅者炸全链；③ once/off 语义补齐；④ 与页面生命周期绑定（onLoad 订、onUnload 退）；⑤ 事件名常量表。Node 的 EventEmitter 是现成参照（node-events 一课平移）（呼应 mp-communication 第四节）。
**来源**：Node.js 官方文档 EventEmitter；microevent 等迷你库设计

### 8. mobx-miniprogram 这类库解决什么问题？原理？
解决"store 变化 → 相关页面自动 setData"：observable 追踪依赖 + 订阅回调里把映射好的字段 setData 到页面/组件（bindings 声明 page 字段 ← store 字段的映射）。本质仍是手动挡 setData 的自动化，不改变双线程成本模型（呼应 mp-communication 第五节、mp-setdata）。
**来源**：mobx-miniprogram 官方 README/文档

### 9. 状态放 Storage 还是 globalData？
判断轴是**寿命与一致性**：要跨启动/冷启动可用 → Storage（异步、限额 10MB）；只要本次会话、读写频繁 → globalData/内存（同步、重启即失）。多数业务是"内存为准 + 定期落 Storage"双写（呼应 mp-storage、node-config 的分层思想）。
**来源**：微信小程序官方文档《数据缓存限制》；社区缓存策略实践

## 四、跨框架与架构（D 类）

### 10. React Context / Vue provide-inject 的思路能搬到小程序吗？
组件层能：Component properties 向下 + triggerEvent 向上就是"props  drilling"，slot/组件嵌套可模拟 composition（呼应 vue-provide-inject 的跨层痛点在小程序同样存在）。页面层不能：页面不是组件树的节点，没有共同"渲染父级"可 inject——所以小程序的全局态只能靠 App/bus/store，而不是 Context（呼应 react-context 边界讨论）。
**来源**：React/Vue 官方文档对照；小程序组件文档

### 11. "页面 A 监听 bus 刷新"和"A 在 onShow 重拉数据"，怎么选？
实时性要求高（秒杀价、支付回调）→ bus 定向刷新；可容忍切回时最新 → onShow 重拉，实现最简、无订阅泄漏风险。混用注意：bus 到达时页面可能正 onHide（不可见仍 setData 浪费），加可见性判断（呼应 mp-lifecycle、mp-setdata）。
**来源**：开放社区"推拉结合"数据刷新模式讨论

### 12. 从架构角度谈：为什么小程序"鼓励页面自治、惩罚重全局状态"？
每页独立 WebView、栈式导航、可随时被微信回收重建——全局内存态在"被杀重进"时不可靠（要恢复必须 Storage + 路由参数可重放，呼应 mp-performance 的状态恢复）；页面自治（每页拿 id 自己拉数据）天然可分享直达、可回收。这与 React Router"URL 即状态、loader 可重放"的 data router 哲学殊途同归（呼应 react-router-data）。
**来源**：《小程序运行机制》官方指南；React Router 官方文档 Data Strategy

---

## 补充（新专题 13-15）

### 13.  把小程序页面间通信方式列全，并各给一句"何时用它"与各自的失效/坑点。

① url 参数（navigateTo ?id=）：父→子单向、启动即得、但只能字符串且小——大/复杂别塞；② eventChannel：父子跳转双向、随栈回收，坑在非父子/多级不通；③ 直接改 prev 实例 setData：能通但强耦合，是反模式；④ globalData：全局可读写，坑在"改了不通知视图"，要配合手动 setData/事件；⑤ 自建事件总线（getApp 上挂 emitter）：一对多广播，坑在忘解绑→重复触发/内存泄漏；⑥ 订阅式 store（mobx/自研）：跨页共享响应式状态，坑在过度使用变"远程全局变量"；⑦ storage：持久化 + 跨启动共享，不适合实时高频；⑧ 后端为准 + onShow 重拉：最解耦但多请求。选型轴：谁→谁（点对点 vs 广播）、生命周期（随栈 vs 常驻）、是否需持久。

微信官方文档《页面之间的数据传递与 EventChannel》；掘金《小程序跨页通信的六种姿势对比》

### 14.  "页面 A 监听事件总线刷新"和"A 在 onShow 重拉数据"，什么时候选哪个？

看"数据的权威源"和"实时性要求"。onShow 重拉：数据以服务端为准、可容忍几秒陈旧、想少维护耦合（页面对自己数据负责，天然处理"从任何来源返回都刷新"），代价是多一次请求与可能闪烁，适合"列表/详情"这类读多写少、别人改了不一定知情的。事件总线：需要"某动作发生后立刻、精准地反映在特定页"（如刚改了昵称马上同步到"我的"页、支付成功即时更新多处），避免全量重拉，代价是订阅关系要维护、必须 onUnload 解绑、且要处理"目标页此刻不在栈里/被隐藏"的情况（隐藏页 set 可能无效或报错）。务实常混用：关键即时反馈走事件、兜底一致性走 onShow 重拉或加时间戳脏检查。

SegmentFault《getOpenerEventChannel 实战与回调丢失坑》；知乎「globalData、eventBus、存储哪种该退场」

### 15.  从架构角度，为什么小程序"鼓励页面自治、惩罚重全局状态"？

根源是运行时模型：逻辑层是单例常驻进程，但视图按页组织、渲染靠 setData 显式推送、且没有跨页响应式绑定——你把大量状态放 globalData/大 store，改值不会自动让"正在显示的页"更新，最终仍要在各页手动 setData/监听，等于自造一套脆弱的响应式，还没框架兜底。于是"重全局状态"在小程序性价比低、坑多（串页脏值、忘记解绑、生命周期错配）。框架因此在 API 设计上把 eventChannel、页面栈、onShow 这些"局部/点对点"通道做得最顺手，引导每页为自己数据负责、按需最小通信。这与 React/Vue SPA 里"能用局部 state 就别上全局 store"的克制同理，只是小程序把这个约束从"最佳实践"升级成了"违反就有 bug"的硬现实。

CSDN《小程序父子/兄弟组件通信与 selectComponent 使用边界》；InfoQ《一次状态库迁移中的页面通信改造》
