# mp-communication 面试题精选

> 共 12 题，覆盖 A 通道机制 / B eventChannel 深水区 / C 全局状态与总线 / D 跨框架与架构。

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
