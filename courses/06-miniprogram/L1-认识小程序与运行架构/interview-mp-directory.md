# mp-directory 面试题精选

> 共 12 题，覆盖 A 目录与文件 / B app.json 配置 / C 页面级配置 / D 工具配置·架构对照类。

---

## 一、目录与文件（A 类）

### 1. 一个标准小程序根目录有哪些必备文件？各自职责？

**答**：`app.js`（逻辑入口，调 `App()` 注册全局生命周期与 globalData）、`app.json`（全局配置：pages 路由表、window、tabBar、分包、权限）、`app.wxss`（全局样式）。再加工程文件 `project.config.json`（开发者工具/构建配置）与 `sitemap.json`（搜索索引规则）。页面放在 `pages/` 下，每页一个目录含 `.js/.json/.wxml/.wxss` 四件套。类比前端工程就是"逻辑入口 + 清单配置 + 全局样式"（呼应 mp-directory 第一节）。

**来源**：微信小程序 — 目录结构 / 配置

### 2. app.json、app.wxss、app.js 三者能和 Vue 工程的哪些文件类比？

**答**：`app.js`≈Vue 的 `main.js`（应用入口、挂载全局）；`app.json`≈`package.json`+路由表+全局构建配置的合体（清单式声明）；`app.wxss`≈全局样式入口（`main.css`）。区别是小程序把"路由注册、窗口外观"等原本分散在 router/manifest 的东西集中进 `app.json`。理解这种映射能帮 Vue/React 开发者快速定位"该改哪个文件"（呼应 vue-project-architecture）。

**来源**：微信小程序 — 项目配置、Vue 工程结构对照

---

## 二、app.json 配置（B 类）

### 3. pages 字段是干什么的？注册和不注册有何区别？

**答**：`pages` 是**页面路由表**，数组每项是不带扩展名的页面路径，**第一项是冷启动首页**。只有登记在 pages（或分包）里的路径才能被路由跳转访问，直接 `navigateTo` 一个未注册路径会失败。新增页面 = 建好四件套 + 在 pages 里注册（或分包登记）。这与 Vue Router 的 `routes` 数组作用类似（呼应 mp-route、vue-router-basics）。

**来源**：微信小程序 — app.json pages、页面路由

### 4. window 配置能设哪些东西？它和页面级 json 是什么关系？

**答**：`window` 设**全局默认外观**：`navigationBarTitleText`、`navigationBarBackgroundColor`/`TextStyle`、`navigationBarTextStyle`、`backgroundColor`、`enablePullDownRefresh`、是否全屏/透明等。页面级 `.json` 可**单独覆盖**其中同名项（如某页改标题、开启下拉刷新）。优先级：**页面 > 全局**（局部覆盖默认，呼应 mp-directory 第四节、10-vite 路由级 meta）。

**来源**：微信小程序 — window 配置、页面配置

### 5. 除了 pages/window/tabBar，app.json 还有哪些常见字段？

**答**：`style`（组件样式版本 v2）、`sitemapLocation`、`debug`、`requiredBackgroundModes`（后台音频等）、`permission`（如 `scope.userLocation` 的授权文案）、`requiredPrivateInfos`（声明用到的隐私接口）、`preloadRule`（分包预下载）、`usingComponents`（全局自定义组件）、`darkmode`/`themeLocation`。这些决定能力申请、隐私合规、全局组件与主题，上架审核常卡在这里（呼应 mp-login、mp-subpackage、mp-publish）。

**来源**：微信小程序 — app.json 字段参考

---

## 三、页面级与组件配置（C 类）

### 6. 一个页面的四件套文件分别是什么？json 可以省略吗？

**答**：`.wxml`（视图模板）、`.wxss`（页面样式）、`.js`（`Page({})` 逻辑）、`.json`（页面配置）。`.json` **可省略**（无特殊配置时），但一旦要用 `usingComponents` 注册该页专属自定义组件、或覆盖导航栏/下拉刷新，就必须建。组件目录同理，其 `.json` 要含 `"component": true`。

**来源**：微信小程序 — Page / Component 配置、usingComponents

### 7. usingComponents 放在哪里？全局注册和页面级注册有何区别？

**答**：可写在 `app.json`（**全局**，所有页面/组件直接用）或页面/组件的 `.json`（**局部**，仅该处可用）。全局注册方便但会让所有页面都加载该组件、增大公共依赖，宜只放真正通用的小组件；业务组件按需局部注册更利于分包与体积控制。这与"全局组件 vs 局部 import 组件"的 Vue 取舍一致（呼应 mp-component、vue-component-basics、10-vite-splitting）。

**来源**：微信小程序 — usingComponents、组件间引用

---

## 四、工具配置与架构对照（D 类）

### 8. project.config.json 和 project.private.config.json 有什么区别？哪个该进版本库？

**答**：`project.config.json` 是**项目级、团队共享**的工具/构建配置（appid、编译开关、minify、忽略目录、packOptions 上传规则等），应进版本库；`project.private.config.json` 是**个人本地**偏好（会覆盖同名项、如本地编译设置/最近打开页），通常**不入库**（写进 .gitignore）。类似前端里"共享 config vs .env.local"的区分（呼应 node-config、mp-directory 第五节）。

**来源**：微信开发者工具 — project.config.json / private 配置

### 9. 编译配置里的"ES6 转 ES5 / 增强编译 / 代码压缩"分别影响什么？

**答**：`es6`（把 ES6 转 ES5 以兼容低版本基础库的 JS 引擎）、`enhance`/增强编译（支持更现代语法与编译期处理，如 `wx://` 组件、可选链）、`minify`/`minifyWXSS`/`minifyWXML`（上传时压缩，减小包体、利于分包体积达标）。它们只在**工具构建/上传阶段**生效，体现"配置在平台侧、非 Vite/babel 自建"的小程序工程化差异（呼应 10-vite-build、mp-performance）。

**来源**：微信开发者工具 — 项目设置/编译模式、小程序构建配置

### 10. 小程序的"配置驱动"和 Vite 的"构建驱动"，在工程组织上最大的不同？

**答**：Vite 是**你写代码 + 配置文件 + 构建工具产出**（rollup 打包、插件、代码分割由 `vite.config` 掌控），自由度高。小程序是**平台约定 + 声明式配置驱动**：路由/外观/分包/权限多写死在 `app.json` 固定字段里，构建与运行由微信工具/宿主托管，你能改的边界由平台规定。所以小程序"上手快、可控面广但自由受限"，跨端框架(Taro)正是在两者间搭桥（呼应 mp-framework、10-vite）。

**来源**：微信小程序 — 项目与构建、Vite — Configuration 对照

### 11. 想把小程序项目组织得像中大型前端工程，你会怎么做？

**答**：① 按 **feature/业务域**建目录（不止平铺 pages），配 `utils`/`services`(封装 wx.request)/`components`(通用组件)/`behaviors`(复用逻辑) 分层；② 用**分包**把不常用业务切出主包（呼应 mp-subpackage）；③ 全局配置只放真正通用的 usingComponents/样式，其余局部化；④ 抽象 `app.globalData` 为带约束的状态模块，别当垃圾桶（呼应 mp-communication）；⑤ 配 ESLint + prettier + husky 保证多人协作。本质是把 mp-directory 的分层思想工程化（呼应 react-architecture、vue-project-architecture）。

**来源**：小程序工程化实践、Taro 项目结构、ESLint 小程序规则

### 12. sitemap.json 到底管什么？为什么很多小程序默认禁用索引？

**答**：`sitemap.json` 声明**哪些页面允许被微信"搜一搜"索引做搜索直达**（`rules` 配 `action: allow/disallow` + `page`/`params`），只管收录、不影响功能。默认/主动 `disallow` 的原因：① 多数页面是登录态/个性化/临时数据，不宜被公开检索；② 隐私合规（避免用户页被索引）；③ 防止无意义或半成品页面被搜到影响体验。需要 SEO 式流量时再精细放开（呼应 react-nextjs SEO、mp-publish）。

**来源**：微信小程序 — sitemap 配置、搜一搜接入
