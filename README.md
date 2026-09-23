# 大前端学院 · BigFront Academy 🚀

一个**可运行、可打卡、可扩展**的大前端「打怪升级」学习平台。暗色主题（借鉴 VS Code Dark+ / Solarized），
专为「对大前端零概念、想在本地边学边往 GitHub 提交」的你而做。

覆盖方向：JavaScript(ES6→ES2025) · TypeScript · Node.js · Express · Vue 3 · React · Svelte/SvelteKit · Solid · 微信小程序 · Next.js · Nuxt · Vite（各包完成度见第九节）。

---

## 一、整体逻辑架构

```
网页（外壳框架）  →  课程包（courses/*）  →  课程 + 作业包
```

- **外壳框架** = `web/`(Vue3+Vite 前端) + `server/`(Express 后端)。
  框架启动时**自动扫描** `courses/` 下所有课程包，读取每个包的 `course.json` 大纲，
  据此渲染地图、关卡、课文、小测。**加一个新课程包 = 在 courses/ 里新建一个文件夹，无需改一行框架代码。**
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

## 六、提交到 GitHub（首次）

```bash
git init                 # 若尚未初始化
git add -A
git commit -m "feat: 大前端学院学习平台（框架 + 13 个满配课程包）"
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
| 主题 | 暗色（VS Code Dark+ / Solarized 灵感） |

## 八、目录速览

```
BigFront/
├─ package.json          # 根：统一 dev/build 脚本
├─ server/               # Express 后端（index.js 为核心）
├─ web/                  # Vue3 前端外壳
│  └─ src/
│     ├─ views/          # Home 地图 / Package 关卡 / Lesson 学习页
│     ├─ components/     # FloatingNav 悬浮导航 / Quiz 小测
│     ├─ api.js          # 接口 + 进度 + 时长打点
│     └─ styles/theme.css
├─ courses/              # 13 个课程包（内容层）
│  └─ <包>/interviews/   # 面试题库（与关卡同名同目）
└─ data/
   ├─ progress.md          # 当前学习进度档案（自动重建，可手改，纳入 Git）
   ├─ progress.initial.md  # 零进度空白模板（拷给别人/从零开始时复制为 progress.md）
   └─ sample-progress.md   # 进度的字段含义与修改示例
```

## 九、内容完成度说明

> 截至本次更新：平台已扫描到 **13 个课程包**，且 **13 个已全部满配**；累计已产出 **331 个关卡**（每关 = 课文 + 小测 + 面试题，每阶段末 + 作业）。既有 10 个满配包已完成一轮**内容缺口审计**：探针逐包扫描关键词覆盖，真空知识点酌情补建 **10 个新关**（三件套 + 所属阶段作业齐备），已足量内容一律不重复制品。`11-svelte`（Svelte 5）从 L8 起补齐收官三阶段、30 关满配；`12-sveltekit`（SvelteKit）9 阶段 27 关、`13-solid`（SolidJS，含 SolidStart）9 阶段 27 关均已交付；后端完整性自检 **13 包全零告警**。

- ✅ **已满配**（课文 + 小测 + 作业 + 面试题；可运行示例 `examples/` 为首批两包附带）：

| 课程包 | 阶段 | 关卡 |   | 课程包 | 阶段 | 关卡 |
| --- | --- | --- | --- | --- | --- | --- |
| `01-es`（ES6→ES2025 逐年） | 10 | 35 |   | `07-nextjs` | 8 | 25 |
| `02-typescript` | 8 | 25 |   | `08-nuxt` | 8 | 25 |
| `03-nodejs` | 8 | 24 |   | `09-express` | 8 | 21 |
| `04-vue` | 8 | 27 |   | `10-vite` | 6 | 17 |
| `05-react` | 8 | 24 |   | `06-miniprogram` | 8 | 24 |
| `11-svelte`（Svelte 5） | 10 | 30 |   | `12-sveltekit` | 9 | 27 |
| `13-solid`（SolidJS） | 9 | 27 |   |  |  |  |

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

- ✅ **新增收官**：`12-sveltekit`（SvelteKit，9 阶段 27 关）与 `13-solid`（SolidJS，9 阶段 27 关：L1–L6 响应式内核与组件/事件/异步/性能，L7–L8 SolidStart 文件路由、query+createAsync、服务端函数与部署测试，L9 内核收官 + React 迁移方法论 + 毕业项目）**已全部交付**，两包内容均基于官方文档全文精读做事实底（SolidStart 以 v2 文档为轴）。`11-svelte` 十阶段 30 关**已全部交付**（L8 编译架构/SvelteKit 引桥/部署 + L9 特殊元素/错误边界/Effect 深水区 + L10 Web Components/纯 Svelte SSR/4→5 迁移），对既有 10 个满配包的内容缺口审计**已完成**（见上方表格与明细，+10 关）。
- 🎓 **面试题**：上述 **331 关**均一一配有 `interviews/<lessonId>.md`（每关 12 题、面向就业、含真实来源与跨关呼应）。后续新增关卡若缺三件套，「🧭 → 📈 记录」底部的**课程包完整性自检**会实时列出待补文件（当前十三包**零告警**）。

> 技术事实若不确定版本演进，请一律以各框架**官方文档 / MDN / TC39** 为准——本课程反复提醒：
> 警惕过时教程与 AI 幻觉。
