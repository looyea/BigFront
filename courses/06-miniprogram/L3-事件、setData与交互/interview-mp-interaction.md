# mp-interaction 面试题精选

> 共 12 题，覆盖 A API 机制 / B 选型与设计 / C 封装工程化 / D 踩坑与合规。

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
