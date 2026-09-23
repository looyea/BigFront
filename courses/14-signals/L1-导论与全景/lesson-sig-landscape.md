# 状态管理简史：从 Flux 到 signals 时代

> 目标：按时间线理清前端状态管理十年的演进逻辑——Flux 用单向数据流治"数据乱飞"、Redux 用单一 store+不可变治"改不回去"、Hooks 把状态还给了组件却带来碎片化、MobX 走自动追踪另一条路、外部 store（Zustand/Jotai）借 useSyncExternalStore 复兴、TC39 Signals 试图把响应式原语标准化；看清**每一代方案解决了什么、又引入了什么新问题**，本包后面四强逐一实战就有了坐标系（呼应 react-usestate、solid-signals、svelte-reactive-runes、vue-reactivity-theory）

## 一、为什么会有"状态管理"这个词

服务器端年代没有这个问题：数据在数据库，页面每次请求重新渲染。SPA 把 UI 搬进浏览器后，出现了一个新物种——**一大坨 JS 内存对象在长时间会话里被无数事件并发修改**。当这坨数据只被一两个组件用时它不叫问题；当一个应用里几十个组件共享、派生、回写同一份数据时，"谁持有真相、变了谁通知谁"就变成了架构问题。这就是状态管理的全部动机：**给共享可变数据找唯一真值源，并建立可追踪的更新通道。**

## 二、时间线上的六代方案

### 2014：Flux——把数据流掰成单向

Facebook 的 Flux 针对的是 MVC 双向绑定在大型应用里的乱麻：视图改模型、模型又反过来改别的视图，事件传播方向不可预测。它给出四个角色（Dispatcher→Store→View→Action→Dispatcher）和一个口号：**单向数据流**。用户动作产生 Action，Dispatcher 分发给 Store，Store 更新后 View 重渲染，View 只能通过再发 Action 来改数据。双向绑定"随手就改"的自由没了，换来的是任何一次数据变更都能倒溯到一个 Action。今天看来 Action 这个词已经渗透进所有方案，它就是 Flux 的遗产。

### 2015：Redux——把 Flux 收进一个函数

Redux 把 Flux 的多 Store+Dispatcher 简化成**单一 store + 纯函数 reducer**：`state = reduce(state, action)`。不可变更新（改对象必须造新对象）保证了新旧引用可比较、时间旅行调试成为可能、"改不回去"的问题被结构上消灭。代价同样明确：样板代码爆炸（一个 Todo 应用要写五种 action type）、UI 状态也得进全局、reducer 里做异步还得加中间件。Redux 统治了 2016-2019，但它的复杂度曲线让后来者不断喊疼（呼应 L8 的 Redux→Zustand 迁移课）。

### 2015 起平行线：MobX——另一条宇宙观

同一年代的 MobX 选择了完全相反的哲学：**状态就是普通可变对象**，用 observable 包起来，"谁读了哪个字段"由框架自动记录；改字段直接赋值，读了它的派生值和 UI 自动更新。开发者写的代码回到"面向对象日常"，没有 action type、没有 reducer、没有 spread。它的代价是魔法感重（不读文档很难解释"为什么解构就丢响应了"）和可变对象在调试上"改了就没了、说不清谁改的"。MobX 与 Redux 的分歧——**自动追踪可变派 vs 显式快照不可变派**——贯穿本包始终，是理解 Zustand/Immer/Jotai 站队的钥匙（呼应 mobx-core、sig-mutability）。

### 2019：Hooks——状态"还给"组件，共享却碎了

React Hooks 让函数组件第一次拥有了局部状态与副作用，社区随之欢呼"不需要 Redux 了"。确实，大量应用把 80% 的状态留在了组件里；但剩下的 20% 跨组件共享态反而更没着落——Context 每次提供新值会让**所有订阅组件重渲**（粒度太粗），useReducer 出不了组件树。于是"状态该放哪"从架构问题变成了每个团队的日常争论。同时期 Vue 3 Composition API、Svelte stores 都在回答同一道题，答案各有自家语法。**碎片化**成为 2019-2021 的关键词：每个框架一套响应式原语，库作者要针对每个 UI 框架发一个适配包。

### 2019-2022：外部 store 复兴——Zustand 们站上新地基

一条新机制结束了 React 侧的混战：React 18 的 `useSyncExternalStore` 把"订阅外部数据源"做成了官方 API，彻底解决撕裂与并发安全问题。Zustand（2019 年发布、靠 4.x 爆红）借此给出 Redux 式不可变模型 + 去样板的最小 API：`create((set,get)=>({...}))`，1.1KB 级别体积、selector 细粒度订阅、组件外可读写可订阅；Jotai 反向走原子化路线、Valtio 走 proxy 路线。共享状态重新离开组件、回到组件外，但这次带着细粒度订阅的小靴子（呼应 za-core、react-context）。

### 2022 至今：Signals——响应式原语的标准化尝试

碎片化最深处冒出的另一股力量：SolidJS 的作者 Ryan Turner 用这个项目证明了"无虚拟 DOM 的细粒度 signal 响应式"能赢下基准赛；Svelte 5 用 runes（`$state/$derived/$effect`）把同族概念焊进语言语法；Angular 也在 v16+ 全面转向 signals；Vue 的 ref/computed 早已是同类。大家各造了一遍轮子后，TC39 的 Signals 提案（proposal-signals）进场，试图把 **signal/computed/effect 作为 JS 语言级原语**标准化，目标是"库作者写一次响应式逻辑，全框架通用"。这是本包 L2 的主角（呼应 sig-paradigms、tc39-core）。

## 三、把六代排进一张表

| 年代 | 代表 | 核心机制 | 治好的病 | 引入的新病 |
| --- | --- | --- | --- | --- |
| 2014 | Flux | Dispatcher+单向流 | 双向绑定的数据乱飞 | 概念多、样板多 |
| 2015 | Redux | 单 store+纯 reducer+不可变 | 状态可回溯可时间旅行 | 样板爆炸、异步别扭 |
| 2015+ | MobX | observable 自动追踪 | 样板与心智负担 | 魔法感、可变调试难 |
| 2019 | Hooks | 组件内状态 | 共享态过度集中 | 跨组件共享没好答案、生态碎片化 |
| 2019-22 | Zustand/Jotai | 外部 store+官方订阅原语 | 细粒度共享、极简 API | 仍需框架绑定层 |
| 2022+ | TC39 Signals | 语言级响应式原语 | 生态碎片化（目标） | 尚未落地（见 L2） |

看清一个规律：**钟摆在"集中显式"与"分散自动"之间摆动，而每一次摆动都把上一代的机制吸收为子集**。Redux 的 Action 进了 Zustand，MobX 的自动追踪进了 signals，Hooks 的局部化被外部 store 的 selector 继承——所以本包四强没有一家是"过时技术"，它们是同一次钟摆的四个切面。

## 四、面试视角：这题在问什么

"讲讲前端状态管理演进"是架构岗高频开放题，面试官要的不是编年史背诵，而是三件事：① 你能否说清**每个方案的第一性动机**（单向流/可回溯/去样板/细粒度）；② 你能否给出**取舍语言**（"不可变换来时间旅行、代价是引用比较的粗粒度"）；③ 你能否落到**自己项目里怎么分层**。能讲满这三段，这题就是加分题；只会背"Redux 三个原则"的，会被追问"为什么 Zustand 不需要 reducer 也能用"打回原形。

> 🚀 部署预告：状态管理是纯客户端概念，但构建时会留痕——store 所在模块的 import 图决定代码分割边界；Redux DevTools/Zustand 中间件在生产要关，否则 action 日志既泄敏感数据又吃内存。L7 体积实测课会把四家的 gzip 成本量化对比。
