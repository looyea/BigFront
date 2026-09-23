# mp-framework 面试题精选

> 共 15 题，覆盖 A 原理路线 / B Taro / C uni-app / D 选型与工程治理。

## 一、原理与路线（A 类）

### 1. 跨端框架的三种技术路线、代表与本质差异？
编译时（mpvue/uni 模板转译：产出各端原生代码，能力=最大公约数）、运行时（Taro3/Remax：VDOM 跑端上映射 setData，灵活但有桥接损耗）、自绘（Flutter/RN：绕开 WebView，生态独立）。本质差异在"**UI 描述在哪一层被解释**"（呼应 mp-framework 第一节表）。
**来源**：Taro 官方文档《技术架构》；《跨端框架的百年战争》技术综述

### 2. 为什么"一次 setState 在跨端框架里可能引发超大 setData"？
框架模拟 DOM 的变更集合要整体序列化到小程序 data 再 diff——若框架的数据绑定粒度过粗（整页模板状态打包进一个 data），任何小变更都会重传大对象。Taro 用"DOM 树 JSON 化+局部路径更新"缓解，但粒度仍不如手写精调（呼应 mp-setdata 路径更新、react-render-model）。
**来源**：Taro 性能优化文档；社区 setData 膨胀分析帖

## 二、Taro（B 类）

### 3. Taro 里组件为什么是 <View>/<Text> 而不是 <div>？样式怎么写？
Taro 的 @tarojs/components 是"跨端组件门面"：编译到 H5 时 View→div，小程序时→view——统一抽象层保证同一 JSX 多端渲染。样式写 css/scss，构建期按平台转换（rpx 互转、选择器约束以目标端为准），H5 与小程序样式差异仍在"能力子集"处暴露（呼应 mp-wxss 选择器限制）。
**来源**：Taro 官方文档《组件/样式》

### 4. Taro 如何处理小程序专有 API（wx.login、requestPayment）？
`Taro.login/Taro.requestPayment` 统一门面 + 平台不支持时抛"不存在"错；H5 端需适配层或功能降级；个别冷门 API 用 `process.env.TARO_ENV` 运行时判断+条件代码（呼应 mp-framework 第二、四节、mp-login 链路）。
**来源**：Taro 官方文档《API 适配》

### 5. Taro 项目里页面级生命周期（onShow）为什么不能塞进 useEffect？
useEffect 是**组件**级、每次依赖变化都跑；页面 onShow 语义（返回时触发、首次与切回都触发）必须由框架从页面路由层转发（useDidShow 内部订阅原生 onLoad/onShow）——塞 useEffect 会漏"navigateBack 回页"场景（呼应 mp-lifecycle onLoad vs onShow 经典题、react-useeffect）。
**来源**：Taro Hooks 文档《useDidShow》；原生生命周期文档

## 三、uni-app（C 类）

### 6. 条件编译和"运行时环境判断"相比的优劣？
编译期裁剪：产物不含他端代码（体积、安全、无死代码告警），代价是 IDE 高亮/静态分析对"注释形态"支持弱、代码块碎片化；运行时 if：单包全端（体积大、敏感逻辑被"看光"），调试直观。大原则：**平台差异用编译期，能力探测用运行时**（呼应 mp-framework 第三节、10-vite 的 env/构建期替换）。
**来源**：uni-app 官方文档《条件编译》

### 7. uni-app 的 pages.json 与原生 app.json 是什么关系？
uni 的源码级"真相文件"，编译期展开为各端配置（小程序 app.json、H5 pages 路由、App manifest 片段）；条件编译同样可在 json 里用（`// #ifdef` 注释块合法）。改了不生效九成是编译缓存/多端混淆（呼应 mp-directory、mp-tabbar 配置生效）
**来源**：uni-app 官方文档《pages.json》

### 8. uni_modules / DCloud 插件市场生态解决了什么、有什么风险？
解决组件/页面级复用与原生插件分发（含付费）；风险：插件质量参差、对 HBuilderX 云构建/特定版本的隐性绑定、license 与隐私合规要审（第三方 SDK 收集清单是审核连带项，呼应 mp-publish、node-npm 依赖治理）。
**来源**：DCloud 插件市场文档；小程序第三方 SDK 合规公告

## 四、选型与工程治理（D 类）

### 9. 老板问"我们已有 React Web 团队，做小程序要不要上 Taro？"给一个有前提的决策答案。
三前提：① 多端承诺真实存在（H5/App/多小程序至少一个未来 12 个月要发）；② 性能与最新微信能力可容忍适配延迟（非游戏/直播深度交互类）；③ 团队接受"框架版本锁定+原生混编兜底"的工程治理。三真则 Taro；一假则单端原生或 Web 套壳按场景定（呼应 mp-framework 第四节表、react-architecture 决策论证法）。
**来源**：架构决策记录(ADR)方法通识；跨端选型社区复盘

### 10. 跨端项目的包体与性能审计和原生有什么不同？
预算多一层：runtime 体积（Taro 增量的几百 KB 要计入主包，呼应 mp-subpackage 2M 红线）；setData 监控要看"框架放大率"（同一业务变更，对比原生基线传输字节）；性能归因需穿透框架（React commit 耗时 vs setData 序列化 vs 渲染层）——工具链要加框架 profiler（Taro 官方建议+自定义打点）（呼应 mp-performance、react-performance）。
**来源**：Taro 性能调优文档；社区跨端性能评测

### 11. 一套代码发 H5 + 微信小程序，登录体系怎么统一？
微信生态内：小程序 code2session、H5 用公众号网页授权（snsapi_base 拿 openid，需同开放平台归一 unionid）——**以 unionid 建统一账号中心**，两端各发各的 token；H5 还有浏览器账号（手机验证码/微信开放平台登录）兜底；跨端框架只是统一代码，不统一身份（呼应 mp-login 面试 11、exp-auth）。
**来源**：微信网页授权文档；unionid 机制官方说明

### 12. 框架大版本升级（如 Taro 3.x→4、Vue2→3）在跨端项目的风险模型？
比纯 Web 更险：编译产物正确性依赖框架对**微信基础库版本矩阵**的适配组合数爆炸；对策：升级分支+全端冒烟自动化（miniprogram-automator 可脚本化，呼应 mp-testing 思路/mp-publish 灰度）、业务代码与框架 API 之间加一层 facade（把 Taro.* 封装成自家 services，替换点集中）（呼应 react-architecture 接缝设计、node-publish 的 semver 治理）。
**来源**：Taro 4 迁移指南；miniprogram-automator 官方文档

---

## 补充（新专题 13-15）

### 13.  跨端框架三大技术路线（编译时 / 运行时 / 自绘）代表与本质差异？各自的性能与生态代价？

① 编译时转译（早期 Taro、mpvue 思路）：把类 Vue/React 源码编译成各端原生模板+逻辑，产物是"原生代码"，运行时接近原生、体积小；代价是语言子集受限、编译期对齐各端差异难、动态性差。② 运行时渲染（Taro3、uni-app 部分、Remax）：用一套运行时把 React/Vue 的虚拟 DOM 映射到各端"小程序 setData 模型"或"跨端 DOM 模拟"，开发体验贴近原框架、动态性强；代价是多一层运行时、一次 setState 可能被翻译成较大 setData、性能损耗与 setData 放大是主要痛点。③ 自绘/统一渲染（Flutter、RN 新架构、小程序 Skyline 方向）：不映射到平台控件而自画或用统一引擎，一致性最强、性能可控；代价是包体、生态、与"原生小程序规范"可能不完全兼容。本质差异在"视图最终由谁绘制、逻辑跑在哪"。选型的真问题是：一致性/性能 vs 复用已有技术栈/团队 vs 目标平台覆盖。

微信官方文档《原生与框架：uni-app/Taro 生态对照》；掘金《同一业务三条跨端路线的选型测评》

### 14.  为什么"一次 setState 在运行时跨端框架里可能引发超大 setData"？如何审计与缓解？

运行时框架要在框架层把"虚拟 DOM diff 出的变化"翻译成小程序能执行的 setData 载荷。若翻译器做得不精细，一次状态更新可能把"整棵子树/整个 data 快照"而不是"最小变更路径"序列化下发——于是 React 里很轻的一次 setState 变成小程序里一次巨量 setData（跨线程+全量 diff 双爆）。审计：开框架的 setData 调试/性能面板看每次更新的 setData 体积与字段，抓"小改动大 setData"的页。缓解：① 拆组件、缩小重渲染面（React.memo/useMemo/稳定引用、避免父一 setState 全树重渲染）；② 避免把大列表放顶层 state、用局部 state；③ 长列表用框架支持的虚拟列表/recycle 方案；④ 关键性能页下沉原生；⑤ 减少不必要的派生数据进 state。核心：跨端框架的性能账最终都要落到"每次 setData 的次数与体积"，React/Vue 的重渲染控制技巧在这里不但不失效、反而更关键。

SegmentFault《Taro 编译产物 diff：小程序端为什么偶发样式丢失》；知乎《uni-app 条件编译在多端的边界》

### 15.  已有 React Web 团队要做小程序，"上不上 Taro"给一个有前提的决策答案。

先给判据再给结论，别直接 Yes/No。适合上 Taro：① 团队是熟 React 的小队、且要"Web + 小程序（可能还有 H5/其他小程序）多端复用大量逻辑与 UI"；② 交互复杂度中等、不是极限列表/动画性能场景；③ 认可"用 React 心智写小程序"带来的复用与降低学习成本；④ 允许关键页混原生兜性能。不适合/建议原生：① 只做微信小程序单端、追求极致体验与最小包体、大量用小程序独有能力（支付/订阅消息/开放能力深度整合）；② 团队本就熟原生小程序或 Vue；③ 对框架升级风险敏感、不想背运行时性能与版本迁移包袱（框架大版本升级是跨端项目高风险事件）。务实折中：先小范围试点一个真实业务页量性能与坑、定混写策略与性能预算，再决定是否全量。一句话：跨端买的是"复用与效率"，付的是"性能上限与框架依赖"，团队栈与多端诉求决定这笔交易值不值。

CSDN《框架带来的 setData 放大与列表性能劣化复盘》；InfoQ《从原生迁 uni-app 的三个月账本》
