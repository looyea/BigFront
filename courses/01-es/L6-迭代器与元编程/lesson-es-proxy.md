# Proxy 与 Reflect：拦截一切对象操作

> 目标：**掌握 Proxy 的 13 个 trap 与 Reflect 的对应方法**；理解「invariant 约束」为什么存在；能读懂 Vue 3 reactive、`immutable` 库、`zod` 校验、Mock 框架的实现思路；知道 Proxy 相比 `Object.defineProperty` 的三大胜利。

---

## 一、Proxy 是什么

**Proxy = 给对象套一层「拦截器」**——所有对目标对象的读、写、枚举、函数调用等操作都可以被**拦截并改写**。

```js
const target = { name: 'Ann', age: 20 };
const proxy = new Proxy(target, {
  get(obj, key, receiver) {
    console.log('读', key);
    return Reflect.get(obj, key, receiver);
  },
  set(obj, key, value, receiver) {
    console.log('写', key, value);
    return Reflect.set(obj, key, value, receiver);
  },
});
proxy.name;         // 打印 "读 name"，返回 'Ann'
proxy.age = 21;      // 打印 "写 age 21"
```

**关键点**：`receiver` 参数是「最初被访问的那个对象」——即 `proxy` 本身；Reflect.xxx 传 receiver 保证 getter 里的 `this` 是 proxy 而不是 target（**这是 Vue 3 追踪依赖不丢失的关键**）。

---

## 二、13 个 trap 全景

| trap | 触发时机 | 对应 Reflect 方法 |
| --- | --- | --- |
| `get(t, k, r)` | `obj.k`、解构、`Reflect.get` | `Reflect.get` |
| `set(t, k, v, r)` | `obj.k = v` | `Reflect.set` |
| `has(t, k)` | `k in obj`、`instanceof` 走原型时 | `Reflect.has` |
| `deleteProperty(t, k)` | `delete obj.k` | `Reflect.deleteProperty` |
| `ownKeys(t)` | `Object.keys`、`for-in`、`Object.getOwnPropertyNames/Symbols`、`JSON.stringify` | `Reflect.ownKeys` |
| `getOwnPropertyDescriptor(t, k)` | `Object.getOwnPropertyDescriptor` | `Reflect.getOwnPropertyDescriptor` |
| `defineProperty(t, k, d)` | `Object.defineProperty` | `Reflect.defineProperty` |
| `getPrototypeOf(t)` | `Object.getPrototypeOf`、`instanceof` | `Reflect.getPrototypeOf` |
| `setPrototypeOf(t, p)` | `Object.setPrototypeOf` | `Reflect.setPrototypeOf` |
| `isExtensible(t)` | `Object.isExtensible` | `Reflect.isExtensible` |
| `preventExtensions(t)` | `Object.preventExtensions` | `Reflect.preventExtensions` |
| `apply(t, thisArg, args)` | **函数被调用**（`proxy(...)`） | `Reflect.apply` |
| `construct(t, args, newTarget)` | `new proxy(...)` | `Reflect.construct` |

**⚠️ Proxy 只对**对象**（含函数、数组、Map 等）生效**——不能包装 primitive。

---

## 三、Reflect：**必须用**吗？为什么不用 `target[key]`？

Reflect 方法与 trap **一一对应**，是「把 Object 上散落的静态方法重新整理成对称 API」。工程上**必须用** Reflect 有 3 个理由：

1. **返回值规范**：Reflect 的 set / deleteProperty / defineProperty 都返回 boolean（是否成功），trap 需要**原样返回**给引擎；直接 `target[k] = v` 拿不到成功标志。
2. **`receiver` 透传**：Reflect 的 get/set 第三/第四参数是 receiver——保证 getter 里的 `this` 是**通过 proxy 访问**的那个对象，Vue 3 才能追踪到正确的依赖。
3. **可调用**：Reflect 上的方法是**函数**（`Reflect.apply`、`Reflect.construct`），可以拿来当函数转发；老写法 `Function.prototype.apply.call(fn, ctx, args)` 繁琐。

---

## 四、Invariants（不变量约束）：Proxy 不能撒谎

规范里**target 是什么形状，trap 就必须返回什么形状**——否则抛 TypeError：

```js
const p = new Proxy({}, {
  get: () => 1,
});
p.x;   // 1（没问题，target.x 是 undefined，configurable true 时随便返回）

// ❌ 违规
const frozen = Object.freeze({ x: 1 });
new Proxy(frozen, { get: () => 2 }).x;   // 2（非严格模式静默失败）/ 严格模式 TypeError

// ownKeys 必须**覆盖 target 全部自有键**
new Proxy({ a: 1 }, { ownKeys: () => [] }).a;   // TypeError: proxy 必须返回全部键

// non-configurable 属性**不能消失**
```

**为什么这么设计**：如果不约束，`Object.isFrozen(p)` 与 `Object.isFrozen(target)` 结论可能不一致——引擎的**形状假设**崩塌。

---

## 五、Proxy 三大真实战场

### 战场 1：**Vue 3 reactive**——替代 Vue 2 defineProperty

Vue 2 用 `Object.defineProperty` 逐字段劫持；三大痛点：① 无法感知新增 key（要 `Vue.set`）；② 无法感知数组 index 与 length 变化；③ 深对象要递归 defineProperty，性能爆炸。

**Vue 3 用 Proxy**：
```js
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);                              // 依赖收集
      const r = Reflect.get(target, key, receiver);
      return typeof r === 'object' ? reactive(r) : r;  // 懒代理：用到才递归
    },
    set(target, key, value, receiver) {
      const old = target[key];
      const r = Reflect.set(target, key, value, receiver);
      if (old !== value) trigger(target, key);         // 派发更新
      return r;
    },
    deleteProperty(target, key) {
      const r = Reflect.deleteProperty(target, key);
      trigger(target, key);
      return r;
    },
  });
}
```

**关键点**：**懒代理**——get 时才给嵌套对象套 proxy，避免一次性递归遍历。

### 战场 2：**immutable 数据**、**默认值**、**私有字段**

```js
const withDefaults = (target, defaults) => new Proxy(target, {
  get: (t, k) => k in t ? Reflect.get(t, k) : defaults[k],
});

const readonly = (target) => new Proxy(target, {
  set: () => { throw new TypeError('readonly'); },
});

const noNewKeys = (target) => new Proxy(target, {
  set: (t, k, v) => {
    if (!(k in t)) throw new TypeError(`未知属性 ${k}`);
    return Reflect.set(t, k, v);
  },
});
```

TypeScript 的严格模式在运行时没有校验，配一层 Proxy 立刻变「运行时 schema」。

### 战场 3：**Mock / 记录 / 断言**

```js
const spy = (obj) => {
  const calls = [];
  return {
    calls,
    proxy: new Proxy(obj, {
      get(t, k) {
        const v = Reflect.get(t, k);
        if (typeof v === 'function') {
          return (...args) => { calls.push({ k, args }); return v.apply(t, args); };
        }
        return v;
      },
    }),
  };
};

const s = spy(console);
s.proxy.log('hi');
console.log(s.calls);   // [{ k: 'log', args: ['hi'] }]
```

Sinon.js / jest.spyOn 底层思路；localStorage 拦截、API mock 都类似。

---

## 六、Proxy 的 apply / construct 与函数包装

```js
const callable = new Proxy(function () {}, {
  apply(target, thisArg, args) { return args.reduce((a, b) => a + b, 0); },
});
callable(1, 2, 3);   // 6

const Counted = new Proxy(Map, {
  construct(target, args, newTarget) {
    Counted.count++;
    return Reflect.construct(target, args, newTarget);
  },
});
Counted.count = 0;
new Counted();  new Counted();
Counted.count;   // 2
```

**用途**：装饰器模式、Mixin、class 元编程。JiSynth / MobX 里都见过。

---

## 七、Proxy 的性能与限制

- **性能**：Proxy 的每一次 trap 都是一次**函数调用**——V8 无法给 proxy 对象做 inline cache 优化。热循环里读写 proxy 通常比读写普通对象慢 2-10 倍。Vue 3 的响应式在**大列表**里靠**浅响应 + 计算属性**规避，不逐字段 reactive。
- **无法 revoke 已有引用**：`Proxy.revocable` 能造一个「可撤销」的 proxy，一 revoke 后续所有操作都抛错——但 target 依然能被原始引用访问。适合临时凭证、插件沙箱。
- **不能包 primitive**：Proxy 的 target 必须是 object。想拦截字符串/数字，只能包成 `new String(...)` 之类，通常得不偿失。
- **调试**：DevTools 里 Proxy 对象展开会显示 target 内容——但 **trap 逻辑不显示**，排查全靠加 log。

---

## 八、Proxy vs `Object.defineProperty`：一场「换代」

| 维度 | defineProperty | Proxy |
| --- | --- | --- |
| 粒度 | **逐属性** | **整个对象** |
| 新增 key 感知 | ❌ 不能 | ✅ 能（set trap） |
| 删除感知 | ❌ 不能 | ✅ 能（deleteProperty） |
| 数组索引/length | 需要重定义 | 天然支持 |
| 原型链变化 | 无 | ✅ 有 getPrototypeOf/setPrototypeOf trap |
| 性能 | 稍快（无 trap 层） | 稍慢（每次函数调用） |
| IE 支持 | ✅（ES5） | ❌（polyfill 不了） |

**最后一行是关键**：Proxy 无法被 polyfill——因为它需要引擎层拦截。Vue 3 因此**放弃 IE 11**。

---

## 九、Proxy 撤销（revocable）

```js
const { proxy, revoke } = Proxy.revocable({}, {});
proxy.x = 1;
proxy.x;      // 1
revoke();
proxy.x;      // TypeError: Cannot perform 'get' on a proxy that has been revoked
```

**用途**：**权限令牌**——把 proxy 交给第三方，随时能收回；**插件卸载**——一 revoke 插件对宿主的一切访问立即失效。

---

## 十、自检清单

- [ ] 说出 13 个 trap 名字与对应 Reflect 方法。
- [ ] 为什么 trap 里要用 Reflect 而不是 `target[key]`？
- [ ] 什么是 invariant？给出一个违反就抛 TypeError 的例子。
- [ ] Vue 3 为什么用 Proxy 而不是 defineProperty？
- [ ] Proxy 为什么无法 polyfill？
- [ ] 手写 `readonly(obj)`：任何 set / deleteProperty 都抛错。
- [ ] 手写 `spyConsole()`：记录每次 log 调用参数。

---

## 🚀 部署预告（本关点到，细节在 L10）

**Proxy 在构建/运行时会被怎样处理？**

1. **无法降级**：Proxy 是引擎级拦截，Babel 转不了。target 里含 IE 就**必须放弃 Proxy**——Vue 3 因此从 3.0 起就官方不支持 IE 11；这就是很多老项目还留在 Vue 2 的**唯一硬约束**。
2. **现代 target 才用得起**：Chrome 49+ / Firefox 4+ / Safari 10+ / Edge 12+ / Node 6+。企业内网老浏览器要评估。
3. **性能**：Proxy 会**破坏** V8 hidden class 优化——每次 trap 都是一次函数调用；`markRaw` / `shallowReactive` 就是为了减少 Proxy 层数。热路径大列表用**索引型 API + 计算属性**代替逐项 reactive。
4. **Tree-shaking**：`new Proxy(target, handler)` 被视为**有副作用**——打包器不会摇掉。这是**运行时对象**的通用规则（与 Map/Set 一样）。
5. **sourcemap 与栈**：trap 里抛错时，栈里会看到 `Proxy.get` / `Reflect.get` 帧——排查 Vue 3 reactive 报错时，DevTools 里**过滤**这类帧更容易看到业务代码。

细节 L10 `es-build` 展开。**你现在只需要记住**：**Proxy 是「IE 杀手」——用了它就告别老浏览器；换来的是响应式与元编程的完整能力。**
