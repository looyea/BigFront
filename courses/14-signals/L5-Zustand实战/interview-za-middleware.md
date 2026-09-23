# za-middleware 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。覆盖 Zustand 中间件机制、persist/immer/devtools 工程实践。

### 1. (A) Zustand 中间件和 Redux/Express 中间件是同一种东西吗？各自的『下一个』是什么？

**来源**：https://zustand.docs.pmnd.rs/integrating-with-middlewares

形似神异。Express 是 `(req,res,next)` 链式放行、Redux 是 `next(action)` 显式传递；Zustand 中间件是高阶函数 `(config) => config`，没有 next 调用——它直接**替换 set 的实现**再把包装后的 config 交给 create。『链』体现在函数嵌套次序上：外层包装先劫持 set，内层拿到的是已被加工过的 set。所以 Zustand 中间件无『忘记 next』这类错误，但有『嵌套顺序』这类错误。

### 2. (B) 上线后老用户打开页面白屏报错读 undefined，store 代码看起来完全正常，第一反应查什么？

**来源**：转述自 persist 迁移事故高频模式

查 persist 的本地旧快照：字段改名/结构变更后没 bump version 没写 migrate，rehydrate 把旧结构原样灌进新 store。定位法：DevTools→Application→localStorage 看那个 key 的结构。修复：version+migrate 逐级搬数据；应急：migrate 里对不识别的旧版本直接返回初始值（弃数据保命）。教训：persist 的 key 是有持久层契约的接口，改结构=改接口，要迁移。

### 3. (A) immer 产出『结构共享的新快照』，这个特性同时利好了 Zustand 的哪两个机制？

**来源**：https://zustand.docs.pmnd.rs/integrating-with-immutability

① 订阅判定：根快照引用必变，Object.is 过不了『没变』关→订阅者被正常唤醒；② selector 比较：未修改分支引用原样保留，订 `s.profile.address` 的组件在只改 `s.cart` 时 selector 产物同引用→跳过重渲。一手满足『该醒的醒、不该醒的不醒』两头——这就是 immer 被列为事实标配的原因，也是 za-core『selector 即订阅面』的镜像福利。

### 4. (C) MobX 和 zustand/middleware/immer 都允许 `s.a.b = 1` 的写法，判若两家的依据是什么？

**来源**：转述自 L4 与本课机制对照（sig-mutability 预热）

看『写完之后对象还是不是原来那个』：MobX 改完还是同一引用（真可变，靠观察 property 的 setter 触发），脱离 observable 代理的裸读取无追踪；immer 改完是全新快照（旧快照原样存在，可回溯），组件靠引用比较感知。实验判据：改后 `newState.a === oldState.a`？MobX 为 true、immer 为 false。同语法两世界观，混用两边教程时的第一鉴别题。

### 5. (D) 设计一个『只在生产关闭、开发自动开 trace』的 devtools 配置，并说明为什么不能反过来。

**来源**：转述自官方配置项与常见事故

`devtools(fn, { name, enabled: process.env.NODE_ENV !== 'production', trace: true })`（或 createJSONStorage 环境判断同款思路）。反过来（生产开 devtools）的代价：Redux DevTools 序列化每帧快照+调用栈，大 store 高频更新下内存与主线程双税；且面板暴露 store 结构=攻击面（用户可手改前端状态）。安全与性能都不允许生产常驻——这是『调试能力也是敏感配置』的样本。

### 6. (B) persist + 异步 storage（IndexedDB）后，首屏组件闪了一下默认值再跳到真实值，两针修法？

**来源**：转述自 hydration 时序文档与社区 issue 模式

① UI 层：用 `useStore.persist.hasHydrated()`/`onFinishHydration` 在未注水前渲染骨架（把这判断收进一个 useHydrated hook）；② 数据层：改 skipHydration+store 外 await `persist.rehydrate()` 完成后再挂载应用（SPA 启动流程里卡住）。根因一句话：异步 storage 下初始值与注水值是两个时刻的事实源，UI 不能同时信仰两份。SSR 场景同款问题在 sig-server 展开。

### 7. (A) 为什么手写 logger 中间件里要先 `const prev = get()` 再 `set(...)`？get 从哪来？

**来源**：转述本课第五节代码与 create 签名

set 触发后 store 已指向新快照，事后 get 拿不到变更前状态，diff 无从谈起——prev 必须在 set 前取。get/api 来自 create 传给 config 的第二、三参（中间件拿到的正是加工前的 set、原生 get、store api），这是 `(set, get, api) => state` 三元组在中间件层的复用。顺带：api 上挂着 `setState`（等价 set）与 `subscribe`，手写中间件常走 `api.subscribe` 而非包 set——两种劫持点对应两类需求（记快照 vs 记迁移）。

### 8. (C) 三家持久化对照：Zustand persist、Redux 生态（redux-persist）、自写 effect 监听 localStorage——工程差距在哪？

**来源**：转述自三家方案社区对比

redux-persist：外部库、store 增强器接入、白黑名单+transform 全家桶，重；persist 中间件：内建零额外依赖、partialize/version/migrate 覆盖八成需求、异步 storage 可插；自写 subscribe+JSON：几十行可控但 version/migrate/竞态全自己扛，等于重造 persist。选型：Zustand 项目直接中间件、Redux 大项目 redux-persist 生态熟、只有『存一两个字段』的轻需求才值得自写——别为 5 行需求引 5KB 依赖，也别为省 5KB 写 50 行隐患。

### 9. (B) devtools 面板时间旅行（回放旧快照）在带 persist 的 store 上有什么坑？

**来源**：转述自 devtools+persist 交互社区讨论

回放是 setState 覆盖当前快照——persist 监听到 set 会把『回放的旧值』当真写进 localStorage，关面板即污染真实持久化。对策：调试期临时注释 persist／persist 配 partialize 排除回放会改的字段／看完回放手动 resetStorage。深层教训：时间旅行是『读操作』心智，但实现走的是写通道——凡持久化/上报类副作用挂在写上，调试工具的『读』都会变成『写事故』，同坑在埋点中间件上重现。

### 10. (D) 给多标签页同步场景补全方案：persist 能不能直接做到『A 页改了 B 页跟着变』？

**来源**：转述自多标签页同步 FAQ

persist 默认做不到——它只负责读写存储，不负责监听。补法两步：`window.addEventListener('storage', e => { if (e.key === 'app-store') useStore.persist.rehydrate(); })`（storage 事件恰只在其他标签页触发，天然单向）；或 BroadcastChannel 自建通道在 set 后广播、收方 setState。坑：rehydrate 触发的 set 再被 persist 写入会不会回环？——写不会再生 storage 事件（同源本页不触发），但 BroadcastChannel 方案要自防回声。考点：中间件能力边界的精确感——知道 persist『不做什么』比知道它做什么更值钱。

### 11. (A) TS 里 create<State>()(devtools(persist(immer((set...) => ...)))) 常报『set 参数类型丢失』，官方推荐的稳定写法模式是什么？

**来源**：https://zustand.docs.pmnd.rs/typescript

curried 空泛型调用钉第一层（`<State>()`）后，中间件泛型链才可推断；再不行用官方模板：PersistOptions/ImmerStateCreator 类型别名逐层显式标注。面试要点不在背类型名，而在说出『泛型要穿过三层高阶函数，TS 推断深度有限，所以显式注一次、让推断从注点向内发散』——curried 技巧的通用心智。

### 12. (C) subscribeWithSelector 提供的 selector 版 subscribe，和直接在 store 里用 getState+手写 diff，工程上差在哪？

**来源**：转述自中间件源码（约 30 行）

中间件版：equality 可换（默认 Object.is）、自动对齐 prevState 时序、退订即停——30 行内但把『订阅三坑』（漏退订、比较时机、等值函数）都填了。手写 getState+轮询 diff 的方案在高频更新下要么轮询浪费要么漏窗口。结论：这 1KB 级别的中间件属于『不值得自研』清单——与 immer 同理：机制看懂归看懂（本关手写题），生产用官方。

### 13. (D) 需求：购物车 store 的变更要上报埋点（含变化字段与触发来源），设计中间件方案，说清与 devtools/trace 的分工。

**来源**：转述自本课机制综合应用

中间件包 set：prev=get()、执行 set、shallowDiff 出变化字段；来源=调用方以 `set(partial, false, 'coupon:apply')` 第三参传标签（devtools 同款约定），中间件读 info 一并上报。分工：devtools/trace 面向**开发者本地**、有栈无网络、可丢；埋点中间件面向**生产**、采样+脱敏（partialize 思路反向用：白名单字段才可上报）、不可丢。同一劫持点、两套约束——这题看候选人会不会把调试和观测混为一谈。

### 14. (B) persist 存了函数和 class 实例，rehydrate 后方法全 undefined 或 instanceof 失效，为什么？两针修法？

**来源**：转述自序列化边界高频坑

JSON 往返只能存活 plain data：函数直接被 stringify 跳过（配 partialize 防不住时更隐蔽）、class 实例退化为普通对象原型链断。修法：① partialize 白名单只存纯数据+actions 全部定义在 store 初始值里（函数本就不该存）；② 需要实例语义时在 migrate/merge 钩子里做 revive（把 plain 重建为实例）。一句话原则：**存储层只过『值』，不过『行为』**——mobx-stores 的『出境 toJS』在这里有镜像条款。

### 15. (C) 为什么 Zustand 不做内建 devtools/持久化而留给中间件？对比 MobX 的 toJS/observe 生态，两家『核心该多大』的哲学差在哪？

**来源**：转述自两家设计文档与社区讨论

Zustand 核心只承诺『快照+订阅』最小契约，persist/devtools 各是可选外套——1.1KB 的底气来自『不默认替用户决定存哪、看哪』；MobX 把可变观察内核做死，出境协议(toJS)与调试(tools 扩展)是内核语义的自然延伸，拆无可拆。选型镜像：喜欢『核心小、清单自己勾』选 Zustand 路线，喜欢『全家桶开箱齐』选 MobX 路线——L6 sig-scenarios 会把这条哲学差画成选型线。
