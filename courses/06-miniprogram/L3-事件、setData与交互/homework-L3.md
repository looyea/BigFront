# L3 课后作业 · 事件、setData 与交互

> 覆盖：事件系统与 dataset、setData 原理与性能、交互反馈 API 与封装。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 点击"编辑"按钮，控制台报 `Component 'pages/todo/todo' does not have a method 'onEdit'` 类似警告，哪里错了？
```wxml
<view bindtap="onEdit({{ item.id }})">编辑</view>
```

**2.** 列表每行结构：`<view data-id="{{item.id}}" bindtap="onTap"> <image src="..."/> </view>`。用户点到图片上时 `e.target.dataset.id` 是 undefined，为什么？该取什么？

**3.** 这段"提交"有什么问题（从交互闭环角度列 2 条）？
```js
async onSubmit() {
  wx.showLoading({ title: '提交中' });
  const res = await api.submit(this.form);
  wx.hideLoading();
  wx.showToast({ title: res.msg, icon: 'success' });
}
```

**4.** 下拉刷新转圈永不停，看代码找漏点：
```js
onPullDownRefresh() {
  api.getList().then((list) => this.setData({ list }));
}
```

**5.** 每次输入一个字符就发一次搜索请求且页面卡，指出两个问题与对应修法（事件侧 + setData 侧各一）。
```js
bindinput(e) {
  this.setData({ kw: e.detail.value });
  api.search(this.data.kw).then((list) => this.setData({ suggest: list, all: this.data.all }));
}
```

**6.** 这段代码执行后，视图为什么没变？逻辑层 `this.data.modal.visible` 是多少？
```js
this.data.modal.visible = true;   // 无 setData
```

**7.** `setData({ user: { age: 18 } })`，原 `user = { name:'Tom', age: 1 }`，之后 `this.data.user.name` 是什么？这是深合并吗？

**8.** 一个页面同时绑了 `bindtap="a"` 和外层 `catchtap="b"`（b 在 a 的祖先上），点 a 所在节点，哪些 handler 会执行？如果把 catch 换成 bind 呢？

**9.** setData 里带了接口返回的完整大对象（含 200KB 的原始 json 与一张 base64 图），页面只要其中 5 个字段。指出问题并给原则。

**10.** showActionSheet 传了 8 个 itemList 项，会发生什么？想在 toast 显示 12 个汉字的长文案，icon 该选什么？

---

## 第二段 · 手写编程（5 小题）

**11.** 用"事件委托"实现待办列表：容器绑一个 `bindtap`，每行只有 `data-id` 和 `data-action`（'done'/'del'），一个 handler 分发勾选与删除；删除需 `wx.showModal` 确认后生效。写出 wxml+js。

**12.** 实现"编辑昵称"最小闭环：input `bindinput` 用**路径更新**同步到 `data.form.nick`（表单字段是对象），点保存按钮读取并 toast 结果。说明为什么这里逐键 setData 可以接受、而联想搜索不行。

**13.** 手写 `utils/feedback.js` 的 `confirm(content)`（Promise 化 showModal，resolve boolean）与 `loading`（引用计数版 show/hide），并用它改写第 3 题的 onSubmit，使失败也能收起 loading 且弹错误 toast。

**14.** 为第 13 题的 loading 引用计数写一个 3 行验证代码：并发调用两次 show、一次 hide，断言 loading 仍在；再 hide 一次才真关。口述如何观测（vConsole/现象）。

**15.** 倒计时组件页面版：每秒 `setData({ timeText })`（格式 mm:ss）。① 写出 setInterval 的启动与 onUnload 清理（呼应 mp-lifecycle）；② 有人建议"每秒把整个 `{h,m,s,text}` 对象都 setData"，用跨线程成本反驳并给出只传字符串的写法。

---

## 第三段 · 场景题（1 小题）

**16.** 电商购物车页体验审计：页面 data 里挂着完整 500 条商品原始数据；每次改数量都 `setData({ cart: 整个新数组 })`；数量加减按钮每行各绑一个 handler 且用闭包思路传参失败后改成每行塞 JSON 字符串到 data-cart-item；接口失败静默无提示；删除无确认直接删。请逐条给出整改方案（≥5 条），并注明各自依据（dataset 规范 / 路径更新 / 事件委托 / 反馈强度选型 / modal 决策场景）。

---

## 第四段 · 简答题（3 小题）

**17.** 一次 setData 从调用到像素变化经历了哪五步？为什么说它的成本模型 ≈ React 重渲染 + RPC？

**18.** bind/catch/capture-bind/capture-catch 的语义矩阵是什么？小程序里为什么没有 `stopPropagation()` 方法？

**19.** showToast/showLoading 为什么不能"同屏共存"？hideLoading 的幂等封装怎么做？

---

## 第五段 · 挑战题 🏆

**20.** 设计"全局反馈 + 请求拦截"一体化方案：`utils/request.js` 封装 wx.request 为 Promise，支持 `{ loading?: boolean, toastError?: boolean }` 选项；loading 用引用计数、错误按 `errMsg/statusCode → 人话文案表` 自动 toast，页面代码完全不再出现 wx.showToast/hideLoading。要求：① 写出 request.js 核心代码；② 演示两个并发请求（一个失败）下 loading 与提示的正确时序；③ 论述这套"反馈出口唯一"与 Express 错误中间件、React Query 全局 onError 的相通之处（跨包呼应 exp-patterns、react-data-fetching）。
