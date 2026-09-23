# 模块系统：一行数组背后的扩展生态

## 1. 心智：Nuxt 的"插件"是构建期的程序，不是配置文件

在 07-nextjs 里我们学过：Next 没有插件系统，能力都靠改 `next.config.js` 的字段和约定（图片靠 `<Image>`、字体靠 `next/font`）。Nuxt 走的是另一条路——**模块（Module）是一段在构建期被执行的代码**，它能读改 Nuxt 的整个内部状态（hooks 流水线），因此一行配置就能带来"自动导入 + 组件 + 服务端路由 + 类型 + 运行时配置"五件套：

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: [
    '@pinia/nuxt',
    '@nuxt/image',
    '@nuxt/content',
    '@nuxtjs/robots',
    '~/modules/tenant-theme',   // 本地模块也走同一入口
  ],
});
```

`npx nuxt module add image` 会解析官方模块注册表、装依赖、改 nuxt.config、跑一次 build 自检（呼应 nuxt-directory 的 package.json 变更可见性）。**这是 Nuxt 生态最被低估的竞争力：能力的"安装体验"接近 VS Code 扩展。**

## 2. 模块的执行时机：构建期，不是运行期

```
nuxt build/dev 启动
 → 解析 nuxt.config（合并 layers/env，呼应 nuxt-runtime-config 第 3 节）
 → 依次执行 modules[]（同步/异步函数，拿 nuxt 实例）
   ↳ 每个模块通过 nuxt.hooks 注册钩子，改动：别名、自动导入表、组件目录、
     vite/webpack 配置、生成的 .nuxt 文件、server route 清单、TS 类型
 → 生成 .nuxt/（类型与虚拟模块，排查问题第一现场，呼应 nuxt-directory 第 5 节）
 → 启动 Vite（客户端 + 服务端两个环境）与 Nitro
```

三条硬结论：

1. 模块**不参与运行时请求处理**（除非它注册了 `nitro:config` 往里塞 server handler/middleware）；
2. 模块里读不到 `event`、读不到用户数据；能读到的只有配置与文件系统；
3. 改了模块配置必须重启 dev server 才生效（.nuxt 重新生成），这是"我改了 nuxt.config 但没变化"的头号原因。

## 3. 写一个自己的模块：以"多租户主题"为例

```ts
// modules/tenant-theme/index.ts
import { defineNuxtModule, addImports, addPlugin, createResolver, useLogger } from '@nuxt/kit';

export default defineNuxtModule<{ tenants: string[] }>({
  meta: { name: 'tenant-theme', configKey: 'tenantTheme' },  // configKey → nuxt.config 里的字段名
  defaults: { tenants: [] },
  setup(options, nuxt) {
    const log = useLogger('tenant-theme');
    const { resolve } = createResolver(import.meta.url);
    log.info(`已启用租户主题，租户数：${options.tenants.length}`);

    // ① 注入自动导入（呼应 nuxt-auto-imports：编译期逐符号写进 .nuxt/imports.d.ts + 虚拟模块）
    addImports([{ name: 'useTenantTheme', from: resolve('./runtime/composables/useTenantTheme') }]);
    // ② 注入运行时插件（构建期注册，运行期在 vue:setup 时机执行，呼应 nuxt-lifecycle）
    addPlugin({ src: resolve('./runtime/plugin'), mode: 'all' });
    // ③ 注入服务端路由（模块能带 API！呼应 nuxt-server-routes）
    nuxt.hook('nitro:config', (cfg) => {
      cfg.virtual = cfg.virtual || {};
      cfg.virtual['handlers/tenant-theme/index.ts'] = `
        export default defineEventHandler(() => ({ tenants: ${JSON.stringify(options.tenants)} }));
      `;
    });
    // ④ 注入 CSS 变量到构建期（下一关 styling 会展开）
    nuxt.options.css.push(resolve('./runtime/theme.css'));
  },
});
```

目录约定：`modules/<name>/{index.ts, runtime/**}`。**`runtime/` 里的代码是运行期代码**，能被模块注入的插件/composable 引用；`index.ts` 是构建期代码，两者不要互相 import（这是模块开发第一号错误：在 index.ts 里 import vue 组件，构建期直接炸）。

## 4. 常用 Kit 工具与钩子速查

| 目的 | 工具 / 钩子 |
|---|---|
| 加自动导入 | `addImports` / `addImportsDir` / `addImportsSources` |
| 注册组件目录 | `addComponentsDir({ path, prefix, global })` |
| 加插件 | `addPlugin({ src, mode: 'client' \| 'server' \| 'all' })` |
| 加服务端路由 | `addServerHandler({ route, handler })` 或 `nitro:config` |
| 加 server middleware | `addServerScanDir` / `nitro:config` 的 middleware |
| 改打包配置 | `nuxt.hook('vite:config', ...)` / `webpack:config` |
| 生成虚拟文件 | `addTemplate({ src, dst, data })` → 落进 `.nuxt/` |
| 合并用户配置 | `options` + `defaults` + `nuxt.options[configKey]` |
| 判断环境 | `nuxt.options.ssr`、`nuxt.options._generate`（SSG 中）、`nuxt.options.dev` |
| 路径解析 | `createResolver(import.meta.url)`、`useNuxt()` 的 `options.rootDir` |

`nuxt.hook('app:resolve')`、`pages:extend`、`components:extend` 是三大"改结构"钩子：分别动插件/组件清单、动路由表（可做"按权限屏蔽路由"这种骚操作）、动自动注册组件表。

## 5. 官方明星模块逐个看

**@nuxt/image**：`<NuxtImg>` + `$img`，配置 provider（imgix/cloudflare/ipx）后按 `sizes`/`quality`/`format` 生成变体，**服务端签名 URL 防止任意尺寸请求**；与 next/image 的差别在于它默认不强制改组件写法（`nuxt: image: { densities: [] }` 之类），且 dev 下用 ipx 本地处理、生产可切远端 provider。坑：给 `<NuxtImg>` 传远程绝对 URL 却不在 `remotePatterns` 白名单里 → 直接不输出图片（呼应 next-fonts-images 的 domains 教训）。

**@nuxt/content**：把 markdown/YAML 编译成 SQLite（dev 下内存、build 后文件）+ `queryCollection` 查询 API，`<ContentRenderer>` 渲染。零后端 CMS 的最小方案（呼应 next-fullstack-project 里 contentlayer 类方案的位置）。

**@nuxtjs/robots / @nuxtjs/sitemap**：生成 `/robots.txt`、`/sitemap.xml` 并**自动接入 Nitro**（下一关 SEO 展开）。这类"只管生成两个 XML 端点"的模块，正是"模块带 server route"能力的最好示例。

**@nuxtjs/i18n / @unhead / @pinia/nuxt / @nuxt/test-utils**：分别管多语言路由前缀、head 标签、状态、测试环境装配。看到"某能力在官方文档里叫 built-in 但代码在独立仓库"，基本就是一个模块。

## 6. 与 Vite 插件、Nuxt Layer 的三方分界

| | Vite 插件 | Nuxt 模块 | Nuxt Layer（`extends`） |
|---|---|---|---|
| 作用层 | 模块图/资源（10-vite 学过） | Nuxt 全套约定 + 底层 vite/nitro 配置 | 整个项目（目录可覆盖） |
| 能改路由/自动导入 | ❌ | ✅ | ✅（提供文件） |
| 分发形态 | npm 包 | npm 包 / 本地目录 | git 仓库 / npm |
| 典型用途 | 自定义 loader、虚拟文件 | 框架能力扩展 | 企业模板基座、多品牌复用 |

选择口诀：**只涉及"文件怎么编译"用 Vite 插件；涉及"Nuxt 的约定/目录/运行期注入"用模块；涉及"整个项目继承与覆盖"用 Layer**。三者在 `nuxt.config.ts` 的三个不同字段里，别放错位置。

## 7. 排错方法论

1. 模块加载失败 → 看启动日志里模块名前缀（`useLogger` 的价值）；
2. 自动导入没生效 → `.nuxt/imports.d.ts` / `components.d.ts` 里搜符号（生成物为准，别猜）；
3. 类型报错但运行正常 → `nuxt prepare` 重新生成类型（CI 里必须在 test/typecheck 前跑）；
4. 生产构建才炸 → 大概率是 `mode` 写错（client 插件里引用了仅服务端可用的东西），或模块在 dev 用了 `nuxt.options.dev` 分支；
5. 版本冲突 → 先 `npx nuxt info` 看实际生效的 Nuxt 与各模块版本，再对官方模块的 compatibility 表（呼应 nuxt-overview 的"三层结构"里框架与集成层的版本耦合）。

## 8. 自检清单

- [ ] 需要的能力是"编译方式"还是"Nuxt 约定"还是"整项目复用"（决定选 Vite 插件/模块/Layer）？
- [ ] 本地模块是否把运行期代码放在 `runtime/` 下？
- [ ] `meta.configKey` 是否与 nuxt.config 里的字段名一致？
- [ ] 模块是否只依赖 `@nuxt/kit` 暴露的稳定 API（而非私挖 nuxt 内部结构）？
- [ ] 改模块配置后是否重启了 dev / 跑了 `nuxt prepare`？
- [ ] 引入的第三方模块是否看过它注册了哪些 server route 与全局组件（避免意外污染）？
- [ ] CI 里 `nuxt build` 是否与本地同 Node 版本（模块常带原生依赖，呼应 node-deploy-perf）？

## 9. 🚀 部署预告

模块能"生成端点"，也能"改 head"。下一关 **nuxt-seo-meta**：`useSeoMeta`/`useHead` 的响应式标签管理、OG 图与 canonical、robots/sitemap 的正确姿势，以及 SSR 在 SEO 上真正的胜负点在哪（呼应 next-metadata 与 vite-deploy）。
