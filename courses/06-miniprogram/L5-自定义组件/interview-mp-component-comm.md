# mp-component-comm 面试题精选

> 共 15 题，覆盖 A 事件通信 / B slot 与内容分发 / C 命令式 API / D 设计原则与跨框架。

## 一、事件通信（A 类）

### 1. triggerEvent 与 $emit / props 回调的对应关系？各自"事件名+载荷"放哪？
`this.triggerEvent(name, detail, options)`：name≈`$emit('name')`≈回调 prop 名；detail≈emit 载荷≈回调参数；options 的 bubbles/composed 是小程序特有——控制能否穿出组件边界。Vue3 默认也不穿（事件不冒泡出组件），React 根本不存在"冒穿"（回调显式传递），三家哲学同为"边界要尊重"（呼应 vue-component、react-composition）。
**来源**：微信小程序官方文档《triggerEvent》；Vue/React 官方文档对照

### 2. bind:xxx、catch:xxx、capture-bind:xxx、capture-catch:xxx 用在自定义事件上有效吗？
有效——自定义事件同样进入事件流，四前缀语义与原生事件一致；vant 等组件库文档里"支持 catch:close"就是此意。但**穿透组件边界仍取决于 composed**，catch 只是截断已到达本层后的继续传播（呼应 mp-events 第二节）。
**来源**：微信小程序官方文档《事件 > 自定义事件与捕获》

### 3. 页面为什么收不到组件内部 button 的 bindtap？三种破局方式？
普通事件止于组件边界（封装设计）。破局：① 组件内捕获后用 triggerEvent + composed:true 转发；② 直接给组件标签绑同名事件且组件内部不拦截（依赖原生事件 composed 规则，button 的 tap 不 composed，故多数要方案①）；③ 父 selectComponent 拿实例监听/调用（下策）（呼应 mp-events 第六节）。
**来源**：微信小程序官方文档《组件间通信》

## 二、slot 与内容分发（B 类）

### 4. slot 里的数据是谁的？插槽内容样式归谁管？
编译作用域归父——内容只能用父 data；样式也按父的隔离域处理，子选不中插槽内节点（想定制用 externalClasses 或让父自带类名）。一句话：**slot 换的是"挂载位置"，不换"作用域"**（呼应 mp-component-comm 第三节）。
**来源**：微信小程序官方文档《slot》；社区插槽作用域讨论精选

### 5. 小程序没有作用域插槽，子组件数据要塞进父提供的内容怎么办？
三种工程变通：① 把该内容做成独立组件，父在 slot 里放它、由父自己把子的数据先经事件/store 拿到再传入（绕）；② 子把数据塞进 triggerEvent，父存起来再喂内容组件（标准做法）；③ 放弃 slot，改用"配置式内容"（properties 传字段名+格式化模板/wxs）（呼应 vue-composables 的 slot-scope 对照、mp-wxml wxs）。
**来源**：微信开放社区作用域插槽替代方案精选

### 6. 多个同名具名 slot、或 slot 内容条件渲染 wx:if，行为如何？
同名多坑位：内容会被渲染到**所有**同名 slot 中（去重是 Vue 3.3+ 才细化的话题，小程序以"复制到每个"为准，务必避免重名）；slot 内容 wx:if 为假时不占坑、子组件的 slot 处即空——子组件可用 wx:if 检测 `$slot`？不能，无 slot 存在性 API，坑位兜底样式要靠父级自觉（官方 slot 不支持 fallback 内容）（呼应 mp-component-comm 第三节）。
**来源**：微信小程序官方文档《slot 使用说明》

## 三、命令式 API（C 类）

### 7. selectComponent 和 createIntersectionObserver 等"拿节点/实例"的 API，作用域规则？
组件实例上的 selectComponent/SelectorQuery 默认限本组件子树；页面实例上查不到组件**内部**节点（隔离）。`>>>` 深层选择器（跨组件查询）曾存在但官方不推荐、行为随版本波动——正规做法是事件或方法 API（呼应 mp-component 第四节）。
**来源**：微信小程序官方文档《selectComponent / 节点查询交互》

### 8. 组件的 validate() 该暴露成方法还是用属性驱动？
两种都合法，取舍：瞬时动作（校验/播放/聚焦）→ 方法（父 selectComponent 调）；可持续状态（显隐/禁用）→ properties 驱动（open: Boolean），可预测、可回放、利于调试。React 社区 useImperativeHandle vs props 控制的争论在小程序原样重演——属性优先，方法兜底（呼应 react-refs、mp-component-comm 第四、五节）。
**来源**：React 官方文档《forwardRef/useImperativeHandle》对照；小程序组件库源码实践

### 9. 用 selectComponent 缓存了子实例，页面卸载/子销毁后仍持有引用，有什么后果？
内存泄漏 + 对已 detached 实例 setData/查询产生告警或空结果。规范：事件优先；必须持引用时在子 detached 钩子/父 onUnload 里置 null（呼应 mp-component 面试第 10 题、mp-component-lifecycle detached）。
**来源**：微信开放社区内存泄漏排查案例

## 四、设计原则与跨框架（D 类）

### 10. 设计一个可复用的弹窗组件，给出接口（props/events/slots/方法）。
props：visible(Boolean 受控)、title、maskClosable；events：close/mask-click（detail 携带原因）；slot：默认内容 + footer 具名；方法：open()/close() 仅作为"非受控便捷"文档标注。原则：**状态属性化、事件语义化、内容插槽化、方法最小化**，配一个 README 的受控/非受控声明（呼应 mp-component-comm 第五节表、react-composition 设计话题）。
**来源**：组件库 API 设计通用结论；vant-weapp 组件文档示例

### 11. Vue 的 provide/inject、React 的 Context 在小程序组件层有对应物吗？
没有"跨层注入"原生机制。近似：app.json 全局组件 + properties 逐层传（drilling，痛点同款）；或组件层自建"小型 context"：根组件持有 store、子树用 bus 订阅（把页面级方案缩小到组件级）。深层配置传递优先重构组件树——传三层以上 props 通常是边界画错了（呼应 vue-provide-inject、react-context、mp-communication）。
**来源**：Vue/React 官方文档对照；小程序社区状态共享实践

### 12. "数据向下、事件向上"在双线程架构下有什么额外成本？设计大列表组件时如何省？
每次下行=一次跨线程 setData 序列化，父子链上多跳多次；大列表若"父全量+子再全量"传输量翻倍。优化：列表数据直入子组件的 properties（一跳）、子内部虚拟滚动只渲染视口、上行只传 id 不传整项（父用 id 反查）（呼应 mp-setdata、mp-performance）。
**来源**：小程序性能优化指南；社区长列表组件设计帖

---

## 补充（新专题 13-15）

### 13.  用 selectComponent 缓存了子实例引用、但子被 wx:if 销毁后仍持有它，会有什么后果？组件方法暴露该用"调方法"还是"属性驱动"？

后果：detached 后实例已从组件树摘除，缓存的引用是"僵尸"——调它的方法可能静默失效或操作已销毁上下文、造成内存无法回收（你持着它，GC 不掉），页面反复进/出会累积泄漏。所以：能"属性驱动"就别"命令式调方法"——把 play/pause 这类翻成 `playing` prop + observer，走单向数据流，子随父重建自然复位，父也无需持引用。确需命令式（ imperative，如 focus、scrollTo、表单 validate），则 selectComponent 即取即用、别长期缓存，或在子 detached 里通知父清引用。这与 React 从"refs+imperativeHandle"转向"受控 props"、Vue 从 ref 调用转向 props/emit 的取向一致：优先声明式，命令式是不得已的逃生舱。

微信官方文档《组件间页面间通信》；掘金《selectComponent、triggerEvent、slot 三种通道怎么选》

### 14.  "数据向下、事件向上"在双线程架构下有什么额外成本？设计一个大列表组件时如何省？

额外成本来自"每一次向下 setData、每一次向上再触发父 setData 都是跨线程往返"：大列表若把每项的点击都 triggerEvent 回父、父再改整表数据 setData 下发，等于一点击两次跨线程 + 整表 diff，巨贵。省法：① 子组件自管交互态（选中/展开）放组件自身 data、不每次惊动父，只在"提交"时上抛一次聚合结果；② 局部更新用路径 setData（list[i].checked）而非整数组下传；③ 高频纯展示计算用 wxs 留在渲染层；④ 用 eventChannel/委托思想——容器绑一次事件 + dataset 反查，避免每项各绑各的回调把事件对象也放大；⑤ props 只传必要字段而非整对象。核心：把"每次交互的跨线程次数"与"每次 setData 的数据量"双降——这恰是 React 大列表要 memo + 稳定 key + 局部 state 的同款理由。

SegmentFault《组件方法调用返回 undefined 的常见原因》；知乎《行为与 relation 跨组件通信实战》

### 15.  设计一个可复用弹窗组件，给出 props / events / slots / 方法 的完整接口，并说明各方案取舍。

Props（向下）：visible（受控显隐，父用属性驱动而非子自改）、title、confirmText/cancelText、maskClosable、type（alert/confirm/custom）。Events（向上）：confirm/cancel/close（携带需要的载荷，如确认时表单值）、mask-click——统一在动作时上抛让父决定"要不要关、关之前做啥"，避免子自己 hide 与父不同步。Slots（扩展）：默认 slot 放自定义内容、footer slot 放自定义按钮组，用 `<block wx:if>` 兜默认——满足"90% 通用 + 10% 可定制"。方法（逃生舱）：确需外部命令式打开可暴露 selectComponent().open()，但优先 visible prop。取舍：受控(visible) 优于非受控(内部 show/hide)——受控让父掌握单一真相源、易与路由/权限联动；catchtouchmove 锁背景滚动要处理；用 slot 而非把内容做成一堆 props，换取灵活又不过度定制。这套接口在 Vue/React 弹窗里长得几乎一样，差别只是语法。

CSDN《组件事件总线在小程序中的边界与反模式》；InfoQ《组件库升级中通信协议的兼容设计》
