# L1 课后作业：入册与工程地基

> 本阶段关键词：发动机与整车 / +文件族职责矩阵 / (group) 与 +layout@ / data key 级遮蔽 / sv create 决策项 / svelte.config vs vite.config / $lib 二层架构 / dev-build-preview 三形态 / $env 四模块 / ssr·csr·prerender 开关矩阵 / 增量 load。
> 判分口径：环境类 Bug 必须答出"泄露/失效发生在构建期还是运行期"才给分；布局题必须区分"路由系统出口"与"业务 UI"两层职责；开关矩阵题允许画图，不接受背结论不报场景。

---

## 一、Bug 找错（10 小题，指出根因并修）

1. 新同事把 `+layout.svelte` 里的 `{@render children()}` 挪进 `{#if !loading}` 骨架屏分支，结果登录页（根布局 children 之下）永远白屏。塌方链与两种修法。
2. 项目在 CI 构建后所有页面读 `$env/static/private` 的 feature flag 全是旧值，本地 dev 却正常。病因发生在哪个时期？两个修复方向。
3. 根 layout 返回 `{ nav }`，`/dashboard` 页的 load 也返回 `{ nav: 面包屑 }`，顶部导航在该页塌了且只在这一页塌。机制名字与三条防御。
4. 手滑把 `.svelte-kit/types` 提交了仓库并改了里面一个 `.d.ts`"修类型报错"。一周后同事拉代码全线爆红。双重错误各是什么？
5. `src/routes/(app)/+layout.server.ts` 里 `import { DATABASE_URL } from '$env/static/private'`，某天真浏览器端代码 import 了这个目录下的一个普通组件（非 + 文件），build 竟然成功——但页面没崩数据也没泄漏。为什么这次"侥幸合法"？哪种改法会让编译器真的报警？
6. 给 `/api-docs`（server load 里 `event.fetch` 自家 `/openapi.json`）开 `prerender=true`，构建报循环引用类错误。prerender 时 fetch 打给谁？两种拆法。
7. 某页被开了 `ssr=false`，上线后搜索引擎抓取只拿到空壳、低端机首屏白屏时间变长。这算 bug 还是设计代价？`view-source` 与开发者工具各能看到什么差异？一句话给出该页回滚方案。
8. `vite.config.ts` 里配了 `kit: { adapter: ... }` 期望生效，构建产物却是默认适配。两配置文件分工的经典车祸现场，复述正确位置。
9. `/user/[id]` 页面里 `$page.params.id` 从 1 变 2（同路由仅动态段变化），页面数据没跟着变，但手动刷新就好。增量 load 规则下这是 bug 还是设计？给两个正规解。
10. 新人把 `Navbar.svelte` 放进 `src/routes/`，担心"会不会多出一条路由"；又发现放 `(app)/` 里布局行为微妙。两个问题各一句话回答。

## 二、手写题（5 题）

1. **目录级布局手术**：按"全局壳 + (marketing)/ + (app)/ + 登录页独立无壳"要求，默写 src/routes 顶层目录树（含每层 +layout/@ 出口标注），并用一行注释说明 `/login` 为什么不进任何 group。
2. **三开关矩阵实测**：建四个页面分别配 默认 / `csr=false` / `ssr=false` / `prerender=true`，`build+preview` 后各记录：view-source 里有无内容、JS 落地后 DOM 有无变化、`.svelte-kit/output` 产物形态。整理成一页实验报告。
3. **$env 安全链路**：server load 读 `static/private` 的 `API_TOKEN` → 返回裁剪后的 `{ userName }` → 页面渲染。README 写 50 字"为什么页面永远看不到 token"，并给出把 return 改成整个 env 对象时编译器的真实报错文案。
4. **同目录接力**：`+page.server.ts` 返回私有用户记录（含 email）→ 同目录 `+page.ts` 拿 `event.data` 加工出 `{ avatarInitials }` 给页面。运行验证：页面组件 data 里有没有 email？把结论写成三行"接力链信任报告"。
5. **请求旅程图**：从浏览器地址栏敲 `/blog/x`（首次进站）到水合完成，画出 L1 第四节的六步管线图，在"load 接力"步旁标注本课学的 server/universal 两分法。手画拍照即可。

## 三、场景评审（1 题）

某团队 Kit 仓库初始化 PR 的方案节选，逐条"采纳/拒绝/讨论"并说理（≤250 字）：

> A："所有共享代码一律进 $lib，routes 里只放 + 文件——边界最干净。"
> B："DATABASE_URL 不加 PUBLIC_ 前缀，因为 load 里也要用，加了才'统一'。"
> C："CI 里 build 后直接部署，不必跑 preview——反正 dev 测过。"
> D："登录墙写在根 +layout.svelte 里：没 user 就只渲染登录表单，天然全局。"
> E："路由私有组件贴页面放，被第二处引用时才上收 $lib。"

## 四、简答题（3 题）

1. 默写七口 + 文件职责矩阵（文件/跑在哪/一句话契约），并单独回答：同目录 +page.ts 与 +page.server.ts 的接力方向。
2. $env 四模块矩阵：static vs dynamic（何时取值）、public vs private（谁能看见）各一句话，配一个"该用哪个"的判断例。
3. 站内导航 `/a/b → /a/c` 时哪些 load 跑、哪些不跑？query 变化呢？各一句规则 + 一个补救工具。

## 五、挑战题 🏆

**给 20 人团队写一份 `docs/architecture.md` 初版**（本关全部规范的立法化）：目录二层架构与"两次规则"、(group) 使用边界、$env 变更安全评审流程、三命令在 CI 的最小流水线草案（含 build+preview 冒烟一步）、命名词表（[param] 单数/matcher 后缀/load 字段 camelCase）。评分口径：每条规则后面必须跟一句"防什么事故"——没有理由的规则按未写处理。

---

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L2**：`kit-dynamic-routes`——目录名就是路由语法的全量展开：[param]/[...rest]/[[optional]]、四条排序规则、matcher 给 URL 上形状约束，以及 (group) 与 +layout@ 的布局重排双保险。
