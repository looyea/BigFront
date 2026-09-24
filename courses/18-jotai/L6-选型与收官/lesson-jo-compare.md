# Jotai vs Zustand vs Redux vs Context：选型矩阵

## 一、路线差异一句话
- Jotai：自下而上「原子」，异步/Suspense 天然。
- Zustand：自上而下「单 store + selector」，最小 API。
- Redux/RTK：中心化 action/reducer，最强规范与工具链。
- Context：React 内置低频注入。

选型前先认清一个事实：这四者解决的问题重叠度不到一半。Context 是「依赖注入管道」不是状态库；Redux 卖的是「规范与工具链」顺带送状态；Jotai 与 Zustand 才是真正的「轻状态方案」双子星——而它俩的哲学相反（jo-atom 第三节的自上而下 vs 自下而上）。

## 二、关键维度对比

| 维度 | Jotai | Zustand | Redux | Context |
|---|---|---|---|---|
| 体积 | ~3KB | ~1.2KB | 大 | 0 |
| 粒度 | 原子自动 | selector 手动 | 手动 | 粗 |
| async | 原生挂起 | 借 Query | thunk/RTKQ | 手搓 |
| DevTools | 有 | 借 Redux | 最强 | 无 |
| Provider | 可选 | 无 | 需要 | 需要 |

补三行隐性维度：**心智迁移成本**（从 useState 出发：Jotai 最近——一次一个值；Redux 最远）；**逻辑复用**（跨页面共享一组状态+派生：原子组合 > slice 拼装 > reducer 组合）；**团队约束力**（超大团队统一范式、时间旅行调试：Redux 无对手）。

## 三、适用场景
Jotai：组件树状态密集、依赖派生多、重度 Suspense；Zustand：中小全局业务；Redux：超大团队标准化；Context：低频配置。呼应 za-compare。

把「组件树状态密集」翻译成人话：**一个页面的状态由十几个互相关联的小块组成**（编辑器：文档+选区+面板+历史栈+协作游标）。这种形态下原子派生是顺水行舟；反之若状态天生是一整块业务袋（购物车、会话），拆原子反而制造拼接代码——那该归 Zustand。

## 四、共存策略
Query 管服务端态 + Zustand/Jotai 管客户端态；甚至 Jotai 与 Zustand 同项目分工（原子交互 vs 业务 store）。

双库共存的边界纪律只有一条：**单一数据单一归属，两边不互拷**（za-layers 同款）。典型分界：URL/表单/弹层/画布等「交互原子群」归 Jotai；session/cart/feature-flags 等「业务大袋」归 Zustand；服务端缓存归 Query。跨库读经 selector 参数传入，禁止 write atom 去 set 对方库的状态。

## 五、原子 vs 大 store 心智
自下而上易拆分复用、订阅天然细；自上而下利于跨域集中协作。选哪种取决于「数据更原子还是更整体」。

一个可操作的判据题：「想象新需求进来——你是倾向**加一个原子**还是**给现有 store 加一个字段**？」总想加原子的项目，数据形态天然离散，Jotai 事半功倍；总想加字段、且字段间强耦合要一起提交回滚的，大 store 的整体性更省心。没有对错，只有匹配。

## 六、迁移与退出成本
Zustand → Jotai：把 getter 拆成派生 atom、action 拆成 write atom，机械但清晰；反向迁移同样成组可逆。真正难迁的是 Redux（规范依赖）与「无库纯 Context」（性能债一起还）。选型时的隐藏分：**迁移成本低的库，选错的可挽回性高**——Jotai 与 Zustand 都属此档，这也是双子星能放心试用的原因。

## 小结
没有银弹：Context 是管道、Redux 卖规范、Jotai/Zustand 是哲学相反的双子星——按数据归属（离散 or 成袋）、订阅粒度与异步需求选型；Jotai 在「原子 + 异步挂起」象限独占优势，且与 Zustand 同属低退出成本区，试错可控。

## 部署预告
给手头一个小项目做「双写演练」：同一组状态（用户会话 + 弹层 + 一个派生统计）分别用 Zustand store 与 Jotai 原子组实现一遍，对照文件行数、订阅写法、异步处理三处差异，写下你的归属判据结论。
