# 中间件链：compose 顺序与自定义

## 一、中间件的统一签名

Zustand 中间件是一个「store 增强器」：

```ts
// 目的：中间件的统一签名—接基础 fn，返回一个包装过 set 的新 initializer
const middleware = (fn) => (set, get, store) => {
  // 可包装 set/get，返回初始化函数
  return fn((...args) => { /* 拦截 set，前后加料再转发 */ }, get, store);
};
// ✅ 签名与 create 的 initializer 一致（set/get/store 三参），故可任意嵌套成洋葱链
// ❌ 忘记把包装后的 set 传给 fn、只原样转发 fn(set,get,store)→中间件形同虚设，拦截逻辑不生效
```

用 `compose`（或直接嵌套）串起来。内置：devtools、persist、immer、subscribeWithSelector。
签名与 `create` 的 initializer 完全一致（set/get/store 三参），所以中间件之间、中间件与业务 fn 之间可以任意嵌套——这就是「洋葱模型」的实现基础。

## 二、为什么顺序重要

```ts
// 目的：中间件嵌套顺序—immer 最内、persist 居中、devtools 最外
create(
  devtools(                                  // 最外：记录经过完整链路的每次 set
    persist(                                 // 居中：拿到最终不可变快照再序列化
      immer((set) => ({ /* ... */ })),        // 最内：把可变写法产成不可变新对象
      { name: 'app' }
    )
  )
);
// ✅ 越接数据真相越靠内(immer)、越接可观测性越靠外(devtools)
// ❌ persist 包在 immer 内→存下去的可能是 Proxy 对象，序列化出错
// ❌ devtools 在 persist 内→水合动作不经 devtools，时间旅行还原不了初始态
```

- **immer 必须最贴近基础 fn**：它改写 set 让「可变写法」产出不可变结果，被外层看到时就已是新对象。
- **persist 包在 immer 外**：持久化时拿到的是最终不可变快照，做序列化。
- **devtools 放最外**：记录所有经过完整链路的 set，时间旅行才能还原。

换序后果：若 devtools 在 persist 内，则水合动作不会上报；若 persist 在 immer 内，可能存到 Proxy 对象。

## 三、手写一个 logger 中间件

```ts
// 目的：手写 logger 中间件—包住 set，在每次写入前后打印旧/新快照
const logger = (fn) => (set, get, store) =>
  fn((...args) => {
    console.log('prev', get());   // 写入前快照
    set(...args);                 // 转发给真正的 set
    console.log('next', get());   // 写入后快照
  }, get, store);
// ✅ 把它接在链里即得免费的“前后状态流水”，生产可换为带 action 名的批量上报
// ❌ 包装时漏传 store 参给 fn→内层依赖 store.api 的中间件（如 persist）拿不到 store.api 报错
```

生产环境把 console 换成带 action 名的批量上报（第三参传 action 字符串），就得到免费的「用户操作流水」。

## 四、undo/redo 中间件思路

在 set 包装里把每次快照 push 进历史栈，暴露 `undo()`/`redo()` 时 setState(replace=true) 回到栈顶——这就是把「命令式 set」折叠成「可回溯状态机」。

```ts
// 目的：undo/redo 中间件思路—每次 set 前入历史栈，限制历史栈深度上限
const undoable = (limit) => (fn) => (set, get, store) => {
  const history = [];
  return fn((partial, replace, action) => {
    history.push(structuredClone(get()));          // 写入前存一份深拷贝快照
    if (history.length > limit) history.shift();   // 超上限丢最早的，防内存无限增长
    set(partial, replace, action);
  }, get, store);
};
// ✅ undo 时用 setState(栈顶快照, replace=true) 回放，把命令式 set 折叠成可回溯状态机
// ❌ 用 structuredClone 直接快照含函数的 state→函数不可克隆报错，需先剥离 action 只存数据
```

注意点：快照粒度（每次 set 还是每个宏任务）、异步 action 中间态是否入栈、函数属性不能被 structuredClone（先剥离 action 只存数据）。

## 五、类型标注的坑

带中间件的 create 必须用 curried 形式 `create<T>()(chain)`——那对空括号是给显式泛型留的位置，直接 `create<T>(chain)` 会报「期望 0 个类型参数」。中间件嵌套深时 TS 推断容易退化成 unknown，此时在每个中间件上写 `StateCreator<T, [], [], Part>` 泛型（呼应 za-slices）最稳。

## 六、compose 与可插拔链

团队常把「哪些中间件、什么顺序」固化成一个 compose 好的工厂：

```ts
// 目的：用 compose 固化中间件顺序—写工厂的人管顺序，业务同学只管写 state/action
import { compose } from 'zustand/utils';
export const appStore = (init) =>
  create(compose(devtools(), persist({ name: 'app' }), immer())(init));   // compose 从右到左包裹，顺序固定
// ✅ 顺序写进工厂集中管理，业务层不会写错包裹层次
// ❌ compose 参数顺序写反(如 immer 放到最外)→内层拿到的 set 不是 immer 版，可变写法失效
```

规则：写工厂的人管顺序，业务同学只管写 state 与 action——顺序错误从此不可能发生（呼应 za-capstone）。

## 小结
中间件 = 拦截 set/get 的函数式增强；顺序遵循「越接近数据真相越靠内，越接近可观测性越靠外」；curried 泛型与工厂固化是工程落地的两只安全阀。

## 部署预告
本地写一个 20 行的 logger 中间件挂到 counter store，观察每次 action 的前后快照；undo/redo 用「文本编辑器草稿」场景验证最直观。
