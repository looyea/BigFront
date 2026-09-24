# Store 外部 API：getState / setState / subscribe

## 一、脱离 React 的三件套

store 创建后可在**任意地方**（拦截器、路由守卫、Web Worker、测试）使用：

```ts
const token = useAuthStore.getState().token;         // 读快照
useAuthStore.setState({ loggingOut: true });          // 写
const unsub = useAuthStore.subscribe(
  (s) => s.count,                                     // 可选 selector
  (count, prev) => console.log('count', prev, '->', count),
  { fireImmediately: true }
);
```

## 二、getState：非响应式读

用于事件回调、axios 拦截器注入 Authorization、命令式逻辑判断。**不会订阅**，拿的是瞬时快照。

```ts
axios.interceptors.request.use((cfg) => {
  cfg.headers.Authorization = `Bearer ${useAuthStore.getState().token}`;
  return cfg;
});
```

注意与组件内订阅读的分工：组件渲染期永远用 hook 订阅（保证更新驱动重渲），getState 只出现在「不在渲染管线里」的代码——事件处理器、回调、拦截器、定时器。渲染期用 getState 读值是反模式：它不会让你重渲，界面会停留旧值。

## 三、setState：外部注入

测试里初始化、SSR 注水、跨标签页同步都能直接 setState。第二参 replace=true 整体替换。

```ts
// 测试造场景：直接塞一个登录态，省去走 UI 流程
useAuthStore.setState({ token: 'test-jwt', user: { id: 1, name: 'qa' } });
// 整体重置（配合初始快照做 reset 按钮/单测 beforeEach）
useAppStore.setState(initialState, true);
```

replace 模式会丢弃 action 定义吗？不会——action 本来就在 state 对象里，替换时记得把 action 一并带上，或改用函数式 partial 只覆盖数据字段。

## 四、subscribe 做 transient 更新

高频变化（如鼠标坐标、拖拽）若每帧走 React 渲染会卡。用 subscribe 在 React 之外消费这些值（直接写 DOM/canvas），渲染层根本不订阅它，性能极高。

```ts
usePointerStore.subscribe((s) => {
  el.style.transform = `translate(${s.x}px,${s.y}px)`;
});
```

对比 MobX reaction：思路一致——把「副作用」从渲染管线剥离。

## 五、选择器式 subscribe（v4.3+）

需要先装 subscribeWithSelector 中间件：

```ts
import { subscribeWithSelector } from 'zustand/middleware';
const useStore = create(subscribeWithSelector((set) => ({ ... })));
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
