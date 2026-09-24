# ng-landscape：为什么 2026 还要学 Angular——企业级定位与四次大改版

> 目标：把 Angular 放回它自己的历史线（AngularJS→大重写→Ivy→v17 默认栈革命→v21 zoneless 收官），理解『全家桶+强约定』路线与 React/Vue/Svelte 三种路线的本质分歧，认清它的真实主场与 2026 年的技术栈新貌（呼应 sig-map、solid-overview、svelte-overview）

## 一、先回答『为什么是它』：一个为『五年后还有人接手』设计的框架

前端框架的暗赌注是『三年后你的代码还有人能维护』。React 赌生态、Vue 赌渐进、Svelte 赌编译，Angular 赌的是**约束**：编译器+DI+路由+表单+HTTP 客户端+CLI+升级工具全部官方出品，版本节奏固定（每三个月一个 minor、每半年一个 major），`ng update` 能把大版本迁移的机械部分自动化——这套『一个供应商负责到底』的模式，在银行、保险、电信、大型 B 端后台这类『十万人天、人员流水账式轮换』的项目里是硬需求。学 Angular 的第二重收益：**它是四家里唯一把 DI、路由守卫、变更检测这些『架构级概念』做成框架内置正字的**，学完再看其它三家的同类问题（14 包 sig-auth 里手写四实现的那种活），视角会完全不同。

## 二、四次大改版：一部『自我革命史』

| 改版 | 时间 | 干了什么 | 留下什么债 |
|---|---|---|---|
| AngularJS → Angular 2 | 2016 | 推倒重写：TypeScript、组件树、zone.js 变更检测、DI | 『Angular 2+』命名混乱至今；生态断代 |
| ViewEngine → Ivy | v9（2020） | 编译器全换：模板编译现代化、可摇树、构建提速、局部编译 | 库作者双轨发布痛苦期（v15 起旧引擎彻底退场） |
| NgModule → standalone + 控制流 | v17（2023.11） | 新项目默认 standalone（该 API v14 引入、v17 起成为默认推荐、v19 标记 stable）；同场革命：@if/@for/@switch 内建控制流取代 *ngIf/*ngFor 推荐位、路由新语法 | 老教程/老项目满屏 declarations/imports 与星号指令 |
| zone.js → zoneless | v18 预览 → v21 默认（2025.11） | 变更检测从『拦截一切异步』转向『signals 精确通知』；同场：Vitest 替换 Karma 成测试默认 | 存量依赖 zone 黑魔法的库需适配；手动 markForCheck 的老习惯要重审 |

注意一个反直觉事实：**v17（2023.11）之后 Angular 实际上换了一个产品**。『Angular 很慢很啰嗦』的刻板印象多数建立在 NgModule+装饰器全家桶时代；今天的默认骨架（standalone + signal-based 组件 API + zoneless 默认 + 模板新控制流）与那时相比，样板量和心智模型都已面目全非。这也是 15 包开『版本地图』单独一关的原因——识别你手头教程是哪个年代的，比在 Angular 圈之外重要得多。

## 三、2026 技术栈一屏概览（v22 为事实底）

```
组件层   standalone component · input()/output()/model() 信号式 API · @if/@for/@switch/@defer
响应层   signals（v20 起 stable）+ computed/effect · RxJS 仍是一等公民（HttpClient/路由事件）
检测层   zoneless 默认（v21+）· OnPush 语义简化为『signals+显式标记』
应用层   app.config.ts 提供者树 · Router（懒加载/函数守卫/resolve） · HttpClient（函数式拦截器）
表单层   Reactive Forms（存量正统） · Signal Forms（v22 转正的新官配）
服务端   @angular/ssr · 增量 hydration · 服务端预取防双请求
工程层   CLI（Vite 系 @angular/build 默认） · budgets 预算 · ng update 迁移 · Vitest 默认 · @angular-eslint
```

和 13 包开篇的 Solid 全景对照着看会很有意思：Solid 把『signals+细粒度』做到极致然后发现 DI、表单、SSR 还得自己配齐；Angular 把全家桶都配齐了，然后花五个版本把响应层换血成 signals。**两条路线在对讲机里听见了对面**——14 包『合流趋势』的又一例证。

## 四、四强定位表（本包版）

| 维度 | Angular | React | Vue | Svelte/Solid |
|---|---|---|---|---|
| 本质 | 应用框架（全家桶） | UI 库+生态拼装 | 渐进框架 | 编译器路线 |
| 状态原语 | signals（框架内置） | 自选（14 包四强） | ref/reactive | signal/runes |
| 依赖注入 | 框架级 injector 树 | Context 手搓 | provide/inject | 无（或库） |
| 路由/表单/HTTP | 全部官方 | 全第三方 | 官方为主 | 官方为主（Kit/SolidStart） |
| 升级策略 | ng update 自动化 | 自选节奏 | 渐进 | 随大版本 |
| 典型主场 | 企业大 B 端 | 全场景+生态位 | 国内全场景 | 性能敏感/新项目 |

『怎么选』三轴：**招聘市场轴**（Angular 在外企/大厂海外业务/金融 IT 的存量与需求稳定）、**项目寿命轴**（预期 5 年+且团队流动大→约束值钱）、**团队偏好轴**（『官方给答案』对某些团队是减负、对另一些是枷锁——这没有标准答案，只有代价）。

## 五、这个包的学法

27 关延续 13 包的框架包体例：L2-L3 组件与 DI 双支柱、L4 把你 14 包学的 signals/RxJS 全部落到 Angular 语境（这是你已有的知识，重点在『Angular 变体与桥接』）、L5-L7 表单路由状态三大实用件、L8-L9 SSR 测试工程与四框架合龙。带三个问题学：**它的约束在哪些时刻替你想好了？哪些时刻你正在跟约束搏斗？这些搏斗值不值？**——答完这三问，无论用不用 Angular，你的工程判断都多了一个参照系。

> 🚀 部署预告：安装环境三件套：Node LTS + `npm i -g @angular/cli`，`ng new tour` 建工程后第一件事是跑 `ng version` 并把输出抄进你的笔记——接下来所有关卡代码都长在这一个工程里，而它的『默认值』（是不是 standalone、测试器是谁）本身就是下一关版本地图的活教材。本包实验是一个持续增值的『27 关博物馆』。
