# CI 加速与前端性能工程化

> 目标：把前两关攒下的缓存与度量知识投进流水线——CI 的三层缓存策略、Turbo 任务级缓存的命中原理、构建耗时压缩手段与 bundle 预算门禁，最后用 web-vitals 把"性能"从构建期延伸到线上真实用户（呼应 vite-deps-perf 缓存指纹、vite-deploy 的 monorepo/Turbo、vite-splitting 分包、node-deploy-perf）。

---

## 一、CI 的三层缓存：装包、构建、产物

一次典型 PR 流水线的时间都花在哪？**装依赖 → 构建 → 测试**，三层各有缓存可吃：

```yaml
# GitHub Actions 骨架
- uses: pnpm/action-setup@v4
- uses: actions/setup-node@v4
  with: { cache: pnpm, cache-dependency-path: pnpm-lock.yaml }   # 层1：依赖 store
- run: pnpm turbo build test --cache-dir=.turbo                   # 层2：任务缓存（下节）
- uses: actions/cache@v4
  with:
    path: '**/node_modules/.vite'                                # 层3：Vite 预构建/转换缓存
    key: vite-${{ hashFiles('pnpm-lock.yaml', 'vite.config.ts') }}
```

- **层 1 依赖**：lockfile 哈希做 key，命中即跳过下载；
- **层 2 任务**：构建/测试的输入输出整体缓存（Turbo/Nx），没改动的包直接回放上次产物；
- **层 3 工具内缓存**：`node_modules/.vite`（预构建，vite-deps-perf 学过指纹逻辑）与 `cacheDir`；CI 里构建为主，此层对 `vite dev` 型冒烟测试与本地增量才关键——**别为了缓存而缓存，先量各层耗时占比**。

## 二、Turbo 任务缓存：命中才是最快的构建

缓存 key = **输入文件哈希 + 依赖任务哈希 + 环境变量白名单 + 平台**。要点四条：

1. `turbo.json` 里 `build: { dependsOn: ['^build'], outputs: ['dist/**'] }`——声明错了等于缓存白搭（漏 outputs 回放不全，多 inputs 永不命中）；
2. `--summarize` / `--dry-run` 看命中率报告，**CI 日志里把 remote cache 命中率当 KPI 晒**；
3. **Remote Cache**：本地 dev 构建过的任务推给 CI 回放（或反向），团队共享——缓存从"每台机器各自为政"变成组织资产；
4. `globalEnv`/`envMode` 把影响产物的环境变量纳入 key（`VITE_API_URL` 变了缓存必须失效——构建期变量的教训回扣 **vite-env**）。

## 三、构建本身提速与 Rolldown 位置

Vite 构建时间大头在 **transform + chunk 图计算 + 压缩**。可动的螺丝：

- `sourcemap`：CI 预览环境 `false`、生产 `'hidden'`（生成但不注入引用，错误上报用）；
- `minify: 'esbuild'`（默认，快）vs `terser`（慢但 DROP_DEBUGGER 等高阶选项）；
- `build.target: 'esnext'` 内部系统免转译；`build.reportCompressedSize: false` 跳过 gzip 估算（大项目省数秒）；
- 依赖侧：manualChunks 拆稳定 vendor（配合层 3 思路，改业务码不动 vendor 哈希，CDN 缓存也受益——呼应 vite-splitting 与 04-vue vue-deploy 的 hash 长效缓存）。

**Rolldown**（Rust 写的打包器，VoidZero——Vite 背后公司——出品，目标兼容 Rollup 插件生态）：Vite 的路线图是把 dev/build 统一到 Rolldown 管道，`rolldown-vite` 是尝鲜别名包。工程决策口径：**主线项目等稳定、实验项目开别名试跑并锁回退路径**——面试考的是"过渡期决策框架"不是站队。

## 四、bundle 预算门禁：让体积回不去

```json
// size-limit（CI 门禁代表选手）
"size-limit": [
  { "path": "dist/assets/index-*.js", "limit": "180 KB", "gzip": true },
  { "path": "dist/assets/vendor-*.js", "limit": "120 KB" }
]
```

组合拳：①`vite-bundle-visualizer` 分析图进 PR 附件；②**预算门禁**（size-limit/bundlestats）让"顺手加个 600KB 库"在 CI 变红——把 review 从人肉自觉升级为机器纪律；③产物 diff 工具比对每 PR 的 chunk 增减清单；④阈值来源是 **vite-splitting** 建立的"首屏预算制"（如 gzip 后主包 ≤ 目标 CWV 换算值），不是拍脑袋。

## 五、最后一公里：web-vitals 线上监控

构建期一切优化，最终验收在**真实用户**（RUM）：

```js
import { onLCP, onCLS, onINP } from 'web-vitals'
for (const f of [onLCP, onCLS, onINP])
  f(m => navigator.sendBeacon('/vitals', JSON.stringify({ name: m.name, value: m.value, route: location.pathname })))
```

- **Lab（Lighthouse CI）vs Field（真实用户）**：前者防回退、后者定基线，两条腿都要；
- 数据按 route 聚合，LCP/INP/CLS 阈值告警（Core Web Vitals 标准：LCP≤2.5s、INP≤200ms、CLS≤0.1）；
- 端点就是自家 server route / 打点服务——sendBeacon 保证卸载也送达（呼应 01-es fetch/beacon 与 nuxt/next server route）；
- 闭环成立：**vite-splitting 分包决策 → CI 预算门禁 → 线上 web-vitals 验证 → 数据回流下一轮分包**——"构建工具"至此升维为"交付流水线"。

## 自检清单

- [ ] CI 三层缓存各 cache 什么、key 是什么，说得条理分明。
- [ ] Turbo 缓存 key 的构成与 dependsOn/outputs 声明错误的后果。
- [ ] sourcemap/minify/target 三个构建提速螺丝的取舍场景。
- [ ] bundle 门禁工具链（visualizer+size-limit+diff）与预算来源讲得清。
- [ ] Lab vs Field 数据两条腿 + web-vitals 三项阈值数字记得。

---

## 🚀 部署预告

- 本关把 **vite-deps-perf** 的缓存指纹观、**vite-deploy** 的 Turbo 单点、**vite-splitting** 的预算观接成完整流水线——L6 三关即 Vite 包的工程收官；
- remote cache 的团队推广剧本与 **node-deploy-perf** 的部署度量同属"平台工程"话题域；
- web-vitals 数据回流后的优化手册（预加载/图片/字体）在 **07-next next-perf**、**08-nuxt nuxt-perf** 各有一版框架特化；
- 至此"从 ES 到 Vite"十包闭环——下一站 **11-svelte**：用第三个框架视角回看响应式与编译时优化的一切。

本关为 L6 与全包的收官：十个词自检——no-bundle、预构建、HMR、管道、分包、target、插件、环境 API、library mode、流水线。
