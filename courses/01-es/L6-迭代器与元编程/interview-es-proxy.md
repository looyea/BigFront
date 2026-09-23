# 面试题 · Proxy 与 Reflect

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）Proxy 有哪 13 个 trap？每个 trap 分别在什么操作下被触发？**
- 参考要点：**目标对象操作类**：get / set / has / deleteProperty / ownKeys / getOwnPropertyDescriptor / defineProperty；**原型链**：getPrototypeOf / setPrototypeOf；**扩展性**：isExtensible / preventExtensions；**函数**：apply（proxy 被调用）/ construct（new proxy）。每个都有对应的 Reflect 方法。
- 来源：MDN《Proxy Reference》；ECMA-262 规范 §10.5。

---

**2）Reflect 与 Object 静态方法有什么区别？为什么 trap 里必须用 Reflect？**
- 参考要点：Reflect 与 trap **一一对应**、返回布尔或值（Object.defineProperty 成功返回 target，Reflect 返回 boolean）；Reflect 的 get/set 接受 `receiver` 参数——**透传**保证 getter 里的 `this` 是 receiver；Reflect 全是**函数**（可 apply、可 bind）。**必须用**：invariant 检查 + receiver 传递，两者缺一会让 Vue 3 reactive 依赖追踪断链。
- 来源：MDN `Reflect`；Vue 3 源码；StackOverflow 高票。

---

**3）什么是 Proxy 的 invariant（不变量约束）？给一个违反就抛 TypeError 的例子。**
- 参考要点：trap 的返回值必须与 target 的**实际形状**兼容。典型违反：target 上非可配置属性 `x`，get 返回别的值 → 抛 TypeError；has 对非可配置属性返回 false → 抛；ownKeys 不返回 target 全部键 → 抛；setPrototypeOf 对非可扩展对象返回不同原型 → 抛。**设计动机**：保证 `Object.isFrozen(p) === Object.isFrozen(target)` 等假设。
- 来源：ECMA-262 规范 §10.5；MDN。

---

**4）Proxy 与 Object.defineProperty 相比有什么优势？为什么说 Proxy 是「换代」？**
- 参考要点：① **整对象拦截** vs 逐属性劫持；② 感知**新增 key**（defineProperty 不能）；③ 感知**删除**；④ 数组**索引与 length** 天然支持；⑤ 拦截**原型链变化 / 函数调用 / new**；⑥ **懒代理**（用到才递归）——性能更好。代价：① 无法 polyfill；② 每次访问多一次函数调用，性能略降。
- 来源：Vue 3 官方《Reactivity System》；MDN；StackOverflow《Proxy vs defineProperty》。

---

**5）为什么 Vue 3 不再支持 IE 11？**
- 参考要点：Vue 3 用 Proxy 做响应式——**Proxy 无法被 polyfill**（需要引擎层拦截属性访问）。IE 11 没有 Proxy 也没有可 polyfill 的空间；Vue 核心团队权衡后选择放弃，而非在 IE 上退回 defineProperty 造成**双份代码 + 行为差异**。社区有 @vue/preload-webpack-plugin + proxy polyfill 强推的，但不推荐。
- 来源：Vue 3 官方 FAQ；尤雨溪知乎回答。

---

****
**6）以下代码打印什么？**
```js
const target = { x: 1, get y() { return this.x + 1 } };
const proxy = new Proxy(target, {
  get(t, k, r) { return Reflect.get(t, k, r); },
});
console.log(proxy.y);
```
- 参考要点：2。getter 里的 `this` 是**receiver**（proxy）；`this.x` 又走一次 get trap 拿 x=1；y 返回 2。**追问**：如果 trap 写成 `return t[k]` 会得 2 但**不会**再走 trap 拿 x——依赖追踪会丢。
- 来源：MDN Reflect；Vue 3 源码讨论。

---

**7）Proxy 的性能到底如何？什么场景要避免？**
- 参考要点：每次 trap 都是**函数调用**，V8 无法给 proxy 做 inline cache——读写 proxy 比读写普通对象慢 2-10 倍。**避免**：热循环里遍历大量 proxy 对象；大列表**逐项 reactive**。**做法**：`markRaw` / `shallowReactive` / `computed` 缓存派生值。
- 来源：v8.dev；Vue 3 官方性能指南。

---

**8）`Proxy.revocable` 干什么用？给一个真实场景。**
- 参考要点：返回 `{ proxy, revoke }`——调用 revoke 后 proxy 一切操作抛 TypeError。场景：① **插件沙箱**：主程序把 API 交给插件，卸载时 revoke 立即切断；② **临时凭证**：给外部一个 proxy，一 revoke 后所有旧引用失效；③ **测试隔离**：afterEach 自动 revoke，防止跨用例引用泄漏。
- 来源：MDN `Proxy.revocable`；Node.js 相关文档。

---

**9）如何用 Proxy 实现「运行时 schema 校验」？**
- 参考要点：
  ```js
  const schema = { age: v => Number.isInteger(v) && v >= 0, name: v => typeof v === 'string' };
  const validated = (obj) => new Proxy(obj, {
    set(t, k, v) {
      if (schema[k] && !schema[k](v)) throw new TypeError(`非法 ${String(k)}=${v}`);
      return Reflect.set(t, k, v);
    },
  });
  ```
  **追问**：性能？set 里加了函数判断，热路径慢；生产可以关掉。
- 来源：多份社区文章；zod / typebox 文档。

---

**10）Proxy 的 `ownKeys` trap 返回顺序有什么讲究？**
- 参考要点：invariant 要求**必须包含 target 全部自有键**（缺一个就 TypeError）；**允许加**新键；顺序就是 trap 返回的顺序（不再受整数键自动排序影响）。**用途**：模拟「虚拟属性」——明明 target 上没这个键但想让 Object.keys 返回它。
- 来源：ECMA-262 规范；MDN ownKeys。

---

**11）Proxy 的 apply / construct 与 Function.prototype.bind / class mixin 相比各适合什么？**
- 参考要点：bind 是**部分应用 + this 固定**、返回普通函数、不能拦截其他属性；apply trap 是**调用时拦截**——可以做参数校验、缓存、限流、监控；construct 是**new 时拦截**——单例、对象池、类 mixin 都能改写。MobX 用 construct 包装 class 让每次 new 都自动 reactive。
- 来源：MDN；MobX 源码。

---

**12）现场手写：`deepReadonly(obj)`——嵌套全部只读，任何深度的 set / deleteProperty 都抛错。**
- 参考要点：
  ```js
  function deepReadonly(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    return new Proxy(obj, {
      get(t, k, r) {
        const v = Reflect.get(t, k, r);
        return typeof v === 'object' && v !== null ? deepReadonly(v) : v;
      },
      set: () => { throw new TypeError('readonly'); },
      deleteProperty: () => { throw new TypeError('readonly'); },
    });
  }
  ```
  **追问 1**：每次 get 都新建 proxy，性能爆炸——用 WeakMap 缓存 `raw → proxy` 单例。
  **追问 2**：如何暴露原对象？→ 定 Symbol `RAW`，get 里特判返回 target。
- 来源：Vue 3 源码 `reactivity/src/baseHandlers.ts` 反向；多份中文八股。

---

**13）set trap 返回 `false` 会发生什么？为什么 trap 里要 `return Reflect.set(...)` 原样透传？**
- 参考要点：set trap 返回 false 即声明「写入失败」——**严格模式下赋值表达式抛 TypeError**，非严格模式静默忽略。`Reflect.set` 的返回值就是引擎视角的成失标志（invariant 也要靠它判定），自己 `target[k] = v` 拿不到这个 boolean，还可能触发二次 trap/丢 setter 语义。因此「Reflect 做、原样 return」是 trap 的标准姿势（deleteProperty/defineProperty 同理）。
- 来源：MDN《Proxy: set handler》；ECMA-262 [[Set]]/[[DefineOwnProperty]] 内部方法。

---

**14）`Proxy.revocable` 解决什么问题？revoke 之后 target 还能访问吗？**
- 参考要点：返回 `{ proxy, revoke }`；`revoke()` 后对 proxy 的一切操作（get/set/apply…）都抛 TypeError。但 **target 本身不受限**——拿着原引用的代码照常读写，所以它是「断别人访问路」而不是「锁数据」；附带收益：revoke 后 proxy 内部槽清空，target 若无其它引用可被 GC。场景：把对象交给不可信插件/回调后随时收权，临时凭证、一次性 API。
- 来源：MDN《Proxy.revocable》；TC39 proxy 提案（软权限/能力安全动机）。

---

**15）Proxy 的代价：为什么 V8 对 proxy 对象的优化失效？工程上怎么缓解？打包器会 tree-shake 掉 `new Proxy` 吗？**
- 参考要点：① 每次属性读写都要多调一次 trap 函数，且引擎无法确定返回值形状——**inline cache / hidden class 假设失效**，热循环实测慢 2-10 倍；② 缓解：Vue 3 提供 `shallowReactive`/`markRaw` 减代理层数，大列表用索引型访问+计算属性而非逐项深层 reactive；③ `new Proxy(target, handler)` 是**运行时副作用表达式**，Rollup/Webpack 不会摇掉（与 Map/Set 同规则）；④ 调试时栈里会多 `Proxy.get`/`Reflect.get` 帧，DevTools 可过滤。
- 来源：v8.dev《slides for V8 team talk on Proxy performance》；Vue 3 文档《Reactivity - Performance Tips》；Rollup《Tree-shaking caveats》。
