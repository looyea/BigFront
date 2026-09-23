# sig-size：打包体积实测——四家各要多少钱

> 目标：建立『先测量再吵架』的体积观：四强 gzip 后的量级感与可摇树性差异，理解『库体积』之外更要紧的依赖传递成本，会用 bundlephobia 与构建产物分析把选型报告里的体积栏填上真数（呼应 vite-bundle-analysis、10-vite、za-core）

## 一、量级印象分（gzip，取官方/Bundlephobia 常见口径）

| 库 | gzip 量级 | 一句话 |
|---|---|---|
| Zustand | ~1.1-1.2KB | 核心小到可以忽略，中间件按支计价 |
| @preact/signals / 提案 polyfill 类 | ~1.5-4KB | 原语级实现都在这个档 |
| MobX | ~16-17KB | 全家一次性进包 |
| RxJS | 核心+常用操作符 ~10-15KB | 见 §二，这家水最深 |

先对齐这三点再看下文：**数字随版本浮动，量级不会**——Zustand 与 MobX 差一个数量级、RxJS 介于两者之间靠用法决定。选型答辩里写『约』和量级，别抄某个日期的精确字节（那是 sig-capstone 实测题的活）。

## 二、可摇树性：账面体积 ≠ 进包体积

- **RxJS**：v6 起全量 `rxjs`+`rxjs/operators` 深路径导出，webpack/rollup 对 `map/filter/switchMap` 做 named-export 摇树——**用 5 个操作符≠背 200 个的货**。但两个漏水点：① 第三方库自己也引 RxJS 并留了重依赖（rxjs 版本对齐才摇得动）；② 有人还写 `import { Observable } from 'rxjs/Rx'`（老 barrels，把全家桶焊死在包里——13 包讲过的 barrel 反模式复发）。结论：**RxJS 的体积账是『用法税』不是『入场税』**；
- **MobX**：内部耦合紧（observable/action/computed 共享同一反应内核），tree-shaking 收益有限——**入场即全家桶**，16KB 是硬账。别误会这是缺点：功能完整度也是账（见 §四的换算）；
- **Zustand**：核心 1.1KB + 中间件各自独立入口（`zustand/middleware`）——persist/immer/devtools 各按支加，不用不进包；但注意 immer 中间件会带进 **immer 本尊（~5-6KB gzip）**，三件套全开的真实价约 8-10KB；
- **Signals 系**：单库都很小，但『框架自带』时这笔账并入框架（Solid ~7KB、Preact+signals 一起也就 15KB 级）——**用框架内置信号，状态层体积成本是零边际**。

## 三、体积之外的三笔隐性账

1. **依赖传递**：Zustand 零依赖是招牌卖点；MobX 也零依赖；RxJS 名义零依赖但 Angular 全家把它当骨干（引 Angular 时它不是增量）；React 侧还要算 use-sync-external-store shim 这类间接件。**看 `npm ls` 的深度比看 bundlephobia 的单库数诚实**；
2. **更新频率与安全面**：多一个高频改版的依赖=多一分维护税（RxJS 大版本迁移的教训在 rx-basics 领过）；
3. **运行时成本不在 bundle 里**：体积读的是下载账，MobX 的 Proxy/defineProperty 层、immer 的 copy-on-write 层在内存与 CPU 里另开账本——sig-perf 的主场，这里只点名『**bundlephobia 不能替你回答『卡不卡』**』。

## 四、换算：每 KB 买到了什么

体积对比不换算功能就是耍流氓：

- Zustand 1.2KB ≈ 快照 store+selector 订阅+SSR 安全——**没有**内建撤销、跨 store 协议、派生缓存；
- MobX 17KB ≈ 字段级追踪+computed 缓存图+patch/snapshot 协议+finalizer 生命周期——React Query 用 ~13KB 买的是另一挂功能；
- RxJS 用量浮动 ≈ 操作符代数+调度器+Subject 家族——它买的『时间整形』是别人根本没有的货架。

正确姿势：**先列你一定会用到的功能，再比『凑齐这套功能各家的打包总价』**——zustand+immer+persist+自研撤销 vs mobx 一站式 vs query+轻 store 组合，三套方案总价接近时，体积就从决定项降为否决项（内存紧张的内嵌设备WebView 才轮到它当决定项）。

## 五、动手：把体积栏填成真数（10 分钟流程）

1. **选型期**：Bundlephobia 查三家的『min+gzip』与 tree-shaking 标注（数字看量级）；
2. **接入后**：`vite build` + `rollup-plugin-visualizer`（10-vite/vite-bundle-analysis 的标配流程）看真实进包字节——重点核对 §二两个漏水点（rxjs barrel、意外进包的 immer）；
3. **CI 卡预算**：size-limit/bundlemon 给 state 层单独设阈值（如『+3KB 即报警』），把体积从玄学争论变成 PR 数字；
4. 报告句式模板：『方案 A 进包 X KB（含 Y 功能），方案 B 进包 Z KB 但缺 W，补 W 需 +N KB——差额 N+Z-X 换 W 值不值』。

> 🚀 部署预告：本关作业不做真实项目，用三个官方模板仓库（rxjs/zustand/mobx 各一）跑 §五 的 1→2 两步，截图 visualizer  treemap 的 state 层占比——你会对『谁在包里偷偷变大』建立终身难忘的体感（提示：故意加一个 `rxjs/Rx` 式坏 import 看看炸成什么样，再把 barrel 改回深路径看它缩回去）。
