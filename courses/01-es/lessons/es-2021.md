# ES2021：逻辑赋值、并发竞态与弱引用

> 目标：掌握 **逻辑赋值运算符**（`||=` `&&=` `??=`）、**数字分隔符**（`1_000_000`）、**`String.replaceAll`**、**`Promise.any`**、**`WeakRef` / `FinalizationRegistry`**。这一年规模小但**命中率极高**——尤其 `??=` 与 `Promise.any` 已是现代代码常客。

---

## 一、ES2021 的定位

**"ES2021 是给『简洁』和『并发』各补一刀"**：
- 逻辑赋值把 `x = x || y` 缩写成 `x ||= y`（且**短路时才赋值**）；
- `Promise.any` 补齐了 `all` / `allSettled` 之外的第三种聚合语义——**谁先赢用谁**；
- `WeakRef` 第一次让开发者能「引用但不阻止回收」。

---

## 二、逻辑赋值运算符：`||=` `&&=` `??=`

```js
a ||= b;    // 等价 a = a || b，但 a 为 truthy 时**不求值 b、也不重新赋值**
a &&= b;    // a 为 truthy 才执行 a = b
a ??= b;    // a 为 null/undefined 才赋值（0 / '' / false 视为已存在！）
```

**`??=` 的杀手场景——惰性初始化 / 缓存**：
```js
config.timeout ??= 3000;         // 只有没设（nullish）才给默认，0 会被保留
cache[key] ??= await expensive(key);   // 命中就跳过计算
```

**与旧写法的差别（面试点）**：`a ||= b` 比 `a = a || b` **少一次赋值与 getter/setter 触发**——对带 setter 的属性、Proxy（呼应 [es-proxy](es-proxy.md)）副作用有意义。

> ⚠️ 混用限制：`a || b ?? c` 仍需括号（呼应 [es-2020](es-2020.md)），但 `a ??= b` 是**独立赋值运算符**，不涉及该歧义。

---

## 三、数字分隔符 `_`

```js
const billion = 1_000_000_000;      // 下划线被忽略，纯可读性
const mask    = 0xFF_00_00_00;      // 十六进制分组
const frac    = 1_000.50_25;        // 小数部分也行
// 规则：不能在首尾、不能连着小数点、不能两个连一起（1__0 非法）
```
**仅是字面量语法**——`typeof 1_000 === 'number'`，运行时与 `1000` 完全一致，Babel 直接删掉下划线，零成本。

---

## 四、`String.prototype.replaceAll`

```js
'a-b-c'.replaceAll('-', '_');        // 'a_b_c'
// 旧写法 1：/'-'/g 正则全局（容易忘 g）
// 旧写法 2：split('-').join('_')
```

**关键规则**：
- 第一个参数是**字符串**时，会替换**所有**匹配（不像 `replace(str)` 只换第一个）；
- 若传**正则**，该正则**必须带 `g` 标志**，否则抛 `TypeError`；
- 支持 `$$`、`$&` 等替换模式与替换函数（与 `replace` 一致）。

---

## 五、`Promise.any`：竞速「首个成功」

```js
Promise.any([p1, p2, p3])
  .then(first)      // 任一 **fulfilled** 就 resolve（取最快成功者）
  .catch(err => {   // 全部 rejected 才 reject
    if (err instanceof AggregateError) console.log(err.errors);
  });
```

**三兄弟对比（必背表）**：

| 方法 | 触发 resolve | 触发 reject | 返回 |
| --- | --- | --- | --- |
| `Promise.all` | 全部 fulfilled | 任一 rejected | 值数组 |
| `Promise.allSettled` | 永远 resolve | 从不 reject | `{status,value/reason}[]` |
| `Promise.any` | **任一** fulfilled | **全部** rejected | 第一个成功的值 |
| `Promise.race` | 任一先 settle | 取决于先 settle 的状态 | 第一个 settle 的结果 |

**典型场景**：多 CDN / 多镜像**取最先返回的可用源**；`race` 常被误当成 any——**race 里先 reject 的会直接让你拿到错误**，any 会忽略失败继续等成功者。呼应 [es-promise](es-promise.md)。

---

## 六、`WeakRef` 与 `FinalizationRegistry`：可控的弱引用

```js
const ref = new WeakRef(hugeObj);
// 需要用时解引用，可能已被 GC 回收
const obj = ref.deref();
if (obj) use(obj);
else reload();                       // 已被回收，重建

const registry = new FinalizationRegistry((heldValue) => {
  console.log(`${heldValue} 被回收了，清理索引`);
});
registry.register(someObj, 'someId');   // someObj 回收后回调（不保证时机）
```

**为什么需要**：`Map`/`WeakMap` 只能整表弱键；`WeakRef` 让**单个值**弱持有（缓存大对象又不阻止回收）。呼应 [es-map-set](es-map-set.md) 的 WeakMap。
**⚠️ 铁律**：**别用 FinalizationRegistry 做正确性关键逻辑**（如关连接）——GC 与回调时机不可预测，只用于「提示性清理」。

---

## 七、自检清单

- [ ] `a ??= b` 与 `a ||= b` 在 `a = 0` 时分别会不会赋 b？
- [ ] `1_0_1` 这个字面量合法吗？数字分隔符有哪些位置限制？
- [ ] `replaceAll` 传正则时少了 `g` 会怎样？
- [ ] `Promise.any` 和 `Promise.race` 的核心区别？全失败时抛什么？
- [ ] `WeakRef.deref()` 可能返回什么？为什么 FinalizationRegistry 不能用于关连接？

---

## 🚀 部署预告（本关点到，细节在 L10）

1. **逻辑赋值 / 数字分隔符** 是**纯语法**，Babel 降级零运行时成本（分隔符直接删、`||=` 展开为短路判断）。
2. **`replaceAll`** 若降级为 `split/join` 或正则全局替换，注意 `$` 模式差异；core-js 提供 polyfill（很小）。
3. **`Promise.any`** 需 core-js polyfill（依赖 `AggregateError`，约 300B gzipped）；Node 15+、主流现代浏览器原生支持。
4. **`WeakRef` / `FinalizationRegistry`** **无法被 polyfill**（依赖真正 GC 语义）——只能做**特性检测** `typeof WeakRef === 'function'`，老环境优雅降级。
5. **Vite `build.target: 'es2020'`** 下，逻辑赋值(ES2021)会被转译；想全量原生把 target 提到 `es2021` 或 `esnext`。详见 [es-build](es-build.md)。

**你现在只需记住**：**`??=` 管惰性默认值、`Promise.any` 管「最快成功」、`WeakRef` 管「弱持有」**——三者分别对应默认值、并发、内存三条日常主线。
