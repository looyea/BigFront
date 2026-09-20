# 项目结构与约定式目录：Nuxt 的地基图

上一关认识了三层结构（呼应 nuxt-overview 第 2 节），这一关把项目摊开逐层数一遍。Nuxt 与 Next 一样信奉"文件放对位置胜过千行配置"（呼应 next-routing 第 2 节的目录约定），但 Nuxt 多了一处关键差异：一切约定的背后有个 `.nuxt/` 生成目录——它是所有魔法的总后台，看懂它，框架就从"魔法"降级成"代码生成"。

## 1. 目录全家福

```
my-nuxt/
├── app/                     # 前端应用区（Nuxt 4 收敛于此）
│   ├── app.vue              # 根组件：渲染 <NuxtPage/> 即出路由
│   ├── pages/               # 文件路由：一个 .vue = 一条 URL
│   ├── layouts/             # default.vue 等命名布局
│   ├── components/          # 自动注册组件（BaseButton.vue → <BaseButton/>）
│   ├── composables/         # 自动导入的 use* 组合式函数
│   ├── middleware/          # 路由中间件（客户端/服务端双态）
│   └── plugins/             # 全局插件（vue app 实例挂载前执行）
├── shared/                  # utils 等"前后端都能用"的纯代码
├── server/                  # Nitro 服务区（独立世界观）
│   ├── api/                 # 接口：stats.get.ts → GET /api/stats
│   ├── middleware/          # 服务端中间件（每个请求先到这）
│   ├── routes/              # 非 /api 前缀的服务端路由
│   ├── plugins/             # Nitro 启动钩子
│   └── utils/               # 服务端专用工具（不会自动进前端）
├── public/                  # 原样静态资源（对比 Vite 的 public，同 Next，呼应 next-groups-matchers 第 4 节）
├── node_modules/
├── .nuxt/                   # ⚠️ 生成物：gitignore 它
├── .output/                 # ⚠️ 构建产物：gitignore 它
├── nuxt.config.ts           # 总控台
├── tsconfig.json            # 继承 .nuxt/tsconfig.json
└── package.json
```

与 07 包对照记忆：app/pages ≈ Next 的 app/（但只有 .vue 页面，没有 layout.tsx 全家桶嵌套约定——布局走 layouts/ 目录，L2 详解）；server/api ≈ Route Handler 但免序列化关税（同进程函数直调，nuxt-server-routes 见分晓）；public/ 两家同款。

## 2. 别名系统：# 开头的暗号

| 别名 | 指向 | 说明 |
|------|------|------|
| `~/` 或 `@/` | app/（含旧布局根） | 前端代码绝对导入 |
| `@@/` 或 `@@/` | 项目根 | 够到 app/ 外面的（如 server/） |
| `#imports` | 自动导入聚合虚拟模块 | IDE"从哪来"的答案就在这 |
| `#shared` | shared/ | 跨端共享层 |
| `#server-utils` | server/utils | 仅服务端上下文 |

`#` 系列是构建期生成的虚拟模块（Vite alias 机制，呼应 vite-intro 第 4 节 resolve.alias）——看到 #imports 别慌，它就是自动导入的"总电缆井"。

## 3. .nuxt/：魔法现形记

`nuxt prepare`（或 dev 启动）会生成 .nuxt/，里面值得翻开看三样：

1. **`tsconfig.json`**：别名与类型声明的权威定义——项目根 tsconfig 只写 `{ "extends": "./.nuxt/tsconfig.json" }`，IDE 红线问题九成出在它过期（跑一次 prepare 就好）；
2. **`components.d.ts` / `imports.d.ts`**：自动注册与自动导入的清单文件——组件为什么不解析、composable 为什么没类型，先来这里对账；
3. **`app.config` / 各类虚拟模块**：路由表、中间件注册、插件排序——最终都会汇总进 `pages.mjs` 之类的胶水代码。

心智升级一句话：**Nuxt 不是运行时黑魔法，是"扫描目录 → 生成代码 → 编译生成物"的代码生成器**（Vue 宏同理，呼应 vue-sfc-compiler-macros 的编译器视角）。排查诡异问题的通法：删 .nuxt 重新 prepare，再不行就去生成物里找证据。

## 4. 配置文件分层

- `nuxt.config.ts`：框架行为（ssr、routeRules、modules、css、vite 内联配置）——它是 TS 文件，可 import、可条件逻辑，但要记住构建期求值；
- `.env`：环境变量只认 `NUXT_` 前缀注入 runtimeConfig（对照 Next 的 NEXT_PUBLIC_ 语义差异，nuxt-runtime-config 专讲）；
- `app.config.ts`：**构建期确定、客户端可见**的应用配置（主题色、版权），与 runtimeConfig 的"运行期可变"形成互补双轨——这个区分 Next 没有直接对等物，面试高频；
- 多个 config 文件会合并，数组字段追加、对象字段浅合并——大团队建议一项目一 config，别玩 extends 套娃。

## 5. 什么进 git，什么不进

| 进 | 不进 | 原因 |
|----|------|------|
| app/ server/ shared/ public/ | .nuxt/ | 生成物，clone 后 prepare 即复现 |
| nuxt.config.ts、package.json、lockfile | .output/ | 构建产物归 CI/部署 |
| .env.example（模板） | .env | 密钥永不进库（呼应 exp-security） |
| tsconfig.json（extends 壳） | node_modules/ | 通用常识 |

## 6. 自检清单

- [ ] 能默写 app/ 与 server/ 两套目录及各自职责；
- [ ] 知道 app/ 与 shared/ 的代码谁能 import 谁（前端可进 shared，server 也可——#shared 双可达）；
- [ ] IDE 报"找不到 #imports"时的第一步动作是什么（nuxt prepare）；
- [ ] 分得清 nuxt.config / .env / app.config 三层的时机与可见性；
- [ ] gitignore 三件套（.nuxt/.output/.env）齐了吗。

## 7. 小结

结构即架构：app/ 管"看得见的"，server/ 管"跑在后面的"，shared/ 是两者共用的纯逻辑层，.nuxt/ 是前两者的"合同公证件"。目录观建好，下一关拆解 Nuxt 最著名的糖——自动导入，以及它暗中标价的账单。

🚀 部署预告：下一关 nuxt-auto-imports 讲自动导入的机制边界与"什么时候必须手写 import"——魔法用对了是生产力，用错了是解谜游戏。
