# runtimeConfig：一产物走天下的配置体系

07 包用 NEXT_PUBLIC_ 泄漏密钥的事故开过题（呼应 next-deploy 第 2、4 节），Nuxt 把同样的问题做成了**结构化防呆**：runtimeConfig 天生分两栏，私密与公开在类型层面就是两个对象——这是 Nuxt 配置体系最值得借鉴的一处设计（通用配置纪律先呼应 node-config）。

## 1. 双栏模型与 NUXT_ 注入

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    databaseUrl: '',           // 私密栏：只有服务端代码读得到
    openaiKey: '',
    public: {                  // 公开栏：会内联进 payload，浏览器可见
      apiBase: '/api',
      appName: 'NoteDeck',
    },
  },
});
```

```ts
// 任意上下文
const cfg = useRuntimeConfig(event);   // 服务端 handler / SSR 里传 event 更准
await $fetch(cfg.databaseUrl);          // ✅ 服务端
// cfg.public.apiBase                   // ✅ 双端可读
// cfg.databaseUrl 在纯客户端 = undefined（Nitro 不把私密栏发往浏览器）
```

环境变量覆盖规则：**`NUXT_` + 大写路径键**，下划线/连字符归一——`NUXT_DATABASE_URL`、`NUXT_PUBLIC_API_BASE` 分别覆盖两栏。部署侧只改环境变量不碰构建：一次 build 的产物在 dev/staging/prod 之间搬着跑（呼应 nuxt-overview B3、D1）。

## 2. 时机对照表：谁在什么时候定格

| 配置面 | 求值时机 | 可见方 | 改后动作 |
|--------|----------|--------|----------|
| nuxt.config 框架字段 | 构建期 | 仅构建/服务端 | 重新 build |
| runtimeConfig 非 public | 运行期注入 | 仅服务端 | 重启/重部署即可 |
| runtimeConfig.public | 运行期（随 payload 下发） | 双端 | 同上 |
| app.config | 构建期 | 双端（只读） | 重新 build |
| import.meta.env.DEV 等 | 构建期内联 | 代码所在端 | 重新 build |

对照 Next 三行版：NEXT_PUBLIC_* ≈ runtimeConfig.public 但**构建期内联**（改值必重构建），服务端变量 ≈ 非 public 栏运行期读（呼应 next-deploy C1）。Nuxt 的 public 是运行期求值再随 payload 走——多环境同产物的关键差异就在这。

## 3. 类型、默认值与缺失防御

```ts
runtimeConfig: {
  // 默认值写 dev 友好值，生产靠环境覆盖
  databaseUrl: 'sqlite:./dev.db',
  openaiKey: '',
}
```

类型由 config 对象推导（cfg.databaseUrl 是 string，改不了形状）；默认值策略：**私密栏默认空串 + 启动断言**——Nitro 插件里 `if (!cfg.databaseUrl) throw new Error('missing config')`，让错配置在 boot 期炸而不是首个请求炸（呼应 node-config 的启动校验、nuxt-lifecycle B2）。可选进阶：zod 包一层 `parseRuntimeConfig()`——环境变量是外部输入这条纪律在配置域同样成立（呼应 nuxt-server-routes 第 2 节的校验观）。

## 4. env 文件与机密管理

加载顺序（后者覆盖前者）：进程环境 > `.env.production`（构建/运行环境文件）> `.env.local` > `.env`。生产容器直接注环境变量，.env 文件基本只在本地与单体部署用。云端机密走平台 secret manager（Vercel 加密 env、Vault），落盘 .env 不进 git 只进 .env.example（模板里放键名与注释、不放值——呼应 nuxt-directory 第 5 节）。密钥轮转场景：runtimeConfig 读进程环境，重启即生效——比"重新构建镜像"快一个数量级，这就是运行期配置的运维价值。

## 5. 双栏之外：per-env 配置文件的诱惑与陷阱

Nuxt 支持 `nuxt.staging.config.ts` 式环境文件（nitro.experimental 路线）与 `dotenv` 多文件——看似方便，实则把"配置中心表"碎片化成 N 个文件，review 与漂移成本暴涨。建议姿态：**结构差异进 config 代码（构建期分支），数值差异全走 runtimeConfig + 环境变量**——一张环境变量清单（键名、类型、默认、负责人）进文档库当合同（呼应 nuxt-render-modes D2 的治理思路）。Next 社区同款教训：env 文件越多，"哪个文件赢"的问题越多。

## 6. 自检清单

- [ ] 双栏语义与"私密栏客户端恒 undefined"记牢；
- [ ] NUXT_PUBLIC_X 覆盖规则能写对变量名；
- [ ] 私密栏默认空串+boot 断言的防御模式会用；
- [ ] 分清 runtimeConfig（运行期）与 app.config（构建期）；
- [ ] 环境变量清单当合同管理的意识建立。

## 7. 小结

runtimeConfig 用结构回答了一个老问题："这个值是给谁的、什么时候定的"——两栏一切，密钥泄漏与多环境错配两大类事故都被设计面挡下。L4 收官：数据（useFetch）、服务端（Nitro/H3）、配置（runtimeConfig）三块拼图齐了，下一层该谈"数据怎么在用户操作里活着回来"——状态管理。

🚀 部署预告：下一关 nuxt-state 进入 L5：Pinia 在 SSR 下的水合与转移、useState 的轻量位、以及"什么状态该进 payload"的裁决标准。
