# L8 课后作业：编译架构、SvelteKit 引桥与部署

> 本阶段关键词：$.template / $.store / 定向更新 / mount·hydrate / create_fragment 断代 / Kit 目录契约 / adapter 谱系 / base 与回退 / 不可变发布。
> 判分口径：Bug 题必须指出"事故发生在哪一层（编译/构建/服务端配置/缓存）"才给分；产物解读题允许贴 playground 输出佐证。

---

## 一、Bug 找错（10 小题，指出根因层级并修）

1. 有人把编译产物里的 `let count = 0;` 截图发群里说"Svelte 5 的 $state 是假的，根本没有响应式"。指出他漏看了什么。
2. 升级 Svelte 5 后，团队老文档里的 `create_fragment`、`apropos` 全部搜不到，有人怀疑编译器装坏了。给两步自证方法。
3. `<script>let page = $state(location.pathname)</script>` 写进 `main.js` 直接编译报错。为什么？给出两个合法落点。
4. Kit 项目把第三方 API key 写进了 `+page.ts`，安全扫描报警。为什么 `+page.ts` 不算服务端文件？挪去哪？
5. SSR 报 `window is not defined`，但组件在浏览器里跑得好好的。解释双端执行时序，给两种修法（其中一种用 `$app/environment`）。
6. 部署在 `/console/` 子路径，刷新任意路由正常、但首页加载的 js 全 404。一行配置修掉。
7. 发布后部分用户 `ChunkLoadError`，运维查日志发现旧版本 assets 目录在部署脚本里被 `rm -rf` 了。给出保留策略与 index.html 缓存头的组合修法。
8. CI 里 `vite build` 成功，但线上页面 img 少了 a11y 属性、`$state` 塞了 store 也没人拦。指出质量闸门的设置错误（提示：不是构建的锅）。
9. `dist/` 直接 `rsync` 上生产，改了三处文案发布后用户还是旧页面。给两个可能根因（各属一层：服务端头/边缘缓存）。
10. SSR 渲染时 `render()` 抛错导致整站 500。用"页面级/区域级/进程级"三层给降级方案骨架（不要求代码完整，层次不能混）。

## 二、手写题（5 题）

1. **产物考古**：把本包 L1 计数器组件贴进 playground，抄录 client 输出里 `$.template`、effect、`$.set` 三处关键行，各配一句注释说明"它对应模板里的哪个字符"。
2. **手搓路由补全**：在课文的 popstate 雏形上补齐两件事——链接拦截（点击 `<a href="/x">` 不整页刷、pushState+同步 page）与 404 兜底区块；不许引入第三方路由库。
3. **双形态部署脚本**：给一个纯 Svelte SPA 写 `deploy/` 目录：Nginx 站点配置（base 子路径+回退+缓存头）+ 发布脚本（打包→`releases/<git-sha>`→切 current 软链→回滚函数），并写出你在本机验证它的方法（Docker 或本地多目录模拟均可）。
4. **load 契约对照**：同一个"文章详情页取数"需求，分别写 Next.js（App Router，Server Component 直接 await）与 SvelteKit（`+page.server.ts` load + `data` prop）两版，交一份 200 字内的取舍笔记（边界表达/序列化约束各至少提一条）。
5. **CI 门禁编排**：把 `sv check / eslint / prettier --check / vitest run / vite build / 产物扫描（无 .map、无密钥字符串）` 排成一份 GitHub Actions workflow，要求：任一门禁失败不进部署、部署 job 用 `needs` 串联、产物保留上一版本清单（配合第 7 题的 ChunkLoadError 修法）。

## 三、场景评审（1 题）

某 8 人团队新建"对内数据看板"，PRD：无 SEO、登录后可见、要嵌进老 OA 系统的一个 iframe 页签。技术方案评审意见节选，逐条判断"该采纳/该拒绝/该讨论"并说理（≤250 字）：

> A："上 SvelteKit，全家桶省心。"
> B："看板首屏必须 SSR，不然老板嫌白屏。"
> C："直接用纯 Svelte 打包成单个 js+css，OA 页面里 script 标签引入，挂在 div 上。"
> D："为防白屏，加 Redux 做全局状态管理。"
> E："部署走公司静态桶，配 immutable 缓存头 + index.html no-cache。"

## 四、简答题（3 题）

1. 用"剧本 vs 临场发挥"讲一次 Svelte 与 React 的更新模型差异，并说明 Svelte 的"代价轴"挪到了哪里。
2. SvelteKit 的 `+page.svelte / +page.ts / +page.server.ts / +server.ts / +error.svelte` 各自在哪个端执行、给谁消费？一句话一个。
3. 为什么"Svelte 特有的部署环节"其实只剩三小块？各举一小块说明它归谁管（编译器/lint/你自己）。

## 五、挑战题 🏆

**给一个"寄生"场景做全套交付**：写一个含两个路由（手搓路由即可）的纯 Svelte SPA，产物以"单 js + 单 css"两个文件形态交付（vite build 的 `rollupOptions` 手动分包成一个 chunk、CSS 合并），并提供：①一个模拟老系统的静态 HTML 壳（script 引入+div 挂载点）；②base 相对路径方案让壳文件放任意目录都能跑（提示：`base: './'` 与资源相对引用的边界）；③README 写清"老系统同事三步接入"。验收：壳页面双击 file:// 打开都行更好，不行说明为什么（module/CORS 限制——这本身就是得分点）。

---

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L9**：`svelte-special-elements`——回到组件深水区：全局事件不用 `on:keydown` 挂 window 的现代写法、动态元素与动态组件的 Svelte 5 终形态。
