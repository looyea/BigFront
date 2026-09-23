# mp-tabbar 面试题精选

> 共 12 题，覆盖 A 配置与约束 / B 运行模型 / C 自定义 tabBar / D 架构与跨框架对照。

## 一、配置与约束（A 类）

### 1. tabBar 的 list 有几种必填/选填字段？图标有什么规格要求？
必填 pagePath/text（未配 iconPath 则只显示文字，是合法形态）；选填 iconPath/selectedIconPath。图标建议 81×81px、png、≤40KB、不要 GIF（底栏不支持动画）（呼应 mp-tabbar 第一节）。
**来源**：微信小程序官方文档《tabBar 配置》

### 2. 改了 app.json 的 tabBar 配置但模拟器没变化，为什么？
tabBar 属于全局配置，修改后需**重新编译/重启工具**；真机侧要重新进入小程序。区别于页面 json 的 window 字段（保存即生效）——全局与局部配置的生效粒度不同（呼应 mp-directory）。
**来源**：微信开发者工具已知行为；官方文档配置生效说明

### 3. tab 页能设置 navigationStyle: custom 吗？和隐藏 tabBar 冲突吗？
可以（页面 json 覆盖 window 字段，呼应 mp-directory），两者互不冲突：一个管导航栏、一个管底栏。沉浸大图页常用组合：custom 导航 + `wx.hideTabBar()`，退出页面时记得 `wx.showTabBar()` 恢复。
**来源**：微信小程序官方文档《hideTabBar / navigationStyle》

## 二、运行模型（B 类）

### 4. "每个 tab 一条独立页面栈"具体指什么？举例说明。
首页→详情A→切"消息"→消息→详情B→切回首页：仍在详情A；再切"消息"仍在详情B。两条栈并行保活；只有 switchTab 前位于**非 tab 页**（如正停在详情A时去 switchTab 到某 tab）会把详情A onUnload（呼应 mp-tabbar 第二节、mp-route 面试 5）。
**来源**：微信小程序官方文档《页面栈与 switchTab》

### 5. tab 页的刷新时机为什么必须放 onShow 而不是 onLoad？
tab 页常驻不销毁，onLoad 整个使用过程只跑一次；用户切走又切回是最常见的"数据可能过期"时点，只有 onShow 每次都触发（呼应 mp-lifecycle 第三节的同款结论）。
**来源**：微信小程序官方文档《页面生命周期》

### 6. onTabItemTap 能干嘛？和普通 tap 有什么区别？
它是 Page 级页面事件：点**当前 tab 页对应的底栏按钮**时触发（重复点击已选中的 tab 也能收到），可据 index/pagePath 做"再点首页回顶部"等交互。它不来自渲染层节点，不走 WXML 绑定（呼应 mp-lifecycle 第五节、mp-events）。
**来源**：微信小程序官方文档《onTabItemTap》

## 三、自定义 tabBar（C 类）

### 7. 什么需求才值得上自定义 tabBar？代价清单？
值得：中央凸起按钮（midButton 可解一部分）、选中动画、皮肤/会员主题、动态增减入口。代价：每 tab 页 onShow 手动同步 selected；原生 badge/style API 全失效需自建状态；高度与占位自管；安全区自适配；低端机多一层组件渲染（呼应 mp-tabbar 第四节）。
**来源**：微信小程序官方文档《自定义 tabBar》；社区实践对比帖

### 8. 自定义 tabBar 时 app.json 的 list 还要不要写？
必须写。list 承担"哪些页面是 tab 页"的登记职责（决定 getTabBar 可用、switchTab 合法路径、原生避让高度）；custom:true 只是替换绘制层（呼应 mp-tabbar 第四节代价2）。
**来源**：微信小程序官方文档《custom-tab-bar 注意事项》

### 9. getTabBar() 返回什么？为什么可能拿到 undefined？
返回当前 tab 页挂载的自定义 tabBar 组件实例（页面级 API）。undefined 的场景：页面不是 tab 页、或 app.json 未开 custom、或在 onShow 之前调用（组件尚未 attach，呼应 mp-component-lifecycle 的 attached 时机）。官方示例就写了 `if (this.getTabBar)` 防御。
**来源**：微信小程序官方文档《getTabBar》

## 四、架构与跨框架对照（D 类）

### 10. Vue Router + KeepAlive 的"标签页布局"和小程序 tabBar 是同类东西吗？
同属"顶层导航+页面保活"：Vue 要手动 `<router-view v-slot>` + `<keep-alive :include>` 拼出来，全在单 WebView 内；小程序是 Native 托管底栏 + 多 WebView 各自保栈，成本模型完全不同（原生底栏不吃 setData）。Taro/uni-app 的 tab 配置最终都翻译成原生 tabBar（呼应 vue-router-nested-dynamic、mp-framework）。
**来源**：Vue 官方文档《KeepAlive》；Taro 官方文档《tabBar》

### 11. 五个 tab 会不会导致五个 WebView 常驻、内存爆炸？
tab 页 WebView 确实倾向保活（微信有页面栈回收策略：内存紧张时后台 tab 页可能被销毁重建，重建后走 onLoad）——所以**不能依赖 tab 页内存状态永远存活**，关键状态要落 Storage（呼应 mp-storage、mp-performance）。
**来源**：微信开放社区《tab 页面被销毁》官方答复帖；小程序内存管理机制说明

### 12. 业务方要求"不同用户看到不同 tab"（如游客 3 个、会员 5 个），原生方案怎么落地？
原生 tabBar 数量 2~5 且**不支持运行时增删 list**（setTabBarItem 可改文字图标路径，但不能减少项数到 2 以下动态伸缩）。两条路：① 固定 5 项 + 权限项点击时 modal 引导（体验一般但实现稳）；② 自定义 tabBar，list 仍 5 项占位、绘制层按权限过滤——用第 4/8 题的机制，把"数据驱动底栏"做在组件里（呼应 mp-interaction 封装、本节代价清单）。
**来源**：微信小程序官方文档《setTabBarItem》；开放社区动态 tab 方案精选
