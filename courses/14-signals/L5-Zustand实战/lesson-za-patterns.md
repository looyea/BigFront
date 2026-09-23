# za-patterns：大 store 的组织——slices、transient 订阅与选型线

> 目标：当一个 store 膨胀到几十个字段时怎么拆（slices 分片模式）、怎么用 subscribe 做不走渲染的 transient 订阅、原子化 selector 的性能边界在哪；并把 Zustand 放进对照系：与 Redux Toolkit 的功能分界、与 Jotai/Context 的选型线（呼应 sig-scenarios、react-context、mobx-stores）

## 一、slices：把大 store 拆成『功能文件夹』

反面起点是一个 800 行的 `useAppStore`：用户、购物车、播放器、UI 全在一起——改一行都要在文件里爬山。Zustand 的拆法不引入新概念，就是**函数拼对象**：

```js
// stores/cartSlice.js
export const createCartSlice = (set, get) => ({
  items: [],
  addItem: (p) => set((s) => ({ items: [...s.items, p] })),
  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
});

// stores/playerSlice.js
export const createPlayerSlice = (set, get) => ({
  playing: false,
  progress: 0,
  play: () => set({ playing: true }),
});

// stores/index.js —— 组装点
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { createCartSlice } from './cartSlice';
import { createPlayerSlice } from './playerSlice';

export const useAppStore = create(
  devtools(subscribeWithSelector((...args) => ({
    ...createCartSlice(...args),
    ...createPlayerSlice(...args),
  }))),
);
```

要点三条：① slice 就是『返回对象的函数』，无框架概念、可单测（直接 call 它传假 set/get）；② 跨 slice 调用走 `get()`（同一 store 内互通）或 import 对方的独立 store（跨 store）；③ **拆分维度按业务不按技术**——『购物车的一切』优于『所有 actions 一个文件』，这跟 mobx-stores 的 RootStore 按域组装是同一直觉的两种实现。

什么时候不再拆 store 而拆**独立 store**？slice 间出现循环依赖、或某块的更新频率与整体差一个数量级（播放进度 vs 用户信息）——拆成独立 store + 单向 import，比在一个 store 里做隔离干净。

## 二、transient 订阅：高频状态不走渲染

za-core 面试第 7 题的正式版。场景：播放器进度条每 250ms 更新、拖拽坐标每帧更新——走 React 渲染流就是全树陪跑。transient 的思路：**数据留在 store，更新绕开 setState→render，直接写 DOM**：

```js
// 组件挂载时注册一次性订阅，卸载时退订——不进 React 数据流
useEffect(() => {
  const unsub = useAppStore.subscribe(
    (s) => s.progress,               // 需要 subscribeWithSelector 中间件
    (p) => {
      barRef.current.style.width = `${p}%`;   // 直写 DOM，零重渲
    },
  );
  return unsub;
}, []);
```

对比三种通道的选型表：

| 通道 | 触发渲染 | 适用 |
|---|---|---|
| `useStore(sel)` | 是（sel 产物变时） | 常规 UI 数据 |
| `subscribe(sel, cb)` transient | 否 | 进度条/拖拽/动画/日志直写 |
| MobX reaction / signal effect | 否 | 同位物——三家在『绕开渲染层』上殊途同归 |

配套一层：源头降频（rAF 合帧/采样）+ 终点 commit（松手、播完才 set 回主 store 让 UI 渲一次）——『中间过程 transient、两端走渲染』是高频状态的通用形状，L7 sig-perf 有完整案例。

## 三、selector 粒度与性能边界

原子化原则：**一个订阅只拿一个原子**。`useStore(s => s.user.name)` 比 `useStore(s => s.user)` 好的原因不是『少拿字段省流量』（内存里没这点钱），而是**订阅面收窄**：任何改 user 对象的动作（改头像、改地址）都会惊动后者，前者只被 name 变化惊动。边界在哪？三个务实刹车：

1. 字段本来就同生同灭（经纬度一对）→ 别硬拆，useShallow 一次拿；
2. selector 里别做计算（`s => s.items.filter(...)` 每次新数组=永判变）——派生收进 store（算好存）或 useMemo（组件内），selector 只做『取』；
3. 组件列表几十个、每人订一条消息？——虚拟化/分页在前，selector 调优在后，别用订阅技巧救架构问题。

再往上的性能手段（`equalityFn` 第三参、中间层聚合 store）都属于『有实测卡顿再动』清单——主流应用里 selector 纪律 + immer 结构共享已经覆盖 95% 的场景。

## 四、与 Redux Toolkit 的功能对照：谁管状态、谁管异步

| 维度 | Zustand | Redux Toolkit |
|---|---|---|
| 心智 | 快照+selector，自由式 | 单一 store+slice+reducer 纪律 |
| 异步 | 无内建：action 里直接 await（自带 thunk 能力） | createAsyncThunk/RTK Query 全家桶 |
| 样板 | 十行起步 | 模板生成，单文件成本高于 Z |
| DevTools/时间旅行 | 中间件级（快照回放） | 完整（action 重放，可回溯可调试异步流） |
| 生态惯性 | React 圈新项目 | 大厂老项目/团队规范 |

分界线一句话：**异步编排复杂度**。『点按钮→fetch→存』Zustand 三行完事；『乐观更新+回滚+轮询+失效重取+缓存归一』这一串交给 RTK Query（或 React Query，13 包老朋友）来管，Zustand 只留 UI 态——两家不是替代而是**分工**，同一页面 Zustand 管主题侧栏、Query 管服务端数据是 14 包推荐的标准姿势（rx-inapp『编排归流、缓存归 query、可分享状态归 URL』的 Zustand 版复读）。

## 五、与 Jotai / Context 的选型线

- **Jotai**：原子派——自下而上，一个 `atom` 一份状态，组合靠派生原子。与 Zustand 是镜像哲学：Zustand 自上而下（先画 store 再切 selector），Jotai 自下而上（先有原子再长出图）。选型速记：状态碎片多、派生关系复杂（表单联动、筛选级联）→ Jotai 顺手；状态成块、跨页面共享、要 transient/持久化总线 → Zustand 顺手。两家互杀场景少，团队熟哪个用哪个；
- **Context**：za-core 面试第 12 题的结论回收——低频小状态（主题、用户摘要）Context 零依赖够用；高频/多 selector 粒度/组件外读写，Context 两个硬伤（一换全渲、困在组件树）无解，别硬撑；
- **三线合一判据**：状态的**形状**决定工具——一颗树给 Zustand（store+selector 切）、一张网给 Jotai（原子+派生）、一潭死水给 Context（低频整读）。L6 sig-scenarios 给总决策树。

> 🚀 部署预告：本关练习用 12 包起的 Vite 模板即可：把一个假想的 800 行 store 重构成三个 slice + 一个 transient 进度条 demo（DevTools Performance 验证渲染次数为 0）。选型线没有标准答案，把判据说出理来就算过关。
