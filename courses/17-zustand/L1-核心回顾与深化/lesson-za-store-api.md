# Store 外部 API：getState / setState / subscribe

## 一、脱离 React 的三件套

store 创建后可在**任意地方**（拦截器、路由守卫、Web Worker、测试）使用：

```ts
// 目的：脱离 React 的三件套——getState 读快照、setState 写、subscribe 命令式监听
const token = useAuthStore.getState().token;         // 读瞬时快照，不订阅
useAuthStore.setState({ loggingOut: true });          // 任意位置直接写
const unsub = useAuthStore.subscribe(
  (s) => s.count,                                     // 可选 selector：只关心 count
  (count, prev) => console.log('count', prev, '->', count),   // 选中值变了才回调
  { fireImmediately: true }                            // 立即先跑一次当前值
);
// ✅ subscribe 返回 unsub，不用时在 cleanup 里调用释放
// ❌ 组件渲染期用 getState() 读值当订阅→它不驱动重渲，界面停在旧值
```

## 二、getState：非响应式读

用于事件回调、axios 拦截器注入 Authorization、命令式逻辑判断。**不会订阅**，拿的是瞬时快照。

```ts
// 目的：getState 在非渲染管线（拦截器）里注入 token——瞬时读、不订阅
axios.interceptors.request.use((cfg) => {
  cfg.headers.Authorization = `Bearer ${useAuthStore.getState().token}`;   // 每个请求现取最新 token
  return cfg;
});
// ✅ 拦截器不在 React 渲染里，用 getState 拿瞬时值正合适，无需 hook
// ❌ 在函数组件体内用 useAuthStore.getState().token 取代 useAuthStore(s=>s.token)→token 变了不重渲
```

注意与组件内订阅读的分工：组件渲染期永远用 hook 订阅（保证更新驱动重渲），getState 只出现在「不在渲染管线里」的代码——事件处理器、回调、拦截器、定时器。渲染期用 getState 读值是反模式：它不会让你重渲，界面会停留旧值。

## 三、setState：外部注入

测试里初始化、SSR 注水、跨标签页同步都能直接 setState。第二参 replace=true 整体替换。

```ts
// 目的：setState 外部注入——测试造场景、整体重置，省去走 UI 流程
// 测试造场景：直接塞一个登录态，省去走 UI 流程
useAuthStore.setState({ token: 'test-jwt', user: { id: 1, name: 'qa' } });   // 浅合并，只动 token/user
// 整体重置（配合初始快照做 reset 按钮/单测 beforeEach）
useAppStore.setState(initialState, true);   // 第二参 replace=true 整体替换
// ✅ 函数式/partial 只覆盖数据字段，保留 action
// ❌ replace=true 传的 initialState 不含 action→整体替换后 store 里没有 action，调用报 undefined
```

replace 模式会丢弃 action 定义吗？不会——action 本来就在 state 对象里，替换时记得把 action 一并带上，或改用函数式 partial 只覆盖数据字段。

## 四、subscribe 做 transient 更新

高频变化（如鼠标坐标、拖拽）若每帧走 React 渲染会卡。用 subscribe 在 React 之外消费这些值（直接写 DOM/canvas），渲染层根本不订阅它，性能极高。

```ts
// 目的：subscribe 做 transient 高频更新——在 React 之外直接写 DOM，不走渲染管线
usePointerStore.subscribe((s) => {
  el.style.transform = `translate(${s.x}px,${s.y}px)`;   // 每帧直写 style，不触发重渲
});
// ✅ 鼠标/拖拽这类高频值用 subscribe 直写 DOM/canvas，渲染层不订阅，性能极高
// ❌ 把 x/y 放进组件 useStore(s=>s.x) 驱动渲染→每帧 setState+重渲，拖拽明显卡顿
```

对比 MobX reaction：思路一致——把「副作用」从渲染管线剥离。

## 五、选择器式 subscribe（v4.3+）

需要先装 subscribeWithSelector 中间件：

```ts
// 目的：选择器式 subscribe—需先装中间件，才能给 subscribe 传 selector
import { subscribeWithSelector } from 'zustand/middleware';
const useStore = create(subscribeWithSelector((set) => ({ ... })));   // 包一层中间件才支持 selector
// ✅ 装后 subscribe(selector, listener) 只在选中值变化时回调，减少无关触发
// ❌ 忘包 subscribeWithSelector 就直接传 selector 参→监听不生效（基础 subscribe 只接 listener）
```

之后 subscribe 传 selector + listener，只在选中的值变化时回调，减少无关触发；`equalityFn` 选项还能自定义判等。

## 六、三条实战守则

1. **subscribe 返回的 unsub 必须释放**——组件场景放 useEffect cleanup；全局订阅放应用销毁钩子，否则热更新/多页面会叠加监听。
2. **回调里别再 setState 成环**：A 写 → 订阅 A → 又写 A，轻则死循环重则栈爆；加判等或改标志位。
3. **worker/库层只依赖 store API**：把纯逻辑放 vanilla store，React 只是消费者之一（呼应 za-factory 与 pinia 的插件层设计）。

## 小结
getState 读、setState 写、subscribe 做副作用与 transient 更新——让 store 成为纯 JS 层，React 只是其中一种消费者；渲染期禁用 getState 读值是底线。

## 部署预告
本地用 14-signals 的 counter store 加一段 subscribe 写 DOM 的 transient demo；跨标签页同步的完整方案见 za-hydration。
