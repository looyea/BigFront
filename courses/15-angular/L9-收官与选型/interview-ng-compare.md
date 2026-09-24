# ng-compare 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。围绕四框架对照表、选型三轴与收官判词的题组。

### 1. (C) 从响应式模型角度对比 Angular/Vue/React/Solid：signal 在四家中的实现差异和性能影响。

**来源**：转述自本关 §一响应式全家采纳表

- Angular：signal() = writable + 手动 `.set()`；通知下游精确到**绑定级别**；无 Proxy 开销。
- Vue：ref() 近似 signal；但 reactive() 用 **Proxy 深层拦截**——对象属性直接 mutate 即触发更新。通知粒度到组件级。
- Solid：createSignal 与 Angular 几乎同 API——但**编译器自动追踪**哪个表达式读哪个 signal → 细到**单个文本节点**。
- React：不用 signal——useState + 重渲染 + VDOM diff。通知粒度是**组件级**（setState → 整棵子树重渲染，除非 memo）。
性能影响：Solid > Angular ≈ Vue > React（从细到粗）。

### 2. (D) 面试官给一个「内容营销站 + 电商 + SaaS 后台」三合一集团——推荐技术栈并给理由。

**来源**：转述自本关 §六企业选型三轴

- 营销站 → **SvelteKit/Nuxt**（极致性能 + SEO + 小 bundle 对 LCP 友好）；
- 电商前台 → **Next.js**（React 生态最大、电商组件/SDK 最丰富、Vercel ISR 开箱）；
- SaaS 后台 → **Angular**（全家桶 + DI + 强约定适合长期维护 + Material 组件丰富 + zoneless signal 性能够）。
一句话：不同类型项目选不同框架——不必强求统一。加分：如果集团要求统一技术栈 → React + Next.js 覆盖面最广。

### 3. (A) 解释 Angular 的「全家桶 + 强约定」哲学对团队协作的实际价值。

**来源**：转述自本关 §五全家桶对照 + §六团队规模轴

全家桶：新人不需选型（Router/Forms/HTTP/SSR 官方自带）→ onboarding 从 2 周→2 天。强约定：风格指南(core/shared/features) + @angular-eslint + DI 规则 → code review 争论从「用什么方案」变成「放对了位置吗」。实际价值：20 人团队 10 个模块——每个模块结构一致 → A 团队成员去改 B 模块无认知障碍。

### 4. (C) Angular DI 与 React Context / Vue provide/inject 的本质设计差异？为什么 Angular DI 更适合大型项目？

**来源**：转述自本关 §三 DI 独家能力

React Context：Provider **嵌套声明** + 值变化**整棵子树重渲染**（没有层级作用域）。Vue provide/inject：**单向**（父提子用）、无自动单例管理、无 token 系统。Angular DI：**三级 injector 树**（root/module/component）+ InjectionToken 解耦 + 可替换（测试 mock）+ providedIn 控制 tree-shaking。大型项目需要：可替换 + 层级作用域 + 编译期类型检查 → Angular DI 唯一满足全部三点。

### 5. (B) 团队从 React 迁移到 Angular，开发者抱怨「太多样板」——你怎么回应并给出实际对比。

**来源**：转述自本关 §四~§五与 React 拼装对照

承认：单看组件定义 Angular 确实比 React FC 多几行（@Component decorator + imports + template）。但：① React 一个 TodoApp 要装 react-router + axios + formik + zustand → **4 个决策 + 配置**；Angular 开箱全有——**总样板反而更少**；② 迁移后第 3 个月：React 团队讨论「这个功能用哪个库」的时间在 Angular 团队不存在。一句话：前期多写 5 行 vs 后期少开 5 次选型会。

### 6. (D) 写一段面试回答：「为什么 2026 年了还有公司大量招 Angular 开发者？」

**来源**：转述自本关 §六~§七招聘市场

核心论点：① **存量**：2016-2022 大量企业用 Angular 建系统——这些系统的维护/迭代/升级需要人；② **新企业项目**：金融/保险/制造业大型 SPA 仍首选 Angular（合规/审计/长期支持）；③ **v17+ 大改版**吸引了新一批——standalone/signals/zoneless 让 Angular 体验现代化——但企业招聘市场有滞后。结论：Angular 开发者少 → 供给缺 → 薪资格局高。

### 7. (A) 各框架的模板控制流趋同现象说明了什么？React 的 JSX 路线为什么没跟？

**来源**：转述自本关 §四模板控制流趋同

趋同说明：**模板原生控制流有客观优势**——编译器可以做静态分析（Angular 的 @for track 强制、Vue 的 v-for key 检查）、更好的 IDE 高亮、对设计师友好（不需要懂 JS map/filter）。React 不跟的原因：① JSX 是 JS 超集——控制流就是 JS 语法（if/map）——引入模板指令与「一切皆 JS」哲学冲突；② 社区惯性巨大——不可能改。代价：React 无法做编译期控制流优化。

### 8. (C) 对比 Angular @defer / Svelte {@render} / React Suspense 三种「延迟渲染」设计。

**来源**：转述自本关 §二 @defer + Svelte/React 生态知识

- **@defer**：声明式 + 6 种触发器 + 有 placeholder/loading/error 三态——完全模板内联。
- **Svelte**：v5 有 `{@render}` snippet + import() 配合 `{#await}`——但无 viewport/idle 等精细触发器。
- **React Suspense**：`<Suspense fallback={...}><LazyComponent/></Suspense>`——只有 fallback 态，触发靠 import 时机（需配合 IntersectionObserver 自己写）。
结论：Angular 的 @defer 设计最完整（触发器×状态机）——是模板级懒加载的标杆。

### 9. (D) 设计一个「四框架同一需求实现对比」的技术分享大纲——要求覆盖 signal store / 路由守卫 / SSR 三个维度。

**来源**：转述自本关 §一~§六综合

大纲：① Signal Store：Angular service+signal vs Pinia vs Zustand+useSyncExternalStore vs Svelte 5 runes——展示相同 CRUD store 四种写法；② 路由守卫：Angular CanMatchFn vs Vue beforeEach vs Next middleware vs SvelteKit +layout guard——权限重定向实现；③ SSR 防双请求：TransferState vs __NEXT_DATA__ vs useNuxtData vs SvelteKit +layout load 序列化。每个维度给「哪个最省力、哪个最灵活」结论。

### 10. (B) 一个 Angular 老项目想迁到 React（因为「招 React 人更容易」）——你作为架构师给出评估框架和结论。

**来源**：转述自本关 §六企业选型与 §七遗留栈

评估框架：① 迁移成本：重写（非转译）所有组件/服务/表单 → 人月估算 = 原开发成本×0.7；② 功能退化风险：全家桶迁到拼装需要重新选型+集成；③ 招聘收益：真的需要换框架才能招人吗？还是薪资没到位？④ 长期维护：新框架栈的约定谁来建？结论：通常「不划算」——建议保留 Angular + 提高薪资/改善技术形象（v22 新栈已现代化）。

### 11. (A) 解释四框架在「编译器参与程度」这条轴上的分布。

**来源**：转述自本关 §二组件模型 + 11/13 包编译器知识

轻 → 重：React（几乎不编译 JSX → 运行时 VDOM）→ Angular（模板编译成 render function + DI 元数据 → 中等）→ Vue（SFC 编译器静态提升 + patch flag → 较深）→ Svelte/Solid（完全编译 → **无运行时框架**/细粒度 runtime → 最深）。越右性能天花板越高但调试越难（源码≠产物）。

### 12. (C) Angular vs Vue 的「渐进性」有什么本质区别？「Angular 不渐进」这个说法公平吗？

**来源**：转述自本关 §五全家桶 vs 拼装

Vue「渐进」= 可以从只引入模板引擎开始 → 按需加 Router/Pinia。Angular「全家桶」= 一开始就有 Router/Forms/HTTP——但也可以**只用一部分**（比如不用 Forms 手写表单）。不公平之处：v17+ standalone 让 Angular 也可以「先一个组件、再加路由、再加服务」渐进式采用——不再是必须先建 NgModule。结论：全家桶≠强制全用，而是全都有且互相配合最顺滑。

### 13. (D) 面试官让你现场「用一句话分别给 Angular/Vue/React/Svelte 写个墓志铭」（或广告词）——你怎么写？

**来源**：转述自本关 §八四强收官判词

- Angular：「十个人写十万行代码而不打架。」（强约定+全家桶+长期维护）
- Vue：「从一行 script setup 到全栈 Nuxt，阶梯式成长。」（渐进+友好）
- React：「给你一切自由，也给你一切责任。」（生态+灵活+选型自担）
- Svelte：「你的代码就是最终产物——框架退场，DOM 登场。」（编译+零 runtime）

### 14. (A) 从「框架退出成本」角度分析：为什么 Angular 项目的「锁定效应」比 React 强？这一定是坏事吗？

**来源**：转述自本关 §七生态锁定度

锁定来源：DI 模式（迁移需重写）+ Material 深度绑定 + 模板语法（vs JSX）+ Router/Forms API → 5 个迁移痛点。React 锁定弱因为生态库可换。但不一定是坏事：锁定 = **沉没成本保护**——已投入的架构投资不会因某库停止维护而报废（Angular 官方承诺 LTS + ng update 路径）。企业视角：可预测的迁移成本 < 不可预测的选型风险。

### 15. (D) 毕业面试终题：「四框架你都学了，下一个新框架来了你怎么应对？」

**来源**：转述自本关 §八收官判词 + 全课程学习路径

回答框架：① **响应式**：看它是 signal 族（push/pull 模型）还是 Proxy（Vue）还是 VDOM（React）——这决定了性能特征；② **编译深度**：是否有编译时优化（Svelte/Solid 式）还是运行时为主——决定 DX 和调试；③ **约定强度**：有没有官方全家桶还是自由拼装——决定适合团队规模；④ **SSR/全栈**：有没有官方服务端方案——决定部署形态。四把尺子量任何新框架——5 分钟判断它适合什么场景。
