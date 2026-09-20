# 交互与反馈 API

> 目标：toast、modal、loading、actionSheet、下拉刷新……这些"告诉用户发生了什么"的反馈，小程序**不用画组件**，全是 `wx.xxx` 原生 API——由 Native 层渲染，**不走 setData、不受页面栈布局约束**。本课按"轻提示 → 决策 → 操作列表 → 过程反馈"的强度分级梳理，并给出一套统一封装（呼应 **react-effect-patterns** 的封装哲学、**exp-validation** 的错误反馈分层）。

---

## 一、按"打断强度"选型

| 强度 | API | 场景 | 用户动作 |
|---|---|---|---|
| 最轻 | `showToast` | "已保存"成功提示、简单失败 | 无需响应，自动消失 |
| 轻 | `showLoading` / `hideLoading` | 异步进行中（阻塞感） | 等待 |
| 中 | `showActionSheet` | 一组并列操作（删除/分享/举报） | 二选一或多 |
| 重 | `showModal` | 必须决策：确认删除、授权引导 | 确认/取消 |

经验法则：**能让用户自动恢复的用 toast，可能丢数据的用 modal**——与 Web 的"toast vs dialog"同一产品直觉（呼应 react 项目里的 UI 反馈层设计）。

---

## 二、核心 API 速查

```js
// 轻提示：icon: success | error | none（none 才能长文案）
wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });

// 加载中：必须成对，防"转圈永不停"
wx.showLoading({ title: '提交中', mask: true });   // mask 防误触
await submit();
wx.hideLoading();                                   // 放 finally！

// 决策框：回调里看 res.confirm / res.cancel
wx.showModal({
  title: '删除草稿', content: '删除后不可恢复',
  confirmText: '删除', confirmColor: '#fa5151',
  success(res) { if (res.confirm) doDelete(); },
});

// 操作列表：itemList ≤6 项，点击回 res.tapIndex
wx.showActionSheet({
  itemList: ['转发', '收藏', '举报'],
  success: (res) => actions[res.tapIndex](),
});
```

三个易错点：

1. **showToast 与 showLoading 共用一个浮层**——互相顶掉；"loading 结束弹 toast"要 `hideLoading` 之后再 `showToast`（或 `showToast({icon:'none'})` 前清干净）；
2. `mask: true` 只挡**触摸穿透**，挡不住系统返回——长任务仍要做可取消设计；
3. showModal 只有**两个按钮**；三个以上选项换 actionSheet 或自定义弹层（需要输入框？官方没有 prompt——只能自定义 modal 组件，这是与 `window.prompt` 的世界差异）。

---

## 三、过程反馈的"页面级"API

```js
// 下拉刷新收尾（在 onPullDownRefresh 里，呼应 mp-lifecycle 第五节）
Page({
  async onPullDownRefresh() {
    try { await this.fetchList(); }
    finally { wx.stopPullDownRefresh(); }   // 忘了收 = 转圈永不停
  },
});

// 设置/恢复顶部胶囊"..."按钮的能力（转发菜单，呼应 mp-openapi）
wx.showShareMenu({ withShareTicket: true });
// 视觉反馈类
wx.vibrateShort({ type: 'light' });  // 轻震动：敏感操作确认手感
wx.setBackgroundColor({ backgroundColorTop: '#fff' });  // 下拉露出的底色
```

选择器要点：**页面过程态（刷新/触底）用页面钩子+配套 stop API；瞬时反馈用全局 wx API；强业务交互（评论面板）才值得自定义组件**——三级成本递增。

---

## 四、统一封装：utils/feedback.js

裸调 wx API 的三大痛：回调地狱、loading 泄漏、文案散落。封装成 Promise 化的 utils（对标 **09-express** 的错误处理中间件思路：反馈出口唯一）：

```js
// utils/feedback.js
export const toast = (title, icon = 'none', duration = 2000) =>
  new Promise((r) => wx.showToast({ title, icon, duration, success: r, fail: r }));

export const loading = {
  _on: false,
  show(title = '加载中') { if (!this._on) { this._on = true; wx.showLoading({ title, mask: true }); } },
  hide() { if (this._on) { this._on = false; wx.hideLoading(); } },
};

export const confirm = (content, title = '提示') =>
  new Promise((resolve) =>
    wx.showModal({ title, content, success: (res) => resolve(!!res.confirm), fail: () => resolve(false) })
  );

// 业务侧：
// if (await confirm('删除后不可恢复')) { ... }
// 所有请求拦截器里 loading.show()/finally hide()（呼应 mp-network）
```

封装三原则：**① Promise 化（await 一条链）；② 幂等（loading 计数/布尔防重复 show）；③ 出口唯一（错误文案在拦截器统一映射，页面不写死）**（呼应 node-async-errors 的"错误路径单点"）。

---

## 五、自检清单

- [ ] toast/loading/actionSheet/modal 的打断强度排序与各自适用？
- [ ] 为什么 hideLoading 必须放 finally？
- [ ] showToast 和 showLoading 同时出现会怎样？
- [ ] 想要"带输入框的弹窗"，官方 API 有吗？怎么办？
- [ ] onPullDownRefresh 忘了 stopPullDownRefresh 的现象？

---

## 🚀 部署预告

- L3 收官：去程 setData、回程 events、反馈走原生 API——"人机交互环"闭环；
- 下一站 **L4 路由与页面**：先 **mp-route**——五种跳转 API 各管什么、页面栈 10 层上限、tabBar 页为什么不能 navigateTo（呼应 vue-router-basics、react-router-basics 的路由心智迁移）。
