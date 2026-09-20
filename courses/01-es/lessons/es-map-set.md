# Map / Set / WeakMap / WeakSet

> 目标：**说清 Map 与 Object 的差别**（键类型、顺序、性能、原型污染）；**Set 与 Array 的差别**（去重、成员判断 O(1)）；**Weak 版本为什么存在**（GC、内存泄漏防治）；能在框架源码里认出这四种数据结构的经典用法。

---

## 一、为什么需要 Map？Object 有什么不够？

| 场景 | Object | Map |
| --- | --- | --- |
| 键类型 | 只能字符串 / Symbol | **任何值**（对象、函数、NaN、undefined 都行） |
| 顺序 | 混合排序（整数升序 → 字符串插入序 → Symbol） | **严格插入顺序** |
| 长度 | 手动 `Object.keys(o).length` | `map.size` O(1) |
| 迭代 | for-in + 过滤 | 直接 `for-of` / 内置三 iterator |
| 原型污染风险 | `obj.__proto__` 是特殊键 | **没有原型链干扰** |
| 频繁增删 | 隐藏类演化，V8 优化打折 | **专为 KV 设计**，哈希表 |

**核心动机**：把「哈希表」从「对象」里剥出来——**Map 是数据结构，Object 是记录（record）**。

```js
const cache = new Map();
cache.set(user1, 'profile1');    // 对象作键
cache.set(NaN, 'yes');           // NaN 作键（SameValueZero 算法，能取回）
cache.set(user1, 'override');    // 同键覆盖
cache.size;                       // 2
cache.get(user1);                 // 'override'
[...cache.keys()];                 // 保持插入顺序
```

---

## 二、Map 的六个方法

```js
const m = new Map([['a', 1], ['b', 2]]);   // 构造接收可迭代 kv 数组
m.set(k, v); m.get(k); m.has(k); m.delete(k);
m.clear();
m.size;

// 三种迭代器
for (const [k, v] of m) { }        // entries（默认）
for (const k of m.keys()) { }
for (const v of m.values()) { }

// forEach
m.forEach((v, k) => console.log(k, v));   // 注意：value 在前，key 在后
```

**⚠️ `forEach` 参数顺序与 Array 一致**（value, key, map），与直觉相反。

**⚠️ Map.get 未命中返回 undefined**——与「存了 undefined 值」无法区分。要判定「存在」用 `has`：
```js
m.set('k', undefined);
m.get('k');   // undefined
m.has('k');   // true
```

**⚠️ 键判等**：SameValueZero（≈ `===` 但 `NaN === NaN` 视为 true）。**对象键按引用**：
```js
const m = new Map();
m.set({}, 1).set({}, 2);
m.size;   // 2 —— 两个不同空对象是两个不同键
```

---

## 三、Set：值唯一的有序集合

```js
const s = new Set([1, 2, 2, 3]);   // {1, 2, 3}
s.add(4).add(4);                     // 链式；重复 add 无变化
s.has(2);                             // true
s.delete(1);
s.size;                                // 2

// 集合运算
const A = new Set([1,2,3,4]), B = new Set([3,4,5,6]);
const union     = new Set([...A, ...B]);
const intersect = new Set([...A].filter(x => B.has(x)));
const diff      = new Set([...A].filter(x => !B.has(x)));
```

**Set 内部就是「只有键的 Map」**（V8 源码 `js-collection.cc` 里两者共用哈希实现）。

**⚠️ Set 的判等也是 SameValueZero**：
```js
new Set([NaN, NaN]).size;      // 1（Array 里 [NaN].indexOf 会失败，Set 不会）
const s = new Set();
s.add({}).add({});              // size = 2（引用不同）
```

**去重经典**：
```js
const uniq = [...new Set(arr)];
const uniqBy = (arr, fn) => [...new Map(arr.map(x => [fn(x), x])).values()];
```

---

## 四、WeakMap：对象键 + 弱引用 + 不可枚举

**关键约束**：
- **键必须是对象**（或 Symbol，ES2023+；实际上多数引擎仍只支持对象）；
- **弱引用**：键对象若无其他引用，GC 会回收**整个 kv 对**；
- **没有 size / clear / keys / values / forEach**——因为「什么时候被 GC 掉你不知道」。

```js
const meta = new WeakMap();
const el = document.querySelector('#box');
meta.set(el, { clicks: 0, focusTime: Date.now() });
// el 从 DOM 移除并失去引用 → 该条元数据自动被 GC
```

**四大用途**：

1. **给对象附加私有数据**（在 class fields 普及前的老写法）：
   ```js
   const privateData = new WeakMap();
   class Account {
     constructor(id) { privateData.set(this, { id, balance: 0 }); }
     deposit(x) { const d = privateData.get(this); d.balance += x; }
   }
   ```
2. **缓存 / 记忆化**：`memoize` 参数是对象时，用 WeakMap 缓存避免内存泄漏。
3. **Vue 3 reactive 反向映射**：`reactiveMap: WeakMap<raw, proxy>` + `proxyToRaw: WeakMap<proxy, raw>`——raw 消失自动清理。
4. **DOM 节点关联数据**：jQuery 早期用 `data(key, value)` 挂在元素上，底层就是 WeakMap。

---

## 五、WeakSet：只放对象、不阻止 GC

```js
const seen = new WeakSet();
function walk(node) {
  if (seen.has(node)) return;   // 循环引用保护
  seen.add(node);
  node.children?.forEach(walk);
}
```

**用途**：
- 检测**对象是否已处理过**（依赖图、循环引用）；
- 标记「这个对象已经初始化」（防止重复 polyfill）；
- 权限标记：`allowed.add(obj)` 后 `allowed.has(x)` 判定 x 是否在白名单。

---

## 六、Object 与 Map 的选择规则（**面试高频**）

| 你要干什么 | 用 |
| --- | --- |
| 表示一条「记录」（有固定字段名） | **Object** |
| 需要**任意类型作 key** | **Map** |
| 频繁增删键值对 | **Map** |
| 需要保持**插入顺序**且键混合数字/字符串 | **Map**（Object 会整数排前） |
| 直接字面量 JSON 序列化 | **Object** |
| 需要 `size` O(1) | **Map** |
| 需要防原型污染 | **Map** 或 `Object.create(null)` |
| 附加数据不阻止 GC | **WeakMap** |

**⚠️ 序列化差异**：`JSON.stringify(new Map([[1,2]]))` → `{}`（Map 内部属性都不可枚举）。要序列化：`[...map]` → `JSON.stringify` → 反序列化时 `new Map(JSON.parse(s))`。

---

## 七、`Object.fromEntries` ↔ `[...map]` 的互转

```js
const obj = { a: 1, b: 2 };
const map = new Map(Object.entries(obj));    // Object → Map
const back = Object.fromEntries(map);         // Map → Object
// Object.fromEntries 也接受任何 kv 可迭代对象
Object.fromEntries([['x', 1], ['y', 2]]);     // { x:1, y:2 }
```

**用途**：`fromEntries + map + filter` 三步组合实现「对象版 map / filter」：
```js
const doubled = Object.fromEntries(
  Object.entries(prices).map(([k, v]) => [k, v * 2]),
);
```

---

## 八、性能与陷阱

- **Map.set 与 Object 赋值谁更快？**——大量随机读写（>10^4）Map 通常更快（哈希直取）；小对象 & 隐藏类稳定的属性访问 Object 更快（inline cache）。
- **Map.keys() 是**活**迭代器**：遍历时删除当前键是安全的，但**新增**键的行为依实现。Set 同理。
- **WeakMap 不能枚举**——所以内存分析器里也看不到它「还剩多少 kv」。
- **`new Set([obj, obj])` 判等按引用**——若 obj 每次是新对象，去重失败。用 `uniqBy(arr, fn)` 模式（见上）。

---

## 九、自检清单

- [ ] 说出 Map 相对 Object 的 5 个优势。
- [ ] Map 判等用的是什么算法？和 `===` 的唯一区别是什么？
- [ ] WeakMap 为什么没有 size / clear / iterator？
- [ ] 举出 WeakMap 的 3 个真实场景（至少 1 个来自框架源码）。
- [ ] 如何序列化和反序列化一个 Map？
- [ ] 说出 Object 转 Map 与 Map 转 Object 的方法。

---

## 🚀 部署预告（本关点到，细节在 L10）

**Map/Set 在构建阶段会发生什么？**

1. **IE 时代需要 polyfill**：Map/Set/WeakMap/WeakSet 在 IE11 无（或残缺）；core-js 会注入约 **6KB gzip**（含 collection 骨架）。现代浏览器 target 直接省掉。
2. **降级不了**：Map/Set 是**运行时数据结构**，Babel 不会转成 Object——只能靠 polyfill。
3. **Tree-shaking**：`new Map()` 是**运行时表达式**，被当作**有副作用**——不会被摇掉；即便 map 没被引用，`new Map()` 也保留。想省得手动优化。
4. **WeakMap 与内存**：某些热重载 HMR 场景里，模块顶层 WeakMap 会**跨版本持有旧引用**——因为「模块对象」还活着。生产无所谓，dev 长会话可能内存缓增。
5. **Source Map 与 debugger**：DevTools 里 Map/Set 有**专用预览面板**（能直接展开看 kv）；不像对象要 `console.log([...m])`。这是排查 state 管理的好帮手。

细节 L10 `es-build` 展开。**你现在只需要记住**：**Map/Set 是「运行时对象」，不能靠语法降级省——老 target 就是硬掏 polyfill 体积。**
