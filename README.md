# 大前端学院 · BigFront Academy 🚀

一个**可运行、可打卡、可扩展**的大前端「打怪升级」学习平台。暗色主题（借鉴 VS Code Dark+ / Solarized），
专为「对大前端零概念、想在本地边学边往 GitHub 提交」的你而做。

覆盖方向：JavaScript(ES6→ES2024) · TypeScript · Node.js · Vue 3 · React · 微信小程序 · Next.js · Nuxt。

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
  ├─ course.json            # 大纲 manifest：包信息 + 分级(levels) + 每级关卡(lessons)
  ├─ lessons/<id>.md         # 课文（Markdown）——概念 + 深入讲解 + 示例 + 自检清单
  ├─ examples/<id>/*.{js,ts}  # 该关的可运行示例代码
  ├─ quizzes/<id>.json       # 该关小测（含正确答案，仅服务端可见，防泄题）
  ├─ interviews/<id>.md      # 该关的面试题（课末实战，面向就业；与关卡同名同目）
  └─ homework/L<n>.md        # 该阶段作业（Markdown）
  ```

- **打怪升级**：包内第 1 阶段默认解锁；某阶段的全部关卡通关后，才解锁下一阶段。
  通关一关 = **读完课文 + 看完示例 + 小测 ≥60% + 完成作业**，四步齐全。
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
git commit -m "feat: 大前端学院学习平台 v1（框架 + ES/TS 完整包 + 6 框架骨架包）"
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
| 数据存储 | 纯文件 `data/progress.json`（零外部数据库依赖） |
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
├─ courses/              # 8 个课程包（内容层）
│  └─ <包>/interviews/   # 面试题库（与关卡同名同目）
└─ data/
   ├─ progress.md          # 当前学习进度档案（自动重建，可手改，纳入 Git）
   ├─ progress.initial.md  # 零进度空白模板（拷给别人/从零开始时复制为 progress.md）
   └─ sample-progress.md   # 进度的字段含义与修改示例
```

## 九、内容完成度说明

- ✅ **完整**（课文+示例+小测+作业+**面试题**）：`01-es`(6 关) 与 `02-typescript`(5 关) —— 首批地基。
- 🚧 **骨架已通、首两关有实质内容、可继续扩写**：Node / Vue / React / 小程序 / Next / Nuxt。
  每关课文底部都标注了「🚧 骨架关卡」及**应去哪个文件补充**，随学随填。
- 🎓 **面试题**：当前 23 关**一一配有** `interviews/<lessonId>.md`（面向就业的课末实战）；
  后续新增关卡时，服务会在「完整性自检」中提醒缺失。

> 技术事实若不确定版本演进，请一律以各框架**官方文档 / MDN / TC39** 为准——本课程反复提醒：
> 警惕过时教程与 AI 幻觉。
