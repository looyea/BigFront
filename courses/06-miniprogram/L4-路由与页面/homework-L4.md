# L4 课后作业 · 路由与页面

> 覆盖：五种跳转与页面栈、tabBar 配置与自定义、页面间通信六通道。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 点"去购物车"毫无反应，vConsole 只有一条 warning，指出错误：
```js
goCart() { wx.navigateTo({ url: '/pages/cart/cart' }); }  // cart 在 tabBar.list 里
```

**2.** 这段跳转的参数接收有什么隐患（列 2 个）？
```js
wx.navigateTo({ url: `/pages/detail/detail?id=${userInput}&from=${JSON.stringify(cfg)}` });
```

**3.** 用户反馈："我在首页进详情，切到'我的'再切回来，详情竟然要我重新加载"。从"tab 保栈"角度这正常吗？可能的真实原因？

**4.** 找错：
```js
onLoad() {
  const prev = getCurrentPages()[0];      // 想拿"上一页"
  prev.data.list.push(this.data.newItem); // 以为这样能更新上页
}
```
（两处错）

**5.** 退出登录要"清掉所有页面回到首页"，有人写了三次 navigateBack，为什么不对？该用什么？

**6.** 自定义 tabBar 后角标不显示了，为什么？给出两种解决方向。

**7.** 支付成功页 emit('pay:success') 后，已退到后台的首页仍收到并 setData，控制台开始偶发报错。总线实现漏了什么机制？首页代码漏了什么？

**8.** 登录页 `wx.navigateTo({ url: '/pages/home/home' })`（home 是 tab 页）失败后，有人改用 reLaunch"能跳就行"，说出这个改法的副作用。

**9.** 页面 A 的 onLoad 里 `this.getOpenerEventChannel().on('preset', fn)` 报 `getOpenerEventChannel is not a function`，最常见的原因是什么？

**10.** 下拉刷新里的数据被别页通过 globalData 改过的字段覆盖了（旧值），说出这种"globalData 双写"竞态的一种治理思路。

---

## 第二段 · 手写编程（5 小题）

**11.** 用五种路由 API 各写一行调用，并逐行注释"页面栈前后变化 + 触发了哪些生命周期钩子"（含被离开页）。

**12.** 实现"地址选择器"回传：列表页 navigateTo（带 `events.onPicked`）→ 选择页 onLoad 拿到 eventChannel、点行 emit 选中项后 navigateBack；列表页收到后**路径更新**对应订单行的 address 字段。写出两侧关键代码。

**13.** 写出 20 行的迷你事件总线（on/off/emit，on 返回退订函数），并写一个页面用例：onLoad 订阅、onUnload 退订、emit 时 try/catch 保护。

**14.** app.json 配置题：手写含两个 tab（首页/我的）的 tabBar 完整配置（颜色/图标字段齐全），并把首页设为"页面第一项、导航标题白底黑字"，我的页单独设为灰底——检验 pages/window/tabBar 三块配置的嵌套位置。

**15.** 给"游客 2 tab / 会员 4 tab"需求写实现：保留原生 tabBar，用 `wx.setTabBarItem`+`hideTabBar/showTabBar` 无法删减项数，请改用**自定义 tabBar**：写出 custom-tab-bar/index.js 里按 `getApp().globalData.isVip` 过滤 list 渲染、以及 tab 页 onShow 同步 selected 的代码。

---

## 第三段 · 场景题（1 小题）

**16.** 外卖小程序流程：首页(店铺列表, tab) → 店铺页(菜品) → 商品详情 → 规格弹窗(你决定用页面还是组件) → 提单页 → 支付 → 结果页 → 返回时要刷新"我的订单"tab 与店铺页销量。请画出页面栈每一步的变化（哪个 API、栈内内容），并指出：① 哪些跳转参数只能传 id、数据谁去拉；② 回传刷新用哪条通信通道、为什么；③ 页面栈会不会触顶 10 层、用户中途切 tab 会发生什么。

---

## 第四段 · 简答题（3 小题）

**17.** navigateTo/redirectTo/reLaunch/switchTab 对"当前页 onUnload vs onHide"的影响分别是？

**18.** tab 页为什么"只 onShow 不 onLoad"？这决定了什么代码必须写在 onShow？

**19.** eventChannel 与事件总线各自的边界（连接范围/寿命/耦合度），一句话各总结一条"永远别用"的反场景。

---

## 第五段 · 挑战题 🏆

**20.** 实现"路由守卫+"封装：`route.js` 导出 `push(url, { auth?: boolean, params?: object })`，功能：① params 自动序列化编码、配对 `parseQuery(query, schema)` 解码并转型（schema 如 `{ id: Number, tab: Number }`）；② auth 为真而未登录时重定向登录页并把目标 url 带参传递、登录成功后 redirectTo 原目标（含参数还原）；③ 每次跳转自动埋点（route/参数/时间戳，先 console.log 占位）。要求：写全三个函数并演示"未登录进订单详情→登录→回原页参数完整"的时序；论述与 vue-router beforeEach、React Router loader 的能力差在哪（跨包呼应 vue-router-guard-lazy、react-router-data）。
