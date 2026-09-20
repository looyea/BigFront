# ES2024：分组、Buffer 转移与规范整理

> 目标：掌握 **`Object.groupBy` / `Map.groupBy`**、**`Promise.withResolvers`**、**`ArrayBuffer.transfer` / `transferToFixedLength`**、**`String.isWellFormed` / `toWellFormed`**、**`Atomics.waitAsync`**；了解 ES2024 作为「**规范整理年**」的定位。

---

## 一、ES2024 的定位

**ES2024 = 收尾年**——把之前几年散落的提案正式打包 + 补上最后几块拼图：
- 集合分组（Array.from async + groupBy）
- ArrayBuffer 可转移（SharedArrayBuffer 时代补齐）
- 字符串合法性检测（处理代理对截断）
- `Promise.withResolvers`（**解放构造器外的 resolve/reject**）

---

## 二、`Object.groupBy` / `Map.groupBy`

```js
const items = [
  { name: '球', type: 'sports', weight: 600 },
  { name: '书', type: 'study', weight: 300 },
  { name: '拍', type: 'sports', weight: 200 },
];

// Object.groupBy：返回**原型为 null** 的对象
const grouped = Object.groupBy(items, ({ type }) => type);
// { sports: [{球...}], study: [{书...}] }

// Map.groupBy：返回 Map（键可以是**非字符串**）
const byWeight = Map.groupBy(items, ({ weight }) => weight > 250 ? 'heavy' : 'light');
// Map { 'light' => [...], 'heavy' => [...] }
```

**取代**：以前手写 `reduce((acc, x) => { (acc[key] ??= []).push(x); return acc; }, {})`。

**`Object.groupBy` vs `Map.groupBy`**：
| 维度 | Object | Map |
| --- | --- | --- |
| 返回值 | `Object.create(null)` 对象 | Map 实例 |
| 键类型 | string / symbol | 任意 |
| 有序 | 整数键自动排序 | **保持插入顺序** |
| 适合 | 枚举分桶 | 动态键、需要 size |

---

## 三、`Promise.withResolvers`

```js
// 以前
let resolve, reject;
const p = new Promise((res, rej) => { resolve = res; reject = rej; });

// 现在
const { promise, resolve, reject } = Promise.withResolvers();
```

**价值**：把 resolve/reject 拿到**构造器外面**——在 class 方法、事件监听器、队列里等场景更自然。

```js
class Modal {
  #resolver;
  show() {
    this.visible = true;
    const { promise, resolve } = Promise.withResolvers();
    this.#resolver = resolve;
    return promise;    // 调用方 await modal.show()
  }
  close() { this.visible = false; this.#resolver?.(); }
}
// await modal.show(); → close 时自动 resolve
```

---

## 四、`ArrayBuffer.transfer()` / `transferToFixedLength()`

```js
const buf = new ArrayBuffer(1024);
const view = new Uint8Array(buf);
view[0] = 42;

const transferred = buf.transfer();   // ⚠️ buf **detached**，后续读写返回 0
new Uint8Array(transferred)[0];       // 42

const sliced = buf.transfer(0, 512);  // transferToFixedLength 变体
```

**价值**：**零拷贝**转移所有权——以前 `new Uint8Array(old).slice().buffer` 是**复制**；`transfer` 只是**把底层内存移交**——Web Worker、GPU buffer 场景性能飞跃。

---

## 五、`String.isWellFormed()` / `toWellFormed()`

```js
'\uD800' + 'a';              // 代理对截断——「脏」字符串
'\uD800a'.isWellFormed();     // false
'\uD800a'.toWellFormed();     // '\uFFFD a'（用替换字符填补）

'正常'.isWellFormed();        // true
```

**用途**：处理网络传输 / 文件读取中被截断的 UTF-16 代理对——JSON / URL / DOM 接口都要求 well-formed；**防御性编程**必用。

---

## 六、`Atomics.waitAsync`（SharedArrayBuffer）

```js
const sab = new SharedArrayBuffer(4);
const i32 = new Int32Array(sab);

// 主线程不阻塞
i32[0] = 0;
Atomics.waitAsync(i32, 0, 0).value.then(() => {
  console.log('worker 已写入');
});

// worker 里
i32[0] = 1;
Atomics.notify(i32, 0);
```

**为什么**：`Atomics.wait` 会**阻塞线程**（只能在 worker 里用）；`waitAsync` 返回 Promise——**主线程也能用**，不卡 UI。

---

## 七、`Array.fromAsync`（ES2024 提案，Node 22+）

```js
const asyncGen = async function* () {
  yield 1; yield 2; yield 3;
};
const arr = await Array.fromAsync(asyncGen());
// [1, 2, 3]
```

---

## 八、自检清单

- [ ] `Object.groupBy` 返回值的原型是什么？为什么？
- [ ] `Map.groupBy` 与 `Object.groupBy` 的取舍？
- [ ] `Promise.withResolvers` 解决了什么以前很难写的模式？
- [ ] `ArrayBuffer.transfer()` 后原 buffer 还能用吗？
- [ ] `isWellFormed` 判断的是什么？给一个截断场景。

---

## 🚀 部署预告

1. **`groupBy` 替代 lodash**：`_.groupBy` / `Array.prototype.reduce` 的经典场景——如果 `browserslist` 不含 Chrome 116+ / Safari 17.4+ / Firefox 119+，需要 core-js polyfill（~500B）。
2. **`Promise.withResolvers`**：core-js polyfill ~200B；无语法降级需求。
3. **`ArrayBuffer.transfer`**：**无法 polyfill**——需要引擎内存管理支持。用在不兼容环境要回退到 `slice()` 拷贝。
4. **`isWellFormed` / `toWellFormed`**：需 polyfill（纯 JS 实现 ~1KB）；处理用户上传 / API 响应时**强烈建议防御**。
5. **`Atomics.waitAsync`**：依赖 SharedArrayBuffer + COOP/COEP 头（跨域隔离）；**部署时**配 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`。
