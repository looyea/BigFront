# structuredClone 与「深拷贝」的边界

> 目标：**知道 `JSON.parse(JSON.stringify(obj))` 的 7 大坑**；掌握 `structuredClone` 的**能拷与不能拷**；理解**结构化克隆算法**的语义；能选对工具解决不同场景的深拷贝 / 序列化。

---

## 一、深拷贝的四种流派

| 方式 | 优点 | 缺点 |
| --- | --- | --- |
| `JSON.parse(JSON.stringify(x))` | 兼容性最好 | **7 大坑**（下一节） |
| 递归手写 / `lodash.cloneDeep` | 全面 | 体积大 / 手写复杂 |
| `structuredClone(x)` | 原生、快、语义最完整 | **不能拷函数、Symbol、DOM、原型链** |
| `MessageChannel` / `postMessage` | 跨线程原生 | 异步、用法绕 |

**规则**：能用 `structuredClone` 就别用 JSON 大法；需要拷函数/原型走 lodash 或手写。

---

## 二、`JSON.parse(JSON.stringify(x))` 的 7 大坑

```js
const x = {
  n: NaN,
  inf: Infinity,
  undef: undefined,
  fn() { return 1; },
  sym: Symbol('a'),
  date: new Date(),
  big: 10n,
  re: /abc/g,
  map: new Map([['k', 1]]),
  set: new Set([1, 2]),
  cyclic: null,
};
x.cyclic = x;   // 循环引用
```

**7 种丢失/变形**：

1. `undefined` / 函数 / Symbol —— **属性被删**（对象里）或变 `null`（数组里）。
2. `NaN` / `Infinity` / `-Infinity` —— 变 `null`。
3. `BigInt` —— **抛 TypeError**。
4. `Date` —— 变 **字符串**（`"2026-01-01T00:00:00.000Z"`），失去方法。
5. `RegExp` —— 变 `{}`（源和 flags 都是非枚举）。
6. `Map` / `Set` / `WeakMap` —— 变 `{}`（内部数据不可枚举）。
7. **循环引用** —— 抛 `TypeError: Converting circular structure to JSON`。

**⚠️ 隐藏坑**：
- **原型链丢失**（`clone` 变成 plain object，`instanceof Foo` 失败）；
- **getter/setter 丢失**（触发求值后存为数据）；
- **非枚举属性丢失**；
- **属性顺序可能变**（JSON 内部按字符串键插入序）；
- **`toJSON` 会被调用**——很多库（比如 Moment、Decimal.js）靠 `toJSON` 输出字符串而不是原对象。

---

## 三、`structuredClone`：**结构化克隆算法**（HTML 标准）

**支持类型**（近乎完整覆盖 JS 常用值）：
- 所有 primitive（含 `BigInt`、`Symbol.toPrimitive` 后的值）
- `Array`、`Object`、plain object、`Map`、`Set`、`Date`、`RegExp`、`Error` 家族
- `ArrayBuffer`、`SharedArrayBuffer`、所有 `TypedArray`、`DataView`
- `Blob`、`File`、`ImageData`、`ImageBitmap`、`CryptoKey`（Web API）
- **循环引用**（内部用 identity 映射表）
- **属性顺序、getter 求值后的数据**（跟 spread 一样会**触发 getter**，结果属性是普通数据）

**❌ 不能拷**：
1. **函数**（包括箭头）—— 抛 `DataCloneError`；
2. **Symbol** 作值 —— 抛错；作 key —— **静默丢失**；
3. **DOM 节点** —— 抛错；
4. **带 `[[ThrowIfDetached]]` 的已分离 ArrayBuffer** —— 抛错；
5. **原型链、getter/setter 语义、非枚举属性** —— 都不保留，产物是**普通对象/数组**；
6. **Error 的 `cause` 属性** —— 早期实现丢；现代浏览器保留部分字段但栈信息不可靠。

**⚠️ 关键陷阱**：structuredClone 后**类实例的原型丢失**：
```js
class Foo { x = 1; hi() { return 'hi'; } }
const f = new Foo();
const g = structuredClone(f);
g instanceof Foo;   // ❌ false
g.hi();              // ❌ TypeError
g.x;                  // ✅ 1（自有属性被拷）
```

---

## 四、`structuredClone` 的三个高级用法

```js
// 1. transfer（性能：把 ArrayBuffer **转移**而不是拷贝）
const buf = new ArrayBuffer(1024 * 1024);
const clone = structuredClone({ buf }, { transfer: [buf] });
buf.byteLength;   // 0（已转移）

// 2. 拷部分子树
const full = { a: { b: 1 }, c: 2 };
const part = structuredClone(full.a);   // { b: 1 }

// 3. Worker 与主线程之间的隐式调用
worker.postMessage({ data });    // 内部就走 structuredClone
```

**兼容性**：Chrome 98 / Firefox 94 / Safari 15.4 / Node 17+（Node 更早通过 `v8.structuredClone`）。老浏览器用 `core-js` 或 `lodash.cloneDeep`。

---

## 五、手写递归深拷贝：一个**较完整**版本（**面试高频**）

```js
function deepClone(v, seen = new WeakMap()) {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v);           // 循环引用
  if (v instanceof Date)   return new Date(+v);
  if (v instanceof RegExp) return new RegExp(v.source, v.flags);
  if (v instanceof Map) {
    const m = new Map(); seen.set(v, m);
    for (const [k, val] of v) m.set(deepClone(k, seen), deepClone(val, seen));
    return m;
  }
  if (v instanceof Set) {
    const s = new Set(); seen.set(v, s);
    for (const x of v) s.add(deepClone(x, seen));
    return s;
  }
  if (ArrayBuffer.isView(v)) return new v.constructor(v);   // TypedArray / DataView

  const out = Object.create(Object.getPrototypeOf(v));       // 保留原型
  seen.set(v, out);
  for (const key of Reflect.ownKeys(v)) {                    // 含 Symbol + 不可枚举
    const desc = Object.getOwnPropertyDescriptor(v, key);
    if ('value' in desc) {
      desc.value = deepClone(desc.value, seen);
    }
    Object.defineProperty(out, key, desc);                   // 保留 getter/setter
  }
  return out;
}
```

**面试追问要点**：
1. 循环引用怎么破？→ WeakMap 记录已拷对象；
2. 如何保留原型？→ `Object.getPrototypeOf` + `Object.create`；
3. 如何保留 getter/setter？→ `getOwnPropertyDescriptor` + `defineProperty`（**不能对 value 无脑递归**，否则触发 getter）；
4. Symbol 键怎么办？→ `Reflect.ownKeys`（含不可枚举 + Symbol）。

---

## 六、什么时候用哪种？

| 场景 | 推荐 |
| --- | --- |
| 后端返回纯 JSON 数据处理 | `JSON.parse(JSON.stringify(x))` 够用 |
| 前端 state 快照 / undo | `structuredClone` |
| 跨 Worker 传值 | `postMessage`（内部走 structuredClone） |
| 类实例带方法 | 手写递归 / `lodash.cloneDeep` + 后处理 |
| 只拷一层 | `{...obj}` / `Object.assign` |
| 大 ArrayBuffer 高性能 | `structuredClone(x, { transfer })` |

---

## 七、序列化的另一半：**反序列化怎么恢复类型**

`JSON.stringify` 把 Date 变字符串后想恢复：
```js
JSON.stringify(x, (k, v) => v instanceof Date ? { __t: 'Date', v: v.toISOString() } : v);
JSON.parse(s, (k, v) => v && v.__t === 'Date' ? new Date(v.v) : v);
```
或直接用 `structuredClone`——它原生保留 Date、Map、Set、RegExp、BigInt。

**⚠️ `toJSON` 的干扰**：`JSON.stringify` 遇到带 `toJSON` 方法的对象会**优先调用**——Moment / Decimal.js 都有 toJSON；这就是「为什么 JSON 大法会把 Moment 变成字符串」的根本原因。**追问**：如何禁用？→ 用 structuredClone，或先 `Object.assign({}, obj)` 剥离原型。

---

## 八、其他相关：`postMessage` 与 `MessageChannel`

structuredClone 算法最初是**跨线程通信**规范里的，被 `postMessage`、`BroadcastChannel`、`IDBObjectStore.put`、`crypto.subtle` 大量使用。JS 层暴露 `structuredClone(x)` 只是把同一算法搬到「同线程」可用。

**⚠️ iframe / Worker 之间 postMessage 传函数会抛 DataCloneError** —— 因为函数不能克隆。要用 RPC 或 `Web Serial` 之类的桥。

---

## 九、自检清单

- [ ] 说出 `JSON.parse(JSON.stringify(x))` 的 7 大坑。
- [ ] structuredClone 能拷与不能拷的类型各列 5 种。
- [ ] 为什么 structuredClone 后类实例的 `instanceof` 会失败？
- [ ] 手写递归深拷贝要处理哪 5 件事（循环、原型、getter、Symbol 键、特殊对象）？
- [ ] transferable 与「拷贝」的性能差在哪？
- [ ] 说出 `toJSON` 方法的调用时机。

---

## 🚀 部署预告（本关点到，细节在 L10）

**structuredClone 与序列化在构建/部署时会被怎样处理？**

1. **polyfill 巨大**：`core-js` 的 structuredClone 约 3KB gzip；`lodash.cloneDeep` 单函数约 2KB。老浏览器 target 要评估是否值得。
2. **State 序列化的构建时差异**：SSR 场景里 state 从 Node 序列化到浏览器——**Next.js** 的 flight data、**Nuxt** 的 payload，都要处理 Date / BigInt / Map 等特殊类型，各家有自定义 replacer。你写的 replacer 与 SSR 框架要**对齐**。
3. **Vite 的 module preload**：ESM 模块对象不能被 structuredClone（内部有函数）——只能拷**数据部分**。这是打包器把 CSS/JS 与「状态」严格分开的原因之一。
4. **sourcemap 与栈信息**：Error 对象 structuredClone 后 `.stack` 字符串保留，但**栈里指向的原始文件**可能与 sourcemap 断链——生产上报错要连 `.map` 一起上传。
5. **MessagePack / Protocol Buffers**：比 JSON 更小更快的二进制格式，`msgpackr`、`protobuf.js`；体积常缩到 JSON 的 30-60%。移动端网络敏感场景值得评估。

细节 L10 `es-build` 展开。**你现在只需要记住**：**深拷贝看似小事，其实是 SSR / 存储 / Worker / 上报的基石——选错一次就丢函数、丢原型、丢栈。**
