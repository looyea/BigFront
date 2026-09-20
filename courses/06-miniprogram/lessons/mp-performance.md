# 性能与体验优化

> 目标：把全包散落各处的性能债汇总清算——**启动三段、渲染两线程、setData 一通道**，性能问题九成出在这三件事上。本课给一张可执行的优化清单 + 度量工具链（体验评分/性能面板/实时日志），并介绍渲染引擎的新变量 **Skyline**（呼应 **mp-setdata**、**mp-subpackage**、**vue-performance**、**react-performance**、**exp-perf**）。

---

## 一、先度量后优化：工具链

| 工具 | 看什么 |
|---|---|
| 体验评分（开发者工具 Audits） | 启动耗时、setData 超 80KB 次数、事件回调超时、包体/图片规则命中 |
| 真机调试-性能面板 | FPS、CPU、内存曲线、数据通信（逻辑↔渲染传输字节）实时流 |
| `wx.getPerformance()` | 官方打点：`AppLaunch`、`Route`、`FirstRender` 等条目，可上报自建监控 |
| 小程序后台-运维中心 | 线上启动/页面打开/setData 耗时分布、JS 错误率 |

经验阈值（体验评分口径）：setData 单次 >80KB 告警、事件回调同步段 >1s 超时、启动 >3.75s 判差——**先把这些指标接进 CI/监控，再谈优化**（呼应 exp-perf 的"没有度量就没有优化"）。

---

## 二、启动优化：三段对治

启动 = **下载代码包 → 注入框架&执行 app.js → 首页首屏渲染**。

1. **下载段**：主包瘦身（分包三板斧，mp-subpackage 已讲）；
2. **注入段**：app.js 顶层别做重活——同步大缓存读、埋点初始化、大量 require 全部延后/异步化；
3. **首屏段**：
   - 首页接口**并行化**+缓存渲染（先 Storage 旧数据上屏、回源后 diff 更新——SWR 模式，呼应 react-data-fetching）；
   - **骨架屏**：页面 json 背景色兼容下拉底色，主体用骨架组件占位（或自定义组件拼）——结论是**任何"等待"都要有视觉反馈**，白屏焦虑最劝退；
   - 首屏 setData 控制体量（只放首屏必需字段，分页/折叠内容二段 setData，呼应 mp-setdata 红线）。

---

## 三、运行期优化清单（按收益排序）

1. **setData 三查**：查大（>80KB）、查频（<2s 间隔连环）、查全量（该路径更新的传了整对象）——手段全在 mp-setdata：路径更新、合并调用、非视图数据出 data；
2. **长列表**：分页+`recycle-view`/自研虚拟列表（L2 作业 20 题你已经写过）；列表项组件化让更新局部化（呼应 mp-component 第四节的"独立王国"红利）；
3. **图片**：CDN+合适尺寸（`image` 的 width/height 写死防抖动）、懒加载 `lazy-load`、webp 格式、列表缩略图永不原图（呼应 mp-openapi 资源外置）；
4. **事件与计算**：滚动/输入监听节流防抖（mp-events）、重计算挪 setData 前或 wxs、`onPageScroll` 能不绑就不绑；
5. **内存**：定时器/observer/bus 订阅的清理纪律（mp-component-lifecycle 面试 4）；页面栈 10 层的产品收敛；切 tab 被回收页面的状态可恢复设计（mp-tabbar 面试 11）；
6. **缓存**：getStorage 同步风暴治理（mp-storage 面试 2）；字典/配置类走版本号缓存不打接口。

---

## 四、Skyline：渲染引擎的变量

传统 WebView 渲染（WebView 内核各机型不一）之外，新引擎 **Skyline**：

- **开启**：app.json/renderer 或页面 json `{"renderer": "skyline", "renderer-options": {...}}`（基础库 2.30.4+，组件能力清单官方维护）；
- **收益**：渲染由 Skia 直绘（非 DOM/CSS），列表/动画帧率与一致性大幅提升、`scroll-view` 增强、worklet 动画线程（手势跟手不掉帧）、`list-view/item-view` 回收列表内置；
- **代价**：WXSS 能力子集不同（部分选择器/特性不支持）、老机型与复杂生态页需双渲染方案回退 WebView——**按页面灰度**，一刀切是赌博（呼应 react 18 并发渲染的"渐进采纳"、vite 构建 target 的兼容权衡）。

```wxml
<!-- Skyline 下的回收列表示意 -->
<list-view scroll-y style="height: 100vh">
  <item-view wx:for="{{ feed }}" wx:key="id" ...>
```

---

## 五、优化工作流（面试要能背出顺序）

```text
1. 定指标（启动 P75、setData 字节、FPS、内存）→ 接监控
2. 体验评分 + 真机性能面板定位 Top 问题（别凭感觉）
3. 先砍最大单项（常见：主包图片、全量列表 setData）
4. 回归对比指标 → 留下基线，防回潮（CI 卡点）
5. 需要时才上 Skyline/虚拟列表等重型方案
```

这与 **exp-perf 的"压测→瓶颈→药方→回归"** 同一流水线——性能工程不分端（呼应 exp-perf、react-performance Profiler 工作流）。

---

## 六、自检清单

- [ ] 启动三段各对应哪类优化手段？
- [ ] setData 三查是哪三查？
- [ ] Skyline 的收益与代价？按什么粒度灰度？
- [ ] 体验评分的三条阈值还记得吗？
- [ ] 优化工作流五步，为什么"定指标"在"做优化"之前？

---

## 🚀 部署预告

- L7 收官：缓存、分包、性能三课构成"体验基建"三角；
- 最后一站 **L8 工程化、跨端与上架**：先 **mp-framework**——用 React 写小程序（Taro）、用 Vue 写小程序（uni-app）到底发生了什么，以及"原生 vs 跨端"的决策框架（呼应 react-architecture、vue-ssr-nuxt 的技术选型课）。
