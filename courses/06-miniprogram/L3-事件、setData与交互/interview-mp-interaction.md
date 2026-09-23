# mp-interaction 面试题精选

> 共 15 题，覆盖 A API 机制 / B 选型与设计 / C 封装工程化 / D 踩坑与合规。

## 一、API 机制（A 类）

### 1. wx.showToast 和 wx.showLoading 是什么关系？同时调用会怎样？
二者共用同一个浮层通道：后调的会顶掉先调的。典型 bug 是 `hideLoading` 后不 `showToast` 或顺序颠倒导致提示消失。正确链路：请求成功 → hideLoading → showToast（必要时延时几毫秒保险）（呼应 mp-interaction 第二节）。
**来源**：微信小程序官方文档《UI 交互 > showToast 注意事项》

### 2. 原生交互 API（toast/modal）渲染在哪里？为什么它们不占 setData 成本？
由 Native 层直接绘制（或独立浮层），不在页面的 WebView 节点树里——所以不受页面样式影响、不参与数据 diff，性能上与 setData 无关。这也是"能用原生就别自绘弹层"的理由之一（呼应 mp-overview 双线程）。
**来源**：《小程序原生组件与层级》官方文档概念对照

### 3. showModal 为什么只有两个按钮？三个选项怎么办？
产品刻意限制"决策二元化"；多操作应下沉为 actionSheet（并列动作）、或页面内操作区。自定义三按钮 modal 也可行但失去原生一致性与无障碍支持（呼应 mp-interaction 第一、二节）。
**来源**：微信小程序官方文档《showModal》《showActionSheet》

## 二、选型与设计（B 类）

### 4. "删除一条数据"全流程的反馈设计，你会怎么排兵布阵？
点击删除 → `showModal` 确认（防误删，重决策）→ 确认后进请求：`showLoading(mask:true)` 防重复提交 → 成功 `hideLoading + toast('已删除')` + 本地路径更新列表 `setData({'list[i]': ...})`/ splice 重传小数组 → 失败 hideLoading + toast 错误文案（出口统一）。一句话：**决策用 modal、过程用 loading、结果用 toast、视图用最小 setData**（呼应 mp-setdata、exp-validation 的错误反馈分层）。
**来源**：小程序交互设计规范（微信设计指南）；开放社区最佳实践帖

### 5. 下拉刷新、触底加载分别要注意什么收尾动作？
`onPullDownRefresh` 必须配对 `wx.stopPullDownRefresh()`（放 finally）；触底 `onReachBottom` 要有"加载中"闸门防重入 + "没有更多了"的明确终态，否则用户狂拉无限请求（呼应 mp-lifecycle 第五节、react-effect-patterns 竞态）。
**来源**：微信小程序官方文档《页面事件处理函数》

### 6. toast 的 icon 为什么长文案必须 icon:'none'？
success/error/loading 图标模式下文案限制 7 个中文字（超长截断显示不全），none 无图标可长文。设计侧：图标模式是"即时确认"，none 是"信息告知"，别混用（呼应移动端设计规范通用结论）。
**来源**：微信小程序官方文档《showToast icon 限制》

## 三、封装工程化（C 类）

### 7. 让你设计一个全项目统一的反馈模块，接口怎么定？
分层：`toast(title, opts)` Promise 化；`loading.show/hide` 幂等计数（多个请求并发时 hide 只在计数归零时真执行）；`confirm(content)` resolve boolean；`withFeedback(promiseFn, {successText})` 高阶包装请求自动 loading+结果提示。原则：Promise 化、幂等、出口唯一（错误码→文案映射表集中维护）（呼应 mp-interaction 第四节、exp-patterns 中间件分层）。
**来源**：Taro/uni-app 社区请求与反馈封装方案精选；axios 拦截器设计思想对照

### 8. 并发两个请求都 showLoading，第一个先回来 hide 了，另一个的 loading 也消失了，为什么？怎么修？
原生 loading 是**全局单例**，谁 hide 都关总闸。修法：封装引用计数（show +1 / hide -1，归零才真 hide），或按业务分区用局部骨架屏（页面级 setData 控制，成本换可控）（呼应 mp-setdata 权衡）。
**来源**：微信开放社区 loading 并发问题高赞问答

### 9. 错误文案为什么不该写在页面里？
写在页面=散落、不可复用、改版要改 N 处。集中放：请求拦截器按 `errMsg/code` 映射成人话，特殊场景页面覆写。与 Express 里"错误中间件统一出口"完全同构（呼应 09-express exp-validation/exp-patterns）。
**来源**：错误处理最佳实践通用结论；Express 官方文档 Error Handling

## 四、踩坑与合规（D 类）

### 10. 什么情况下"诱导分享"会被驳回？交互 API 和审核有什么关系？
showModal 文案含"分享后才能查看/解锁利益"即踩《运营规范》诱导分享红线；API 本身合规，文案与流程违规。类似：强制关注、弹窗轰炸（频繁 modal 也会被投诉体验差）。上架前自查交互话术（呼应 mp-openapi 分享、exp-deploy 上线检查清单思路）。
**来源**：微信运营规范《诱导分享行为规范》；审核驳回案例社区汇总

### 11. 键盘弹起挡住输入框（尤其 iOS 固定底部按钮）怎么处理？
`adjust-position`（input 默认真：顶起页面）、`cursor-spacing` 控制间距、`wx.onKeyboardHeightChange` 手动抬升底部栏；弹层里的输入框配合 `scroll-into-view`。核心：原生 API 管不了 Native 键盘，只能"监听高度自己挪"（呼应 mp-performance 键盘优化条目）。
**来源**：微信小程序官方文档《input 组件 > adjustPosition》；开放社区键盘遮挡案例集

### 12. vConsole 里看到 "hideLoading cannot pair with showToast"，根因是什么？
官方在部分版本对**未 show 先 hide**、或 loading/toast 通道互踩给出告警。根因仍是单通道+散落调用。治本：反馈模块统一封装（第 7 题方案），页面永远不裸调 wx.hideLoading（呼应 mp-interaction 第四节）。
**来源**：微信开放社区 hideLoading 告警问答；开发者工具告警说明

---

## 补充（新专题 13-15）

### 13.  原生交互 API（toast/modal/loading）渲染在哪一层？为什么它们几乎不占 setData 成本、又有何局限？

它们由小程序容器（Native 层/宿主 UI）直接绘制，不进你的 WebView 视图层、更不走 setData 跨线程传数据——所以开销极小、风格与系统一致、层级天然浮于页面之上。局限：样式/动效几乎不可定制、同一时刻反馈通道是单例（会互相顶替）、复杂交互（多按钮、富内容、输入框）不支持。因此设计取舍是：轻提示/确认/加载这类"通用瞬时反馈"优先用原生（省心、性能好、平台一致），一旦需要品牌样式或复合交互就用自定义弹层组件（代价是它活在你的页面 WebView 里，会参与 setData 与渲染、要考虑层级 z-index 与滚动锁定）。键盘挡输入框、iOS 底部固定按钮上浮等则是原生 API 管不到、要靠 adjust-position/cursor-spacing 或页面自身布局处理。

微信官方文档《交互组件与反馈接口》；掘金《下拉刷新/触底加载的节流设计》

### 14.  两个并发请求都 showLoading，第一个先回来把 loading 关了、第二个还在跑——为什么？怎么治？

因为 toast/loading 是全局单例通道，第二个 showLoading 只是把同一层"重新点亮"，第一个的 hideLoading 直接把这张唯一的浮层关掉，于是第二个请求"视觉上没了 loading"。治法是"引用计数"：封装的 feedback 里维护 loadingCount，showLoading 时 ++、到 0 才真正 hide；每个请求 complete 时 --。更根本的是把 loading 归属交给网络层统一拦截器（在 request 封装里按 options.loading 自动管计数），业务页不再手写 show/hide，从源头消除错配与悬挂。顺带解决 hideLoading 顶掉 showToast 的问题：不同通道类型也走同一计数/队列调度，避免相互抢占单例。

SegmentFault《showToast 和自定义 toast 怎么选》；知乎《小程序动画 animation 与 wx.createAnimation 取舍》

### 15.  让你设计一个全项目统一的"反馈模块"，接口怎么定、要兜住哪些坑？

对外接口收敛成少数语义方法：toast.success(msg)/fail(msg)/loading.start()/loading.stop()（内部引用计数）/confirm(opts)->Promise/action(opts)->Promise，屏蔽原生 API 名字与默认项。要兜的坑：① 单例互斥——统一队列/计数，禁止业务直接调 wx.showToast；② hide 必达——loading 与网络层 complete/finally 绑定，异常/超时也要关；③ 文案归一——错误码→文案映射集中在一处，页面里不写死提示语（便于多语言与改口径）；④ 可静默——某些请求（后台刷新、轮询）不弹 loading；⑤ 频控——连续同类 toast 合并/节流，避免刷屏；⑥ 降级——原生不支持的复杂反馈走自定义组件但同样从本模块出。本质与前端"统一 UI 反馈 + 请求拦截器"完全同构，只是这里多了"跨端单例通道"这一物理约束。

CSDN《小程序手势冲突与滚动区域嵌套实战》；InfoQ《交互反馈一致性在中台小程序的落地》
