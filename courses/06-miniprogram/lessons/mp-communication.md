# 页面间通信

> 目标：页面是**相互隔离的 WebView 实例**（mp-overview 的余波），所以"通信"必须借道公共媒介。本课把六条通道逐一定性——url 参数、globalData、Storage、`getCurrentPages()`、**eventChannel**、事件总线——给出选型矩阵，并讨论"要不要在小程序里引入状态管理"（呼应 **vue-provide-inject**、**react-context**、**mp-route** 面试第 7 题的清单兑现）。

---

## 一、六条通道总览

| 通道 | 方向 | 生命周期 | 典型场景 | 风险 |
|---|---|---|---|---|
| url query | 去程（A→B） | 一次性 | 传 id、来源标记 | 全是字符串、长度 |
| globalData | 任意↔任意 | 小程序实例存续期 | 登录态、系统信息 | 重启丢失、无更新通知 |
| Storage | 任意↔任意 | **持久**（跨启动） | 草稿、偏好设置 | 异步 IO、10MB 限额 |
| getCurrentPages() | 双向拿实例 | 页面存续期 | 返回前调上一页方法 | 强耦合，重构杀手 |
| eventChannel | 双向（限 opener↔opened） | 本次跳转存续期 | 选货返回、回传表单 | 只连"亲子"两页 |
| 事件总线（自建/App 上挂 Emitter） | 任意↔订阅者 | 手动管理 | 全局广播（支付成功刷新多页） | 忘解绑=泄漏 |

前两条与 Storage 已在 mp-route/mp-storage 出现，本课聚焦后三条。

---

## 二、getCurrentPages()：拿到"活的"页面实例

```js
const pages = getCurrentPages();          // 页面栈数组，栈底在前
const prev = pages[pages.length - 2];     // 上一页实例
// 读写数据（注意：改 data 后仍需其自行 setData 才上屏）
prev.setData({ needRefresh: true });
// 或直接调其方法
prev.fetchList?.();
wx.navigateBack();
```

能力很大、责任很大：

1. 你依赖了"上一页恰好是谁"——页面栈一变（产品插了一页）代码就错；**只用于相邻栈页**、或按 `page.route` 判等再用；
2. 拿到实例直接改 `prev.data.xxx` 不触发渲染（教训呼应 mp-setdata 第一节）——必须走它的 setData；
3. tab 页/栈底页可能不是你预期的那个实例，先 `route` 校验。

对照 React：像极了"把函数组件实例存进全局让你随便调 setState"——能做，但社区会追杀你（正确的解耦版是 Context/回调，呼应 react-context）。

---

## 三、eventChannel：官方钦定的"回传通道"

场景：A 页 `navigateTo` B 页（如地址选择器），B 选好要**把结果带回 A**且 A 不重载。

```js
// A 页：跳转时挂监听
wx.navigateTo({
  url: '/pages/address/pick',
  events: {
    onPicked(addr) {            // B 回传的数据
      this.setData({ 'form.address': addr });
    },
  },
});

// B 页：接收与回传
Page({
  onLoad() {
    this.getOpenerEventChannel().emit('onPicked', {
      name: '张三', phone: '138...', detail: '...',
    });
    // 也能监听 A 传来的：this.getOpenerEventChannel().on('preset', fn)
  },
});
```

要点：

- **官方为"返回回传"设计的唯一一等公民**——事件名约定式，数据即发即收，无需全局状态；
- 通道只连 opener/opened 这一对；三页链式（A→B→C 回 A）需逐跳转发，或者换全局方案；
- 监听 `events` 定义在 **navigateTo 的 option** 里，别和组件的 triggerEvent 混（那是组件间，见 mp-component-comm）；
- Taro/uni 的"路由传参钩子"底层就是它（呼应 mp-framework）。

---

## 四、事件总线：小程序没有内置，自己造一个

全局广播（例：任意页完成支付 → 首页/订单页/角标同时刷新），globalData 没有"变化通知"，用发布订阅补齐：

```js
// utils/bus.js —— 20 行迷你 Emitter
const handlers = {};
export const bus = {
  on(evt, fn) { (handlers[evt] ??= new Set()).add(fn); return () => this.off(evt, fn); },
  off(evt, fn) { handlers[evt]?.delete(fn); },
  emit(evt, payload) { handlers[evt]?.forEach((f) => { try { f(payload); } catch (e) { console.error(e); } }); },
};

// 发布者（支付成功页）
bus.emit('pay:success', { orderId });
// 订阅者（首页）
Page({
  onUnload() { this._offPay?.(); },              // 必须解绑！
  onLoad() { this._offPay = bus.on('pay:success', this.refresh); },
});
```

纪律三条：**① on 必配对 off（onUnload/onHide 解绑，否则回调里 this 指向已销毁页面，setData 报错/幽灵刷新）；② 事件名常量化（散字符串迟早打错）；③ 别用它传大数据**——它传引用，但订阅者销毁时机不可控，数据归属仍要清晰。

对照 Node：这就是 **EventEmitter**（node-events 那一课的技能直接平移；小程序连 `once/removeAllListeners` 都得自己补）。Vue3 删了实例事件总线、React 靠库，而小程序社区方案本质都是自己写 emitter。

---

## 五、要不要"小程序状态管理"？

- 全局低频（登录态、主题）：**globalData + App.onShow 校准**足够；
- 多页共享且**要变化通知**：事件总线 → 再进一步就是 "store + 订阅 setData" 模式：社区成熟方案有 mobx-miniprogram、mobx-miniprogram-bindings 等（数据变了自动算、页面绑定自动 setData）；不必追新——自己写 30 行"store：state + subscribe + 页面 onLoad 订阅 onUnload 退订"已覆盖大多数场景；
- 判断标准与 React 完全一致：**"这个状态需要几个不相关的页面读、且要求响应变化？" ≥3 且要求通知 → 上 store；否则参数/回调足够**（呼应 react-state-mgmt 的"别把所有东西放全局"、vue-pinia 适用边界）。

---

## 六、自检清单

- [ ] 六条通信通道各自的"方向/寿命/风险"能默写吗？
- [ ] eventChannel 的连接范围与三页链式的局限？
- [ ] getCurrentPages 拿到的实例，直接改它的 data 为什么不上屏？
- [ ] 事件总线最容易漏的生命周期动作是什么？
- [ ] 什么信号出现才值得引入 store？

---

## 🚀 部署预告

- L4 收官：路由（怎么去）、tabBar（顶层骨架）、通信（怎么带数据）三位一体，"多 WebView 页面应用"的地图完整了；
- 下一站 **L5 自定义组件**：从 `Page` 走向 `Component` 构造器——properties、数据方法、样式隔离落地，把 vue-component-basics / react-component 的组件心智做第四次翻译（呼应 mp-component）。
