# mp-route 面试题精选

> 共 12 题，覆盖 A API 与页面栈 / B tabBar 与规则 / C 传参与回传 / D 与 SPA 路由对照。

## 一、API 与页面栈（A 类）

### 1. navigateTo / redirectTo / reLaunch / switchTab / navigateBack 的区别？
navigateTo 压栈（可 back、原页保留）；redirectTo 替换栈顶（不可回退到原页）；navigateBack 出栈 delta 层；switchTab 跳 tab 页并清空非 tab 栈；reLaunch 关闭所有页打开唯一页。核心差异就是"对页面栈做了什么操作"（呼应 mp-route 第二节）。
**来源**：微信小程序官方文档《路由 API》

### 2. 页面栈是什么？onHide/onUnload 与跳转 API 的对应关系？
栈里每个元素是一个存活页面实例。navigateTo 使当前页 onHide（保留）；navigateBack 使当前页 onUnload、上一页 onShow；redirectTo 使被替换页 onUnload；reLaunch 使所有旧页 onUnload。理解这层映射，"返回后要不要刷新"类 bug 自然清晰（呼应 mp-lifecycle 第三、四节）。
**来源**：微信小程序官方文档《生命周期与路由》

### 3. 为什么小程序要限制页面栈 10 层？
每页是独立 WebView 实例，10 层已占大量内存（双线程+多 WebView 模型，呼应 mp-overview）；产品层面也抑制"无限钻取"的坏导航。超限 navigateTo 直接 fail。
**来源**：微信小程序官方文档《navigateTo 页面栈限制》

## 二、tabBar 与规则（B 类）

### 4. 为什么 tabBar 页面不能被 navigateTo？
tab 页是"根级常驻页"，各自维护独立页面栈（切 tab 回各自上次的栈顶）。若允许压入普通栈，tab 切换语义（switchTab 会清非 tab 栈）就矛盾了。因此官方规定 tab 页只能 switchTab/reLaunch 到达（呼应 mp-tabbar）。
**来源**：微信小程序官方文档《switchTab》注意事项

### 5. switchTab 前页面栈里有 3 个普通页，会发生什么？
这 3 页全部 onUnload 销毁，切到目标 tab 页。若怕丢状态，跳转前先持久化（Storage/globalData）（呼应 mp-storage）。
**来源**：微信开发者工具路由调试 + 官方文档

### 6. 小程序页面能被"链接分享"直接打开某路径吗？
能，但形式是"小程序页面路径"（后台配置页面路径、分享携带 path、URL Scheme/Short Link 转跳），而不是 H5 那种自由 URL；路径必须在已发布版本存在。与 web 的"任意 URL 可分享"仍是两个世界（呼应 mp-openapi 分享）。
**来源**：微信小程序官方文档《URL Scheme / 页面配置》

## 三、传参与回传（C 类）

### 7. 小程序页面间传参的完整清单与选型？
① url query（字符串、少量、一次性）；② globalData（内存级、易丢、重进小程序失效）；③ Storage（持久、10MB 上限、有 IO 成本）；④ eventChannel（A→B→返回 A 的回传通道，官方推荐）；⑤ `getCurrentPages()` 拿上一页实例直接调其方法（能力大、耦合重，慎用）；⑥ 组件化改造：抽公共状态走 App 级事件总线/状态库（呼应 mp-communication、react-context）。
**来源**：微信小程序官方文档《页面间通信》

### 8. onLoad 的 options 里参数需要解码吗？
url 中 `encodeURIComponent` 过的值，onLoad 拿到时官方文档提示：**开发者工具与真机行为曾有差异**，稳妥做法是接收端统一 `decodeURIComponent`（做好容错）；数字/布尔记得转类型（呼应 mp-route 第三节）。
**来源**：微信开放社区 onLoad 参数编码问答精选

### 9. "详情页点了喜欢，返回列表要同步红心"，两条链路各自怎么做？
去程列表→详情：url 带 id；回传详情→列表：navigateTo 时用 `events` + `eventChannel.emit`，列表页 `onLoad(options)` 里 `getOpenerEventChannel().on('liked')` 更新自身 data；或列表在 onShow 里重新拉取（简单但费流量）。优先 eventChannel：精准、省请求（呼应 mp-communication、react-router-data 的 loader/action 回写思想）。
**来源**：微信小程序官方文档《eventChannel / 页面通信》

## 四、与 SPA 路由对照（D 类）

### 10. Vue Router 的嵌套路由在小程序里怎么实现？
**做不到同层嵌套**——小程序一个页面就是一个 WebView，没有 `<router-view>`。替代：① 视觉嵌套用组件（组件内切换内容，呼应 mp-component）；② 真"页面里的页面栈"用**半屏小程序/嵌套容器**（web-view 内嵌 H5、`openEmbeddedMiniProgram`）视需求而定。这是小程序路由模型最大的能力缺口。
**来源**：微信小程序官方文档《web-view》；Vue Router 官方文档《嵌套路由》对照

### 11. history 模式 hash 模式、memory router 与小程序路由的本质区别？
前三种都是"URL 与视图的映射引擎"（有路由表、可匹配、可回退、由前端控制地址栏或历史栈）；小程序是"多 WebView 实例的栈管理 API"——没有 URL 参与、没有匹配表（pages 是登记而非模式匹配）、回退只能 navigateBack。Taro 之类跨端框架会在小程序端模拟出路由表，但底层仍是页面栈（呼应 react-router-basics、mp-framework）。
**来源**：React Router / Vue Router 官方文档；Taro 路由方案文档

### 12. 小程序怎么做"路由参数校验/类型安全"？
没有 loader/中间件帮你做：在 onLoad 里白名单校验+转换（`const id = Number(options.id); if (!Number.isFinite(id)) return back()`），或封装 `guardTo/parseQuery` 统一处理；TS 项目可给每页定义 `interface Query` 约束接收端（呼应 ts-narrowing、exp-validation、react-router-data 的 loader 校验思想）。
**来源**：TypeScript 官方文档《Narrowing》；小程序参数校验实践帖汇总
