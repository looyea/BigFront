# tabBar 与多页结构

> 目标：tabBar 是小程序的"导航骨架"——它不只是 app.json 里那段配置，更定义了**"每个 tab 一条独立页面栈"**的运行模型。本课讲：list 配置全字段与图标规格、徽标 API、**自定义 tabBar**（用组件接管底栏）的代价与用法、以及 tab 页与分包首页的关系（呼应 **mp-directory** 配置、**mp-route** 页面栈、**vue-router-nested-dynamic** 的布局嵌套心智）。

---

## 一、tabBar 配置全解（app.json）

```json
{
  "tabBar": {
    "color": "#7A7E83",
    "selectedColor": "#07c160",
    "backgroundColor": "#ffffff",
    "borderStyle": "black",
    "position": "bottom",
    "list": [
      { "pagePath": "pages/home/home", "text": "首页",
        "iconPath": "images/home.png", "selectedIconPath": "images/home-on.png" },
      { "pagePath": "pages/me/me", "text": "我的",
        "iconPath": "images/me.png", "selectedIconPath": "images/me-on.png" }
    ]
  }
}
```

硬约束（审核与运行都会查）：

- **2 ~ 5 个** tab；`pagePath` 必须已在 `pages` 中注册；
- 图标：建议 **81×81px、png、无动画、≤40KB**（官方规格），过大徒增包体（呼应 mp-subpackage 体积预算）；
- 首页永远是 `pages` 数组第一项（tab 首页也一样，呼应 mp-directory）；
- 修改 tabBar 配置**需要重启开发者工具**才生效——热重载不覆盖它，新手常以为"改了没用"。

---

## 二、tab 页的运行模型（比配置更重要）

1. **每个 tab 一条独立页面栈**：首页 push 详情 A → 切到"我的" → 切回首页，仍停在详情 A（栈被保留）；
2. tab 页生命周期特殊：**首次进入 onLoad+onShow，之后切换只有 onShow/onHide，永不 onUnload**（除非 reLaunch/小程序销毁）——所以 tab 页的"返回后刷新"逻辑天然该写 onShow（呼应 mp-lifecycle 第三节）；
3. **切 tab 会销毁非 tab 页**：在详情页点 switchTab，该页直接 onUnload（呼应 mp-route 面试第 5 题）；
4. `onTabItemTap` 是唯一挂在 Page 上的 tab 事件（当前页即 tab 页才触发，可拿 index/pagePath/text）。

对照 Vue：tabBar ≈ "带 KeepAlive 的顶层布局路由"——tab 页实例常驻、状态保留；但它是**运行时托管的原生底栏**，不是你可随意嵌模板的组件（自定义 tabBar 除外，见第四节）。

---

## 三、徽标与运行时操作

```js
wx.setTabBarBadge({ index: 2, text: '5' });      // 红点数字（text 最多 3 字符显示）
wx.removeTabBarBadge({ index: 2 });
wx.showTabBarRedDot({ index: 0 });               // 小红点
wx.setTabBarStyle({ selectedColor: '#ff0000' }); // 运行时改样式
wx.hideTabBar({ animation: true });              // 沉浸态可临时藏起底栏
```

经典用法：未读消息数在**别的页面**也能给 tab 加角标（API 按 index 全局操作）；角标数据源应在登录/推送刷新时统一重算（呼应 mp-interaction 的"出口唯一"）。注意：这些 API **对自定义 tabBar 无效**——自定义后要自己同步状态。

---

## 四、自定义 tabBar：midButton 之外，用组件接管一切

需求超出"图标+文字+角标"（如中央凸起相机按钮、选中动画、云主题皮肤）时：

```json
// app.json：仍要写 list（页面归属仍由它定义），外加
"tabBar": { "custom": true, "list": [ /* 同上，仍必填 */ ] }
```

```text
// 固定路径四件套（官方要求，名字不能改）：
custom-tab-bar/index.js  .wxml  .wxss  .json
```

```js
// custom-tab-bar/index.js —— 它就是普通 Component
Component({
  data: { selected: 0, list: [ /* 自己的菜单数据 */ ] },
  methods: {
    onTap(e) {
      const { index, pathtext } = e.currentTarget.dataset;
      wx.switchTab({ url: pathtext });
    },
  },
});

// 每个 tab 页 onShow 里同步选中态（官方文档示例做法）：
onShow() {
  const tabBar = this.getTabBar();     // tab 页专属 API
  if (tabBar) { tabBar.setData({ selected: 1 }); }
}
```

三条代价须知：

1. **每页 onShow 手动同步 selected**——原生底栏帮你做的事（高亮跟随）现在自己维护，漏写就是"切了页底栏没跟上"的错位 bug；
2. list 配置仍必填（页面归属、switchTab 合法性判断靠它），**custom 只是换掉"绘制"**；
3. 底栏出现/消失、高度计算都要自理（`position: fixed` 占位），iOS 安全区记得 `env(safe-area-inset-bottom)`（呼应 mp-wxss 适配）。

---

## 五、tab 页与分包的关系

- **tabBar 页必须在主包**（底栏常驻，不能等分包下载）——"分包做 tab 首页"是不成立的；
- 分包页**可以**把自己页面的 `navigationStyle` 伪装、或用自定义"假底栏组件"做出 tab 观感，但切换语义是 redirectTo 替换而非保栈；
- 想给某 tab 下钻内容瘦身：tab 页留主包、它的深层页面进分包（呼应 mp-subpackage 的"入口留主包"策略）。

---

## 六、自检清单

- [ ] tab 数量、图标规格、pagePath 注册这三类硬约束各是什么？
- [ ] 切 tab 时非 tab 页发生什么？tab 页会 onUnload 吗？
- [ ] setTabBarBadge 对自定义 tabBar 有效吗？
- [ ] 自定义 tabBar 的固定目录/文件名是什么？每页要补什么代码？
- [ ] 为什么 tabBar 页不能进分包？

---

## 🚀 部署预告

- tabBar 的本质是"运行时托管的顶层导航 + 每 tab 独立保栈"，自定义是把它降级成普通组件、责任回到你身上；
- L4 还差最后一块拼图——**mp-communication**：页面间通信全家桶（globalData、eventChannel、getCurrentPages、事件总线与缓存），把 mp-route 面试第 7 题的清单逐条落地（呼应 vue-provide-inject、react-context）。
