# sig-migrate：迁移与共存路径

> 目标：把『选型』的静态讨论推进到『换血』的动态工程：Redux→Zustand 的渐进迁移路线（双写桥、按 feature 切）、已有 Context 应用引入外部 store 的判断边界、MobX+Zustand 同仓共存的分工线与反模式，以及让迁移敢上生产的验证安全网（呼应 sig-scenarios、za-patterns、interview-sig-mutability q12）

## 一、迁移第一定律：没有『一把梭重写』这个选项

面试官爱问『Redux 迁到 Zustand 怎么迁』，现实里更常的问题是『**凭什么**迁』。先把账算清：Zustand 相对 Redux 的收益（样板减少、订阅面自控、无 Provider）在 sig-scenarios 已对过表——如果你的 Redux 项目靠 RTK 已经把样板抹平、团队没有 selector 性能债，**迁移收益≈0，别动**。迁移的正当理由通常是：重渲风暴治不好（Redux 订阅面整 state）、样板债重到 RTK 也压不住、或团队主动换范式。理由不成立，这关当历史课读。

理由成立，则第一定律生效：**20 万行的状态层重写=用新 bug 兑换旧 bug**。12/13 包迁移课的总纲在这里重播：渐进、可回滚、每步可验证。

## 二、Redux→Zustand 的三段渐进桥

**第 1 段：共存地基**。新 Zustand store 直接挂在 Redux 应用旁——Zustand 无 Provider，挂载零侵入（这是它比『再引一个 Redux 家族库』友好的地方）。此段禁止新功能写进 Redux reducer，增量先进新体系。

**第 2 段：双写桥**。迁移单位是 feature slice，切一个搬一个，搬完的不许回头写旧家。过渡期两块阵地要同步，标准装置是**单向双写**：

```js
// 旧→新：Redux 是唯一写入口时，订一份广播
const unsub = reduxStore.subscribe(() => {
  const next = reduxStore.getState().articles;
  if (next !== useArticleStore.getState().raw)   // 引用比较挡全量广播
    useArticleStore.setState({ raw: next });
});
// 新组件只读 useArticleStore；旧组件照读写 reduxStore
```

双写桥的三条纪律：① **方向单一**（旧→新，或新功能新→旧广播，二选一，双向同步=死循环预约）；② 桥只过值不过行为（za-middleware 存储边界第三分册——别把 dispatch 包成 action 往对门塞）；③ 每座桥配**拆桥日期**，双写状态进 tech-debt 看板，无期限双写=永久双事实源。

**第 3 段：按 feature 切流与收尾**。一个 slice 的读写组件全部改完后删桥。最后剩下的通常是 `connect` 老组件海——react-redux 的 `useSelector` 版迁移（connect→hook）可以放在 Zustand 迁移**之后**单独做，两件事别捆一起上。

**中间件对号入座**（迁移清单的隐藏项）：thunk→直接函数调用删掉；saga→最难啃，副作用编排单独评审（多数可降级为 async 函数+错误边界，剩下的 RxJS 化而不是搬进新库）；redux-persist→zustand persist 对拍迁移，注意版本与 partialize 白名单重立。

## 三、Context 应用引入外部 store 的边界

『我们全用 Context，要换吗？』——不换库，换**位置**。判据背 za-patterns 三件套比喻的分工版：**高频瞬态与跨切面共享出 Context，低频全局配置留 Context**。具体来说值得引入 Zustand/Jotai 的信号：① Context 值频繁变化导致消费树集体重渲（Context 订阅面=整棵树，没有 selector 可窄化——这是结构缺陷不是使用问题）；② 组件树外需要读/写状态（事件回调、axios 拦截器、路由守卫——Context 出树即死，store 模块单例天生出树可达）；③ 三个以上 Context Provider 开始互相依赖排列组合。只有一条『传参嫌烦』不构成引入理由——那是对 Context 的正当使用。

引入后**不拆迁**：已有 Context 继续服务它的低频配置，新功能进 store——两套房各住各的，边界就是上面三条判据，写进 review 清单。

## 四、MobX + Zustand 共存：分工线与三大反模式

大厂真实项目里这组合不少见（MobX 管域模型、Zustand 管 UI 壳），可行，但要划死分工线：**对象有行为、要懒派生、关系成网→MobX；纯值快照、跨切面、要 persist→Zustand**——即 sig-scenarios『一颗树给 Zustand、一张网给 MobX』的同仓执行版。

三大反模式：① **跨库联动**——MobX reaction 里 setState 进 Zustand、或 Zustand subscribe 里改 observable：两条通知事务咬合成隐式循环，glitch 窗口出现在库的接缝上，调试时两边面板各看半截日志；② **同一数据两处存**——user 在 MobX 有实例、Zustand 缓存了它的字段投影：投影过期速度比你想的快；③ **事件总线私聊**——用 mitt/自造总线绕开①的禁令。合规接口只有一种：**单向、显式、过值**——MobX 域模型在 action 末尾显式调用 `useShellStore.setState({ snapshot: toJS(...) })`，方向固定为『网→树』，且这条线要写在两个 store 的文件头注释里。共存不立文档=半年后没人知道哪条边是故意的、哪条边是手滑。

## 五、验证安全网：迁移敢上生产的三件兜底

1. **行为快照对拍**：双写期间同一操作序列（录制的 action 日志或 e2e 脚本）分别打到新旧 store，diff 最终状态——这是单元测试给不了的『等价性』证据；无现成工具，一个 50 行的 reducer-of-states 比对器就够；
2. **渲染计数基线**：迁移前后各跑一遍关键页，Profiler commit 数对比——Zustand 迁移的典型翻车不是功能坏而是**订阅面意外变宽**（selector 偷懒写 `s => s`）；顺路接 sig-perf 的四断言；
3. **灰度与回滚开关**：feature flag 控制组件读新读旧，桥在 flag 全绿一个版本后才拆——拆桥即不可逆点，之前随时可撤。

interview-sig-mutability q12 的『迁移性能案』在此收口：迁移事故榜第一不是丢功能，是**悄悄变慢**——没有基线对拍的迁移等于蒙眼换胎。

> 🚀 部署预告：拿一个玩具 Redux todo 应用（或用本包 demo 改造），完整走一遍第 2 段：建 Zustand 镜像 store→搭单向双写桥→迁一个组件改读新 store→跑对拍脚本→拆桥。全程记录你写的每一行桥代码——拆桥时它们应该全部消失，留一行都是设计失误。
