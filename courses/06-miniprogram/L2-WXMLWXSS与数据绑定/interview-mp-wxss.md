# mp-wxss 面试题精选

> 共 15 题，覆盖 A 单位与适配 / B 样式作用域与隔离 / C 工程组织 / D 深度原理。

## 一、单位与屏幕适配（A 类）

### 1. rpx 是什么？换算公式？
规定屏幕宽度为 750rpx。`rpx 值 = px 值 × 750 / 屏幕宽度px`。iPhone6（375px）上 1rpx=0.5px。设计稿按 750 宽出图时，标注即 rpx，零换算成本。
**来源**：微信小程序官方文档《WXSS > 尺寸单位》

### 2. 小程序的 rpx 和 H5 的 vw/rem 方案是什么关系？
同一问题的三种解：vw 是浏览器原生百分比视口单位；rem 需 js 动态设置根字号（lib-flexible 方案）；rpx 由小程序运行时内置折算，无需任何 js。思想都是"以设计稿宽度为基准的相对单位"（呼应移动端适配通用实践）。
**来源**：《移动端适配方案对比》技术专栏；微信小程序官方文档

### 3. 什么时候不该用 rpx？
① 细边框/分割线：1rpx 在窄屏不足 1 物理像素，会消失或不匀，用 px 或 4rpx+；② 与原生组件/导航栏对齐的固定高度（如胶囊按钮相关尺寸只能 px，API 返回的都是 px）；③ 需要配合无障碍字体缩放时用 px。
**来源**：微信开放社区高赞问答《rpx 与 1px 边框问题》

### 4. 字体大小用 rpx 有什么隐患？
系统"大字体模式/老年模式"下，纯 rpx 字号不跟随系统缩放，可读性受损。对正文可考虑 px 交给 WebView 缩放策略，或监听 `wx.onDeviceOrientationChange`/系统字体信息做档位调整——本质是"视觉还原 vs 可访问性"的权衡。
**来源**：微信开放社区《字体放大适配方案》精选；iOS/Android 无障碍设计指南思想对照

## 二、样式作用域与隔离（B 类）

### 5. app.wxss、页面 wxss、组件 style 的关系与优先级？
app.wxss 全局层，页面 wxss 页面层，同权重后者胜；行内 style 最高。组件默认 `isolated`：内外互不影响；`apply-shared` 页面→组件单向流入；`shared` 双向；`page` 组件样式影响页面。
**来源**：微信小程序官方文档《组件模板和样式 > styleIsolation》

### 6. 组件里为什么不能用 ID 选择器和标签层级选择器穿透？
官方限制组件样式**只能用 class 选择器**（id、属性选择器在组件内无效/受限）。设计上收窄选择器，是为了运行时隔离实现与样式 diff 的可控性——这与双线程"少传、简算"的整体哲学一致（呼应 mp-overview）。
**来源**：微信小程序官方文档《组件样式隔离注意事项》

### 7. Vue 的 scoped 和小程序组件隔离有什么区别？
Vue scoped 是编译期给选择器加 `[data-v-xxx]` 属性，本质仍是全局 CSS，子组件根节点可被父选中、`::v-deep` 可穿透；小程序是**运行时真隔离**（不同作用域树），穿透要走 externalClasses 或显式改 isolation 选项。后者更严格，也更难"手滑污染"（呼应 vue-class-style-transition）。
**来源**：Vue 官方文档《SFC 样式处理》；微信小程序官方文档

## 三、工程组织（C 类）

### 8. app.wxss 应该放什么？为什么不建议放大批量公共样式？
只放真正全局原子：reset、字体、少数通用工具类。app.wxss 会被每个页面携带，全量公共样式进全局等于给每页加体积与匹配成本；页面级公共应 @import 单独文件，组件级随组件走。与 Web 项目"全局 CSS 谨慎瘦身"同一结论（呼应 10-vite 产物分析、vue-project-architecture）。
**来源**：《小程序包体积与样式组织最佳实践》微信开放社区技术精选

### 9. @import 有哪些坑？
必须文件顶部；分包（subpackage）场景相对路径解析易错，跨分包引用样式是禁忌（分包应尽量自包含）；大量小文件 @import 链会拖慢首屏样式计算——Vite 对 CSS 同样是"内联小图/合并小文件"的权衡（呼应 10-vite）。
**来源**：微信小程序官方文档《WXSS > 导入》；分包最佳实践文档

### 10. 暗色模式怎么做？
`app.json` 开 `"darkmode": true` + `theme.json` 定义变量映射，wxss 里用 `@media (prefers-color-scheme: dark)`；或不用系统能力、自管主题 class + CSS 变量切换。前者跟系统、后者可控，多主题品牌色场景选后者。
**来源**：微信小程序官方文档《小程序.config > darkmode / theme.json》

## 四、深度原理（D 类）

### 11. WXSS 最终在哪里生效？改一样式为什么会牵动 setData？
WXSS 编译后进渲染层 WebView。样式规则与节点是两回事：改 class 名要通过 setData 更新节点属性，触发渲染层重算样式与布局——所以"高频改样式值"（逐帧动画颜色）走 setData 是灾难，应改用 CSS 动画/`wx.createAnimation`/worklet（Skyline 下）（呼应 mp-setdata、mp-performance）。
**来源**：《小程序渲染机制解析》技术专栏；微信小程序官方文档《Skyline 样式能力》

### 12. style 行内绑定对象字符串的性能问题？
`style="{{'width:'+w+'px'}}"` 每次 setData 都要序列化拼接；节点多时成本高。替代：预置类名切换 class（样式表命中缓存）、或用 CSS 变量 + 少量 setData（只改变量不改结构）。这对应 React 里"稳定 className、慎拼 inline style"的同一优化直觉（呼应 react-performance）。
**来源**：微信开放社区性能优化问答精选；React 官方文档《DOM 组件 > style》对照

---

## 补充（新专题 13-15）

### 13.  rpx 的换算公式是什么？它和 H5 的 vw/rem 方案是什么关系？

官方以 750 为总宽基准：rpx→px = screenWidth/750 × rpx 值，即 1rpx = 屏宽/750 px（iPhone6/375 宽下 1rpx=0.5px）。它本质是「相对视口宽度的单位」，和 `1vw = 屏宽/100`（所以 1rpx ≈ (100/750)vw ≈ 0.1333vw）同源——都是用「屏宽比例」实现等比适配。与 rem 的区别：rem 相对 html font-size（要 JS 动态设根字号的 flexible 方案），rpx 是引擎内置、无需 JS。取舍：rpx 简单但「按宽等比」在大屏/横屏会失真（内容过大），需要时混用 px（不随屏放大的字号、边线、安全热区）。理解「rpx≈vw」这一层，就能把 H5 的适配经验平移到小程序、也知道两者同样的宽屏陷阱。

**来源**：小程序 WXSS rpx 单位定义与换算；H5 vw/rem 适配方案对照。

### 14.  app.wxss、页面 wxss、组件 style 的优先级与「样式到底在哪生效」？为什么改样式有时牵动 setData？

层叠：app.wxss（全局）< 页面 wxss < 组件内 style（就近、受 styleIsolation 影响），同权重看选择器特异度与顺序，页面 wxss 对同元素覆盖 app.wxss。组件默认 isolated 会阻断页面/组件互选，需显式 apply-shared/shared 才穿透。WXSS 最终在「渲染线程」的 WebView 里生效——这是它与逻辑线程分离的。所谓「改一样式牵动 setData」：多数纯样式改动只重绘不涉逻辑；但当样式类要「随数据动态切换」（`:class="{{ active ? "a":"" }}"`），或你为了改样式而新增/改变了驱动 class 的 data，就会走 setData 跨线程；另外大量 `style="{{}}"` 行内拼接对象/字符串每次生成新值、或频繁切 class 会放大渲染层重排与 diff。故动态样式尽量「预定义 class 用少量布尔切」，别每帧拼字符串 style（本关行内绑定性能题）。

微信官方文档《WXSS 样式》；掘金《rpx 的设计原理与适配陷阱》

### 15.  暗色模式在小程序里怎么落地？有哪些与 Web 不同的点？

三源合一：① 系统主题——监听 `wx.onThemeChange`/`getSystemInfo().theme`，在 App/Page 的 onShow 初始化当前主题，据此在根节点挂 `data-theme="dark"` 或切 class，配合 WXSS 变量（CSS variables 小程序支持）定义色板一键翻。② 导航栏/胶囊/tabBar——这些是 Native 绘制、不吃 WXSS，必须调 `wx.setNavigationBarColor`/tabBar `setTabBarStyle` 或 json 里配 `darkmode:true`+`light/dark` 两套色与 `themeLocation` 引用的 json。③ 图片/图标——暗色下要换资源或用 currentColor/SVG。与 Web 差异：不能纯靠 CSS `prefers-color-scheme` 一把梭，因为窗口/导航/胶囊是原生层，必须 JS 主动同步；页面背景色也可由 json backgroundColor 控制。落地上把「色值集中成 theme token」是防止改一处漏一处的关键。

**来源**：小程序 darkmode 配置、themeLocation、setNavigationBarColor 与 onThemeChange 文档。
