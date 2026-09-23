# 面试题 · Map / Set / WeakMap / WeakSet

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）Map 与 Object 相比有哪些优势？说出至少 5 条。**
- 参考要点：① 任意类型作键；② 严格插入顺序；③ `size` O(1)；④ 无原型链干扰（`'toString' in map` 永远 false）；⑤ 内置三种 iterator；⑥ 频繁增删性能更稳定（哈希表，无隐藏类演化）。
- 来源：MDN《Map》；javascript.info《Map and Set》；StackOverflow 高票。

---

**2）Map 的键判等用的是什么算法？和 `===` 的差别？**
- 参考要点：**SameValueZero**——与 `===` 几乎一致，唯一区别是 `NaN` 与 `NaN` 视为相等；不区分 `+0` 与 `-0`（与 `Object.is` 也不同）。Set 也是 SameValueZero。
- 来源：ECMA-262 §7.2.14；MDN；TC39 ES6 讨论。

---

**3）以下代码打印什么？**
```js
const m = new Map();
const a = {}, b = {}, c = a;
m.set(a, 1).set(b, 2).set(c, 3);
console.log(m.size, m.get(a));
```
- 参考要点：`size = 2`，`m.get(a) = 3`。**关键**：Map 按**引用**判等，c === a 所以第三次覆盖第一次。
- 来源：MDN；dmitripavlutin.com。

---

**4）WeakMap 与 Map 的 4 个差异？为什么 WeakMap 没有 `size`？**
- 参考要点：① 键必须是对象（ES2023 起允许 Symbol）；② 键是**弱引用**，其他引用消失时 GC 会回收 kv；③ 不可枚举（无 size / keys / values / forEach / clear）；④ 只能 set/get/has/delete。**没 size 的原因**：任何时刻 kv 都可能被回收，「当前条数」不稳定，暴露 size 会误导。
- 来源：MDN《WeakMap》；javascript.info；V8 源码。

---

**5）举出 WeakMap 在真实框架里的两个用途。**
- 参考要点：① **Vue 3 reactive**：`reactiveMap: WeakMap<raw, proxy>` + `proxyToRaw: WeakMap<proxy, raw>`——raw 消失自动清理，不造成内存泄漏；② **class 私有数据老写法**：ES2022 `#field` 普及前，社区广泛用 `wm.set(this, {...})` 模拟私有字段；③ **DOM 元数据**（jQuery data 底层）；④ **memoize 参数是对象**时的缓存表。
- 来源：Vue 3 源码 `reactivity/src/baseHandlers.ts`；MDN。

---

**6）用 Set 实现 Array 去重，与 `filter + indexOf` 的复杂度对比？**
- 参考要点：`[...new Set(arr)]` — **O(n)**（Set.has 是 O(1)）；`arr.filter((x, i) => arr.indexOf(x) === i)` — **O(n²)**。大数据量差 100 倍以上。**追问**：如何按字段去重？→ `uniqBy` 用 Map：`[...new Map(arr.map(x => [fn(x), x])).values()]`。
- 来源：MDN；lodash.uniqBy 源码；多份中文八股。

---

**7）如何序列化和反序列化一个 Map？**
- 参考要点：`JSON.stringify([...map])` → `new Map(JSON.parse(s))`。**追问**：值里有对象时也能正常序列化；键是对象时不行（反序列化后是普通对象引用，不是原对象）——只能自定义 replacer/reviver 或走 MessagePack。
- 来源：MDN；StackOverflow 高票。

---

**8）Map 与 Set 的遍历时修改语义？**
- 参考要点：都是**活** iterator——遍历时**删除**当前或未来项是安全的；遍历时**新增**的项**不会**被当前迭代看到（V8 与规范均如此：Set 里 iterator 记录「下一次要访问的槽位」，新加项在末尾；Map 同理）。**⚠️ forEach 也是活 iterator**，不像 Array.forEach 会缓存快照。
- 来源：ECMA-262 Map Iterator；MDN。

---

**9）以下代码结果为？**
```js
const s = new Set();
s.add(1).add(2).add(1);
console.log(s.has(1), s.size);
```
- 参考要点：`true`, `2`。add 已存在的值不改变集合，但**返回 Set 自身**——所以可以链式。
- 来源：MDN `Set.prototype.add`。

---

**10）WeakSet 有什么典型用途？给一个防循环引用的例子。**
- 参考要点：检测对象是否已访问。递归遍历图 / 深拷贝 / JSON.stringify 循环引用检测——都可以用 `seen = new WeakSet()`。当对象离开作用域后 seen 里的标记自动被 GC，不需要手动 clear。
- 来源：MDN；lodash.cloneDeep 源码。

---

**11）Map 与 Object 的性能谁更快？分场景说。**
- 参考要点：**大量随机增删** Map 胜（哈希表 O(1)）；**少量固定字段读写** Object 胜（V8 hidden class + inline cache）；**原型链污染攻击面** Map 无。工程经验：JSON 数据用 Object，KV 索引 / 缓存 / 计数器用 Map。
- 来源：v8.dev 相关博客；StackOverflow《Performance of Map vs Object》。

---

**12）现场手写：`memoize(fn)`，支持**对象参数**且**不造成内存泄漏**。**
- 参考要点：
  ```js
  function memoize(fn) {
    const cache = new WeakMap();
    return function (arg) {
      if (cache.has(arg)) return cache.get(arg);
      const v = fn.call(this, arg);
      cache.set(arg, v);
      return v;
    };
  }
  ```
  **追问**：多参数怎么办？→ 数组 key 用一层层嵌套 WeakMap（每个参数一层），或 Map + JSON.stringify；lodash.memoize 是单 cache + 默认取首参。**为什么不能用 Map？**——Map 的 object key 是强引用，会让 arg 永远不被 GC，形成内存泄漏。
- 来源：lodash.memoize 源码；dmitripavlutin.com《JavaScript Memoization》；MDN。

---

**13）Map 为什么保证插入顺序、普通对象不保证？这个差异在生产踩过什么坑。**
- 参考要点：Map 内部按插入维护双向链表、keys()/forEach 严格吐插入序；对象的字符串键虽 ES2015 定了规则（整数键升序优先）但与插入意图不一致。**坑**：用 `{}` 存优先级列表再 Object.keys 读取，整数键被重排；缓存 LRU 靠 Map 的 set 不刷新位置、需 delete+set 手动提前。
- 来源：MDN《Map > 描述（插入顺序）》；ECMAScript 规范 OrdinaryOwnPropertyKeys 的转述。

---

**14）WeakMap 的「弱键」到底弱在哪？为什么引擎要实现成「不让 GC 看得到引用」。**
- 参考要点：键是弱引用——不阻止键对象被回收；键回收时条目自动消失（不可预测时机，所以没 size/不可枚举）。原理：GC 扫不到 WeakMap 的键引用（经典用 ephemeron 表解决「值强引用键」的循环）。**追问**：为什么值可以是普通对象而键必须可被回收。
- 来源：MDN《WeakMap》；GC 文献中 ephemeron 表处理弱引用映射的机制转述。

---

**15）一道设计题：用 Map/Set 写一个支持过期时间的内存缓存，要注意什么。**
- 参考要点：Map<key, {value, expire}> + 惰性过期（get 时判断过期则删）或定时扫；WeakMap 无法做过期（不可枚举、没 keys）所以只能 Map；要防无界增长需 LRU（Map 插入序 + delete/set 提前）或上限。**追问**：为什么不用普通对象。
- 来源：MDN《Map/WeakMap》；lodash.memoize 与各类 JS LRU 库实现的转述。
