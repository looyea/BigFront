# 大前端学院 · BigFront Academy 🚀

一个**可运行、可打卡、可扩展**的大前端「打怪升级」学习平台。内置 **7 组主题**（3 深色 + 4 浅色，其中含「护眼豆绿 / 护眼米黄 / 柔和暗灰」三组护眼色），
右下角 🎨 浮动按钮在**课文 / 小测 / 作业 / 面试题 / 地图任意位置**都能就地换肤并记住选择，专为「对大前端零概念、想在本地边学边往 GitHub 提交」的你而做。

覆盖方向：JavaScript(ES6→ES2025) · TypeScript · Node.js · Express · Vue 3 · React · Svelte/SvelteKit · Solid · Angular · 微信小程序 · Next.js · Nuxt · Vite · Signals 状态管理 · 状态管理三强 Pinia/Zustand/Jotai · 工具链专题 SWC/Biome/Vitest（各包完成度见第九节）。

---

## 一、整体逻辑架构

```
网页（外壳框架）  →  课程包（courses/*）  →  课程 + 作业包
```

- **外壳框架** = `web/`(Vue3+Vite 前端) + `server/`(Express 后端)。
  框架启动时**自动扫描** `courses/` 下所有课程包，读取每个包的 `course.json` 大纲，
  据此渲染地图、关卡、课文、小测。**加一个新课程包 = 在 courses/ 里新建一个文件夹，无需改一行框架代码。**
  首页地图按**大前端生态分层架构**自上而下分组：基础语言 → 视图框架 → 元框架/全栈 → 服务端/运行时 → 跨端 → 状态与数据 → 构建/编译 → 质量/测试（归类表见第九节；未归类新包自动落入末尾「其他」组）。
- **课程包** = `courses/<编号-名称>/`，每个包结构固定：

  ```
  courses/01-es/
  ├─ course.json                    # 大纲 manifest：包信息 + 分级(levels) + 每级关卡(lessons)
  └─ L1-变量与作用域/               # 一个阶段一个文件夹，该阶段所有文件都平铺在此
     ├─ lesson-<id>.md              # 课文
     ├─ quiz-<id>.json             # 小测（含正确答案，仅服务端可见，防泄题）
     ├─ interview-<id>.md          # 面试题（课末实战）
     ├─ homework-<阶段id>.md        # 阶段作业（自学资料库，不再在前端展示）
     └─ example-<id>-<名>.js       # 可运行示例（前缀带关卡 id，防同阶段重名；可选）
  ```

  > 【目录口径·2026-09 二次扁平化，全部 13 包已完成】取消早期的 lessons/quizzes/interviews/examples/homework 五大子目录，
  > 改为**课程包根下直接建阶段文件夹**（名 = `level.id-level.title` 去空格），阶段内所有文件按类别加前缀
  > （lesson-/quiz-/interview-/homework-/example-）平铺。框架仍**向后兼容**旧三布局（五目录+阶段夹 / LessonN / 平铺）作为安全网。
  > 前端：每关**小测/面试题是 2 个独立按钮**，课文页为单栏（课文 + 文末示例），作业无 UI 入口。

- **打怪升级**：包内第 1 阶段默认解锁；某阶段的全部关卡通关后，才解锁下一阶段。
  **小测 ≥60%（答对六成的题）即自动通关本关**，无手动“通关”按钮、不再要求作业勾选。
  （跨包之间不互相锁，ES 是推荐的第一块地基。）

## 二、环境要求

- **Node.js ≥ 20**（你在用 v24，直接满足；课程示例与 `.ts` 示例靠 Node 原生类型擦除即可运行）
- npm

> ⚠️ Windows PowerShell 若报「禁止运行脚本」，请用 `npm.cmd` 代替 `npm`（本项目脚本已兼容），
> 或以管理员执行 `Set-ExecutionPolicy RemoteSigned` 解锁。

## 三、安装与运行

```bash
# 1) 安装三处依赖（根 / server / web）
npm.cmd install
npm.cmd --prefix server install
npm.cmd --prefix web install

# 2) 开发模式（前后端一起起，前端 http://localhost:5173，热更新）
npm.cmd run dev

# —— 或 ——

# 3) 生产模式（先构建前端到 web/dist，再由后端单端口托管 http://localhost:3001）
npm.cmd run build
npm.cmd start
```

开发模式下 Vite 会把 `/api` 代理到后端 `3001`，无跨域问题。

### 该打开哪个地址？（按你实际运行的模式对号入座）

| 你执行的命令 | 运行模式 | 浏览器访问地址 | 说明 |
| --- | --- | --- | --- |
| `npm.cmd run dev` | 开发（前后端分离，热更新） | **http://localhost:5173** | 日常学习用这个；`/api` 由 Vite 代理到 3001 |
| `npm.cmd run build` → `npm.cmd start` | 生产（后端单端口托管） | **http://localhost:3001** | 后端直接托管构建好的 `web/dist` |

- **只想调后端接口**（不关心前端页面）：后端固定监听 **http://localhost:3001**，可直接访问如 `http://localhost:3001/api/packages`、`http://localhost:3001/api/integrity`。
- **想在手机或另一台电脑预览**（连同一 Wi-Fi）：先照常起后端，再单独用 `npm.cmd --prefix web run dev -- --host` 启动前端，然后用 `http://<你电脑的局域网IP>:5173` 访问（IP 用 `ipconfig` / `ifconfig` 查看）。
- 打不开先自查两点：①端口是否被占用；②你访问的地址是否属于上表「你实际运行的那种模式」。

## 四、学习进度与每日打卡（GitHub 记录）

- 每进入一个**学习页**，前端每 15 秒向后端打点一次，并累计「页面停留时长」；
  离开/关闭页面时用 `navigator.sendBeacon` 兜底上报。
- 所有进度写入 **`data/progress.md`**（Markdown）：包含累计时长、每日时长(`days`)、每关小测最好成绩、
  作业完成、通关状态、最近学习与事件流水。**人能读、也能直接手改**（补卡、抹卡、重置）。
- **进度文件放在哪**：`data/` 位于**项目根目录**下，与 `server/`、`web/`、`courses/` 同级；
  完整路径即 `<项目根>/data/progress.md`。首次运行若该文件不存在，服务会自动创建。
- 自动初启时若发现旧的 `progress.json`，会**自动迁移**到 `progress.md`，旧文件改名 `.migrated`。
- 不确定的字段含义 → 看同目录的 **`data/sample-progress.md`**（带逐字段解释与常见修改场景）。
- **想从零开始 / 拷给别人**：同目录备有一份 **`data/progress.initial.md`**（不含任何进度记录的零进度空白模板）。
  第一次拿到本项目、或想把干净进度交给别人时，把它**复制并重命名为 `progress.md`** 即可干净起步；
  想保留自己已有进度时则**不要覆盖** `progress.md`（或直接删掉 `progress.md`，服务下次启动会自动重建空档）。
- **该文件故意纳入 Git 版本管理**：你每天学完 `git commit && git push`，
  GitHub 上就会出现逐日的提交/贡献记录（绿格子）。悬浮面板「📈 记录」标签可看打卡天数与条形图。

## 五、如何扩展课程（后续更新到哪儿）

- **加深某关**：直接编辑 `courses/<包>/lessons/<id>.md`、`quizzes/<id>.json`、`homework/<级>.md`。
- **新增一关**：在 `course.json` 对应 level 的 `lessons` 里加一项，并建同名 `lessons/<id>.md`（+ 可选 quiz/homework/examples）。
- **新增一个包**：在 `courses/` 下建 `09-xxx/`，照抄结构。框架下次启动自动识别。
- 悬浮按钮「🧭」→「📈 记录」底部有**课程包完整性自检**，缺文件会在此列出，边写边校对。
- **示例程序规范**：每个例子（课文内嵌代码块与 `example-*.js`）都须带「目的注释」，逐行注释写出该语句当前的影响/结果；且对每个知识点给出「正确使用用例（注释写明正确结果）」与「错误用例（注释写明会产生什么结果 / 抛出什么异常）」——不能只给定义不给应用。

## 六、提交到 GitHub（首次）

```bash
git init                 # 若尚未初始化
git add -A
git commit -m "feat: 大前端学院学习平台（框架 + 22 个满配课程包）"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
# 之后每天学完：git add -A && git commit -m "day: 学了 xxx" && git push
```

## 七、技术栈

| 层 | 选型 |
| --- | --- |
| 前端外壳 | Vue 3 + Vite + vue-router + marked(Markdown 渲染) + highlight.js(代码高亮) |
| 后端 | Node.js + Express 5（课程扫描、进度持久化、判分） |
| 数据存储 | 纯文件 `data/progress.md`（Markdown 进度档案，零外部数据库依赖） |
| 主题 | **7 组可切换主题**（CSS 变量 token 化）：深夜墨蓝（VS Code Dark+ 灵感，默认）/ Solarized 夜 / 柔和暗灰（GitHub Dark Dimmed）· 纸感浅色 / 冷雾蓝灰 / 护眼豆绿 / 护眼米黄；选择存 `localStorage`，`index.html` 内联脚本防首屏闪肤 |

## 八、目录速览

```
BigFront/
├─ package.json              # 根：统一 dev / start / build / install:all 脚本
├─ run-dev.bat / run-prod.bat    # 开发（5173+3001）/ 生产（仅 3001）一键启动
├─ server/                   # Express 后端（index.js：课程扫描、全部 API、托管 dist）
├─ web/                      # Vue3 + Vite 前端
│  ├─ vite.config.js
│  ├─ dist/                  # 构建产物（:3001 直接托管）
│  └─ src/
│     ├─ views/              # Home 课程地图 / Package 关卡列表 / Lesson 单栏课文 / LessonPart 小测・面试题・作业
│     ├─ components/         # FloatingNav 悬浮导航 / ThemeSwitcher 悬浮换肤 / Quiz 小测组件
│     ├─ router.js           # /p/:pkg、/l/:pkg/:lessonId（+/quiz、/interview、/homework）
│     ├─ api.js              # 接口封装 + 进度 + 时长打点
│     ├─ themes.js            # 主题清单（7 组 id/名称/色板）+ 应用与 localStorage 持久化
│     └─ styles/theme.css    # 主题 token 层：:root 为默认暗色，html[data-theme=x] 整组覆盖
├─ courses/                  # 22 个课程包（内容层），全部已统一为扁平布局：
│  └─ <包>/                  #   包根 = course.json + 每个阶段一个文件夹（如 L1-变量与作用域）
│     ├─ lesson-<id>.md          # 课文正文
│     ├─ quiz-<id>.json          # 小测（≥6成及格即自动通关）
│     ├─ interview-<id>.md       # 面试题（带来源）
│     ├─ homework-<阶段id>.md    # 阶段作业（自学资料，无 UI 入口）
│     └─ example-<id>-<名>.js    # 可运行示例（前缀带关卡 id 防重名；首批两包附带）
├─ tools/                    # audit-probe.cjs 内容审计探针；theme-contrast-check.cjs 主题配色对比度自检
├─ data/
│  ├─ progress.md            # 当前学习进度（后端自动回写；手改须先停后端；纳入 Git）
│  ├─ progress.initial.md    # 零进度空白模板（拷给别人/从零开始时复制为 progress.md）
│  └─ sample-progress.md     # 进度的字段含义与修改示例
└─ audit-blueprint.txt       # 内容缺口审计蓝图记录（内部资料）
```

## 九、内容完成度说明

> 截至本次更新：平台已扫描到 **22 个课程包**，且 **22 个已全部满配**；累计已产出 **504 个关卡**（每关 = 课文 + 小测 + 面试题，每阶段末 + 作业）。既有 10 个满配包已完成一轮**内容缺口审计**：探针逐包扫描关键词覆盖，真空知识点酌情补建 **10 个新关**（三件套 + 所属阶段作业齐备），已足量内容一律不重复制品。`12-sveltekit`（SvelteKit）9 阶段 27 关、`13-solid`（SolidJS，含 SolidStart）9 阶段 27 关、`14-signals`（响应式状态管理实战：TC39 Signals / RxJS / MobX / Zustand）9 阶段 27 关、`15-angular`（Angular 实战：企业级框架的主流姿势）9 阶段 27 关均已交付；本轮又新增三个**状态管理专项包**——`16-pinia`（Vue 官方状态管理，5 阶段 15 关）、`17-zustand`（React 轻量 store，7 阶段 21 关）、`18-jotai`（原子化状态，6 阶段 18 关），共 +54 关；本轮再新增**服务端状态专项包** `19-tanstack-query`（React 生态事实标准的数据缓存层，6 阶段 18 关，+18 关）；本轮再新增**工具链专题三包** `20-swc` / `21-biome` / `22-vitest`（黄金·工具链专题，各 5 阶段 15 关，共 +45 关，均以简明为主、只走主流应用流程，不求穷尽官方文档）；本轮针对 `04-vue` **L1 响应式基础**前置补建 2 个零基础起步关——`vue-hello-world`（建工程 / Hello World / 项目结构 / SFC 三段 / 重要性分层）与 `vue-script-setup`（`<script setup>` 语法糖与编译器宏），让新手在碰 `ref/reactive` 前先会创建项目、读懂满屏的 `<script setup>`，`04-vue` 升至 **29 关**、累计 **504 关**；后端完整性自检 **22 包全零告警**。

- ✅ **已满配**（课文 + 小测 + 作业 + 面试题；可运行示例 `examples/` 为首批两包附带）。按下表**包编号顺序**排列，「生态层」列即首页地图的分层归类（与 `Home.vue` 的 `LAYERS` 一致）：

| 课程包 | 生态层 | 阶段 | 关卡 |
| --- | --- | --- | --- |
| `01-es`（ES6→ES2025 逐年） | 基础语言层 | 10 | 35 |
| `02-typescript` | 基础语言层 | 8 | 25 |
| `03-nodejs` | 服务端·运行时层 | 8 | 24 |
| `04-vue`（Vue 3） | 视图框架层 | 8 | 29 |
| `05-react`（React） | 视图框架层 | 8 | 24 |
| `06-miniprogram`（微信小程序） | 跨端层 | 8 | 24 |
| `07-nextjs`（Next.js） | 元框架·全栈层 | 8 | 25 |
| `08-nuxt`（Nuxt 3） | 元框架·全栈层 | 8 | 25 |
| `09-express`（Express 5） | 服务端·运行时层 | 8 | 21 |
| `10-vite`（Vite） | 构建·编译层 | 6 | 17 |
| `11-svelte`（Svelte 5） | 视图框架层 | 10 | 30 |
| `12-sveltekit` | 元框架·全栈层 | 9 | 27 |
| `13-solid`（SolidJS） | 视图框架层 | 9 | 27 |
| `14-signals`（响应式原语·跨框架） | 状态与数据层 | 9 | 27 |
| `15-angular`（Angular v22） | 视图框架层 | 9 | 27 |
| `16-pinia`（Pinia） | 状态与数据层 | 5 | 15 |
| `17-zustand`（Zustand） | 状态与数据层 | 7 | 21 |
| `18-jotai`（Jotai） | 状态与数据层 | 6 | 18 |
| `19-tanstack-query`（TanStack Query） | 状态与数据层 | 6 | 18 |
| `20-swc`（SWC） | 构建·编译层 | 5 | 15 |
| `21-biome`（Biome） | 质量·测试层 | 5 | 15 |
| `22-vitest`（Vitest） | 质量·测试层 | 5 | 15 |
| **合计 22 包** |   |   | **504 关** |

<details>
<summary>缺口审计本轮补建的 10 关（点开展开）</summary>

| 课程包 | 新关 | 落位 | 补建动机（探针真空点） |
| --- | --- | --- | --- |
| `04-vue` | `vue-forms-validation` | L2 尾 | 表单校验体系（v-model 参数/modifiers、vee-validate+zod）此前无人讲 |
| `04-vue` | `vue-directives-teleport` | L3 尾 | 自定义指令钩子与 Teleport 仅在别关点名、无正文 |
| `04-vue` | `vue-use-i18n` | L4 尾 | vue-i18n 整包零覆盖 |
| `03-nodejs` | `node-queues-jobs` | L6 尾 | BullMQ/cron 异步任务与定时作业真空 |
| `09-express` | `exp-prisma` | L5 尾 | Prisma/关系型/`$transaction` 全包 0 次 |
| `07-nextjs` | `next-i18n` | L6 尾 | App Router 多语言（next-intl/hreflang）未展开 |
| `08-nuxt` | `nuxt-i18n-content-layers` | L6 尾 | i18n/Content/Layers 三主题均点名未展开 |
| `10-vite` | `vite-vitest` | 新 L6 | Vitest 体系（mock/组件测试/覆盖率）近乎真空 |
| `10-vite` | `vite-deps-perf` | 新 L6 | optimizeDeps 预构建调优无正文 |
| `10-vite` | `vite-ci-perf` | 新 L6 | CI 缓存/预算门禁/web-vitals 度量真空 |

`01-es`、`02-typescript`、`05-react`、`06-miniprogram` 审计判为已足量，未动。`10-vite` 因新增整个 **L6「测试与性能工程」** 阶段，同步补建 `homework/L6.md`。

</details>

 🎓 **四大框架全部收官**：`15-angular`（Angular 实战：企业级框架的主流姿势，9 阶段 27 关：L1 导论与全景 + L2 组件与模板 + L3 依赖注入与服务 + L4 响应式 signals 与 RxJS 交接 + L5 表单与 HTTP + L6 路由 + L7 状态管理与大型架构 + L8 生态与工程 + L9 收官与选型）**已全部交付**，以 v22 为事实底（standalone 默认、zoneless 默认、Signal Forms GA），主流应用为尺、不挖编译器源码，与 04/05/11/13/14 五包知识点两两对照。`14-signals`（响应式状态管理实战，9 阶段 27 关：L1 导论全景 + L2-L5 TC39 Signals/RxJS/MobX/Zustand 四强各自实战 + L6 横向对比 + L7 体积/调试/性能工程实践 + L8 服务端状态/迁移共存/登录态四实现 + L9 手写 mini-signal 内核·四实现对照终战选型·进阶路线）**已全部交付**，主流应用定位为尺、不深挖源码，口诀链（海关/两税/五碗）贯穿。`12-sveltekit`（SvelteKit，9 阶段 27 关）与 `13-solid`（SolidJS，9 阶段 27 关：L1–L6 响应式内核与组件/事件/异步/性能，L7–L8 SolidStart 文件路由、query+createAsync、服务端函数与部署测试，L9 内核收官 + React 迁移方法论 + 毕业项目）**已全部交付**，两包内容均基于官方文档全文精读做事实底（SolidStart 以 v2 文档为轴）。`11-svelte` 十阶段 30 关**已全部交付**（L8 编译架构/SvelteKit 引桥/部署 + L9 特殊元素/错误边界/Effect 深水区 + L10 Web Components/纯 Svelte SSR/4→5 迁移），对既有 10 个满配包的内容缺口审计**已完成**（见上方表格与明细，+10 关）。

 🎓 **状态管理三强专项收官**：在 `14-signals` 横向综述（其 L5 已带 Zustand 入门）基础上，本轮为三大主流库各立专包、按内容密度差异化分阶（非固定阶段数）：`16-pinia`（5 阶段 15 关：L1 入门与核心 + L2 Getters 与异步 Actions + L3 组合与插件 + L4 实战与 SSR + L5 测试·迁移·选型），以 Vue 官方 Store 为事实底（Setup Store、storeToRefs、$patch/$subscribe、Vuex→Pinia 迁移、Nuxt SSR 水合）；`17-zustand`（7 阶段 21 关：核心回顾与深化 → 中间件链 → 状态切片与组织 → 订阅与并发渲染 → Next.js 与 SSR 全链路 → 实战专题 → 对比·测试·终战），深度专讲 v5 create、useShallow、useSyncExternalStore、中间件链顺序、slices/factory、startTransition/useOptimistic、Next per-request + skipHydration；`18-jotai`（6 阶段 18 关：原子核心 → 派生与写 → 异步与 Suspense → 工具原子库 → 架构与性能 → 选型收官），以原子范式为轴（atom/useAtom、derived/write-only、async + Suspense、loadable/unwrap、atomWithStorage/Family/focus/split、createStore + Provider 隔离、dehydrate/hydrateAtoms）。三包均遵循「主流应用为尺、不挖源码」，与 14-signals、各框架包知识点两两对照。

 🎓 **服务端状态专题收官**：状态管理四包的另一半拼图——`19-tanstack-query`（TanStack Query v5，6 阶段 18 关：L1 核心认知（server state 之痛/useQuery/QueryClient）+ L2 缓存模型（queryKey 工厂/staleTime·gcTime 双时钟/失效与后台重取）+ L3 请求模式（条件依赖/并行预取/useMutation）+ L4 进阶专题（无限分页/取消竞态/乐观回滚）+ L5 框架与工程（SSR 水合/持久化多标签/Devtools 与测试）+ L6 选型与收官（vs SWR·RTK Query/异步状态四层分工总决算/毕业项目影视数据层）**已全部交付**，以官方 v5 文档（llms.txt 全索引 294 篇）为事实底，内容以简明为主；与 16/17/18 三包在竞态、分层、SSR、持久化等知识点上处处对映——「服务器数据归 Query、浏览器数据归状态库」的分工总决算在此合龙。**累计关卡已达 457 关**。

 🎓 **Rust/TS 工具链专题收官**：本轮新增三包，均以「主流应用为尺、不求穷尽文档」为宗旨（每包第一关 overview 专门声明「本教程覆盖什么、不覆盖什么」）：`20-swc`（Speedy Web Compiler，Rust 写的超快编译/转译器，5 阶段 15 关：L1 认知与起点（定位、.swcrc、CLI、core API）+ L2 库与工具集成（swc-loader、打包链、压缩）+ L3 现代语法与正确性（preset-env 降级、loose/spec 兼容权衡、缓存与性能）+ L4 测试与库打包（jest 集成、tsdown 打包、发布产物）+ L5 迁移与收官（插件生态、从 Babel 迁移、毕业选型））；`21-biome`（Rust 一体化 formatter + linter、Rome 精续，5 阶段 15 关：L1 认知与上手（init/check/配置四大分区）+ L2 格式化 + L3 Linter 规则（recommended/分目录/抑制注释）+ L4 迁移与工程化（从 ESLint+Prettier 迁移/monorepo/CI）+ L5 深入与收官（性能/CSS·包管理/选型））；`22-vitest`（Vite 生态即时测试框架，5 阶段 15 关：L1 认知与起跑 + L2 断言与数据（matcher/异步定时器/参数化快照）+ L3 Mock 与隔离（vi.fn·spyOn/vi.mock/钩子隔离）+ L4 组件与集成（jsdom/组件测试/MSW 网络）+ L5 覆盖率与工程化（coverage/UI·projects/CI·从 Jest 迁移））。三包在「编译→质量→测试」上相互呼应，并分别与 10-vite/16-pinia/17-zustand/19-tanstack-query 知识点交叉对照。**累计关卡已达 502 关**。

 🎓 **Vue 起步地基补建**：本轮针对 `04-vue` **L1 响应式基础**，在 `ref/reactive` 之前前置新增两关（三件套齐备，并并入 `homework-L1` 的「第 0 部分·起步实操」）——`vue-hello-world`（从零 `npm create vue`/Vite 建工程、跑通 Hello World、认清项目结构与 SFC 三段式、给出🔴/🟡/🟢重要性分层）与 `vue-script-setup`（`<script setup>` 语法糖与 `defineProps/defineEmits/defineExpose/defineOptions/defineModel` 编译器宏）。旨在解决「新手进来不会建项目、看不懂满屏的 `<script setup>` 就被响应式淹没」的断档。本轮两关示例代码均已升级为「正确 + 错误（含后果）」带注释写法。**`04-vue` 现共 8 阶段 29 关，累计关卡达 504 关。**

 
 🎓 **面试题**：上述 **504 关**均一一配有 `interview-<lessonId>.md`（面向就业、含真实来源与跨关呼应）。后续新增关卡若缺三件套，「🧭 → 📈 记录」底部的**课程包完整性自检**会实时列出待补文件（当前二十二包**零告警**）。

## 十、示例程序规范回改进度（进行中，分多轮）

> 目标：全库所有出现程序的地方都统一为**严格注释规范**——**既包括独立 `example-*.js` 程序，也包括课文 `lesson-*.md` 里的内嵌代码块**（课程文件中的程序同样遵循此规则）。
> 规范五条：①每个例子带「目的」注释；②逐行注释写出该语句当前的影响/结果；③不只给定义、必须给应用；④每个知识点给「正确用例（注结果）」；⑤同时给「错误用例（注会报什么异常/产生什么后果）」。
> **例外**：`homework-*.md` 的「读代码写结果」题**故意不给答案**（给出就废了练习），不受②④⑤约束。
> 因量极大（504 关），以**关卡**为最小单位纵向推进——一关内的 examples 与课文代码一起改完再进下一关，每轮更新此表。

| 批次 | 关卡 | 独立 example | 课文内嵌代码 | 备注 |
| --- | --- | --- | --- | --- |
| B1 | `01-es` L1 变量与作用域 | ✅ 9 个 | ✅ 3 篇（scope/hoisting/closure） | 修失效运行路径 + 目的/结果/错误用例；**修复 `es-scope-03` ESM 冻结写入崩溃真实 bug**；课文内 module/memoize/debounce/curry/class 均补齐“只定义不应用”的应用+错误用例 |
| B2 | `01-es` L2 数据类型与转换 | ✅ 6 个 | ✅ 2 篇（types/coercion） | **修复 `isPlainObject` 运算符优先级真实 bug**；instanceof/typeOf/== 各块补目的+应用+错误用例 |
| B3 | `01-es` L3 函数进化 | ✅ 1 个 | ✅ 3 篇 | 箭头 this / 闭包 / 柯里化补目的+应用+错误用例 |
| B4 | `01-es` L4 对象与数组 | ✅ 1 个 | ✅ 4 篇 | 解构/展开/对象 API 补应用与后果注释 |
| B5 | `01-es` L5 集合与结构化数据 | — | ✅ 2 篇（map-set/structured） | deepClone 补齐循环引用+Date/Map/Set+原型保留应用（实跑验证） |
| B6 | `01-es` L6 迭代器与元编程 | — | ✅ 3 篇（iterator/proxy/symbol） | **修复 iterator counter 值序列真实错误**（`0,1,1,2`→`0,1,0,1`）；**修正 Proxy invariant 两处事实错误**（frozen get 恒抛 TypeError、ownKeys 需不可配置键+Object.keys/for-in 才触发） |
| B7 | `01-es` L7 模块化 | ✅ 2 个 | ✅ 2 篇（module/module-deep） | 跨文件示意补目的头 |
| B8 | `01-es` L8 异步编程 | ✅ 2 个 | ✅ 4 篇（callback/promise/async/event-loop） | callback §九补 `once` 定义+parallel/waterfall 应用；promise 四聚合器+MyPromise 补应用（均实跑验证）；event-loop §十补 `bar()` 定义使可跑 |
| B9 | `01-es` L9 现代语法时间线 | ✅ 1 个 | ✅ 9 篇（2015-2025/modern） | **修正 `buf.transfer(0,512)` 为 `transferToFixedLength(512)`/`transfer(512)`**；**改正 `toWellFormed` 结果首字符为 U+FFFD 替换符（原误多打一个空格）**；class/Iterator helpers/RegExp.escape/Promise.try 均实跑验证；`Math.sumPrecise` 标注 Node 24.18 未提供 |
| B10 | `01-es` L10 环境部署 | — | ✅ 3 篇（build/devtools/publish） | build/publish 配置块补目的+效果注释；publish 新增消费侧 ✅exports 内/❌`ERR_PACKAGE_PATH_NOT_EXPORTED` 用例；devtools 全表格无程序、免改 |
| ✅ | **`01-es` L1~L10 已全部收口**（10 阶 35 关） | ✅ 22 个 example 全 EXIT=0 | ✅ 全 lesson | 含 **4 处真实代码/事实 bug 修正**，关键应用经 Node 24.18 实跑验证 |
| B11 | `02-typescript` L1~L4 | ✅ 4 个（types/interface-shape/union-narrow/generic） | ✅ 12 篇 | 类型基础/接口函数/联合收窄守卫/泛型：目的头+逐行结果+✅应用+❌报错；4 个 example 经 Node 24.18 类型擦除实跑 EXIT=0 |
| B12 | `02-typescript` L5~L8 | ✅ 1 个（L7 utility） | ✅ 13 篇 | 工具类型/装饰器(experimentalDecorators vs TC39)/strict 逐项/tsconfig/渐进迁移/isolatedModules/框架落地/发布：example-ts-project-01-utility 补 Pick/Omit/Partial 应用+错误用例（EXIT=0）；`ERR_PACKAGE_PATH_NOT_EXPORTED`、dual-package 补说明 |
| ✅ | **`02-typescript` L1~L8 已全部收口**（8 阶 25 关） | ✅ 5 个 example 全 EXIT=0 | ✅ 全 lesson | IDE tsc 诊断 + Node 24.18 实跑 |
| B13 | `03-nodejs` L1~L4 | —（本包无独立 example） | ✅ 11 篇 | 运行时/ESM↔CJS/require 缓存/事件循环六阶段/异步错误/EventEmitter/Buffer/fs/path-url/Stream/pipeline：目的头+逐行效果+✅应用+❌运行报错（ENOENT/EMFILE/detached 等）；buffer `encodeFrame/decodeFrame` 往返应用 |
| B14 | `03-nodejs` L5~L8 | — | ✅ 13 篇 | http/https-tls/net-dns/child-process(命令注入 RCE)/cluster/queues-jobs/workers/npm/publish/testing/cli/config/deploy-perf：`npm ci` vs `i`、幽灵依赖、dual-package hazard、优雅退出 SIGTERM/SIGKILL、多阶段 Docker 缓存层序 均补目的头+错误用例 |
| ✅ | **`03-nodejs` L1~L8 已全部收口**（8 阶 24 关） | 无 example（全改课文内嵌代码） | ✅ 全 24 篇 lesson | 每个 fenced 代码块均带目的头；本包无独立 example |
| B15 | `04-vue` L1~L4 响应式/模板/组件/通信 | —（本包无独立 example） | ✅ 17 篇 | ref/reactive/computed/watch、模板渲染与指令、组件基础与生命周期、provide-inject/组合式函数/async-suspense/use-i18n(VueUse+vue-i18n)：目的头+逐行效果+✅应用/结果+❌编译或运行报错（如 `defineProps() is a compiler-hint helper…must be called in <script setup>`） |
| B16 | `04-vue` L5~L8 路由/Pinia/编译性能测试/实战部署 | — | ✅ 12 篇 | VueRouter4(basics/guard-lazy/nested-dynamic)、Pinia(basics/advanced/state-patterns)、sfc-compiler-macros/performance/testing、project-architecture/deploy/ssr-nuxt：**修复 pinia-advanced 插件双层箭头写法 bug**；state 工厂函数坑、`store.$reset()`/`getActivePinia was called with no active Pinia` 报错、nginx history 回退、`VITE_` 前缀安全边界均补目的头+错误用例 |
| ✅ | **`04-vue` L1~L8 已全部收口**（8 阶 29 关） | 无 example（全改课文内嵌代码） | ✅ 全 lesson | SFC/模板/CSS 代码块均带目的头+应用+错误用例；含 1 处既有插件代码 bug 修正 |
| B17 | `05-react` L1~L4 JSX/Hooks/refs复用 | —（本包无独立 example） | ✅ 12 篇 | JSX/组件/渲染模型、useState/useEffect/effect-patterns、refs/memo-hooks(useMemo/useCallback)/advanced-hooks(useReducer/useId/useSyncExternalStore/useTransition)、context/组合(children·render prop·HOC)/custom-hooks：目的头+逐行效果+✅应用+❌运行报错（`Each child in a list should have a unique key`、`You provided a \`value\` prop without an \`onChange\` handler`、`Rendered fewer hooks than expected`） |
| B18 | `05-react` L5~L8 表单列表路由状态性能测试架构 | — | ✅ 12 篇 | forms/lists-keys/render-control(ErrorBoundary·Suspense)、router-basics/router-data(Data Router loader·action)/data-fetching(TanStack Query)、state-mgmt(Context·Zustand)/performance(memo·虚拟化·lazy)/testing(Testing Library)、architecture/nextjs(Server↔Client)/deploy：**React 19 forwardRef 退场与 action+FormData**、`No QueryClient set`、memo 因内联对象失效、Zustand 不传选择器退化、hydration mismatch、`VITE_`/`NEXT_PUBLIC_` 密钥泄漏、nginx 回退 均补目的头+错误用例 |
| ✅ | **`05-react` L1~L8 已全部收口**（8 阶 24 关） | 无 example（全改课文内嵌代码） | ✅ 全 lesson | 每 fenced 代码块均带目的头+应用+错误用例；纯概念无代码块的 lesson（render-model）免改 |
| B19 | `06-miniprogram` L1~L4 认识/绑定/交互/路由 | —（本包无独立 example） | ✅ 12 篇 | 双线程架构/目录/app.json、App↔Page 生命周期、WXML({{}}/wx:if·for·key/rpx)、事件 bind·catch·dataset、setData 异步/路径更新/红线、交互 API 封装、五种跳转/url 传参/tabBar/通信六通道：目的头+逐行效果+✅应用+❌报错（`document is not defined`、`can not navigateTo a tabbar page`、直接改 `this.data` 视图不更新） |
| B20 | `06-miniprogram` L5~L8 组件/网络/存储分包/工程化 | — | ✅ 12 篇 | Component/properties 三铁律/triggerEvent·selectComponent·behavior、生命周期 created→attached→ready→detached、wx.request 三枷锁/封装/竞态/WebSocket、wx.login+code2session 三方、订阅消息、Storage/cache 三件套、分包/preloadRule/独立分包、Skyline、Taro/uni-app、云开发安全规则：**修正 uni-app 示例误用 `</template>` 应为 `</view>`**；`url not in domain list`、session_key 泄漏边界 均补目的头+错误用例；publish（无程序代码块）免改 |
| ✅ | **`06-miniprogram` L1~L8 已全部收口**（8 阶 24 关） | 无 example（全改课文内嵌代码） | ✅ 全 lesson | WXML/WXSS/JSON/JS 代码块均带目的头+应用+错误用例；含 1 处 uni-app 示例标签 bug 修正；纯目录树/表格/发布清单 lesson 免改 |
| B21 | `07-nextjs` L1~L4 心智/路由/RSC/缓存 | —（本包无独立 example） | ✅ 13 篇 | SPA 三座大山/四合一、文件路由(page·layout·template 家族/children 插槽/html-body 铁律)、动态段(params 为 Promise)/并行拦截路由、RSC 与 'use client' 边界/children 穿透/Context 搬家、Suspense 流式、fetch 四写法/三层缓存/unstable_cache、段配置/ISR/cacheComponents·PPR、Route Handler：目的头+逐行效果+✅应用+❌报错（`Missing <html> and <body>`、layout 忘渲 children 白屏、`new Date()` 水合对账失败、`Server Components cannot have state`、CSS Modules 在服务端件报错、串号缓存） |
| B22 | `07-nextjs` L5~L8 变更/体验/性能/部署 | — | ✅ 12 篇 | Server Action 四层防御/useActionState/useFormStatus·useOptimistic/after()、middleware 三层纵深·Auth.js、Tailwind cn/Module CSS 边界、metadata·generateMetadata·hreflang、next/font 零 CLS·next/image 生产线·remotePatterns、next-intl 双层、error/notFound·digest·instrumentation、CWV 三板斧·取数瀑布、测试(RSC/Action/Handler/E2E)、standalone·Docker·Nginx·全栈串联：`'use client'` 边界、密钥进 NEXT_PUBLIC_/缓存串号、matcher 负向断言写宽的代价 均补目的头+错误用例；architect·groups-matchers（纯概念/表格/目录树）免改 |
| ✅ | **`07-nextjs` L1~L8 已全部收口**（8 阶 25 关） | 无 example（全改课文内嵌代码） | ✅ 全 lesson | TSX/TS/JSON/Dockerfile/Nginx 代码块均带目的头+应用+错误用例；纯概念无程序（架构终局、路由组目录树）的 lesson 免改 |
| B23 | `08-nuxt` L1~L4 心智入门/文件路由/渲染生命周期/数据Nitro | —（本包无独立 example） | ✅ 12 篇 | 双目录/~ 别名/vuex 退场、文件路由(page·layout·嵌套/动态段参数为 Ref/路由中间件)、SSR·SSG·ISR·混合渲染与 app: 钩子、useFetch/useAsyncData 双端执行与竞态/Nitro server/api 与路由：目的头+逐行效果+✅应用+❌报错（`ref` 未 import、layout 忘渲 `NuxtPage` 白屏、useFetch 缺 key 竞态、服务端钩子误用在客户端） |
| B24 | `08-nuxt` L5~L8 状态鉴权/模块体验/性能工程/部署架构 | — | ✅ 13 篇 | Pinia 集成与 SSR 水合(state 序列化防串号)、刷新 token 鉴权中间件、i18n/Content/Layers 三主题、SeoMeta/图片/nitro 优化、路由预取与打包体积、多阶段部署与 preset：`useState` vs `useCookie` 水合边界、`nuxt generate` 与按需数据冲突、模块未注册即用 均补目的头+错误用例；纯概念/表格/目录树 lesson 免改 |
| ✅ | **`08-nuxt` L1~L8 已全部收口**（8 阶 25 关） | 无 example（全改课文内嵌代码） | ✅ 全 25 篇 lesson | Vue/Nuxt 模板、TS、JSON、bash、nitro 代码块均带目的头+应用+错误用例 |
| B25 | `09-express` L1~L3 项目结构/中间件/请求响应 | —（本包无独立 example） | ✅ 9 篇 | app/server 分离、洋葱圈 next、中间件五签名与错误中间件四参数、Express5 breaking(async 自动捕获/path-to-regexp v8 `{*name}`/req.query qs)、HttpError+全局 errorHandler、cookie-session-RedisStore/multer/pino/healthz、req 头/内容协商/trust proxy、res 方法与 sendFile 防路径穿越/SSE 清理、multipart 上传与分片合并：目的头+逐行效果+✅应用+❌运行报错（`Cannot set headers after they are sent`、`entity.too.large` 413、错误中间件漏 next 接不到） |
| B26 | `09-express` L4~L5 模板静态/RESTful 实战 | — | ✅ 7 篇 | ESM `__dirname`、static 核心配置(maxAge/etag/immutable/setHeaders)、EJS `<%= 转义` vs `<%- 原始` XSS、express-ejs-layouts、CRUD 状态码与幂等、zod safeParse+strip 防 mass assignment、JWT 双 Token(显式 `algorithms` 防 alg:none)+bcrypt 防枚举+RBAC 防 IDOR、offset vs cursor 深分页、buildFilter 防 NoSQL 注入、Prisma schema 建模/迁移分工/`$transaction` 假事务坑：目的头+逐行效果+✅应用+❌报错（`__dirname is not defined`、`No engine for file`、include N+1、交互式回调误用外层 prisma） |
| B27 | `09-express` L6~L8 安全工程/测试/生产部署 | — | ✅ 5 篇 | feature-slice 目录与 Controller/Service/Repository 三层+DI 工厂、config fail-fast required+AppError 体系+pino redact、helmet/CSP/CORS 互斥/XSS DOMPurify/SQLi 参数化/execFile 防命令注入/rateLimit RedisStore、supertest 测不 listen 的 app+vitest mock DI+mongodb-memory-server+覆盖率门禁、cluster/PM2/多阶段 Docker/Nginx 反代 trust proxy/健康双端点分离/优雅关闭 SIGTERM/keep-alive 超时链/连接池/压缩/缓存三患/内存泄漏/压测：目的头+逐行效果+✅应用+❌报错（`origin:'*'+credentials` 互斥、`EADDRINUSE` 测试并占端口、K8s 叠 PM2 cluster、liveness 查 DB 引发雪崩） |
| ✅ | **`09-express` L1~L8 已全部收口**（8 阶 21 关） | 无 example（全改课文内嵌代码） | ✅ 全 21 篇 lesson | JS/JSON/Dockerfile/Nginx/bash/prisma 代码块均带目的头+应用+错误用例；顺带修正源码 `role:` 缺值语法错误 |
| B28 | `10-vite` L1~L3 初体验/资源处理/构建优化 | —（本包无独立 example） | ✅ 9 篇 | dev 原理/esbuild 只删类型不校验/依赖预构建、静态资源导入与 `?url?raw?worker` 四后缀、CSS 预处理器/postcss/modules、环境变量与 define、`import.meta.glob` 路由表、build 产物解读/target 降级/babel 补平 terser 降体积/sourcify 排障：目的头+逐行效果+✅应用+❌报错（`Unknown extension`、`Array.prototype.at is not a function`、`terser not found`） |
| B29 | `10-vite` L4~L6 插件系统/框架集成SSR/测试性能工程 | — | ✅ 8 篇 | 插件钩子全签名(resolveId/load/transform 分工、config/configResolved 需 JSON.stringify、configureServer 中间件、transformIndexHtml、handleHotUpdate、enforce/apply、虚拟模块 `\0` 配对、generateBundle this.error)、手写完整插件实战、四框架集成(vue/react/swc/svelte 拆件原理)、SSR middlewareMode+ssrLoadModule 三件套与双产物、base/nginx 分级缓存/Docker 多阶段/Monorepo/library external/MPA、Vitest 接线与 mock、optimizeDeps 调优、CI 三层缓存+size-limit 门禁+web-vitals：`plugin is missing a name`、`window is not defined`、忘写 `external:['vue']` 双实例、jsdom `document is not defined` 均补目的头+错误用例；bash/nginx/dockerfile/yaml 块同步改造 |
| ✅ | **`10-vite` L1~L6 已全部收口**（6 阶 17 关） | 无 example（全改课文内嵌代码） | ✅ 全 17 篇 lesson | JS/TS/JSON/JSONC/bash/nginx/dockerfile/yaml 代码块均带目的头+应用+错误用例 |
| B30 | `11-svelte` L1~L3 心智内核/模板事件样式/组合 Snippet | —（本包无独立 example） | ✅ 9 篇 | 编译器派心智/runes 全家($state·raw/$derived·by/$effect 清理与 untrack/$props·$bindable)、props 解构默认值与双向、模板({#each key}/{#await}/{#key}/{@const}/{@html}/bind:this)、on: 指令 vs 小写 prop 与修饰符边界/回调 prop 取代 dispatcher、编译期 scoped CSS/:global/CSS 变量 style:--x、snippet 带参与 {@render}/children/组合三通道/spread-rest 与 class 手动合并：目的头+逐行效果+✅应用+❌报错（渲染即执行的内联调用、each 不写 key 状态串位）；svelte 文件注释语法分层（script 用 `//`、markup 用 `{/* */}`/`<!-- -->`、style 用 `/* */`） |
| B31 | `11-svelte` L4~L6 状态通信/表单动画交互/响应式内核生命周期性能 | — | ✅ 9 篇 | setContext/getContext 初始化期铁律与 Symbol key、.svelte.js 模块全局态与 HMR 保状态、stores 四件套与 $ 自动订阅/toStore 桥、bind:value·checked·group·files/NaN 兜底/受控 vs FormData 非受控/aria 三件套、transition:/in:·out:/animate:flip/crossfade/自定义过渡 tick/class: CSS 动画、use: action 契约与 click-outside/tooltip/longpress/expose、信号图 push-pull/微任务批处理/===短路换引用/$inspect、五阶段时机地图/onMount vs $effect 清理/tick·flushSync、大列表 keyed/虚拟滚动/$state.raw/effect 戒律/测量五流程：localStorage 未判类型上 SSR 报 ReferenceError、单框布尔误用 bind:value、action 不 return destroy 监听泄漏、each 不写 key flip 乱跳 均补目的头+错误用例 |
| B32 | `11-svelte` L7~L10 TS测试工具链/编译架构引桥部署/进阶专题/渲染形态迁移 | — | ✅ 12 篇 | lang=ts 推导规则与泛型 generics/Snippet 类型/svelte2tsx-svelte-check 翻译映射/.svelte.ts 边界、render({props}) 契约/waitFor/单例 reset/测试金字塔四层、sv 四命令/vite-plugin-svelte 接线/runes 三档旋钮/CI 三件套、产物骨架 $.template·user_effect 读源码/三代对比、手搓路由雏形与 Kit 分工地图、纯 Svelte 部署(base/nginx immutable/CDN invalidate index.html/CI 闸门)、svelte:window·document·body/on{event} 合流/svelte:element/动态组件换代与点号小写新规、<svelte:boundary> failed·pending·onerror 传播与捕获四行表、$effect.pre·root·tracking·pending/untrack·$state.snapshot/$memo 四替身、render()/hydrate 手搓 SSR 全管线与数据三纪律、WC 化 customElement 选项/props 反射协议/$host/Shadow 四规则/extend、4→5 映射表六组与 codemod 半径、五步团队节奏：`Unexpected token '<'`、hydration mismatch、on 前缀禁区、effect 内 flushSync 报错 均补目的头+错误用例；migration-legacy（全表格/无程序块）免改 |
| ✅ | **`11-svelte` L1~L10 已全部收口**（10 阶 30 关） | 无 example（全改课文内嵌代码） | ✅ 全 30 篇 lesson | Svelte/TS/JS/CSS/bash/nginx/yaml 代码块均带目的头+应用+错误用例；顺带修正 2 处正文错字 |
| B33 | `12-sveltekit` L1~L9 入册地基/路由进阶/load数据/表单错误/Hooks安全/适配部署/进阶专题/测试排障/内核终战 | —（本包无独立 example） | ✅ 27 篇 | 项目骨架与 svelte.config/vite 双配置、路由可选段/匹配器/reroute、+page/+layout·load（server 与共享）、form action+`enhance`+错误投影、`handle` 认人→`locals` 挂身份→layout 广播与 cookies 默认(httpOnly/sameSite)、CSP/CSRF/safeRedirect、adapter-static·node·平台与 Dockerfile 多阶段/ORIGIN·代理头·优雅停机、`+server.js` 方法导出即路由/ReadableStream/cache-control、i18n `[[lang]]`+reroute+`$t`、`$app/state` 与 navigating/updated、generated types `./$types`·PageProps·app.d.ts、load 单测/mount+flushSync/vi.mock/Playwright、`building` 守卫与 manifest·Server 类 respond=SSR 点火位：`passwordHash` 泄进 HTML、layout 当唯一守卫 params 不变不重跑、Dockerfile ENV/EXPOSE 行尾加 `#` 被当字面量 均补目的头+错误用例；svelte/sveltekit 注释语法分层（`<script>` 用 `//`、markup 用 `{/* */}`/`<!-- -->`、`<style>` 用 `/* */`）；adapters/debug-playbook/performance/capstone（纯表格·目录树·prose）免改 |
| ✅ | **`12-sveltekit` L1~L9 已全部收口**（9 阶 27 关） | 无 example（全改课文内嵌代码） | ✅ 全 27 篇 lesson | JS/TS/JSONC/svelte/bash/nginx/dockerfile/yaml 代码块均带目的头+应用+错误用例 |
| B34 | `13-solid` L1~L9 心智响应式内核/派生stores生命周期/组件模板组合/事件refs类型/Resource·Suspense·错误边界/进阶响应式性能/SolidStart上(路由数据)/SolidStart下(服务端部署测试)/内核终战迁移 | —（本包无独立 example） | ✅ 27 篇 | 两支柱(细粒度 signal+编译期 JSX 无 vdom)、组件只执行一次与丢失响应四写、createEffect 同步追踪/batch·untrack·on、createMemo 断链与早返回改依赖集、createStore Proxy 按路径订阅/produce·reconcile·unwrap、onMount/onCleanup 沿 Owner 树、props Proxy-getter 三铁律(不解构·不提前求值)、控制流 For/Index/Show/Switch vs `.map`/`&&` 冻结、createContext 放 signal 本体非快照、事件委托 vs 原生 `on:`/处理器非响应式/数组绑定省 bind、refs 三形态·use: 指令·样式绑定=属性级 effect、createResource 五态+refetch/mutate·Suspense 就近边界·useTransition 无闪切换·ErrorBoundary 只兜渲染更新流·catchError、细粒度内核(读时登记·===短路·拓扑批处理)、SolidStart `vite.config.ts`+`solidStart()`、query+createAsync+`"use server"`+route.preload+single-flight action、prerender/Nitro 预设/Cloudflare ALS 双配、testing-library render 收函数·无 rerender·renderHook·testEffect·Vitest 双份 solid-js 坑、源码级最小响应系统与 React→Solid 迁移地图：`count` 异步读丢追踪、解构 props 冻结、`{user() && user().name}` 报 possibly undefined、`setN(n()+1)` 之外漏调用、`</Show>` 误把 `//` 放 JSX 开标签属性区、漏 `"use server"` 密钥进客户端、忘 `nodejs_compat` 运行时炸 均补目的头+错误用例；Solid=TSX 注释语法分层（TS 语句 `//`、JSX 子节点 `{/* */}`、`{}` 表达式内 `//`、不把 `//` 放进 JSX 开标签属性区）；bash/toml/jsonc 块同步改造；overview/react-to-solid-migration/capstone（纯表格·目录树·prose）免改 |
| ✅ | **`13-solid` L1~L9 已全部收口**（9 阶 27 关） | 无 example（全改课文内嵌代码） | ✅ 全 27 篇 lesson | TSX/TS/JS/bash/toml/jsonc 代码块均带目的头+应用+错误用例 |
| B35 | `14-signals` L1~L9 导论全景/TC39Signals实战/RxJS实战/MobX实战/Zustand实战/横向对比/工程实践/架构与集成/内核终战 | —（本包无独立 example） | ✅ 27 篇 | signal 心智与四家谱系、TC39 `@angular/core/rxjs-interop` 之外纯提案 `Signal` API（signal/computed/effect/untracked 与 version 短路）、RxJS Observable vs Signal 边界与 `toSignal/toObservable` 双向桥、MobX `makeAutoObservable`/action 批处理/derivation 透明、Zustand `create` 中间件(persist/immer/shallow) 与订阅粒度、四家 API 横向对照与选型、DevTools/内存/SSR 白名单工程实践、架构集成与手写最小响应式内核终战：目的头+逐行效果+✅应用+❌报错（读 signal 未在追踪期、computed 内副作用、effect 死循环不 return 清理、mutate 破坏 MobX derivation、Zustand selector 返新引用致无限重渲 均补错误用例）；纯概念/表格/目录树 lesson 免改 |
| ✅ | **`14-signals` L1~L9 已全部收口**（9 阶 27 关） | 无 example（全改课文内嵌代码） | ✅ 全 27 篇 lesson | JS/TS 代码块均带目的头+应用+错误用例 |
| B36 | `15-angular` L1~L9 导论全景/组件模板/依赖注入服务/响应式signals与RxJS交接/表单HTTP/路由全家桶/状态与大型架构/生态与工程/收官选型 | —（本包无独立 example） | ✅ 27 篇 | 四次大改版心智与 standalone/bootstrapApplication、v17 新控制流 @if/@for/@switch/@defer+四种绑定+@let+投影、四级注入器树与四种 provider+InjectionToken+inject 上下文边界(NG0203/runInInjectionContext)、signal/computed/effect/untracked/patch 与 toSignal/toObservable 桥、zoneless+markForCheck+afterNextRender、Reactive Forms(FormBuilder/校验三元组/FormArray)与 Signal Forms、provideHttpClient/函数式拦截器洋葱/retry-timeout、provideRouter/loadComponent/守卫三段/ResolveFn/TransferState 防双请求、service=singleton store 与 NgRx 五件套/@ngrx/signals/ComponentStore、core/shared/features 三层与 barrel 禁令、Material/CDK/ViewEncapsulation/Web Components 出口、@angular/ssr 增量 hydration+每请求 DI 隔离+prerender、Vitest+TestBed 组件/service/Http 测试、budgets+@defer+track 性能、四框架对照与选型三轴收官：目的头+逐行效果+✅应用+❌报错（`mat-button is not a known element`、忘 `provideClientHydration` 首屏闪烁、Resolver 返 class instance 序列化类型丢失、SSR 端 window ReferenceError、track $index 全重渲染、input 不可 set、provideZonelessChangeDetection 未配 均补错误用例）；Angular 注释语法分层（ts 用 `//`、模板反引号内不加注释、独立 html 块用 `<!-- -->`、css 用 `/* */`、bash 用 `#`、json 片段/目录树/流程图/表格免改）；ng-compare·ng-capstone（纯表格·目录树·prose）免改 |
| ✅ | **`15-angular` L1~L9 已全部收口**（9 阶 27 关） | 无 example（全改课文内嵌代码） | ✅ 全 27 篇 lesson | TS/HTML/CSS/bash 代码块均带目的头+应用+错误用例 |
| B37 | `16-pinia` L1~L5 入门核心/Getters异步/组合插件/实战SSR/测试迁移选型 | —（本包无独立 example） | ✅ 全 15 篇 | defineStore Options/Setup 两写法(ref即state/computed即getter/函数即action、必须 return 暴露)、storeToRefs 保留响应式解构与 action 直接解构、私有态不 return、直接赋值/$patch(对象不支持 push、函数支持)/action 封装、$subscribe(mutation/detached)·$onAction(after/onError 只拦 action)、Setup 无 $reset、乐观更新四步(快照→改→请求→回滚)与指数退避重试/离线队列、跨 store 只在 action 内 useOtherStore、插件 pinia.use/onAction onError 全局错误/持久化 options.persist、acceptHMRUpdate、Vitest(setActivePinia/vi.mocked/桩 localStorage 需 nextTick/mount 需 global.plugins 注入 pinia)、Vuex codemod 迁移：目的头+逐行效果+✅应用+❌报错（忘 return 状态全丢、storeToRefs 漏解 action、$patch 对象写 push 失效、useRouter 顶层解构 undefined、SSR 未 skipHydration 串号 均补错误用例）；Vue 注释语法分层（ts 用 `//`、`<script setup>` 用 `//`、`<template>` 用 `<!-- -->`、bash 用 `#`、json/表格/目录树免改）；ecosystem（纯 prose·表格）免改；顺带修正 plugins 关 logPlugin `onAction({...}){}` 非法语法为箭头回调、修正数处正文错字 |
| ✅ | **`16-pinia` L1~L5 已全部收口**（5 阶 15 关） | 无 example（全改课文内嵌代码） | ✅ 全 15 篇 lesson | TS/JS/Vue SFC/bash 代码块均带目的头+应用+错误用例 |
| B38 | `17-zustand` L1~L7 核心回顾/中间件全解/架构模式/React并发与安全/SSR与Next.js/实战专题/选型与生态 | —（本包无独立 example） | ✅ 全 21 篇 | create 返回 hook+store 一体、set 三写法(浅合并/函数式取最新/replace 丢其余字段)、v5 默认 Object.is 致新对象无限重渲/useShallow、selector 粒度=重渲粒度行级订阅、getState 只用于非渲染管线、transient subscribe 直写 DOM、中间件统一签名与顺序 immer最内/persist中/devtools最外/curried `create<T>()()(chain)`、persist partialize/version+migrate/skipHydration+rehydrate/onRehydrateStorage、Slices Pattern(StateCreator 四泛型/组合透传三元组/跨 slice 只 get() 调 action/导出 selector 做黑盒)、createStore 工厂+Context 注入多实例隔离、useSyncExternalStore 三参契约与撕裂、startTransition/useOptimistic、SSR per-request store+水合 skeleton+cookie storage 双适配、RSC/Client 边界、auth/crud归一化/forms 与 RHF 分工、Vitest 纯测 store/getInitialState/msw/renderHook 数重渲、团队 createStore 工厂规范：目的头+逐行效果+✅应用+❌报错（selector 返新引用死循环、中间件顺序写反 devtools 记 draft 快照、SSR 模块级单例跨请求串号、persist 不判 window 报 ReferenceError、getSnapshot 不缓存、patch 整体替换清空草稿 均补错误用例）；React 注释语法分层（ts 用 `//`、tsx 语句级 `//`、JSX 子节点 `{/* */}`、不把 `//` 放进 JSX 开标签属性区）；compare（纯表格·prose）、layers（表格·目录树·prose）免改 |
| ✅ | **`17-zustand` L1~L7 已全部收口**（7 阶 21 关） | 无 example（全改课文内嵌代码） | ✅ 全 21 篇 lesson | TS/TSX 代码块均带目的头+应用+错误用例 |
| B39 | `18-jotai` L1~L6 原子核心/派生与写/异步与Suspense/工具原子库/架构与性能/选型与收官 | —（本包无独立 example） | ✅ 全 18 篇 | atom 形状定身份(值→可写、getter→只读派生)、三 hook 分工(useAtom/useAtomValue/useSetAtom 不订阅读值引用稳)、write-only atom 封 action(atom(null,write)、参数即接口、write 可编排 write、异步 write await 后续落)、派生惰性缓存+DAG+可写派生(get+set 双向换算)、依赖图自动收集+同帧批处理、async atom throw promise 配 Suspense+依赖变自动重取、loadable 三态显式化/unwrap 互转/atomWithObservable 接推流、竞态内建最新值语义+AbortController/tick 失效、selectAtom/focusAtom(lens 双向深层不可变)/splitAtom 拆行、atomWithStorage/createJSONStorage/atomWithReducer/atomWithDefault(null 即 reset)、makeFamily 手写 Map+失效防泄漏、createStore+Provider 作用域隔离(写时 fork)、vanilla store 三 API、SSR 每请求 store+dehydrate/hydrateAtoms、Vitest store 直测/renderHook：目的头+逐行效果+✅应用+❌报错（对只读派生直接 set no-op、无 Suspense 边界读 async atom 抛错、loadable 又套 boundary 错误静躺、removeItem 误传 index、getOnInit+SSR 水合不一致、模块级单例跨请求串号 均补错误用例）；React 注释语法分层（ts 用 `//`、tsx 语句级 `//`、JSX 子节点 `{/* */}`、不把 `//` 放进 JSX 开标签属性区、bash 用 `#`）；compare（纯表格·prose）免改；顺带修正 race 关 retry 块 `setTimeout(()=>set=>{},0)` 无效代码、修正数处正文错字 |
| ✅ | **`18-jotai` L1~L6 已全部收口**（6 阶 18 关） | 无 example（全改课文内嵌代码） | ✅ 全 18 篇 lesson | TS/TSX 代码块均带目的头+应用+错误用例 |
| B40 | `19-tanstack-query` L1~L6 核心认知/缓存模型/请求模式/进阶专题/框架与工程/选型与收官 | —（本包无独立 example） | ✅ 全 18 篇 | 服务器状态 vs 客户端状态分工与手写 fetch 七坑、useQuery 两要素(queryKey 定身份/queryFn 透传 signal)、status×fetchStatus 二维模型与三态早返回收窄、QueryClient=defaultOptions+命令式 API(getQueryData/setQueryData/prefetch/invalidate/fetchQuery)+Provider 显式注入、client 引用稳定 useState 惰性 new、双时钟 staleTime/gcTime 正交轴、树形 key+key 工厂 as const+前缀失效、invalidate refetchType vs removeQueries、被动刷新聚焦/重连/轮询与 networkMode offlineFirst、enabled/skipToken/placeholderData(keepPreviousData)/initialData、useMutation 四拍(onMutate/onSuccess/onError/onSettled)+useMutationState 跨组件 pending、useQueries 并行+prefetch 预取、signal 竞态正确性层 vs 取消资源层两层皮、useInfiniteQuery pages/pageParams+getNextPageParam 定终点、乐观三件套 cancel→快照→改→回滚/对齐、SSR 每请求 new client+dehydrate/HydrationBoundary+streaming+useSuspenseQuery、persist+broadcast 正交、测试 retry:false+gcTime:0+MSW 网络层拦、四层分工与 Query/SWR/RTKQ 选型：目的头+逐行效果+✅应用+❌报错（queryKey 漏动态参数致永不更新、fetch 不判 res.ok 吞错、mutate 用 useQuery、get 不同 key 去重失效、忘 Provider 报 No QueryClient、getNextPageParam 恒真值滚不停、服务端 persist ReferenceError、SSR 模块级单例跨请求串号 均补错误用例）；React 注释语法分层（ts 用 `//`、tsx 语句级 `//`、JSX 子节点 `{/* */}`、不把 `//` 放进 JSX 开标签属性区）；division（纯 ASCII 分层图·prose）、vs-swr（纯表格·prose）免改；顺带修正 parallel 关 useQueries `);` 缺右括号语法错误、修正数处正文错字 |
| ✅ | **`19-tanstack-query` L1~L6 已全部收口**（6 阶 18 关） | 无 example（全改课文内嵌代码） | ✅ 全 18 篇 lesson | TS/TSX 代码块均带目的头+应用+错误用例 |
| B41 | `20-swc` L1~L5 认知与起点/库与工具集成/现代语法与正确性/测试与库打包/迁移与收官 | —（本包无独立 example） | ✅ 全 15 篇 | Rust 编译器+压缩器与 esbuild/tsc/Babel 三角定位、CLI 闭环(swc src -d dist --delete-dir-on-start/--watch/-C)、.swcrc 三区 jsc/parser-transform-target+module+minify/env(env.targets 优先于 jsc.target)、转译四步解析→擦类型(isolatedModules 只删不查、tsc --noEmit 不能省)→语法变换→打印、JSX automatic/classic+importSource、三 API transform/transformSync/transformFile 同构返回 code+map、optionalDependencies 平台二进制跨机器锁文件坑、swc-loader 换 babel-loader/Rspack 内置/Next 默认 SWC(有 babel 配置则让位)/Vite 用 esbuild、minify 同趟省一次解析+compress/mangle(reserved)/format 三开关与假设清单、装饰器 legacy(legacyDecorator+decoratorMetadata 对齐 tsconfig) vs TC39 两套、ESM↔CJS interop(__esModule/importInterop)与 loose 语义松、webpack5 persistent cache+.swcrc 进 buildDependencies、@swc/jest 换引擎与 Vitest 两路、库两正交轴 SWC 出 JS+tsc/vue-tsc 出 d.ts、exports(types 前置/import/require 分指)+sideEffects+npm pack --dry-run、Babel 预设→SWC 开关三层迁移+产物diff双验收、Wasm 插件与 core 版本耦合 v1.15 ABI、五方选型：目的头+逐行效果+✅应用+❌报错（忘 exclude node_modules 构建爆炸、mangle 不列 reserved 反射出错、忘 decoratorMetadata DI 静默失效、classic 删 import React ReferenceError、库忘 external 双 React 实例、types 未前置类型解析失败 均补错误用例）；工具链注释语法分层（bash 用 `#`、jsonc 配置块行内 `//`+目的头、lib-publish package.json 围栏改 ```jsonc 以容注释）；overview/correctness/cache-perf/babel-migrate/capstone（纯表格·对照表·prose）免改 |
| ✅ | **`20-swc` L1~L5 已全部收口**（5 阶 15 关） | 无 example（全改课文内嵌代码） | ✅ 全 15 篇 lesson | TS/JS/JSONC/bash 代码块均带目的头+应用+错误用例 |
| B42 | `21-biome` L1~L5 认知与上手/格式化/Linter规则/迁移与工程化/深入与收官 | —（本包无独立 example） | ✅ 全 15 篇 | Rust 单二进制 formatter+linter、`biome check`=format+lint+organize imports 三合一、退出码 0/1 挡 PR、--write 只做安全修复/破坏性须显式 --unsafe、biome.json $schema+files/formatter/linter/organizeImports 分区与 files.include 范围控制、优先级 CLI>biome.json>默认、`// biome-ignore` 强制冒号后写理由（可审计纪律）、六大 group(recommended/all/逐条 off)、correctness 整组常开与 tsc 互补、noFloatingPromises、formatter 选项逐项映射 Prettier、organizeImports 与 IDE 冲突、@biomejs/migrate 近似翻译（无法映射插件规则静默丢弃须 review）、共存策略、CI `biome ci`+--error-on-warnings、husky+lint-staged --no-errors-on-unmatched、--changed --since=main、monorepo extends/overrides/vcs.useIgnoreFile、快四来源(Rust/一次解析多处用/并行/daemon-LSP)、四方矩阵(Biome/ESLint+Prettier/dprint/oxlint)与全切·共存·留守选型、插件系统 experimental 别指望：目的头+逐行效果+✅应用+❌报错（跨机器锁文件没带全平台 @biomejs/cli-* → CI 报找不到、指望 --write 修一切→破坏性修复默认不做、裸 `// biome-ignore` 不带冒号理由→Biome 报错、migrate 跑完直接 commit 不 review→lint 基线悄悄变松、lint-staged 漏 --no-errors-on-unmatched→提交中断、忘 files.include→扫全仓含 dist 拖慢 CI 均补错误用例）；工具链注释语法分层（bash 用 `#`、js/jsonc 配置块行内 `//`+目的头）；overview/formatter/organize-imports/L3 三关(linter-rules/correctness/style-complexity)/monorepo/L5 三关(capstone/performance/plugins-css)（纯表格·对照表·prose·无代码块）免改 |
| ✅ | **`21-biome` L1~L5 已全部收口**（5 阶 15 关） | 无 example（全改课文内嵌代码） | ✅ 全 15 篇 lesson | TS/JS/JSONC/bash 代码块均带目的头+应用+错误用例 |
| B43 | `22-vitest` L1~L5 认知与起跑/断言与数据/Mock与隔离/组件与集成/覆盖率与工程化 | —（本包无独立 example） | ✅ 全 15 篇 | 复用 Vite 管线免 Babel、Jest 兼容 API；describe/it/expect 三件套、toBe(Object.is)/toEqual(深比较忽undefined)/toStrictEqual(严格) 精度阶梯、globals:true 需 tsconfig types 否则报「找不到 expect」、environment node/jsdom/happy-dom + @vitest-environment per-file、include/exclude 收窄、watch vs run；异步必 await 防假绿、resolves/rejects、vi.useFakeTimers+advanceTimersByTime+afterEach useRealTimers、vi.setSystemTime、vi.waitFor；it.each 表格驱动 %d 插值、toMatchSnapshot 无脑 -u 警告、CI 禁 -u；钩子四件套作用域与清理栈式逆序、isolate:true 文件隔离、setupFiles/globalSetup/ctx；vi.fn 调用记录 toHaveBeenCalledWith、mockReturnValue/ResolvedValue/Implementation(Once)、vi.spyOn+mockRestore、clear/reset/restore 别盲配 resetAllMocks；vi.mock 自动提升、importOriginal 部分 mock、vi.hoisted 喂提升变量；MSW setupServer listen/resetHandlers/close(on-server)测网络边界；组件 RTL render/getByRole/userEvent/jest-dom、Vue mount+createPinia、findBy/waitFor/flushPromises 异步渲染；coverage provider v8/istanbul、all:true 防虚高、thresholds perFile 挡 CI；projects 拆 node/jsdom、typecheck expectTypeOf、--shard 并行；CI vitest run 禁 watch/-u + github-actions reporter；Jest 迁移 jest→vi、删 babel-jest：目的头+逐行效果+✅应用+❌报错（toBe 比对象引用不等、globals 忘 types 找不到 expect、jsdom 没装 Cannot find package、忘 await 假绿、忘 useRealTimers 污染后续、vi.mock 工厂引用后声明变量 undefined、漏 resetHandlers 覆盖泄漏、coverage 漏 all 假 100%/漏 perFile 拉平、CI 写 watch 卡死/加 -u 洗白 均补错误用例）；测试代码注释语法分层（ts/js 用 `//`、bash/yml 用 `#`）；overview/component（纯 prose·无代码块）免改 |
| ✅ | **`22-vitest` L1~L5 已全部收口**（5 阶 15 关） | 无 example（全改课文内嵌代码） | ✅ 全 15 篇 lesson | TS/JS/bash/yml 代码块均带目的头+应用+错误用例 |
| 🏁 | **全部 22 个课程包（504 关）示例注释改造已收口** | — | ✅ | 14-signals ~ 22-vitest 逐包逐关全部完成；仅回改注释未增删关卡，§九 504 总计不变 |

## 十一、平台功能与内容维护（非注释批次）

| 日期 | 改动 | 文件 | 说明 |
| --- | --- | --- | --- |
| 本轮 | **多主题体系（7 组）+ 全局 🎨 浮动换肤** | `web/src/styles/theme.css`、`web/src/themes.js`、`web/src/components/ThemeSwitcher.vue`、`web/src/App.vue`、`web/src/main.js`、`web/index.html` | 原写死的暗色拆为 **CSS 变量 token 层**：`:root` = 默认「深夜墨蓝」，其余主题各用一个 `html[data-theme="…"]` 块整组覆盖 token（组件代码零改动）。**深色**：深夜墨蓝 / Solarized 夜 / 柔和暗灰（护眼）；**浅色**：纸感浅色 / 冷雾蓝灰 / 护眼豆绿 / 护眼米黄。浮动 🎨 钮挂在 `App.vue`，因此课文/小测/作业/面试题/地图**任何页面任何滚动位置**都能就地切；选择存 `localStorage`，`index.html` 内联脚本在样式表前上色防首屏闪肤；与 🧭 导航面板**互斥**（任一侧打开自动收另一侧，不重叠）。新增主题 = theme.css 加一个块 + themes.js 登记一行 |
| 本轮 | **代码高亮接入主题 token** | `web/src/styles/theme.css` | highlight.js 全局只引了 `atom-one-dark`（自带 `#282c34` 深底），现把各语义组改接到 `--hl-*` token：先中和 `.hljs` 自带底色，再由浅色系主题换上一套加深后的 one-light 配色，**修好了浅色下“字符串 1.6:1 几乎看不见”一类低对比问题** |
| 本轮 | **主题对比度自检探针** | `tools/theme-contrast-check.cjs`、`.gitignore` | `node tools/theme-contrast-check.cjs` 直接解析 theme.css 各 token 块，按 WCAG 公式算「高亮色 vs 代码底」「正文色 vs 页面/卡片底」对比度，**低于 3:1 则 exit 1**；当前 7 组全部达标。调完颜色随手跑一遍，不用靠眼睛猜 | 
| 本轮 | **三类资料页底部加「返回」** | `web/src/views/LessonPart.vue`、`web/src/views/Lesson.vue` | 小测/面试题/作业页（LessonPart）与课文+动手示例页（Lesson）正文最下方新增返回条：`📚 返回课程目录 · 选下一节`（跳 `/p/:pkgId`）+`← 回到课文`，免滚回顶部或退回菜单；`vite build` 验证编译通过 |
| 本轮 | **`04-vue` vue-hello-world 内容补全** | `lesson-vue-hello-world.md` | ①新增 §三「HMR 原理」小节：Vite 开发服务器+WebSocket 推送→重编译变更模块→就地替换、整页不重载、状态保留（课文两处提及 HMR 却未讲原理）；②新增 §四「public vs src/assets 本质区别」对照表（原仅目录树一行注释、而小测/自检/作业均考） |
| 本轮 | **术语“一笔带过”速查表** | `lesson-vue-hello-world.md` | §六后新增「术语速查」表，给 18 个扫过却没解释的词（脚手架/响应式/指令/props-emits/import-export/编译打包/别名代理/tree-shaking/hash/base64/CDN/WebSocket/编译器宏/patchFlag/虚拟滚动/SSR/scoped）各一句话大意 + 标注哪关细讲，不在首讲展开全部 |
| 本轮 | **四个框架包第一关补“先跑起来”** | `05-react/lesson-react-jsx`、`11-svelte/lesson-svelte-overview`、`13-solid/lesson-solid-overview`、`06-miniprogram/lesson-mp-overview` | 全库审计发现这四个框架包的第一关直入概念/语法、从未带“建项目跑起来”（Next/Nuxt/Vite/Express/Angular/TS/SWC/Biome/Vitest 均自带起步，无需改）：React/Solid 新增 §〇 Vite 模板三行命令 + 代码写在哪；Svelte 新增 §〇 Playground/`npx sv create` 两入口；小程序新增 §〇“用微信开发者工具新建项目”（小程序无命令行脚手架）——均只求“有个能跑的地方”、完整部署指向后续关 |

> 以上改动均**不增删关卡**，§九 504 总计与 §十 注释批次表不受影响。换肤属外壳样式层，也不影响课程内容与进度数据。


---

> 技术事实若不确定版本演进，请一律以各框架**官方文档 / MDN / TC39** 为准——本课程反复提醒：
> 警惕过时教程与 AI 幻觉。
