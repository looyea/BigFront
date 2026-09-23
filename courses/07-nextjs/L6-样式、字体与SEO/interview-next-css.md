# next-css 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎等站点 Next 样式方案高频面经，中文重述。

---

## A. 规则与演进

**1. App Router 允许任意组件 import 全局 CSS，级联顺序如何保证？工程上怎么不吃亏？**
**来源**：掘金《全局 CSS 的秩序问题》；SegmentFault（样式注入顺序讨论）
框架按模块图稳定排序但语义上你不应依赖它——实践契约：全局文件只放 tokens/reset/keyframes/工具类，布局样式一律 module 或 utility；code review 看到组件 import 全局 CSS 新增规则文件即问"为什么不用 module"（呼应 vue-class-style-transition 的作用域教训）。

**2. CSS Modules 不能在服务端组件用的历史原因与绕行方案？**
**来源**：CSDN《CSS Module 与服务端组件的兼容之争》；Next 仓库 issue 讨论（社区摘要）
module import 产出运行时对象，被框架归入客户端能力线；绕行：① 组件加 'use client'（小岛可接受）；② 改 utility/CSS 变量方案；③ 等待/跟进官方对该限制松动的提案。答出"限制来自边界模型而非 CSS 本身"即高分（呼应 next-css 第一节、next-server-client）。

**3. Tailwind v4 相比 v3 与 Next 集成的变化点？**
**来源**：InfoQ《Tailwind 4：CSS-first 配置》
配置重心从 JS 文件转向 CSS @theme/@variant 指令、引擎 Oxide 提速、容器查询等原语入库；create-next-app 模板同步迁移。面试立场：讲影响面（扫描/配置迁移、CI 缓存）而非背书（呼应 next-css 预告、10-vite 的配置演进观）。

---

## B. 方案选型

**4. Tailwind vs CSS Modules vs 组件库，团队选型你按什么轴判断？**
**来源**：知乎《样式方案之争到底在争什么》；SegmentFault（设计系统团队实践）
三轴：设计系统成熟度（有成体系 token/组件→库或 Tailwind 主题化优先）、RSC 边界兼容（utility/变量>module>运行时 CSS-in-JS）、团队审美纪律（Tailwind 放大烂设计，token 化库兜底下限）。给轴比给答案值钱（呼应 react-architecture 权衡法）。

**5. 运行时 CSS-in-JS（styled-components/emotion）在 Next 里的现状与迁移建议？**
**来源**：CSDN《CSS-in-JS 的退潮》；InfoQ（RSC 与样式方案趋势）
需要 'use client'+注册表式 SSR 集成，性能与服务端渲染双打折；官方已把方向指向零运行时（Vanilla Extract/Panda 编译期流派补位）。建议：存量不推翻（隔离在客户端岛）、新代码零运行时方案（呼应 next-css 第二节表）。

**6. 暗色模式三种实现（class 变量/媒体查询/双主题 token）的闪烁与体验账怎么算？**
**来源**：掘金《next-themes 原理拆解》；CSDN（FOUC 案例分析）
媒体查询跟随系统但用户不可选且无 cookie 时服务端可预判 prefers-color-scheme；class+cookie 可手动切换且 SSR 定稿零闪；纯 localStorage+水合后注入必闪（脚本抢跑可缓解但水合要豁免）。结论：可选主题=cookie 方案是 Next 语境默认解（呼应 next-css 第四节）。

---

## C. 细节与坑

**7. 组件的 className 透传为什么必须配 tailwind-merge？给一个不带它的具体翻车例。**
**来源**：SegmentFault（cn 工具链讨论）
例：`<Btn className="bg-red-500">` 而 Btn 内部有 `bg-black`——输出 `bg-black bg-red-500` 时后声明者胜，但组件内部类顺序变化就会反向覆盖；merge 把同类目归一（最后一个意图赢）（呼应 next-css 第三节经验1、mp-wxss 隔离）。

**8. 字体文件/CSS 里的图片 URL 在 basePath 部署下会出什么问题？**
**来源**：知乎（子路径部署踩坑案例）
CSS 相对 url() 由构建重写到 _next/static，一般安全；但 public 里手写的绝对路径字体/图与第三方库 CSS 的硬路径会丢前缀——审计法：构建后 grep 产物里的 `/fonts`、`/images` 裸路径（呼应 next-groups-matchers 第四节、10-vite 的 base 课）。

**9. 打印样式/邮件模板这类特殊 CSS 在 RSC 里怎么做？**
**来源**：CSDN（print 与媒体查询实践）；掘金（邮件 HTML 工程化相关）
print：全局 `@media print` + 工具类 `print:hidden` 够用；邮件是另一物种：React Email 走独立渲染（inline 样式、无外部 CSS），别拿页面样式体系硬套——"同一组件思维、不同 CSS 方言"的边界题（呼应 mp-wxss 兼容性讨论）。

---

## D. 综合设计

**10. 设计系统团队要同时供 Web（Next）与小程序，token 架构怎么统一？**
**来源**：InfoQ《多端设计令牌工程化》
单一真源：tokens.json（色板/间距/字号语义层）→ 构建产物双出口：CSS variables+Tailwind @theme（Web）、WXSS 变量或编译 class 表（小程序，rpx 换算层）；组件库按端各实现、按 token 对齐。与 06-mp 的跨端框架选型互为镜像（呼应 mp-wxss、mp-framework）。

**11. Lighthouse 报"未使用的 CSS 过多"，Tailwind 项目还严重，怎么分析怎么治？**
**来源**：知乎《utility 框架的体积迷思》
先分真伪：purge 后未用已被清，报的多是全局层（preflight/组件类误扫）与真正高频复用不足导致的类组合爆炸。治：全局瘦身（reset 按需）、暗色/变体的 media 折叠、路由级 CSS 分包观察；不建议激进手动 tree-shake 工具类（收益小维护贵）（呼应 next-perf、vite-build）。

**12. 让 AI 生成 UI 代码时，为什么 Tailwind 成了事实标配？这个现象说明什么？**
**来源**：掘金（Cursor/v0 与 Tailwind 生态讨论）；知乎（AI 生成前端实践观察）
类名是**封闭词表+组合语法**，训练充分、自校验强（错类名大概率视觉立刻可见）、无上下文漂移（不用命名 BEM 讨论）；说明样式方案的竞争力多了一个维度：**机器可生成性与可检查性**。面试能聊到这层，展示的是工程生态嗅觉（呼应 ts-tooling 的工具链视野、next-architect）。
