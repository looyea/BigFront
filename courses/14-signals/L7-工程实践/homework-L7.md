# L7 阶段作业：工程实践

> 覆盖：sig-size / sig-debug / sig-perf
> 判分：Bug 每题 3 分、手写每题 7 分、场景题 20 分、简答每题 5 分、挑战 +10 分（基分 100）

## 一、Bug 猎杀（10 小题，每题指出唯一错误并给出修法）

**Bug 1**（barrel 焊死摇树）
某文件一行 `import { Observable } from 'rxjs/Rx'` 让构建产物暴涨 40KB。指出 tree-shaking 断在哪一环，给出改法与『同类复发防再犯』的一条 lint/CI 规则。

**Bug 2**（中间件体积盲区）
选型报告写『Zustand 1.1KB 通过体积评审』，实际项目用了 persist+immer+devtools+subscribeWithSelector。指出报告错法，按量级重报价（说清 immer 的连带账）。

**Bug 3**（gzip/brotli 混口径）
对比表里 Zustand 用 brotli 数、MobX 用 minify 数，结论『差距没那么大』。指出两个口径错误，立三条比数纪律。

**Bug 4**（selector 现造对象）
`const sel = (s) => ({ theme: s.theme, lang: s.lang })` 定义为模块级函数后 `useStore(sel)`——仍无限重渲。指出『函数稳定≠产物稳定』的病根，给修法。

**Bug 5**（MobX 解构漏订）
```jsx
const { count } = store;
return <b>{count}</b>;
```
按钮 action 里 `store.count++` 后数字不动。三式归哪一式？给两种修法（含一种保留解构写法的）。

**Bug 6**（分支短路断读）
`return store.loading ? <Spinner/> : <List items={store.list} />` 上线后 list 更新但 Spinner→List 切换前 list 是旧的，切换后不重渲。指出订阅面在分支下的断点，重写保读写法。

**Bug 7**（订阅无主）
`useEffect(() => { store.subscribe(s => setRows(s.rows)) }, [])`。指出『缺的不只是退订』的两缺，给带 StrictMode 验证的正确版本。

**Bug 8**（时间旅行污染）
开发者用面板回放调试 10 分钟后关闭，用户 localStorage 的购物车变成回放中途的旧值。指出机制成因，给调试纪律与一个配置级防呆。

**Bug 9**（console.log 建边）
Angular 组件构造器里 `effect(() => console.log(this.user()))` 调试残留，线上 user 高频更新拖垮性能且偶发 after-modified 报错。指出『调试也是订阅』的两重代价，给 untracked 版与安全删除策略。

**Bug 10**（坑4 不分型就开药）
同事的修复 PR：给所有组件套 React.memo + 所有 selector 套 shallow——之后 CPU 火焰图里比较函数占 30%。指出他跳过了 §四的分型步骤，按 `prev===next, deepEq` 两种组合各给对症修法。

## 二、手写题（5 题）

**手写 1**：给一个 300KB 首包的 demo 跑 visualizer，截 state 层 treemap；把占比最大的三个包各写一行『功能/可替代性』评注（10 分钟，产出半页报告）。

**手写 2**：实现 40 行『生产审计环』：subscribe 记账（时间戳+浅 diff+标签）、环形缓冲 200 条、window error 时 sendBeacon 导出；写一条让它吞掉敏感字段的脱敏白名单。

**手写 3**：为 `debounce + switch` 组合写两条 marble 用例：`cold('ab----c--|')` 与 `cold('a--b--c--|')` 各推演期望输出（先心算帧表再跑），错一条就回去重算。

**手写 4**：把四大坑各写成一条『提问式 review 规则』（每问一行），并给每条配一个 5 行内的反例代码+一行修法。

**手写 5**：性能体检实战——给一个已知埋了坑1 与坑3 的 demo（自造即可：多字段 selector+无退订定时器）跑完整 §五流程，交：取证日志片段×2、归因一句话×2、修复 diff、修复后的计数断言各一条。

## 三、场景题（1 题，20 分）

你的应用上线后监控告警：低端安卓机『滑动 5 分钟后整页卡死』，桌面无法复现。给出完整排障与治理战役：① 现场取证方案（无法连接用户设备的前提下：采样审计环/性能埋点/远程日志三选二并说明取舍）；② 四个候选病根（本关四坑各映射一种）的预期证据特征与分辨实验；③ 修复优先级排序原则（一次只改一处+基线）；④ 防复发制度（回归断言清单+CI 预算+review 规则三件套怎么落）。要求每步注明『用什么工具看到什么现象得出什么结论』。

## 四、简答题（3 题）

**简答 1**：『可调试性≈可确定重放性』——为什么 RxJS 驱动的状态不满足？它把确定性外包给了谁？

**简答 2**：体积账三本（下载/执行内存/功能换算）各举一个本关说过的典型误用案例。

**简答 3**：为什么 Vue/Solid 项目少坑1 却自有坑2 换皮？『没有免税范式，只有免税位置不同』怎么理解？

## 五、挑战题 🏆（+10 分）

『性能契约进 CI』工程：给一个含 Zustand store+MobX 组件+RxJS 管道的练习仓库，搭一条可跑的质量门：① size-limit 设 state 层预算（超标红）；② 渲染计数断言（一次无关更新 renderCount===0）进测试；③ 泄漏守门用例（mount/unmount×50 后活订阅计数===初值，Node 环境可用 getImmediateUnusedSubscriptions 类自报钩子或 WeakRef 计数方案）。附 60 字内 README：三闸各拦的是四坑里哪一坑。（分项合计 ≤10 分：①2 + ②4 + ③4，跑不通酌情给设计分。）
