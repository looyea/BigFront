# L5 作业：数据结构、序列化与本地存储

> 覆盖本阶段 3 关：`es-map-set`、`es-structured`、`es-local-db`。
> 提交方式：读代码题直接答；手写实现放 `homework/L5.answers.js`。

---

## 一、读代码写结果（每题 2 分，共 20 分）

**A1.**
```js
const m = new Map();
m.set(1, 'a').set('1', 'b').set(NaN, 'c').set(NaN, 'd');
console.log(m.size, m.get(NaN));
```

**A2.**
```js
const s = new Set([1, '1', true, false, null, undefined, NaN, NaN]);
console.log(s.size);
```

**A3.**
```js
const wm = new WeakMap();
const k = {};
wm.set(k, 'v');
console.log(wm.get(k), wm.has(k), 'size' in wm);
```

**A4.**
```js
const o = { a: 1, b: { c: 2 } };
const s = new Set([o, { ...o }]);
console.log(s.size);
```

**A5.**
```js
console.log(JSON.stringify({ a: undefined, b: NaN, c: Infinity, d: 10n }));
```

**A6.**
```js
const m = new Map([['x', 1]]);
console.log(JSON.stringify(m), JSON.stringify([...m]));
```

**A7.**
```js
const src = { d: new Date(0), r: /abc/g, m: new Map([[1, 2]]), s: new Set([3]) };
const clone = structuredClone(src);
console.log(clone.d instanceof Date, clone.r instanceof RegExp, clone.m.get(1), clone.s.has(3));
```

**A8.**
```js
const buf = new ArrayBuffer(8);
const view = new Uint8Array(buf);
view[0] = 1;
const c = structuredClone({ buf, view }, { transfer: [buf] });
console.log(buf.byteLength, c.view[0]);
```

**A9.**
```js
class T { constructor() { this.x = 1; } hi() { return 'h'; } }
const g = structuredClone(new T());
console.log(g.x, g.hi, g instanceof T);
```

**A10.**
```js
const a = { n: 1 };
a.self = a;
try { JSON.stringify(a); } catch (e) { console.log(e.name); }
console.log(structuredClone(a).self === structuredClone(a).self);
```

---

## 二、手写实现（每题 6 分，共 30 分）

**B1 · LRUCache(cap)**：Map 版 LRU，`get/put` 都是 O(1)；用 Map 的**插入顺序**当访问顺序（get 时 delete + set 一下）。

**B2 · uniqDeep(arr)**：按**深层字段**去重，接受 `keyFn`；返回保持首次出现顺序的新数组；处理对象参数（WeakMap 记录已见对象）。

**B3 · countBy(arr, fn)**：Map 版分组计数，返回 `[[key, count], ...]`；按 count 降序排。

**B4 · safeStructuredClone(v)**：包一层——遇到函数/Symbol/DOM 时**降级**为可 JSON 序列化的部分并记录哪些字段被替换；输出 `{ value, lostKeys }`。

**B5 · deepMerge(a, b)**：**递归**合并 plain object；数组按 index 合并（b 覆盖 a）；Date/RegExp/Map/Set 视为叶子直接返回 b；处理循环引用。

---

## 三、场景改造（20 分）

**给一个「带函数与 Date 的配置对象」**：
```js
const config = {
  name: 'App',
  version: '1.0',
  launchDate: new Date('2026-01-01'),
  hooks: {
    onStart() { console.log('start'); },
    onStop: () => console.log('stop'),
  },
  metrics: new Map([['boot', 100]]),
};
```

请实现：
1. `serializeConfig(config)` → 输出可以 JSON.stringify 的**纯数据对象**（函数与 Date 与 Map 都用可识别的**包装结构**表达）；
2. `deserializeConfig(s)` → 还原成能用的对象（Date 是 Date；Map 是 Map；hooks 保留函数名字符串而不是函数本体，同时导出 `bindHooks(config, impls)` 把真实函数注入）；
3. 处理 `config` 里可能存在的**循环引用**。

---

## 四、面试简答（每题 6 分，共 18 分）

**Q1**：Object、Map、WeakMap 三者分别适合做什么？给三个具体场景（一个数据快照、一个对象元数据、一个防原型污染字典）。

**Q2**：`JSON.parse(JSON.stringify(x))` 会破坏哪些类型的语义？structuredClone 与它的选择依据是什么？

**Q3**：手写递归深拷贝要处理哪 5 件事？为什么 `WeakMap` 而不是 `Map` 用来记「已拷贝对象」？

---

## 五、数据分层与浏览器本地数据库（18 分）

**T1（6 分）分层判定**：下面 8 项各属于哪一层（**L0 内存 / L1 浏览器持久 / L2 服务端存储 / L3 独立数据库**），并用一句话给出理由（判据：“谁是事实源”、“换个设备还得是同一份”）：

1. 本页表单尚未提交的草稿文本
2. 网站主题与正文字号偏好
3. 用户已下单的订单记录
4. 一个 40MB 的离线视频缓存
5. 商品库存数量
6. 列表接口的上一页结果（为了返回时不重新拉）
7. 会话 token
8. 服务端打点的学习进度（本平台用的 `data/progress.md`）

> 要求：第 2/4/6 项额外写出“为什么不能只放某一层”的反例（例如只放 L1 会因 origin 隔离/被驱逐而丢）。

**T2（8 分）手写一个 IndexedDB 封装**。要求：

1. `openDB(name, version, upgrade)` 返回 Promise，`upgrade(db, tx)` 只在版本变大时被调；用 `db.close()` 与 `onversionchange` 处理“老标签页占住库”；
2. `putAll(records)` 在**一个事务**里写完，中途抛错整体不入库（说清你靠哪个事件判定“真的落盘了”，而不是单个请求的 `onsuccess`）；
3. `listByAuthor(author)` 走 `byAuthor` 索引且按 `createdAt` 倒序取前 20 条（**不允许**先 `getAll()` 再 `filter/sort`）；
4. 说明为何下面这段会报错，并给两种修法：
   ```js
   // 目的：拉服务端汇率后把换算结果入库
   const tx = db.transaction('note', 'readwrite');
   const rate = await fetch('/api/rate').then((r) => r.json());   // 💥 事件循环转了一圈
   tx.objectStore('note').put({ id: 'n9', rate });                 // TransactionInactiveError
   ```

**T3（4 分）双层记忆与离线写队列**：本平台的外观（主题 + 字号）同时写 `localStorage` 与后端 `data/appearance.json`。请回答：

1. 只靠 `localStorage` 会在哪三种场景下“下次打开回到默认”？（提示：origin 包含协议+主机+**端口**）
2. 合并规则为什么是“后端有 `updatedAt` 则后端赢并回灌本地，否则把本地值种上去”？说出一个反例（前端赢了会怎样）。
3. 若把“离线写队列 + 重放”应用到笔记应用，幂等键必须存在哪一侧？为什么客户端自己记“这条发过了”不算？

---

## 六、拓展挑战（12 分，选做）

写一个 `deepEqual(a, b)`（**不用 lodash**），要正确处理：
- 基本类型 + `NaN`（`NaN` 与 `NaN` 相等）
- 数组顺序、对象顺序无关
- Date（按时间戳）
- RegExp（source + flags）
- Map / Set（成员判等，无序）
- Symbol 键
- 循环引用（WeakSet 记录）

**追问**：如何写 `deepEqual` 的**性能优化版**——遇到「两边是同一引用」直接 true 短路？

---

## 我的答案（作答区）

（待补）
