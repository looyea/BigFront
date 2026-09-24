# Zustand vs Redux Toolkit vs Jotai vs Context

## 一、四象限速览

| 维度 | Zustand | Redux Toolkit | Jotai | Context |
|---|---|---|---|---|
| 体积 | ~1.2KB | 较大 | ~3KB | 0（内置） |
| 心智 | 直接 set | action/reducer | 原子 | Provider+useContext |
| DevTools | 借用 | 最强 | 有 | 无 |
| 订阅粒度 | selector | selector | 原子级 | 粗（易全量） |
| 适用 | 中小/快速 | 超大团队标准化 | 依赖图/异步 | 低频注入 |

## 二、共存才是常态

现代 React 应用很少单一状态库：
- **服务端态** → TanStack Query
- **客户端全局交互态** → Zustand
- **原子级派生/异步** → Jotai（可选）
- **表单字段** → React Hook Form
- **低频主题/登录注入** → Context 或直接 Zustand

选型题的正确句式不是「X 比 Y 好」，而是「我们的矛盾是____，所以让____管____」。把「状态来源」当第一分类轴（呼应 za-layers），库只是每层的落地工具。

## 三、为什么 Zustand 增长快

零 Provider、TS 友好、API 就是 useState 的扩展版、可 vanilla 脱离 React（呼应 za-store-api）。

学习成本也最低：会用 useState 就会用 create；中间件（persist/devtools/immer）是可选糖而非必选骨架——「渐进复杂度」正中 Redux 样板之痛。

## 四、何时仍选 Redux Toolkit

超大团队、需要严格单向数据流、中间件生态（saga/rtk-query）、强 DevTools 与规范化约束。

再补两条硬理由：① 团队里有大量初级成员时，「只能 dispatch、状态必可回放」的约束反而是护栏；② RTK 自带 createSlice/createAsyncThunk/rtk-query 全家桶，标准化本身就是卖点。Zustand 的自由度在这里是负债。

## 五、何时选 Jotai

状态天然是「许多小原子 + 依赖派生」、重度用 Suspense/async（呼应 za-suspense）。

判别练习：一个「联动表单」（改 A 显示 B、C 派生自 A+B）——用 Jotai 写是十几条派生 atom 的自然映射；用 Zustand 写会在一个 store 里塞满互相引用的字段与重复的订阅簿记。形状匹配度决定代码气味。

## 六、一句话对比 Vue 侧

React 的「store 即 hook」≈ Pinia 的「store 即 reactive」；Context ≈ provide/inject 但无细粒度响应。跨框架面试时把这组映射讲出来，等于同时展示两家生态的理解（呼应 pinia-overview、jo-compare）。

## 小结
不是谁取代谁：按「数据归属 + 团队规模 + 订阅粒度需求」组合选型；Zustand 赢在手感与体积，RTK 赢在约束与生态，Jotai 赢在原子与异步，Context 只配低频注入。

## 部署预告
给同一需求（主题 + 购物车 + 用户列表 + 登录）分别用四方案写 mini 版，统计代码行数与 bundle 体积——自己的数据是最好的选型依据。
