# mp-setdata 面试题精选

> 共 12 题，覆盖 A 原理机制 / B 性能优化 / C 与 React/Vue 对照 / D 实战场景。

## 一、原理机制（A 类）

### 1. 讲一次 setData 从调用到页面变化的完整过程。
逻辑层合并 data → JSON 序列化 → 经 Native 桥传到渲染层 → 渲染层数据 diff → 节点最小更新 → 重排重绘。`this.data` 的更新是同步的，视图更新是异步的（呼应 mp-setdata 第一、二节）。
**来源**：《小程序运行机制》官方指南；《setData 都做了什么》技术分析专栏

### 2. setData 的"合并"是深合并吗？
不是。顶层 key 整体替换：`setData({ user: { age: 1 } })` 会把 user 整个对象换掉、丢掉原有其他字段；要保留就写路径 `'user.age': 1`。把"合并"背成"深合并"是面试挂点。
**来源**：微信小程序官方文档《setData 用法与注意事项》

### 3. setData 支持哪些参数形态？回调什么时候必须用？
对象形态 `{ 'a.b[0].c': v }`；旧版字符串路径形态已废弃。回调在"渲染层完成更新"后执行——读更新后的节点布局（SelectorQuery、canvas 绘制、滚动定位）必须放回调或 `wx.nextTick`（呼应 mp-setdata 第二节）。
**来源**：微信小程序官方文档《setData 函数》

## 二、性能优化（B 类）

### 4. setData 数据量过大有什么后果？给个量化感觉。
序列化+跨线程拷贝耗时随体积线性增长、渲染层 diff 变慢，典型表现是点击响应延迟、动画掉帧；官方指南建议**一次 setData 控制在 1MB 以内、越小越好**，超出会被明确标记为性能问题（体验评分工具会报 "setData 不应超过 1MB"）（呼应 mp-performance）。
**来源**：小程序性能优化指南《setData 性能》；体验评分规则说明

### 5. 长列表分页加载，每次 setData 的正确姿势？
只传**新一页**数据：路径追加不可通用时，退而求其次是"新数组只含增量字段引用"仍会整段序列化——最优是配合 recycle-view/虚拟列表，让 setData 传 `viewList`（视口十几条）而非累积全量。反面教材：`setData({ list: 全量.concat(新页) })` 第 N 页传输量 ∝ N（呼应 mp-render、mp-setdata 第四节）。
**来源**：微信开放社区长列表实践；recycle-view 组件官方文档

### 6. "用 setData 传大数据给下一个页面"为什么是坏主意？
页面间传参走 setData/内存各有上限，大数据跨页应：存 Storage（wx.setStorage，注意 1MB/key、10MB 总限）、或干脆两个页面各请求各的、或全局状态+只传 id（呼应 mp-communication、mp-storage）。
**来源**：微信开放社区页面传参问答精选

## 三、与 React / Vue 对照（C 类）

### 7. setData 和 React setState 的异同？
同：都声明"数据要更新+视图要变"、都异步渲染、都鼓励"不可变地传新值"。异：setState 只换内存引用、diff 在同进程 JS 完成且 React18 自动批处理；setData 多了**跨线程序列化传输**这一大成本项，且**不自动合并多次调用**——所以 React 的"拆细 state"优化直觉在小程序要反过来用"合并 setData"（呼应 react-usestate、react-render-model）。
**来源**：React 官方文档《useState》；小程序性能指南对照

### 8. 为什么说小程序"没有响应式"？它和 Vue 的本质差异？
Vue 用 Proxy 拦截 setter，赋值即触发依赖更新；小程序 data 是普通对象，赋值无副作用，必须显式 setData。工程后果：Vue 里"派生值用 computed 自动追踪"，小程序里派生值要么 setData 前算好、要么 wxs 现算（呼应 vue-reactivity、mp-wxml）。
**来源**：Vue 官方文档《响应式原理》；微信小程序官方文档

### 9. Taro/uni-app 用 React/Vue 写小程序，setData 还存在吗？
存在且是底层瓶颈：框架把 JSX/template 的渲染结果翻译成 setData 调用，并做数据 diff 精简（如 Taro 的 diff 算法只 emit 变化路径）。理解原生 setData 成本，才能在跨端框架里写出"对底层友好"的代码（呼应 mp-framework）。
**来源**：Taro 官方文档《工作原理》；uni-app 官方文档《技术架构》

## 四、实战场景（D 类）

### 10. 页面有搜索框+商品列表+购物车角标，输入联想每次击键 setData 全量数据，怎么治？
① 联想结果单独字段路径更新；② 防抖 300ms 合并请求与更新；③ 列表与角标不相关的 state 别被顺带重发（对象引用没变就不要放进 setData 参数）；④ 竞态：仅采用"最后一次请求"的回包（requestId 比对/Abort 思路，呼应 react-effect-patterns）（呼应 mp-events 面试 12）。
**来源**：微信开放社区搜索页性能案例

### 11. 倒计时每秒更新，体验评分报 setData 频繁，怎么改？
方案一：只传变化的字符串字段 `setData({ countText })` 而非整个对象；方案二：渲染层 wxs 拿 endTime 本地算？——wxs 无定时器，不可行；正解是 **setInterval 低频化（秒级只传 4 字节文本）+ 组件内局部 setData**（倒计时封装成组件， setData 不波及页面大 data），或 Skyline worklet 动画（呼应 mp-component、mp-performance）。
**来源**：体验评分规则《setData 频繁调用》；微信开放社区倒计时优化帖

### 12. 首屏白屏时间长，setData 角度能做什么？
① 初始 data 瘦身：路由参数/骨架字段先渲染，其余"二次 setData"；② 接口并行 Promise.all 后一次 setData；③ 关键列表截断首屏页数；④ 避免 setData 里带 base64 图；⑤ 开"骨架屏/分包预下载"配合（呼应 mp-subpackage、exp-perf 的"关键路径先行"同一哲学）。
**来源**：小程序性能优化指南《启动流程与首屏》；体验评分指标文档
