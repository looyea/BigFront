# 响应式原理：Proxy、effect 与依赖收集

> 目标：把前两关的 ref/reactive/computed/watch 收拢到**同一套机制**下讲透——为什么 Vue 3 抛弃 `Object.defineProperty` 改用 **Proxy**；`effect` 如何"记住"要跑哪个函数；`depsMap`（`WeakMap → Map → Set`）怎样完成**依赖收集**与**触发更新**；`computed` 的惰性缓存、更新队列与 `nextTick` 批量刷新；以及 `shallowRef`/`shallowReactive`/`toRef`/`toRefs`/`markRaw`/`customRef` 这些"逃生舱"。（呼应 vue-reactivity 全课、vue-watch 第三~五节、ES 包的 Proxy / Reflect / WeakMap / getter）

---

## 一、为什么是 Proxy，而不是 defineProperty

Vue 2 用 `Object.defineProperty` 逐个属性劫持 getter/setter，天生有几个填不平的坑：

- **无法侦测新增/删除属性**（所以有 `Vue.set`/`$set`）；
- **无法侦测数组索引赋值与 `length` 变化**（所以要重写 7 个数组方法）；
- 初始化要**递归遍历**整个对象，一次性把所有属性都转成 getter/setter，大对象开销大。

`Proxy` 是**对整个对象的代理**，拦截的是"读/写/删除/枚举"等**操作**本身：

```js
const target = { count: 0, user: { name: 'a' } };
const seen = new Set();
const proxy = new Proxy(target, {
  get(t, key, r) {
    recordRead(t, key);            // ← 依赖收集发生在这里
    const v = Reflect.get(t, key, r);
    return (v && typeof v === 'object') ? reactive(v) : v; // 深层懒代理
  },
  set(t, key, value, r) {
    const ok = Reflect.set(t, key, value, r);
    trigger(t, key);               // ← 触发更新发生在这里
    return ok;
  },
  deleteProperty(t, key) { const ok = Reflect.deleteProperty(t, key); trigger(t, key); return ok; }
});
```

三个关键改进：① **新增/删除属性都能感知**；② **数组的索引与 length 也能感知**；③ **懒代理**——只有真正 `get` 到某个嵌套对象时才递归地给它建代理，初始化成本从 O(全部) 降到 O(用到的)（呼应 ES 包 Proxy/Reflect 关）。`Reflect.get/set` 保证 `receiver` 正确、行为符合规范。

---

## 二、effect：把"要重复跑的副作用"包起来

响应式的最终目的，是"数据变了，把用到它的地方重新执行一遍"。Vue 内部用一个 `ReactiveEffect` 记录这个"要重跑的函数"：

```js
let activeEffect;                       // 当前正在执行的 effect
const effectStack = [];
function effect(fn) {
  const e = (...args) => {
    activeEffect = e; effectStack.push(e);
    try { return fn(...args); }         // 运行 fn 的过程会读响应式属性 → 触发 get
    finally { effectStack.pop(); activeEffect = effectStack[effectStack.length - 1]; }
  };
  e.deps = new Set();                   // 这个 effect 依赖了哪些"桶"
  return e;
}
```

用栈是为了支持 **effect 嵌套**（computed 内部也是 effect），避免内层 effect 执行完把外层的 `activeEffect` 冲掉。`watch`/`watchEffect`/`computed`/组件渲染，本质都是往这套 `effect` 上套不同配置——这解释了 vue-watch 第五节"`watchEffect` 为什么用到谁就侦听谁"。

---

## 三、依赖收集：WeakMap → Map → Set

依赖关系存成三层结构：

```
targetMap:  WeakMap< 原始对象, 
             depsMap: Map< 属性key, 
             dep: Set< effect > > >
```

- **get** 时 `track(target, key)`：把 `activeEffect` 塞进 `(target,key)` 对应的 `Set`（一个"桶"）；同时把桶记到 `activeEffect.deps`，方便下次清理；
- **set** 时 `trigger(target, key)`：取出对应桶，遍历里面的每个 effect，**调度**它们重新执行。

```js
function track(target, key) {
  if (!activeEffect) return;
  let dm = targetMap.get(target); if (!dm) targetMap.set(target, (dm = new Map()));
  let dep = dm.get(key); if (!dep) dm.set(key, (dep = new Set()));
  dep.add(activeEffect); activeEffect.deps.add(dep);
}
```

用 **WeakMap** 作外层：key 是原始对象， WeakMap 不阻止 GC——对象没人引用时，其依赖记录自动回收（呼应 ES 包 WeakMap 关）。重新执行 effect 前会先 `cleanup` 掉旧的 dep 关系，这样**分支切换**（`flag ? a.x : b.x`）不会残留失效依赖。

---

## 四、computed：惰性 + 缓存，本质是带 dirty 标记的 effect

`computed` 内部也把一个 getter 包成 effect，但**不立即执行**，而是靠 `.value` 访问时才求值：

```js
function computed(getter) {
  let value, dirty = true;
  const runner = effect(getter, { lazy: true,
    scheduler: () => { dirty = true; triggerRef(computedRef); } }); // 依赖变→只标脏，不立即算
  const computedRef = { get value() { if (dirty) { value = runner(); dirty = false; } track(); return value; } };
  return computedRef;
}
```

- **依赖变化**时不重算，只把 `dirty` 置真并通知下游——这就是 vue-reactivity 第四节说的"缓存"；
- **只有 `.value` 被读且脏了才真正执行** getter；
- 多次读、依赖没变 → 直接返回缓存值。这正是"派生值优先用 computed 而非 watch 手动同步"的底层理由（呼应 vue-watch interview 第 2 题）。

---

## 五、更新调度：微任务队列 + nextTick 批量

`trigger` 不直接同步跑 effect，而是把要更新的组件 effect **推入一个去重队列**，再用**微任务**（`Promise.then`）一次性 flush——所以同一 tick 内连续改 100 次，只重渲染 1 次。`await nextTick()` 返回的就是"本次 flush 完成后"的微任务，能读到更新后的 DOM（呼应 vue-watch 第三节 `flush`、node-event-loop 的微任务模型）。

- `flush:'pre'`：DOM 更新前跑（默认，性能最好）；
- `flush:'post'`：排到 flush 之后跑，能读渲染后 DOM；
- `flush:'sync'`：跳过队列、依赖变即同步跑，几乎别用。

---

## 六、逃生舱：shallow / toRef / markRaw / customRef

| API | 作用 | 场景 |
|---|---|---|
| `shallowRef` | 只有 `.value` 整体替换才触发；内部深层变化不侦听 | 大对象/图表实例/第三方数据，用 `triggerRef()` 手动触发 |
| `shallowReactive` | 只代理顶层属性 | 同上，省递归代理开销 |
| `toRef(obj,'k')` | 为 reactive 某属性建 ref，**共享读写** | 传单个 prop 给 composable（呼应 vue-reactivity 解构丢响应） |
| `toRefs(obj)` | 把每个属性转成 ref，解构**保留响应** | 组合式函数返回多个状态 |
| `markRaw(obj)` | 永久标记不转代理 | 存组件定义、不可变实例 |
| `customRef` | 自己实现 track/trigger | 防抖 ref、写时 trim 等定制行为 |

`customRef` 示例（防抖，把 vue-watch 的 onCleanup 思想内化进 ref）：

```js
function useDebounceRef(value, delay = 300) {
  let timer, _v = value;
  return customRef((track, trigger) => ({
    get() { track(); return _v; },
    set(nv) { clearTimeout(timer); timer = setTimeout(() => { _v = nv; trigger(); }, delay); }
  }));
}
```

---

## 七、自检清单

- [ ] Vue 3 用 Proxy 相比 defineProperty 解决了哪些侦测盲区？"懒代理"省了什么？
- [ ] `activeEffect` 为什么需要一个栈？
- [ ] `targetMap` 的三层结构分别是什么？为什么外层用 WeakMap？
- [ ] computed 的 `dirty` 标记如何实现"惰性 + 缓存"？
- [ ] 为什么同一 tick 改多次只渲染一次？`nextTick` 和微任务什么关系？
- [ ] 大列表/图表实例为什么该用 `shallowRef`？如何手动触发？
- [ ] `toRef`/`toRefs` 解决的是 vue-reactivity 里的哪个坑？

---

## 🚀 部署预告

- 到这里，"响应式三件套"（vue-reactivity、vue-watch、本课）已从**用法**贯通到**原理**；后续所有高级特性都建立在这套 effect/依赖收集之上；
- 组件之所以"数据变就重渲染"，是因为**渲染函数本身就是一个 effect**——进入 **L2 模板与渲染**，我们看模板如何被编译成 render 函数；
- `shallowRef` + `triggerRef`、`v-memo`、虚拟滚动是 **vue-performance（L7）** 的基石；`toRefs` 是 **vue-composables（L4）** 返回值的标准姿势；`customRef`/`scheduler` 解释了 **vue-pinia（L6）** 的响应保持。

下一关进入 **vue-template-syntax**：模板不是 HTML——它会被编译成 render 函数，理解插值、指令、修饰符与 `v-html` 的 XSS 边界。
