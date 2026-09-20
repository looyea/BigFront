# 应用与页面生命周期

> 目标：生命周期决定"哪段代码在什么时候跑"——放错钩子是小程序最常见的隐性 bug。本课讲两层：`App` 的 `onLaunch/onShow/onHide/onError`，`Page` 的 `onLoad/onShow/onReady/onHide/onUnload`，以及 `onPullDownRefresh/onReachBottom/onShareAppMessage` 等页面事件钩子。重点辨析 **onLoad vs onShow 的调用次数差异**、冷启动/热启动时序、页面栈对触发的影响。呼应 **vue-lifecycle**（created/mounted/unmounted）、**react-component**（effect 挂载/卸载）。

---

## 一、App 级生命周期（全局一次）

```js
App({
  onLaunch(options) { /* 小程序初始化，冷启动只跑一次 */ },
  onShow(options)   { /* 小程序从后台到前台 / 进入 */ },
  onHide()          { /* 从前台到后台 */ },
  onError(err)      { /* 全局 JS 报错、api 异常 */ },
  onPageRoute(...)  { /* 路由事件（新版本） */ }
})
```
- **onLaunch**：**冷启动**时触发、**全局仅一次**——做初始化：读缓存、判断登录态、拿系统信息（呼应 mp-login）；
- **onShow/onHide**：小程序**前后台切换**时反复触发，比 onLaunch 频繁；用来暂停/恢复计时器、刷新角标等；
- `options` 携带 `path`、`query`、`scene`(场景值)、`shareTicket` 等——判断"从哪来"（扫码/分享/小程序消息）；
- 一个小程序**只有一个 App 实例**，`getApp()` 获取。

对照 **vue**：`onLaunch`≈`main.js` 顶层 / `created`，`onShow/onHide`≈页面可见性 `visibilitychange`。

---

## 二、Page 级生命周期（每页一组）

```js
Page({
  onLoad(query) {},     // 加载：解析参数、初始化数据，仅一次
  onShow() {},          // 显示：每次进入该页都触发
  onReady() {},         // 首次渲染完成：可安全操作节点/查询布局
  onHide() {},          // 隐藏：被切走(未销毁)时
  onUnload() {},        // 卸载：navigateBack/被销毁时，清理
})
```

触发顺序（进入一个页面）：`onLoad → onShow → onReady`（首绘完成）。离开：`onHide`（被压栈/切走，未销毁）或 `onUnload`（真正销毁）。

---

## 三、onLoad vs onShow（头号易错点）

| | onLoad | onShow |
|---|---|---|
| 触发次数 | 页面生命周期内**仅一次** | **每次**显示该页都触发 |
| 参数 | 拿到 url 的 query | 无（要参数请存 onLoad 里） |
| 典型用途 | 解析入参、初始 setData | 从后台返回、别的页改了数据后**刷新** |

经典 bug：列表页跳详情、返回后列表要刷新——**刷新逻辑写在 onShow 才生效**，写 onLoad 不会再次触发（页面没重载，呼应 mp-route 页面栈）。这与 React "同路由换参数不重挂载"、Vue keep-alive `activated` 是同一类心智（呼应 react-router-basics 第 8 题、vue-lifecycle）。

---

## 四、冷启动 / 热启动完整时序

**冷启动**（首次/被销毁后打开）：
`App.onLaunch → App.onShow → Page.onLoad → Page.onShow → Page.onReady`

**切后台再回前台**：`App.onHide → App.onShow`（页面的 onShow 视情况，返回当前页也会 onShow）

**navigateTo 到新页**：当前页 `Page.onHide` → 新页 `onLoad→onShow→onReady`；**navigateBack 返回**：被返回页 `onUnload` → 上一页 `onShow`（不是 onLoad！）。

---

## 五、页面事件钩子

```js
Page({
  onPullDownRefresh() { /* 下拉刷新，处理完 wx.stopPullDownRefresh() */ },
  onReachBottom() { /* 触底：分页加载 */ },
  onShareAppMessage() { return { title, path }; },  // 转发
  onPageScroll(e) { /* 页面滚动 */ },
  onTabItemTap() { /* 点 tabBar（仅 tab 页） */ }
})
```
- 需在 `json` 里开启才生效（如 `enablePullDownRefresh`、`onReachBottomDistance`）；
- `onLoad/onShow/onReady` 只属于 Page，`Component` 用另一套（`created/attached/ready/detached`，见 mp-component-lifecycle）。

---

## 六、自检清单

- [ ] onLaunch 和 onShow 触发次数差别？初始化放哪个？
- [ ] onLoad vs onShow：为什么"返回后要刷新"该写 onShow？
- [ ] 冷启动的完整触发顺序是什么？
- [ ] navigateBack 后上一页触发 onLoad 还是 onShow？
- [ ] 哪些钩子需要在 json 里显式开启？Component 用的是同一套吗？

---

## 🚀 部署预告

- 本课把"全局 App 一次、页面各一组、onShow 反复触发"的时序钉死，避免参数/刷新类 bug；
- L1 三关收官。下一关进入 **L2**：WXML / WXSS 与数据绑定——先讲 **mp-wxml** 模板语法：`{{}}` 插值、运算、属性绑定、wxs，呼应 vue-template-syntax 与 react-jsx 的对照。
