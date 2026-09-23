# 项目骨架：sv create、src/routes、$lib 与环境

> 目标：发车前把整机舱过一遍——官方脚手架 `sv create` 的决策项、routes 的两种物理布局、`$lib` 的边界纪律、`svelte-kit sync` 在生成什么、dev/build/preview 三命令各验什么、`.svelte-kit` 目录解剖，以及 `$env` 如何从机制上防密钥出境。（呼应 svelte-tooling、svelte-deploy、vite-config。）

---

## 一、`npx sv create`：工具链合流后的唯一入口

Svelte 官方工具链已收拢进 **sv CLI**（`create/check/test/tidy/migrate` 一锅端，`create-svelte` 的继任者）：

```bash
npx sv create my-app
# 交互式决策项：
#   - 模板：bare / demo / minimal
#   - TypeScript：full strict / strict 基础 / library 模式 / 不用
#   - 是否装 prettier + eslint
```

生成的骨架三要点：`svelte.config.js`（Kit 配置：adapter/paths/prerender 都在这，vite.config.ts 里挂 `sveltekit()` 插件——**两个配置文件分工：编译器与 Kit 归前者，打包器插件链归后者**，L7 的 svelte 包同款分裂在这延续）；`src/app.html`（HTML 模板，`%sveltekit.head%` / `%sveltekit.body%` 两个占位符就是 11 包手搓 SSR 里"你自己拼模板"的那块底板）；`src/app.d.ts`（**类型增强登记处**：`App.Locals`/`App.Error`/`App.Platform` 往这写，L5/L8 都要回来用它）。

## 二、routes 的两种物理布局与目录纪律

`src/routes/` 是默认，但 `kit.config` 里 `files.routes` 可指到**项目根 `routes/`**——老项目常见（Kit 1.0 前默认如此，脚手架现在提供选项）。目录纪律三条：

- **只有 `+` 开头的文件有魔法**，其他文件（组件、样式、工具函数）随便放、不贡献路由——把 `Navbar.svelte` 塞进 routes 不报错但也不参与路由，纯噪声；
- 特殊文件族 L1 下一关整表伺候：`+page/+layout/+error/+server/+reset`；
- `(group)` 括号目录不影响 URL、`[param]` 方括号是动态段——**目录名就是路由语法**，这一层认知 L2 全量展开。

## 三、`$lib`：一条别名买到的架构纪律

`$lib` 默认指向 `src/lib`（可在 `kit.alias` 改）。它不是缩短 import 的糖，是**模块边界的物理线**：

- `import x from '$lib/x'` —— 任何路由代码都可见的共享层（组件/工具/stores）；
- routes 目录下的东西默认只有路由内部互引——**"这段代码属于页面私有还是全局资产"的答案写在了文件位置里**；
- 更重要的暗纪律：**服务端专用代码永远不放 $lib 深处再被页面 import**——`.server.ts` 后缀是唯一的私有性保险（下一节），放 $lib 的密钥模块等于给全仓开公共接口。

## 四、三命令与 .svelte-kit：各验什么

| 命令 | 干什么 | 排障定位 |
|---|---|---|
| `npm run dev` | Vite dev server + Kit 中间件，SSR 每请求现做 | HMR 失效/钩子行为看这里 |
| `npm run build` | 客户端 bundle + SSR 产物 + **adapter 落地包** | CI 里跑，产物问题在这暴露 |
| `npm run preview` | **跑 build 后的产物**（不是 dev！） | "dev 正常 build 炸了"专用复现位（对照 10-vite 的 dev/build 双人格） |

`npx svelte-kit sync`：按 routes 现状重新生成 `.svelte-kit/` 里的类型声明与 manifest 骨架——改了路由目录结构、或 `./$types` 报红时的第一补救命令（多数场景 dev/build 会自动跑，CI 缓存怪有时要手动）。`.svelte-kit/` 整体**不进版本库**：它是生成物（types/、output/、非生产环境下的 runtime 缓存），删了重跑即恢复——L9 internals 关会回来解剖这里。

## 五、`$env`：密钥不出境的机制保险

四种模块两两一对：

```bash
# .env 文件
PUBLIC_API_BASE=https://api.example.com   # PUBLIC_ 前缀
DATABASE_URL=postgres://...               # 无前缀 = 私有
```

- `$env/static/private` —— 构建期**内联进服务端产物**，客户端 bundle 物理不含（编译器看到 import 自 static/private 的代码进客户端直接 build 报错——这是 Next `NEXT_PUBLIC_` 靠约定、Kit 靠编译拦截的差别）；
- `$env/static/public` —— 构建期定值，两端可用；
- `$env/dynamic/private` / `dynamic/public` —— 运行期读 `process.env`，改值不用重 build（代价：失去内联优化，且 **dynamic 的 import 本身不能出现在客户端代码里**——public 版也只能在 server 侧 load/hooks 用）。

纪律一句话：**"要不要 PUBLIC_" 是安全评审问题，不是命名习惯问题**——进了 static/public 就等于印在 HTML/JS 里对全世界公开（11 包 SSR 数据注入"注入即公开"条款的亲兄弟）。

## 六、自检清单

- [ ] sv create 的三决策项与两个配置文件的分工一句话。
- [ ] routes 目录三纪律；(group)/[param] 在目录名层面的含义。
- [ ] $lib 边界暗纪律：服务端密钥为什么不能藏进 $lib。
- [ ] dev/build/preview 各验什么；"dev 正常 build 炸"该跑哪条命令复现？
- [ ] $env 四模块矩阵：static vs dynamic、public vs private 各切哪条线。

---

🚀 **下一关**：`kit-routing-basics`——+ 文件族全家福：page/layout/error/server 的职责矩阵、嵌套布局的 children 出口、一个请求从 URL 到渲染的全流程走查。
