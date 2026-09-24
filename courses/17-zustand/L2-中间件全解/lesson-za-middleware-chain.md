# 中间件链：compose 顺序与自定义

## 一、中间件的统一签名

Zustand 中间件是一个「store 增强器」：

```ts
const middleware = (fn) => (set, get, store) => {
  // 可包装 set/get，返回初始化函数
  return fn((...args) => { /* 拦截 set */ }, get, store);
};
```

用 `compose`（或直接嵌套）串起来。内置：devtools、persist、immer、subscribeWithSelector。
签名与 `create` 的 initializer 完全一致（set/get/store 三参），所以中间件之间、中间件与业务 fn 之间可以任意嵌套——这就是「洋葱模型」的实现基础。

## 二、为什么顺序重要

```ts
create(
  devtools(
    persist(
      immer((set) => ({ /* ... */ })),
      { name: 'app' }
    )
  )
);
```

- **immer 必须最贴近基础 fn**：它改写 set 让「可变写法」产出不可变结果，被外层看到时就已是新对象。
- **persist 包在 immer 外**：持久化时拿到的是最终不可变快照，做序列化。
- **devtools 放最外**：记录所有经过完整链路的 set，时间旅行才能还原。

换序后果：若 devtools 在 persist 内，则水合动作不会上报；若 persist 在 immer 内，可能存到 Proxy 对象。

## 三、手写一个 logger 中间件

```ts
const logger = (fn) => (set, get, store) =>
  fn((...args) => {
    console.log('prev', get());
    set(...args);
    console.log('next', get());
  }, get, store);
```

生产环境把 console 换成带 action 名的批量上报（第三参传 action 字符串），就得到免费的「用户操作流水」。

## 四、undo/redo 中间件思路

在 set 包装里把每次快照 push 进历史栈，暴露 `undo()`/`redo()` 时 setState(replace=true) 回到栈顶——这就是把「命令式 set」折叠成「可回溯状态机」。

```ts
const undoable = (limit) => (fn) => (set, get, store) => {
  const history = [];
  return fn((partial, replace, action) => {
    history.push(structuredClone(get()));
    if (history.length > limit) history.shift();
    set(partial, replace, action);
  }, get, store);
};
```

注意点：快照粒度（每次 set 还是每个宏任务）、异步 action 中间态是否入栈、函数属性不能被 structuredClone（先剥离 action 只存数据）。

## 五、类型标注的坑

带中间件的 create 必须用 curried 形式 `create<T>()(chain)`——那对空括号是给显式泛型留的位置，直接 `create<T>(chain)` 会报「期望 0 个类型参数」。中间件嵌套深时 TS 推断容易退化成 unknown，此时在每个中间件上写 `StateCreator<T, [], [], Part>` 泛型（呼应 za-slices）最稳。

## 六、compose 与可插拔链

团队常把「哪些中间件、什么顺序」固化成一个 compose 好的工厂：

```ts
import { compose } from 'zustand/utils';
export const appStore = (init) =>
  create(compose(devtools(), persist({ name: 'app' }), immer())(init));
```

规则：写工厂的人管顺序，业务同学只管写 state 与 action——顺序错误从此不可能发生（呼应 za-capstone）。

## 小结
中间件 = 拦截 set/get 的函数式增强；顺序遵循「越接近数据真相越靠内，越接近可观测性越靠外」；curried 泛型与工厂固化是工程落地的两只安全阀。

## 部署预告
本地写一个 20 行的 logger 中间件挂到 counter store，观察每次 action 的前后快照；undo/redo 用「文本编辑器草稿」场景验证最直观。
