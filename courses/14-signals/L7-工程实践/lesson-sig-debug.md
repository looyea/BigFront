# sig-debug：调试工具链——四家对比

> 目标：给四强各配一套『看得见状态变化』的调试装备（Redux DevTools 系、MobX 工具链、框架自带 signal 调试、RxJS marble 测试），提炼统一心法——**让『谁改了状态、经过什么路径、变成了什么』全程可见**（呼应 vite-devtools、react-devtools、za-middleware）

## 一、调试的第一性问题

所有状态 bug 归根到底是三个问句：**谁改的？（触发源）怎么传的？（依赖/订阅路径）改成了什么？（值迁移）**。四家工具链本质是三家都答、各有侧重——看工具前先拿这三问当透镜，不会被面板功能晃花眼。

## 二、不可变系：Redux DevTools 一统两家

Zustand devtools 中间件与 Redux 共用同一个浏览器扩展（za-middleware 已实战过），这里补的是**方法论**：

- **Action 日志=触发源账本**：每条记录带标签（`set(partial, replace, 'coupon:apply')` 第三参），时间轴上滚动作序列——『谁改的』直接读；
- **时间旅行=值迁移回放**：任意快照可跳回、单步 Action dispatch——配合 Action diff 视图看字段级迁移（『改成了什么』）；
- **dispatch 注入=复现器**：粘贴一段 action 序列给同事即可复现 bug（za-middleware 面试第 9 题警告过：带 persist 时回放=写入，调试前先摘副作用）。

**MobX 没有现成的时间轴**——可变路线补票的又一现场（sig-mutability §二）：替代装备是 `configure({ enforceActions:'observed' })` 让越界写立刻 throw（断点天然落在『谁改的』现场）+ `why-did-update`/`why-did-you-render` 拦截层（打印组件重渲的字段级原因——答『怎么传的』）。**不可变系把账记在面板里，可变系把围栏设在写入处**——心法一致：变化必须留下可追问的痕迹。

## 三、RxJS：marble 测试把时间装进断言

流的问题（乱序、该吞没吞、退订时机）在运行时面板里是瞬时烟花，**RxJS 的答案是把时间搬进测试**：

```ts
import { TestScheduler } from 'rxjs/testing';

it('debounce 吞掉连击只留最后一个', () => {
  new TestScheduler((actual, expected) => {
    expect(actual).deepEqual(expected);
  }).run(({ cold, expectObservable }) => {
    const src = cold('abcd----|');                // 连击 a-d：彼此间隔均小于去抖窗
    expectObservable(src.pipe(debounceTime(30))).toBe('------d--|');
  });
});
```

marble 图（`'a--b--c'`）即用例文档——debounce/throttle/switch/concat 的语义分歧用一行图各判各的；`TestScheduler` 虚拟时钟让『10 分钟轮询』秒测。面板侧配 Redux DevTools 的 RxJS 观测扩展（rx-devtools 系）看运行时，但**主力是测试层**：流的 bug 多数是时序 bug，复现一次不如断言永久。这与信号系的哲学一致——computed 图同样『不弹面板』，靠纯函数单测推导链（MobX/solid 通用）。

## 四、框架侧 signal 调试：各家的现成度盘点

| 环境 | 装备 | 答到哪问 |
|---|---|---|
| Angular | DevTools 新版 Signals 面板（signal 图/状态追踪）、`untracked()`+断点 | 谁改的+依赖图 |
| Preact signals | `@preact/signals` 配套 devtools 浏览器扩展（signal/computed 值实时树） | 三问基本齐 |
| Solid | devtools 扩展看 owner 树+signals 图；effect 断点+`createRoot` disposer 追泄漏 | 怎么传的+生命周期 |
| Svelte 5 runes | 生态早期：`console.log($derived)` 派生链断点+ `$.untrack` 手动排雷；编译器输出可查 | 主要靠人肉 |
| Vue ref/computed | Vue DevTools 的 reactivity inspector（历史版本有 tracking 版） | 谁改的 |

现状一句话：**框架内置信号的调试还在『够用但在补课』阶段，第三方库（Redux 系）的工具链反而最成熟**——这是引库的真实红利之一（za-middleware 面试第 15 题『核心该多大』的工具面镜像）。

## 五、通用三板斧（跨库复用）

工具面板会过时，这三招不会：

1. **给变更打标签**：所有 set/dispatch 带语义字符串（`'drag:commit'`、`'ws:price'`）——日志可读性决定排查速度，成本零；
2. **断点打在唯一入口**：不可变系=set/dispatch 函数体、可变系=observable 的 setter 条件断点（`prop === 'targetField'` 时停）——『入口收敛』纪律（sig-mutability §三）在调试上的回报；
3. **最小复现切片**：把状态子图/流管道剥成 CodeSandbox 单文件——剥的过程本身就是依赖分析；配合海关行/中间件层加 `tap`/`trace` 探针看数据流过形态。

## 六、统一心法收尾

本关全部装备压成一句话：**状态系统必须有『变更审计日志』能力——面板只是日志的 GUI**。不可变系天然有（action+快照）、可变系围栏造（strict throw+patch 账）、流系时间化（marble+tap）、signal 系图可视化（devtools 面板）。选库时问一句『它的审计日志长什么样』，比问『有没有面板』更接近本质——自研状态层时，这条就是你要先写的模块。

> 🚀 部署预告：实验清单（各 10 分钟）：① Zustand demo 里给 5 种操作打标签，时间旅行复现一个故意埋的错值；② MobX demo 开 enforceActions 后越界写，读一次 throw 栈；③ 给 rx-operators 关的 switchMap demo 补一条 marble 用例；④ 你主力框架的 signal 面板截一张图，标注它能答三问中的哪几问。
