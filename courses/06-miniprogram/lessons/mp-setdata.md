# setData 原理与性能

> 目标：`setData` 是小程序**唯一的"去程快递"**——逻辑层改数据的一切意图都经它跨线程送达渲染层。它是 90% 小程序性能问题的案发现场。本课拆四件事：一次 setData 完整做了什么、异步语义与回调、**路径更新**的省法、以及"多大算大、多频算频"的红线（呼应 **mp-overview** 双线程、**react-render-model**、**vue-reactivity**）。

---

## 一、一次 setData 的完整旅程

```js
this.setData({ greeting: '你好' })
```

背后五步：

1. **逻辑层**：把 `{ greeting: '你好' }` 与当前 data 合并（浅合并到 key 层）；
2. **序列化**：JSON.stringify 传输内容；
3. **跨线程**：逻辑层 → Native → 渲染层（web 层）；
4. **渲染层 diff**：对比新旧数据，算出最小节点操作；
5. **WebView 更新**：改节点、重排重绘。

结论炸点：**`this.data.xxx = v` 直接赋值不会报错，但视图永远不更新**——它跳过了第 2~5 步的全部意义（数据只在逻辑层内存里）。这是从 Vue/React 迁移者踩的第一坑：**小程序没有"响应式代理"，data 不是 reactive 对象，setData 才是那个"响应式触发器"**（呼应 vue-reactivity 的 Proxy 拦截——两种世界观）。

---

## 二、异步与回调

setData 是**异步**的：调用后 `this.data` 立即是新值（逻辑层已合并），但**页面还没更新完**。

```js
this.setData({ list: newList }, () => {
  // 渲染层确认更新完毕后执行：此处再查节点布局才稳
  wx.createSelectorQuery().select('.first').boundingClientRect();
});
```

三条守则：

1. 想在更新后**读渲染结果**（量高度/截图），放回调或 `wx.nextTick`，别写完立刻查；
2. 回调**不承诺**与 Vue `nextTick` 完全等义——它表示"渲染层已收到并处理"；
3. 连续多次 setData **不会自动合并成一次渲染**（与 React 18 自动批处理不同！），框架仅做队列节流——所以"拆碎连环 setData"不是优化，**合并成一次才是**（呼应 react-usestate 批处理一节）。

---

## 三、路径更新：只寄"变化的那页纸"

```js
// ❌ 改一项标题，把整个 200 条数组重新序列化寄一遍
this.setData({ list: this.data.list });

// ✅ 路径（data-path）更新：只传差异
this.setData({
  'list[2].title': '新标题',
  'userInfo.address.city': '杭州',
  'modal.visible': true,
});

// ✅ 动态路径：先算 key 再 setData（对象展开）
const key = `list[${index}].done`;
this.setData({ [key]: true });
```

路径更新还有**追加**语义吗？没有——它只能定位已存在的下标；往数组尾部加数据，更省的写法是**分页拼接在逻辑层做、只传新页 + 索引指针**，或用 setData 传整段但控制量（视场景）。

**只传视图要用的**：逻辑中间量（临时数组、对象池、原始响应）**存 `this._cache = ...` 普通属性**，别塞 data——不进视图的数据不配占跨线程带宽（这是"VM 模式分离数据"的原生实现，呼应 vue-pinia 的 state 取舍、react 里 state/ref 之分）。

---

## 四、红线：大小与频率

官方性能指南的硬指标：

- **单次 setData 数据 ≤ 1MB 量级要警惕**，传输+序列化成本随体积线性涨；超过会明显卡顿甚至报错；
- **频率**：两次 setData 间隔 < 协议阈值会被合并/排队——高频（逐帧动画、滚动跟值）会产生"通信队列堵塞"，表现为响应延迟；
- 图片 base64、长 JSON 原文塞进 setData = 自杀式写法（base64 一律走文件/网络 URL）；
- 初始化大数据：考虑**分片 setData**（首屏必需字段先行，其余延后一帧）——与 web"关键 CSS 先行"同一思想（呼应 10-vite）。

| 反模式 | 后果 | 正解 |
|---|---|---|
| onReachBottom 里 `setData({list: 全量拼好})` | 传输量随页数平方级膨胀 | 只传新页 + 分页游标 |
| onPageScroll 里 setData scrollTop | 每帧跨线程 | CSS sticky / Skyline 手势 |
| 5 个接口回来各 setData 一次 | 5 轮渲染 | Promise.all 后一次 setData |
| 定时器每秒 setData 整个大对象 | 队列堵塞 | 只传变化的秒数字段 |

---

## 五、setData vs setState vs 响应式（面试必考三连）

| | React setState | Vue 响应式 | 小程序 setData |
|---|---|---|---|
| 触发者 | 状态换新引用 | Proxy setter 拦截 | 显式调用 |
| 视图更新依据 | 重跑组件 + vDOM diff | 依赖收集 + 精确更新 | 渲染层按数据 diff |
| 批处理 | React18 自动 | 微任务队列 | 有限队列节流，**要手动合并** |
| 跨进程 | 否（同线程） | 否 | **是（两线程+Native）** |

一句话：**setData 的成本模型 = React 重渲染成本 + RPC 序列化成本**，所以"少传、合传、传路径"六字是小程序性能第一心法（呼应 mp-performance 将展开首屏链路）。

---

## 六、自检清单

- [ ] 直接 `this.data.x = 1` 为什么视图不动？
- [ ] setData 的回调什么时候必须用？
- [ ] 连续 3 次 setData 会像 React 一样自动批处理吗？
- [ ] 路径更新的三种典型写法？动态下标怎么拼？
- [ ] 哪些数据不该进 setData？放哪？

---

## 🚀 部署预告

- 本课立起全包最重要的一根性能标尺："一切成本看跨线程"；
- 下一关 **mp-interaction**：交互反馈 API（toast/modal/loading/actionSheet/下拉刷新收尾）——都是"官方帮你把 setData 省了"的现成组件，外加把提示封装成 utils 的工程做法（呼应 react-effect-patterns 的封装哲学）。
