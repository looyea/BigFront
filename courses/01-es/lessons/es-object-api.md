# Object 静态方法全家桶

> 目标：**分得清 Object 静态方法 vs 实例方法**；掌握 keys/values/entries/fromEntries/assign/freeze/seal/preventExtensions/getOwnPropertyDescriptors 各自的**语义边界**；能说出**属性描述符四件套**。

---

## 一、Object 静态方法的三条主线

Object 构造函数上的静态方法可以分成三组：

| 组别 | 方法 | 干什么 |
| --- | --- | --- |
| **枚举** | `keys` / `values` / `entries` / `fromEntries` / `getOwnPropertyNames` / `getOwnPropertySymbols` | 读一组 key 或 kv |
| **合并/定义** | `assign` / `defineProperty` / `defineProperties` / `getOwnPropertyDescriptor(s)` / `create` | 写属性或新建对象 |
| **不可变控制** | `freeze` / `seal` / `preventExtensions` / `isFrozen` / `isSealed` / `isExtensible` | 三档冻结程度 |

**共同特征**：
- 都接受**任何值**（不会 TypeError）；传 primitive 会被临时装箱成对象（`Object.keys('abc')` → `['0','1','2']`；`Object.keys(1)` → `[]`）。
- `null` / `undefined` 是**唯一例外**：ES2015+ 都不抛（`Object.keys(null)` 返回 `[]`）。
- 都**只看可枚举自有属性**（除 `getOwnPropertyNames` 会包含不可枚举的）。

---

## 二、枚举：keys / values / entries / fromEntries

```js
const u = { id: 1, name: 'Ann', [Symbol('t')]: 'x' };

Object.keys(u);     // ['id', 'name'] — 只有字符串键
Object.values(u);   // [1, 'Ann']
Object.entries(u);  // [['id',1], ['name','Ann']]
Object.fromEntries([['a',1], ['b',2]]);  // { a:1, b:2 }
Object.getOwnPropertyNames(u);           // ['id','name'] — 含不可枚举
Object.getOwnPropertySymbols(u);         // [Symbol(t)]
```

**顺序规则**（ES2015 起明确）：
1. **整数键**（`'0'`, `'1'`, ...）**升序**在前；
2. **字符串键**按**插入顺序**；
3. **Symbol 键**按插入顺序，只在 `getOwnPropertySymbols` / `Reflect.ownKeys` 出现。

**⚠️ 数字键陷阱**：
```js
const o = { 10: 'a', 2: 'b', 'x': 'c', 1: 'd' };
Object.keys(o);  // ['1', '2', '10', 'x']  ← 整数键自动排序
```
这也是为什么**「对象不能保证顺序」**的老说法不完全对——现代 JS 里对象是**有序**的（按上述规则）。想真正无序得走 Map。

**`entries` 与 `Object` 是双向的**：`Object.fromEntries(Object.entries(o))` ≈ 浅拷贝。

---

## 三、合并：`Object.assign` 与 spread

```js
const target = { a: 1, set b(v) { this._b = v; }, get b() { return this._b } };
Object.assign(target, { b: 2, c: 3 });
// 触发 setter；target 变 { a:1, _b:2, c:3 }

const copy = { ...target };  // 触发 getter；copy 是 { a:1, _b:2, c:3 }
```

**5 个关键差异**：

| 项 | `Object.assign(t, ...src)` | `{ ...src }` |
| --- | --- | --- |
| 是否写入 target | **是**（会触发 target setter） | 否（新建对象） |
| 多源合并 | 支持 `assign(t, s1, s2, s3)` | 支持 `{...s1, ...s2, ...s3}` |
| Symbol 键 | **拷贝** | **拷贝** |
| getter/setter | 触发 getter，**结果存为普通属性** | 同上 |
| 返回 | target 本身 | 新对象 |

**⚠️ 都是浅拷贝**：`Object.assign({}, { nested: { a: 1 } })` 里的 nested 仍是同一引用。深拷贝走 `structuredClone`。

---

## 四、属性描述符：**所有 Object.defineProperty 类 API 的地基**

每个属性在引擎里对应一个 descriptor：

**数据属性**：
```js
{ value: 42, writable: true, enumerable: true, configurable: true }
```

**访问器属性**：
```js
{ get: fn, set: fn, enumerable: true, configurable: true }
```

**四件套语义**：
- `value` — 值；
- `writable` — 能否被赋值（仅数据属性）；
- `enumerable` — 是否出现在 `for-in` / `Object.keys` / `JSON.stringify`；
- `configurable` — 能否删除、能否改描述符、能否从数据属性变访问器（**一旦 false 不可逆**）。

**手写一个 Vue 2 式响应式属性**：
```js
function reactive(obj, key, val) {
  let v = val;
  Object.defineProperty(obj, key, {
    get() { return v; },
    set(nv) { if (nv !== v) { v = nv; notify(); } },
    enumerable: true,
    configurable: true,
  });
}
```

---

## 五、`defineProperty` vs `defineProperties` vs 直接赋值

```js
const o = {};
o.a = 1;                                        // writable/enumerable/configurable 全 true
Object.defineProperty(o, 'b', { value: 2 });   // 三个 flag 默认全 false！
Object.defineProperties(o, {
  c: { value: 3, enumerable: true },
  d: { get() { return 4 } },
});
```

**⚠️ defineProperty 陷阱**：只写 `{ value: x }` 会得到**不可写、不可枚举、不可配置**的属性——很多新手在这里翻车。要么显式加 flags，要么用 `Object.defineProperties` 或 spread。

**`Object.getOwnPropertyDescriptors(obj)`（ES2017）**：**正确浅拷贝 getter/setter/flags 的写法**：
```js
const clone = Object.create(
  Object.getPrototypeOf(obj),
  Object.getOwnPropertyDescriptors(obj),
);
```
`{...obj}` 会**丢** getter/setter 语义（触发求值后存为普通属性），本方案保留。

---

## 六、三档冻结：**preventExtensions < seal < freeze**

| API | 加新属性 | 删属性 | 改属性值 | 改描述符 |
| --- | --- | --- | --- | --- |
| `preventExtensions` | ❌ | ✅ | ✅ | ✅ |
| `seal` | ❌ | ❌ | ✅ | ❌ |
| `freeze` | ❌ | ❌ | ❌ | ❌ |

三档都**只作用于自有属性**，嵌套对象不受影响：
```js
const a = Object.freeze({ nested: { x: 1 } });
a.nested.x = 42;      // ✅ 成功！freeze 是**浅**冻结
```

**深冻结**：递归 freeze，或用 `structuredClone` 序列化时打标记。**Vue dev 模式**里的 `markRaw` 反向操作：告诉响应式系统「不要走 defineProperty」。

---

## 七、`Object.create` 与原型链

```js
const proto = { hi() { return 'hello' } };
const obj = Object.create(proto);
obj.hi();  // 'hello'（走原型链）
Object.getPrototypeOf(obj) === proto; // true
```

**带第二参数**（描述符对象，等价 defineProperties）：
```js
const o = Object.create(proto, {
  size: { value: 10, enumerable: true },
});
```

**`Object.create(null)`**：**没有原型**的纯净字典，避免 `hasOwnProperty` 污染，是**缓存/映射表**的经典写法（比 Map 轻）。**追问**：为什么 ESLint 推荐「用 `Object.create(null)` 或 Map 而不是 `{}` 做字典」？—— 因为 `obj['__proto__']` / `obj['constructor']` 可能污染。

---

## 八、`is`：更精确的相等

```js
Object.is(NaN, NaN);     // true   （=== 会 false）
Object.is(0, -0);        // false  （=== 会 true）
Object.is(1, 1);         // true
```

`Object.is` 是**SameValue 算法**，比 `===` 更符合直觉。**用途**：在 defineProperty setter 里做「值真的变了才通知」的判断（Vue 3 reactive 内部就用 Object.is）。

---

## 九、自检清单

- [ ] 说出 Object.keys/values/entries 的顺序规则。
- [ ] 手写「正确浅拷贝保留 getter」的三行代码。
- [ ] 说出 `Object.assign` 与 `{...}` 的 5 个差异（含 Symbol 是否拷）。
- [ ] 说出属性描述符四件套含义；`defineProperty` 不写 flags 的默认值。
- [ ] 说出 preventExtensions / seal / freeze 三档的差异，并证明 freeze 是**浅**冻结。
- [ ] 说出 `Object.is` 与 `===` 的两个差别。

---

## 🚀 部署预告（本关点到，细节在 L10）

**Object API 在构建/运行时如何被处理？**

1. **`Object.assign` 需要 polyfill**：IE 无；Babel `@babel/polyfill`（现拆成 `core-js`）会自动注入。target 里含 IE 时打包体积 +3KB。
2. **`Object.fromEntries` / `getOwnPropertyDescriptors` / `Object.entries`** 都是 ES2017+，同样靠 core-js polyfill。
3. **`Object.freeze` 与 V8**：V8 会**放弃**给被 freeze 的对象做隐藏类（hidden class）演化——热路径上的常量对象 freeze 反而**更快**（因为形状已定），但**运行时修改密集**的对象 freeze 会慢。Redux DevTools 里「冻结 state 提升可预测性」用的就是这个思路（顺便让意外写失败）。
4. **`defineProperty` 与 Vue 2 响应式**：Vue 2 无法感知**新增 key**（因为初始遍历 defineProperty 只覆盖了当时存在的键），所以 `Vue.set` 必须显式调用——是「API 语义限制架构」的教科书案例。Vue 3 换 Proxy 才彻底解决。
5. **Tree-shaking**：`Object.keys` 是**纯函数**（无副作用）；如果整个表达式未被引用，打包器可摇掉。`Object.assign(target, ...)` 会改 target，被视为**副作用**，摇不掉。

细节 L10 `es-build` 展开。**你现在只需要记住**：**Object API 看着都是元数据操作，实际每一句都在悄悄告诉 V8 与打包器「这块能不能优化」。**
