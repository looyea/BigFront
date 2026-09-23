# sig-auth：登录态实战——同一需求四种实现

> 目标：用『登录态跨页共享 + 路由守卫 + 登出清理』这个最经典的需求当标尺，分别以 Zustand store、MobX store、signals+Context、RxJS BehaviorSubject 实现一遍，在代码量、心智负担、框架锁定度三个维度上贴身对比——把本包的范式讨论落成一次同题写卷（呼应 za-core、sig-server 登出协议、kit-auth-session）

## 一、考卷题目：登录态需求的三件套拆解

需求看着一句话，拆开是三件各有脾性的事：

1. **跨页共享**：任何组件、任何路由下的守卫都要能回答『现在谁登录了、token 是什么』——要求状态**出树可达**（拦截器和守卫不在 React 树里，Context 直接出局一半）；
2. **路由守卫**：未登录访问 /dashboard 要弹登录页——要求状态可**同步读取**（守卫函数里等不了 hook）；
3. **登出清理**：token 失效/主动登出时，UI 全站翻转+清缓存——sig-server 清场协议的执行者，要求状态可**订阅变化**（触发跳转与 clear 成对动作）。

三件事对状态库的要求浓缩成一句：**写得动、读得快（同步）、变得可监听**——这四条实现全都能满足，区别在满足的姿势和附带的账。

## 二、四份答卷

**Zustand 版**（约 15 行核心）：

```js
const useAuth = create((set) => ({
  user: null, token: null,
  login: (u, t) => set({ user: u, token: t }),
  logout: () => { queryClient.clear(); useUIStore.getState().reset(); set({ user: null, token: null }); },
}));
// 组件内：const user = useAuth(s => s.user)
// 守卫/拦截器（树外）：useAuth.getState().token
```

心智：一个对象三种用法（hook 订阅/getState 旁路/set 动作）。守卫拿 `getState()` 同步读，教科书级贴合。

**MobX 版**（约 18 行）：`makeAutoObservable` 的 AuthStore + RootStore 挂载，组件 `observer` 包裹后**解构都敢用**；守卫里 `root.auth.token` 直接读（observable 读本来就是同步的）。多付的账：RootStore 组装仪式、observer 包裹纪律、mobx-react-lite 依赖。

**signals + Context 版**（Solid 约 12 行 / React 约 25 行）：Solid 里 `const [user, setUser] = createSignal()` 模块级导出，信号出树天然可达、守卫直接 `user()` 同步读、`createEffect(when(user))` 挂登出联动——**signals 版是这个需求在小框架里的原生最优解**。React 没有原生 signal，只能 signal 库+Context 传 Provider，或退化成 useSyncExternalStore 胶水，代码量立刻爬上四份答卷最高——一次生动的『框架有没有内置响应式』差价演示。

**RxJS BehaviorSubject 版**（约 20 行 + 订阅税）：`auth$ = new BehaviorSubject(null)`，守卫 `take(1).toPromise()` 或 snapshot 读（要手写 `getValue()` 才同步）；组件订阅走 `useObservable` 类胶水（React 里又一笔外接税）。**它的长板恰在第三件事**：登出流可以 `logout$.pipe(switchMap(clearAll))` 把清场编排写成管道——四份卷里唯一把『登出清理』当一等公民表达的方案。

## 三、三角评分：代码量 × 心智 × 锁定度

| 方案 | 核心行数 | 心智负担 | 框架锁定度 | 一句话判词 |
|---|---|---|---|---|
| Zustand | ~15 | 最低（一个对象） | 中（库可换，API 不跨框架） | 全能中庸：三件事都及格无长板 |
| MobX | ~18 | 中（observer 纪律+RootStore） | 高（反应式渗透组件写法） | 域模型大户顺路带，小需求杀鸡用牛刀 |
| signals(Solid) | ~12 | 低（语言原生感） | **反向锁定：锁进框架而非库** | 框架内置者白捡，React 复刻版立刻涨税 |
| RxJS | ~20+胶水 | 高（流语义翻译层） | 低（库本身框架无关） | 清场编排最强，共享/守卫用它是拧水龙头当水泵 |

两个维度的坑：① **代码量骗人**——RxJS 行的少不代表账少，`getValue()` 旁路、useObservable 胶水、退订纪律都是隐形首付；② **锁定度方向相反**——MobX/Zustand 锁库（换框架大概率还带得走），Solid signal 锁框架（换框架全部重写）——za-core『依赖形状』论辩在登录态这张小考卷上的重演。

## 四、结论不在排名，在『需求形状识别』

单看这道题给排名（Zustand>Solid signals>RxJS>MobX 在 React 生态语境下）是背答案；正解是学会读需求形状：**登录态=低频变更+全局同步读+树外可达**，这形状天然贴合『对象式 store+getState 旁路』；如果需求换成『登录态驱动 20 个联动副作用』（IM 断线重连、埋点身份切换），形状就滑向事件流，RxJS 版反超。**同一份需求文档里圈出『需要 getValue 的时刻』和『需要 subscribe 的时刻』各占几处——哪个多，哪个库的主场**。这套读法平移到任何状态需求都成立，是本题真正的考纲。

> 🚀 部署预告：四份答卷都跑起来后做一件事：在每份实现里故意删除『登出清理』的一半（只清 token 不清缓存/只清缓存不跳登录页），复现 sig-server q2 的跨用户残留事故——四库版症状一模一样。架构协议的地位与库选型无关，这是本关和 L8 前两关合上的锁。
