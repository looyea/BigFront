# 依赖预构建与冷启动调优

> 目标：把 "dev 服务器慢" 从玄学变成可观测、可调节的工程问题——esbuild 预构建到底在治什么病、`node_modules/.vite` 缓存的失效逻辑、optimizeDeps 三参数实战、冷启动剖析手法与大项目提速组合拳（呼应 vite-intro 双模型、vite-hmr 模块图、vite-deploy monorepo）。

---

## 一、预构建治的是什么病

no-bundle dev 的代价全在 `node_modules` 上（vite-intro 埋的线现在收）：

1. **请求瀑布流**：`import _ from 'lodash-es'` 展开是 600+ 个模块文件、600+ 个 HTTP 请求，首屏串行网络往返能把任何项目拖死；
2. **CJS/ESM 互操作**：浏览器只认 ESM，老派 `require()` 风格发布的包（如 npm 上的 lodash）必须在服务端转成 ESM 垫片；
3. **语法统一**：老依赖里的 JSX/TS 要先编译才能进浏览器模块图。

**esbuild（Go 写的、比 JS 工具快 10-100 倍）在启动时把这些一次性做掉**：每个依赖打包成一个单文件 ESM，存进 `node_modules/.vite/deps`——600 请求变 1，CJS 变 ESM，之后浏览器直接命中缓存文件。生产构建走 Rollup 另一套（双模型的第二笔账，呼应 vite-build）。

## 二、缓存与失效：为什么"又在重新构建依赖"

预构建结果按 lockfile + 配置指纹缓存。**失效重建（"new dependencies optimized, reloading"）的三大来源**：

1. **入口没扫到**：默认只从 `index.html` 关联入口静态扫描依赖；动态导入、多页、库模式新入口扫不到 → 运行中"发现新依赖"触发 reload。治法：`optimizeDeps.entries: ['src/main.tsx', 'src/pages/**/*.ts', '!**/*.test.ts']` 把发现范围声明全；
2. **monorepo 联动**：workspace 里可链接包（`src` 直出）被当依赖预构建 → 改了库源码 dev 不生效/反复失效。治法：`optimizeDeps.exclude: ['@acme/ui']` + `include` 它依赖的 CJS 传递依赖（呼应 vite-deploy 的 monorepo 课）；
3. lockfile/配置真变了：正常重建，别慌。

SSR 侧有独立的 deps 缓存目录（与客户端分开预构建），规则同构——SSR 首包慢先查这里（呼应 vite-ssr）。

## 三、参数实战手册

```ts
export default defineConfig({
  optimizeDeps: {
    include: ['lodash-es', 'some-cjs-lib > internal/deep'],  // 扫描盲区/传递 CJS 手动点名（> 语法引子包）
    exclude: ['heavy-esm-only-lib', '@acme/ui'],             // 已是高效 ESM/工作区链接包，跳过省时间
    entries: ['src/**/*.html', 'src/main.tsx'],              // 依赖发现范围
  },
  server: { warmup: { './src/**': {} } },                    // Vite 6 环境 API：启动即预 transform 热点文件
})
```

判断该 include 还是 exclude 的口诀：**"页面一打开就用到但没在首屏 import 链上" → include；"本身是打包良好的 ESM 或要改源码的 workspace 包" → exclude**。改完配置别玄学重启——`rm -rf node_modules/.vite` 强制干净重建排除缓存干扰（排查三板斧第一板）。

## 四、冷启动剖析与提速组合拳

度量先行：`vite --debug` 看 deps 解析日志与 "optimized in Xms"；`node --cpu-prof ./node_modules/vite/bin/vite.js` 采样出 CPU 火焰图；HTTP 侧看首屏请求数。**没有数字的调优是炼丹**。

大项目（千级模块）cold start 分钟级的组合拳：

1. **entries 收敛**：扫描面减半，时间减半——把测试/故事书排除在 entries 外；
2. **exclude 高体积纯 ESM 包**：预构建本身就是 O(体积)，能跳则跳；
3. **warmup**：把路由级懒加载的入口文件列入预热，换"首跳不卡"；
4. **fs.cache 与硬链接**：monorepo 下 Vite 默认把项目根上溯到 workspace 根，`server.fs.strict` 与 `cacheDir` 按包独立可减扫描面；
5. **升级链条**：Node 版本、Vite 小版本（预构建并发策略在迭代）——升级前后用同一套度量说话（呼应 node-basics）。

## 五、生产侧的镜像问题

预构建不管 build，但 L3 学的构建侧是同一批病的不同药方：**Rollup 的 tree-shaking 面对没预构建过的散装 ESM（lodash 全家桶）会慢且胖**——`build.commonjsOptions` 与依赖治理（少而精的依赖清单）是构建侧"预构建"。面试聊"Vite 性能"能同时讲 dev 预构建与 build 分包两面，才是完整双模型心智（呼应 vite-build、vite-splitting）。

## 自检清单

- [ ] 预构建三大动机（瀑布流/CJS 互操作/语法统一）各举一例。
- [ ] "反复 reload"的三来源与对应参数说得出。
- [ ] include vs exclude 的判断口诀能现场应用。
- [ ] --debug/火焰图两类度量手段记得住。
- [ ] dev 预构建与 build 依赖治理的镜像关系讲得清。

---

## 🚀 部署预告

- 本关的 `cacheDir`/`.vite` 指纹逻辑，正是下一关 **vite-ci-perf** 三层缓存策略里"dev 侧"那层的地基；
- workspace exclude 联动 monorepo 的坑在 **vite-deploy** 的 linked 包章节有前传；
- `server.warmup` 走的是 Vite 6 **环境 API**（vite-ssr 见过的名字），Rolldown 时代预构建归并进统一 transform 的路线图在 **vite-ci-perf** 交代；
- 依赖体积与 tree-shaking 的构建侧账本，复习入口在 **vite-splitting**。

下一关进入 **L6 vite-ci-perf**：CI 缓存、任务级增量与 bundle 预算门禁——把构建工具升维成交付流水线。
