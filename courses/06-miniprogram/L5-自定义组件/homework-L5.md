# L5 课后作业 · 自定义组件

> 覆盖：组件创建/properties/usingComponents、四条通信通道、生命周期与 behavior。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 页面 wxml 写了 `<stepper />`，控制台无报错但什么都不显示，列出两个最可能原因（一个与 json 有关、一个与 json 里的另一个字段有关）。

**2.** 组件内代码如图，父页面发现"标题被第一个实例改了，其他实例跟着变"，为什么？
```js
properties: { tags: { type: Array, value: [] } },
methods: {
  addTag(t) { this.properties.tags.push(t); this.setData({ tip: 'ok' }); }
}
```

**3.** 子组件里 `this.triggerEvent('changed', { v: 1 })`，父页面 `bindchange="onChanged"`——收不到，为什么？改哪里？

**4.** 父页每次 onShow 都 `setData({ cfg: { theme: 'dark', ...} })`（内容完全相同），子组件观察 cfg 的 observer 却每次都触发，为什么？两条治理思路？

**5.** 组件在 created 里 `this.setData({ n: 1 })`、在 attached 里 `wx.createSelectorQuery().select('.box').boundingClientRect()`——各犯什么错？该放哪？

**6.** 弹窗组件用 `wx:if` 控制显隐，关闭再打开后"上次的表单草稿没了"，从组件生命周期解释；给出 hidden 与状态提升两种对策及代价。

**7.** 组件内倒计时 `setInterval` 在 ready 里启动，但从未清理。页面 navigateBack 后偶发 `setData: page not found` 类告警，解释链路并给出修复位置。

**8.** 组件里写了顶层 `onShow() { /* 刷新 */ }` 期望页面显示时刷新，无效。改成什么？

**9.** price 的 observer 里 `this.setData({ price: (v/100).toFixed(2) })` 想让显示带两位小数，结果工具报"数据循环更新"，为什么？正确写法？

**10.** 页面 A 用 selectComponent 拿了子实例存到 `this._child`，子组件被 wx:if 销毁后仍调 `this._child.play()`，可能出什么状况？两条规范可避免？

---

## 第二段 · 手写编程（5 小题）

**11.** 实现 `rate-star` 评分组件：properties `value:Number`、`max`（默认 5）；点击第 n 星 `triggerEvent('change', { value: n })`；支持 `ext-class` 外部类定制尺寸。写出四件套核心代码并在页面以受控方式使用（父回写 value）。

**12.** 用"slot + 具名插槽"改造第 11 题：卡片头部标题由父用默认插槽提供、底部按钮进 `slot="footer"`。说明为什么插槽里不能用子组件的 data，并给出一条"把子数据给插槽内容用"的合规链路（事件+父中转）。

**13.** 写 behavior `exposure`（曝光埋点）：attached 里用 IntersectionObserver 监听根节点，50% 可见超 1s 时 `triggerEvent('expose')` 并 disconnect；detached 里释放 observer。给出组件侧 `behaviors: [exposure]` 的接入示例。

**14.** 用 `observers` 实现表单组件内 `province + city` 联合观察：两者都非空才拼 `regionText` 写入另一个 data 字段（注意：properties 初始赋值不会触发 observer，如何补偿初始值？）。

**15.** 实现命令式 `toast-box` 组件：对外只暴露方法 `show(msg)/hide()`（组件内部自管 2s 自动消失与定时器清理），父页通过 selectComponent 调用。对比"properties visible 驱动"版，各写一行使用代码并评述受控/非受控取舍。

---

## 第三段 · 场景题（1 小题）

**16.** 为直播间设计组件树与通信方案：`live-room`（页面）下有 `video-panel`、`chat-list`（高频消息流）、`product-card`（讲解中商品）、`like-button`（飘心）。要求：① 画出数据流向（哪些是下行 properties、哪些是上行 triggerEvent、页面 store 该放什么）；② chat-list 每秒多条消息，用 mp-setdata 原理给出"组件自治+分片 setData"方案；③ 页面 onHide 时 video/chat 各自要做什么（pageLifetimes）；④ 产品要求"进房间后离开再进，点赞动画不残留"，用生命周期解释该注意什么。

---

## 第四段 · 简答题（3 小题）

**17.** properties 五条"宪法"（只读/类型转换/命名互转/引用陷阱/observer 时机）各是什么？

**18.** triggerEvent 第三参 bubbles 与 composed 的区别？不透传时父还能用什么方式拿到子的行为（列两种）？

**19.** behavior、纯函数 utils、store 三种"逻辑复用"手段的选择依据各一句。

---

## 第五段 · 挑战题 🏆

**20.** 造一个"分页列表容器组件" `list-page`：properties 接收 `fetcher`？——函数不可序列化进 properties（type 不支持！），请你自己设计合规接口（如组件只负责渲染+触底事件 `bind:loadmore`，数据由父管理，或 behavior 方案 `listBehavior` 提供 load-more 状态机：page/size/loading/finished/error 六态 + `fetchPage` 约定）。要求：① 用 behavior 实现状态机并说明为何 behavior 优于纯组件（父要复用滚动容器 UI 时再嵌一层组件）；② 处理"请求竞态"（requestId 丢弃过期回包，呼应 react-effect-patterns）；③ finished 后不再触发、error 时展示重试按钮（slot 或方法）；④ 写 50 字评述：这个组件的"受控度"你打几分，为什么。
