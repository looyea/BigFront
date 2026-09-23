# 分包加载

> 目标：小程序把"首屏下载包体"做成硬指标——**整包 2M？不，总包上限 30M、单包（含主包）≤2M**（2024 后逐步放宽至总 30M，以最新文档为准），超限根本传不上去。分包（subPackages）就是把代码按"进入时机"切块：**主包管启动，分包管按需**。这与 10-vite 的 chunk 拆分、React.lazy 是同一灵魂在微信基建上的落地（呼应 **vite-splitting**、**react-performance**、**mp-directory**）。

---

## 一、包体预算与基本模型

```text
dist/
├── 主包（≤2M）        ← 启动必经：app.js/json/wxss、tabBar 页、公共组件、首页
├── packageA/（≤2M）   ← 订单流：下单、地址、售后……
├── packageB/（≤2M）   ← 我的：收藏、足迹、设置……
└── packageC/ 独立分包  ← 活动页：可以不依赖主包直接进
```

- **启动只下载主包**——主包大小 ≈ 冷启动时长下限（体验评分第一杀手，呼应 mp-performance）；
- 页面进入分包页时，微信**自动下载对应分包**（带 loading，用户可感知）；
- tabBar 页必须在主包（mp-tabbar 已论证）；分包**不能引用主包以外其他分包**的代码（可以引主包的）；跨分包共享的东西放主包。

```json
// app.json
{
  "pages": ["pages/home/home"],
  "subPackages": [
    { "root": "packageA", "pages": ["order/list", "order/detail", "address/pick"] },
    { "root": "packageB", "pages": ["me/fav", "me/setting"] }
  ]
}
// 跳转照常：wx.navigateTo({ url: '/packageA/order/list' })  ← 路径即物理目录
```

---

## 二、三板斧

### ① 普通分包：按业务域切

切分依据是**"一次任务流"**而非"技术类型"：把"下单→地址→结果"放一包（进任一页整包下载，内跳转零等待）；组件也随包走（packageA 专用组件就在 packageA 里，别放主包——主包每页都背，呼应 mp-wxss 全局样式同理）。

### ② 预下载规则（preloadRule）：治"第一次进分包要等"

```json
"preloadRule": {
  "pages/home/home": {                 // 当进入首页（本页空闲时）
    "network": "all",                  // wifi | all（蜂窝也下）
    "packages": ["packageA"]           // 提前偷偷下载
  }
}
```

策略直觉：首页预下载"高频下一步"（购物车/下单）；低频角落（设置页）不预下载——预下载吃的是**启动后的空闲带宽**，铺太满反而拖慢交互（呼应 vite-splitting 的 prefetch 取舍）。

### ③ 独立分包（independent）：活动/引流页的快进快出

```json
{ "root": "packageAct", "independent": true, "pages": ["lottery/index"] }
```

- **不依赖主包即可运行**：扫码/分享直落活动页时，只下载活动分包；
- 约束：不能 `require` 主包 js、不能用主包组件/全局样式——活动包要**自包含**（公共部分复制而非共享，"用冗余换独立"，呼应 node-modules 的打包哲学）；
- 活动页里"逛主流程"按钮= navigateTo/switchTab 回主包页（此时主包才加载）。

另有**分包异步化**（`componentPlaceholder` 等）：主包页占位渲染、异步用分包组件——高级选项，理解存在即可。

---

## 三、什么该进主包：一张裁决表

| 内容 | 归属 | 理由 |
|---|---|---|
| tabBar 页 + 其专用组件 | 主包 | 规则+常驻 |
| 启动兜底页（登录/降级） | 主包 | 冷启动必经 |
| request.js / cache.js 等全局 utils | 主包（注意瘦身） | 人人要用 |
| 首页 feeds 组件 | 主包 | 首屏 |
| 二级流程页群（下单/售后） | 对应分包 | 任务流内聚 |
| 活动/抽奖页 | 独立分包 | 直落快、隔离风险 |
| 大体积静态资源 | **谁都不进——上 CDN** | 包体寸土寸金（图片/字体/JSON 数据都别打包，呼应 10-vite 的 assets 外置）|

工具：详情-基本信息里看"包大小构成"、`CI 上传`时报告各包体积；把"主包 ≤1.5M"设成流水线红线（呼应 exp-deploy 的发布门禁）。

---

## 四、常见事故与修复

1. **分包页空白/报错**：分包里以相对路径 `require` 到主包文件层级算错，或跨分包引用（禁止）；
2. **主包莫名超大**：某公共组件 import 了一张 1.8M 启动图——静态资源走 CDN 铁律；
3. **独立分包引用了全局 app.js 逻辑**：independent 页里 `getApp()` 行为异常（主包未必在），能力要自带；
4. **tabBar 页被拖进分包**：编译即报错（呼应 mp-tabbar 第五节）；
5. 分包命名/目录与构建产物混淆：Taro/uni 有各自的分包配置入口，原理一致（呼应 mp-framework）。

---

## 五、自检清单

- [ ] 主包/单分包/总包的体积上限量级？启动下载什么？
- [ ] 分包能引用别的分包吗？独立分包的"独立"独立到什么程度？
- [ ] preloadRule 解决什么问题、代价是什么？
- [ ] 图片、大 JSON 的正确归宿在哪？
- [ ] 一次任务流为什么要放同一分包？

---

## 🚀 部署预告

- 分包的心法与代码分割同宗：**按"用户下一步"切资源，而不是按"文件类型"切**；
- L7 收官关 **mp-performance**：启动链路（代码包下载→注入运行框架→首页渲染三段）、setData/长列表/图片优化汇总、Skyline 引擎与体验评分/真机性能面板——把全包性能债一次性清算（呼应 vue-performance、react-performance、exp-perf）。
