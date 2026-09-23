# L7 课后作业 · 存储、分包与性能

> 覆盖：Storage 缓存设计、分包策略、性能度量与优化。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 冷启动代码有什么问题（从启动耗时角度两条）？
```js
// app.js 顶层
const conf = wx.getStorageSync('dict');       // 800KB 字典
const token = wx.getStorageSync('token');
initAnalytics(); initMap(); initIm();          // 全部同步串行
App({ onLaunch() { this.checkLogin(); } })
```

**2.** 为什么这段"读缓存"在另一个用户手机上直接崩了？给出容错写法。
```js
const user = JSON.parse(wx.getStorageSync('user'));
this.setData({ nick: user.profile.nickName });
```

**3.** cache 用量报警：`currentSize` 显示 9800KB。翻代码发现一个 key 存了 900KB，最可能存的是什么？两种正确归宿？

**4.** 分包报错 `cannot find packageB/xx`：packageA 页面 json 里 `"usingComponents": { "vip-tag": "../packageB/components/vip-tag" }`，为什么非法？两条改法？

**5.** 独立活动包里写了 `const { request } = require('../../utils/request.js')`，开发工具正常、线上直落该包用户白屏，为什么？

**6.** 列表页每 100ms setData 一次轮询订单状态（只关心一个 status 字段），指出三宗罪并给修法（含"页面不可见时暂停轮询"）。

**7.** 首页体验评分报"setData 数据量过大 480KB"。data 里有：goodsList(30条)、bannerList、categories、**rawApiResponses(调试遗留)**、userInfo。删哪个、拆哪个、缓哪个？

**8.** 商品详情主图用 `<image style="width: 100%">` 不写高度，图片加载完成瞬间页面"跳一下"，为什么？改法两条？

**9.** 把 moment.js 全量引入主包只为了格式化两种日期，说出体积问题与两个替代方案（含 wxs 思路）。

**10.** 用户投诉"小程序越用越卡，杀掉重开就好了"。列两个最可能成因（与缓存和内存各一）与对应排查工具。

---

## 第二段 · 手写编程（5 小题）

**11.** 给 mp-storage 第三节的 cache.js 补两个能力：① `setJSON(key, v, ttl)` 循环引用/函数探测失败时降级只存可序列化部分并告警；② sweep 增加"按容量驱逐"——超过预算 8MB 时按过期时间近→远删除带 TTL 的 key（不许动不过期的）。写代码。

**12.** 为项目切分包：首页/分类/tab 我的 在主包；下单流程 4 页、售后流程 3 页各自分包；抽奖活动独立分包。写出 app.json（pages/subPackages/preloadRule/requiredBackgroundModes 之外任选合理项），并写一段 50 字的切分理由。

**13.** 实现"二段 setData"首屏优化：首页 onLoad 先 `setData({ fromCache: true, ...cache.get('home') })` 秒出骨架内容，接口回包后只对**变化的 key** 做路径更新并回写缓存（提示：diff 函数自己写 10 行内）。

**14.** 用 `wx.getPerformance()` 思路写一个"页面打开耗时"打点：路由起点取 `performance.getEntries` 相应条目、终点在首屏数据 setData 回调，输出 `{route, cost, fromCache}` 并上报（console 占位）。说明为什么终点不能打在 onLoad。

**15.** 给第 13 题加"防回潮"：写一个开发者工具体验评分脚本化思路（description：如何用 `miniprogram-ci` 上传时同步跑审计并把分数写进构建产物 metadata），伪码 20 行内。

---

## 第三段 · 场景题（1 小题）

**16.** 社区团购小程序大促复盘数据：冷启动 P75=4.1s（主包 1.95M，含 600KB 图片与全量商品缓存字典）、首页可交互 P75=6.8s（onLoad 串行 3 接口、回包一次 setData 620KB）、团长端长列表(2000 行)FPS<30、活动页分享直落白屏 3s。请分四个问题各给：根因假设 → 验证手段（工具/指标）→ 优化方案（引用具体课程小节）→ 预期指标改善。这是你作为性能负责人的第一份报告。

---

## 第四段 · 简答题（3 小题）

**17.** Storage/globalData/后端三层各自的数据定位一句话+一个典型字段例子。

**18.** 主包、普通分包、独立分包三者的"依赖方向"规则分别是什么？

**19.** Skyline 迁移评估列哪三类风险？（样式兼容/组件清单/回退策略展开）

---

## 第五段 · 挑战题 🏆

**20.** 设计"轻量离线包"方案：把"字典+首页第一屏配置"打进一个**随版本发布的 JSON 资源文件**（构建期从后端导出），端上启动读它（分包或主包）作为 0 号缓存，接口回包后写 Storage 作 1 号缓存，下次启动优先 1 号并后台校准。要求：① 数据流图（构建期→冷启动→热启动→无网四级降级）；② 版本号/字段 schema 校验失败的回退逻辑；③ 对比"纯接口、纯缓存、本方案"三者的首屏耗时与一致性，写 100 字决策建议（呼应 vite 预渲染思想、react-data-fetching 的 initialData、mp-subpackage 资源归属）。
