# 浏览器本地数据库：localStorage / IndexedDB / OPFS

> 目标：把"数据到底放哪儿"这件事一次讲清——**内存态、浏览器持久层、服务端库、远程独立数据库**四层各自的位置与判据；IndexedDB 从建库到索引查询的真本事；封装层（idb-keyval / Dexie）怎么和框架的持久化中间件对接；容量与权限（`navigator.storage`）；浏览器里跑 SQL（sql.js / wasm SQLite + OPFS）能做到什么、做不到什么；最后一节给出**四大框架（Vue / React / Angular / Svelte）对接数据层的地图**，含"远程有一台独立 MySQL"时的完整链路。
>
> 呼应关：`es-structured`（结构化克隆是 IndexedDB 的存取代语）、`es-map-set`（Map/Set 能直接进 IDB，进不了 JSON）、`exp-prisma`（服务端关系库与类型安全查询）、`vue-pinia-advanced` §四、`za-persist-deep`、`tq-persist`、`ng-state-services` §四、`svelte-global-state` §三、`mp-cloud` 与 `interview-mp-storage`。

---

## 一、先画地图：四层数据，各管一件事

| 层 | 介质 | 活多久 | 能查吗 | 谁能看见 | 典型职责 |
|---|---|---|---|---|---|
| L0 内存 | `ref/state/signal/atom` | 到刷新为止 | — | 本页面 | UI 态、表单草稿 |
| L1 浏览器持久 | localStorage / sessionStorage / **IndexedDB** / OPFS | 到天~永久（看浏览器策略） | localStorage ❌ 只能按 key；IDB ✅ 索引/游标 | **本机本机浏览器**，同 origin 隔离 | 主题/字号、草稿、离线兜底、乐观队列 |
| L2 服务端存储 | 文件（JSON/Markdown）、Redis、对象存储 | 看运维 | 取决于实现 | 服务端进程 | 会话、缓存、上传件 |
| L3 独立数据库 | MySQL / PostgreSQL / Mongo | 永久 | ✅ SQL / DSL | 整个应用 | **业务事实源**：用户、订单、库存 |

一句判据：**「谁是事实源」决定它该放哪层**。凡"换个设备也得是同一份"的数据，属于 L3，浏览器只是缓存；凡"丢了也不该影响别人"的数据（主题、字号、面板宽度、本页草稿）才配待在 L1。

> **本平台的活样板**：主题与字号存 L1（`localStorage` 的 `bigfront.theme` / `bigfront.fs`，零延迟 + 首屏不闪）**并且**再存一份到 L2（后端 `data/appearance.json`）——因为 localStorage 按 origin（协议+主机+端口）隔离，dev 的 `:5173` 与 prod 的 `:3001`/`127.0.0.1` 互不相通，只靠浏览器就会出现"下次打开被调回默认"。学习进度则是 L2 的 `data/progress.md`（人能读能改，写入走临时文件 + 原子 rename）。这三个决定分别在 `web/src/themes.js`、`server/index.js`、本文 §六 有对应实现。

---

## 二、localStorage：好用的 KV，天花板也很明确

```js
// 目的：记住用户字号，并让另一个标签页跟着同步
// localStorage 是同步 API：读到的永远是字符串，写之前没人帮你序列化
const FS_KEY = 'bigfront.fs';
localStorage.setItem(FS_KEY, String(1.18));      // ✅ 写入后 FS_KEY === "1.18"（字符串，不是数字）
const fs = Number(localStorage.getItem(FS_KEY)); // ✅ 读回并转数字：fs === 1.18
const miss = localStorage.getItem('nope');        // ✅ 不存在的 key 返回 null（不是 undefined、不抛错）
if (miss === null) console.log('首次访问，用默认值');  // ✅ 判"没存过"只认 null

// ❌ 存对象直接传引用 → 落盘变成 "[object Object]"，读回来是字符串，解析炸
//    localStorage.setItem('cart', { a: 1 });
// ✅ 正确：显式 JSON 序列化，读回时再 parse（并包 try/catch 防历史脏数据）
localStorage.setItem('cart', JSON.stringify({ a: 1 }));   // ✅ 落盘 '{"a":1}'
const cart = JSON.parse(localStorage.getItem('cart') ?? '{}');  // ✅ cart = { a: 1 }

// ❌ 跨 tab 同步只能靠事件，且**同一页内的写入不会触发**（自己写的自己收不到）
window.addEventListener('storage', (e) => {
  if (e.key === FS_KEY) applyFs(Number(e.newValue));       // ✅ 别的标签页改了，这页跟着改；e 带 key/oldValue/newValue/url
});

// ❌ 循环引用 → JSON.stringify 抛 TypeError: Converting circular structure to JSON
//    （对象里有 parent 指回自己、或塞了 Vue ref / DOM 节点，都是这个下场）
// ❌ 配额写满 → localStorage.setItem 抛 QuotaExceededError（约 5MB，且是同步阻塞主线程的大文件写入）
```

三条硬限制，背下来：**① 只有字符串**（对象必须自己序列化，Date/Set/Map/函数全降级或蒸发，见 `es-structured`）；**② 同步 + 无查询**（只能按 key 整块读写，不能"找出 price > 100 的所有商品"）；**③ 约 5MB、可能被清**（Safari/Chrome 的 ITP 会对长期无交互的站点做存储驱逐，最长 7 天量级——真离线需求不能只靠它）。

---

## 三、IndexedDB：浏览器里真正的数据库

它不是"更大的 localStorage"，而是一个**面向对象的短路查询引擎**：库 → object store（相当于表）→ keyPath（主键）→ index（二级索引）→ transaction（事务）。存的是**结构化克隆**，所以 `Blob / File / ArrayBuffer / Date / Map / Set` 都能原样进去。

### 3.1 建库建表 + 写入

```js
// 目的：打开（或创建）一个笔记库，建 objectStore 与两个索引，然后写入一条记录
// open 的第二参是版本号：必须是整数，且只在"版本号变大"时触发 onupgradeneeded
function openNotesDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('notes-app', 1);

    req.onupgradeneeded = (ev) => {              // ✅ 首次打开（旧版本 0 → 1）就在这里建表建索引
      const db = req.result;                     // ✅ ev.target.result 与 req.result 是同一个 IDBDatabase
      if (!db.objectStoreNames.contains('note')) {
        const store = db.createObjectStore('note', { keyPath: 'id' });  // ✅ 以记录的 id 字段为主键
        store.createIndex('byAuthor', 'author');                        // ✅ 二级索引：按 author 查
        store.createIndex('byCreated', 'createdAt');                    // ✅ 按时间排序/范围查询用
      }
    };

    req.onsuccess = () => resolve(req.result);                          // ✅ 已有版本（2）打开时只走这里，不走上游
    req.onerror = () => reject(req.error);                              // ✅ 打开失败（磁盘、权限、被删除）走这里
    // ❌ 用版本 1 去开一个已经是 2 的库 → onerror 抛 VersionError（IndexedDB 不允许降级，只能升版本或删库）
  });
}

const db = await openNotesDB();

// 目的：一次事务里写两条记录（事务默认在"没有更多请求要排队"时自动提交）
const tx = db.transaction(['note'], 'readwrite');   // ✅ 事务模式：readonly（默认）/ readwrite / versionchange
tx.objectStore('note').put({ id: 'n1', author: 'lisa', createdAt: 1700000000000, text: 'hi' });  // ✅ put=有则覆盖无则插入
tx.objectStore('note').add({ id: 'n2', author: 'bob',  createdAt: 1700000001000, text: 'yo' });  // ✅ add=主键重复则抛 ConstraintError
// ❌ 主键 'n1' 再用 add → tx.onerror 触发，name === 'ConstraintError'（要"重复就更新"就用 put）
const done = await new Promise((res, rej) => {
  tx.oncomplete = () => res(true);   // ✅ 全部请求成功且提交完成
  tx.onabort = () => rej(tx.error);  // ✅ 任一请求失败 → 整个事务回滚，两条都不落地（原子性就在这）
});
// ❌ 只 await 单个请求的 onsuccess 就以为"已持久化" → 事务尚未提交，此刻崩溃/关页就丢
// ✅ 要拿返回值就读请求对象的 result：const got = tx.objectStore('note').get('n1'); got.onsuccess = () => use(got.result)
```

### 3.2 索引查询（这才是它区别于 KV 的地方）

```js
// 目的：查某作者的全部笔记，按创建时间倒序；再演示范围查询
const tx2 = db.transaction('note', 'readonly');
const store = tx2.objectStore('note');

const byAuthor = await new Promise((res) => {
  const r = store.index('byAuthor').getAll('lisa');   // ✅ 走索引取等值全部记录，不扫全表
  r.onsuccess = () => res(r.result);                  // ✅ 结果是一个数组（结构化克隆还原后的原对象）
});

const recent = await new Promise((res) => {
  // ✅ IDBKeyRange 四种：only / lowerBound / upperBound / bound；[a, b] 与 open 参数控制开闭区间
  const range = IDBKeyRange.lowerBound(1700000000000, false);   // createdAt >= 1700000000000（含边界）
  const r = store.index('byCreated').openCursor(range, 'prev');   // ✅ 'next'（默认，升序）/ 'prev'（倒序）/ 'nextunique' / 'prevunique'
  const out = [];
  r.onsuccess = () => {
    const cur = r.result;              // ✅ 游标每命中一条回调一次；cur 为 null 表示遍历结束
    if (cur) { out.push(cur.value); cur.continue(); }   // ✅ continue() 前进，"prev" 是倒序游标
    else res(out);
  };
});

// ❌ 想"按 author 过滤"却用 store.getAll() 再 .filter() → 全表载入内存再筛，索引白建了
// ✅ 多属性组合索引用**数组键**：store.createIndex('byAuthorCreated', ['author', 'createdAt'])
//    查询传 IDBKeyRange.bound(['lisa', 0], ['lisa', Infinity])（顺序必须与键数组一致）
```

### 3.3 最容易踩的一个坑：事务不能等异步

```js
// 目的：演示"事务里夹一个 fetch"为什么会炸
// ❌ 经典错误写法
const tx3 = db.transaction('note', 'readwrite');
const resp = await fetch('/api/price');          // 💥 事件循环转了一圈，事务早已自动提交/关闭
tx3.objectStore('note').put({ id: 'n3', price: await resp.json() });
// 抛：TransactionInactiveError: The transaction is inactive or finished

// ✅ 两条正路：
// ① 先把异步数据取完，**再开事务**（99% 的场景够用）
const price = (await fetch('/api/price')).ok ? 12 : 0;
const txA = db.transaction('note', 'readwrite');
txA.objectStore('note').put({ id: 'n3', price });

// ② 确实要在事务中 await：把 await 交给事务自己的对象（请求 promise 化），或直接用 Dexie 的事务包装
//    （Dexie 用自定义 zone 保持事务存活，见 §四）；原生 IDB 里 `await promiseOf(request)` 是安全的，
//    因为请求本身不会让事务闲置
```

> 顺带三个已知边界：① `tx.done`（等事务真正提交）目前只有 Chromium 系提供，跨浏览器要自己包 `oncomplete/onabort`；② `db.close()` 后再用旧 `db` 引用抛 `InvalidStateError`；③ 结构变更（加表/加索引）**只能**在 `onupgradeneeded` 里做，别的回调里 `createObjectStore` 抛 `InvalidStateError`。

---

## 四、封装层：别手写回调，用 idb-keyval 或 Dexie

```js
// 目的：把 IndexedDB 当"异步版 localStorage"用——idb-keyval 五行就够（存大对象、Blob、图片）
import { set, get, del, update } from 'idb-keyval';       // npm i idb-keyval（库名 keyval-store / 表名 keyval）
await set('theme', { name: '豆绿', fs: 1.18 });            // ✅ 键任意字符串，值任意可结构化克隆的东西
const t = await get('theme');                              // ✅ 返回 Promise；没有该键时 resolve(undefined)
await update('theme', (v) => ({ ...v, fs: 1.35 }));        // ✅ 读改写在一个事务里，省掉一次手写的原子性处理
await del('theme');                                        // ✅ 删除不存在的键也不报错（幂等）

// 目的：需要"查询"时上 Dexie——schema 一行、条件查询链式
import Dexie from 'dexie';
const db2 = new Dexie('notes-app');
// ✅ 字符串 schema：首项是主键（++ 表自增），其余是要建索引的字段，* 前缀=多值索引（数组每元素都可命中）
db2.version(1).stores({ note: 'id, author, createdAt, *tags' });
await db2.note.put({ id: 'n4', author: 'lisa', createdAt: Date.now(), tags: ['es', 'db'] });   // ✅ 数组字段照样入库
const list = await db2.note.where('author').equals('lisa').orderBy('createdAt').reverse().toArray();  // ✅ 走索引，不扫全表
const hit = await db2.note.where('tags').equals('db').toArray();        // ✅ 多值索引命中：tags 含 'db' 的都回来
await db2.transaction('rw', db2.note, async () => {                     // ✅ Dexie 事务：里面的 await 不会让事务闲置
  await db2.note.add({ id: 'n5', author: 'bob' });
  await db2.note.update('n4', { author: 'lisa2' });                     // ✅ 任一步 throw → 整段回滚
});
// ❌ db2.version(1).stores({ note: 'id' }) 后想按 author 查 → where('author') 抛"未定义该索引"
//    必须 version(2).stores({ note: 'id, author' })（IndexedDB 不能随时加索引，只能在 upgrade 里做）
```

**接框架的持久化层**（各包对应关有细讲，这里只给接线形状）：

```js
// 目的：zustand persist 换成 IndexedDB（大列表、图片 base64 早该离开 5MB 的 localStorage）
// 见 17-zustand 的 za-persist-deep
import { createJSONStorage } from 'zustand/middleware';
import { get, set, remove } from 'idb-keyval';
const idbStateStorage = {                       // ✅ zustand 的 StateStorage 接口只要这三个方法
  getItem: (k) => get(k) ?? null,               // ✅ 返回 Promise 即异步 storage；首帧会先给初始值
  setItem: (k, v) => set(k, v),
  removeItem: (k) => remove(k),
};
// create( persist((set) => ({...}), { name: 'cart', storage: createJSONStorage(() => idbStateStorage), version: 2, migrate }) )
// ⚠️ 换异步 storage 的代价：首屏读到的是初始值，真值在 onFinishHydration 后才到
//    —— 会闪一帧默认主题/空列表（SSR 水合不一致的同款根因，见 za-persist-deep、za-middleware）

// Vue：VueUse 的 useLocalStorage 够用；要异步就 useStorageAsync（背后即可插 idb-keyval）——见 vue-use-i18n
// Pinia：手动 $subscribe + idb-keyval 落盘最稳（见 vue-pinia-advanced §四），敏感 token 别落盘
// Svelte：$effect 里 snapshot 拍扁再写 IDB（见 svelte-effects-advanced、svelte-global-state）
// Angular：service 里包一层 Dexie/IDB，effect 触发写；SSR 端不存在 window.indexedDB，须判平台
```

---

## 五、容量与权限：先问浏览器能给多少

```js
// 目的：写大数据之前先看额度；并申请"别把我当缓存清掉"
const { usage = 0, quota = 0 } = await navigator.storage.estimate();   // ✅ 单位字节；quota 是浏览器给本源的配额（与磁盘相关）
console.log(`已用 ${(usage / 1048576).toFixed(1)} MB / 配额 ${(quota / 1073741824).toFixed(2)} GB`);

const persisted = await navigator.storage.persist?.();   // ✅ true = 申请到持久化，浏览器不再因空间压力随意驱逐本源
// ⚠️ 三个现实：① 不是所有浏览器都支持（Safari 没有）；② 是否需用户手势/权限提示各浏览器策略不同；
//    ③ 它只保证"不被启发式清理"，用户手动清站点数据照样没
// ❌ 把 persist() 当"数据一定不丢"的保证 → 真离线业务的权威必须在服务端（L3），本地只是缓存
if (quota && usage / quota > 0.9) await pruneOldestDrafts();           // ✅ 快满了先自己淘汰（按 updatedAt 删旧的）
```

同一节里另外两个成员：**`navigator.storage.getDirectory()`（OPFS，源私有文件系统）** 返回 `FileSystemDirectoryHandle`，能存任意二进制、按文件流式读写，比 IDB 存大 Blob 更省内存（wasm SQLite 的落盘后端就是它）；**Cache Storage** 给 Service Worker 存响应，属 PWA 专题（本套课暂未展开，口径见 `node-deploy` 的缓存分层）。

---

## 六、想在浏览器里跑 SQL：能，但先想清楚为什么

| 方案 | 存储后端 | 特点 | 适合 |
|---|---|---|---|
| `sql.js` | 内存（要自己 `export()` 落盘） | 整库读进内存，改完写出 Uint8Array | 小工具、纯计算、可接受"手动保存" |
| `wa-sqlite` / `absql` + **OPFS** | 源私有文件系统 | 真正的页面 SQLite，增量落盘，二进制体积大 | 需要 SQL 语法 / FTS / 复杂本地分析 |
| 后端 SQLite/MySQL + 前端调 API | 服务端 | 多端一致、可加索引与事务、可控权限 | **默认答案** |

```js
// 目的：sql.js 的"必须记得导出"这一条坑
import initSqlJs from 'sql.js';
const SQL = await initSqlJs();                  // ✅ 需要把 sql-wasm.wasm 路径配好（Vite 下常从 node_modules 复制）
const db3 = new SQL.Database();                 // ✅ 内存库：此刻一切都还不落盘
db3.run(`CREATE TABLE note (id TEXT PRIMARY KEY, title TEXT);
         INSERT INTO note VALUES ('n1','hello')`);  // ✅ 建表 + 插入，全在内存
const rows = db3.exec('SELECT * FROM note')[0].values;   // ✅ rows = [['n1','hello']]
// ❌ 只 new Database() 就以为刷新后还在 → 关页即丢；必须：
const bytes = db3.export();                     // ✅ 序列化为 Uint8Array
const handle = await navigator.storage.getDirectory();
const f = await handle.getFileHandle('notes.db', { create: true });
const w = await f.createWritable(); await w.write(bytes); await w.close();   // ✅ 自己写 OPFS
db3.close();                                    // ❌ 忘了 close → wasm 内存一直占着
// ⚠️ 另一条红线：sqlite-wasm 的 OPFS VFS 走 SharedArrayBuffer，页面需要 COOP/COEP（crossOriginIsolation === true）才能用；
//    纯 sql.js 方案不需要（细节以所选库文档为准）
```

一句话结论：**"我要 SQL 语法" 和 "我要本地存业务事实源" 是两件事**。后者请留在服务端；浏览器侧 SQL 适合纯离线小工具、本地全文检索、导入用户文件做分析。

---

## 七、四大框架对接数据层的地图（含"远程一台独立 MySQL"）

框架从不"直连数据库"——它们直连**你的 API**（全栈框架在服务器组件里可以直连，但也只在服务端那一侧）。所以链路永远是四段：

```
组件里的 state/store  →（框架的取数/持久化入口）→  HTTP/WebSocket  →  服务端 ORM  →  MySQL/Postgres/Mongo
        L0/L1                                                     L2/L3
```

| 框架 | 服务端数据（L3 消费口） | 客户端持久化（L1） | 直连数据库的可能位置 | 细讲关 |
|---|---|---|---|---|
| **Vue 3** | `useFetch`（Nuxt）/ TanStack Query(vue-query) / VueUse `useFetch`；Pinia action 里 fetch | Pinia `$subscribe` + `pinia-plugin-persistedstate`；VueUse `useLocalStorage` / `useStorageAsync` | 只有 Nuxt 的 **Nitro server route / `useAsyncData` 的同进程 handler** 能直连 Prisma（运行在服务端） | `vue-pinia-advanced` §四、`vue-use-i18n`、`vue-ssr-nuxt`、08-nuxt L4 |
| **React** | TanStack Query / SWR / RTK Query；RSC 里 `async` 组件直接查 | Zustand `persist`（可换 IDB）、Redux `redux-persist` | **Server Component / Server Action**（Next）里 `import { db }` 直连；客户端组件永远不该 | `react-data-fetching`、`za-persist-deep`、`tq-persist`、07-nextjs L4/L8 |
| **Angular** | `HttpClient` + `interceptor`；信号生态里的 `resource()`/`httpResource()`；NgRx Effects | service 里手写 effect 同步 / `@ngrx/store` 的 `store-devtools` + persist 库 | 没有"服务端组件"概念，**只能走后端 API**（SSR 也只是渲染，不给你直连库的语义） | `ng-http`（L5 表单与HTTP）、`ng-state-services` §四、`ng-signals`、`ng-ngrx` |
| **Svelte / SvelteKit** | `+page.server.ts` 的 `load`（SSR 侧）、`+page.ts` universal load、`form actions` | `$effect` + `snapshot` 写 localStorage/IDB（见 `svelte-global-state`） | **`+page.server.js` 的 load 与 `+layout.server.js`、API routes、hooks handle**——这些只在服务端跑，可直接 `import` Prisma | `kit-server-modules`（三判据）、`kit-form-actions`、`kit-internals`（building 守卫） |
| 附带两行 | SolidStart **Server Functions**（`'use server'`）里写库；小程序 **云开发数据库**端直连 + 安全规则 | Solid `createStore` 无内置持久化；小程序 `wx.setStorage`（10MB、无查询） | `solidstart-server-functions`、`mp-cloud`、`interview-mp-storage` |

**远程独立 MySQL 的最小正确链路**（每一段都有对应关，不在本节展开）：

```js
// ① 服务端：Prisma 指到远程 MySQL（连接串走环境变量，密码不进仓库）——细讲见 09-express exp-prisma
// prisma/schema.prisma
// datasource db { provider = "mysql"; url = env("DATABASE_URL") }   // ✅ mysql://user:pass@db.corp.example:3306/app
// ② Express：把表变成 REST——exp-rest / exp-validation / exp-pagination
app.get('/api/notes', async (req, res) => {                 // ✅ 只暴露窄接口：鉴权 + 校验 + 分页 + 选列
  const { cursor, take = 20 } = req.query;                   // ❌ 绝不把 req.query 直接展开进 where（注入面）
  res.json(await db.note.findMany({ take: +take, cursor: cursor ? { id: cursor } : undefined,
                                    select: { id: true, title: true } }));   // ✅ select 裁列，顺手防 N+1 与字段泄露
});
// ③ 框架侧：把"服务端数据"当缓存而不是自己的 state——TanStack Query / Nuxt useFetch / Kit load
//    ✅ 缓存键 = ['notes', cursor]；失效靠 refetch/invalidate；乐观改必配失败回滚
//    ❌ 把接口结果又复制一份塞进全局 store 再手工同步 → 两处事实源，早晚漂移（za-layers、sig-scenarios 的三层分工）
// ④ 安全账：数据库端口不公网暴露、只允许应用服务器 IP；前端永远拿不到连接串；
//    多实例要连接池（进程数 × connection_limit 不触 max_connections，见 exp-perf §四）
```

> 反模式三件套：① 在浏览器组件里 `import mysql2 / PrismaClient`（要么构建就失败，要么把密码打进公开 JS——`kit-project-structure` 那道"连接串被改成 static/public"的题就是它）；② 把 IndexedDB 当业务主存储、多设备各写各的，最后靠人工对齐；③ 用 localStorage 存 token（`vue-pinia-advanced` 与 `exp-security` 的红线：明文、可被 XSS 读走，该用 httpOnly cookie）。

---

## 八、离线优先的最小正确姿势（四步，缺一不可）

1. **本地写队列**：离线时 `put` 进 IDB 的 `pendingOp` store（带 `opId / entity / payload / localAt`），UI 立刻乐观反馈；
2. **重放与幂等**：`online` 事件或后台任务按 `localAt` 顺序 POST，服务端用 `opId` 去重（幂等键必须落库，别靠"客户端保证只发一次"）；
3. **服务端权威**：成功后用返回的 canonical 数据覆盖本地；失败分可重试（5xx/网络）与不可重试（4xx/校验）；
4. **冲突策略**：`updatedAt`/版本号比对——服务端更新则丢弃本地改动并提示；业务允许就合并（CRDT 或字段级 merge）。

```js
// 目的：冲突判定必须在服务端算，客户端只看结果
// ✅ 乐观锁：where 带读取时的 version，更新 0 行 = 被别人改过 → 前端拿 409 再拉最新重放
await db.account.updateMany({ where: { id, version: readVersion }, data: { balance: newBal, version: { increment: 1 } } });
// ❌ 客户端直接 POST"最终余额"（而非增量）→ 两个离线标签页各写一次，后写的把前者的扣款抹掉（丢失更新）
```

呼应：`pinia-optimistic` 的 `queue` + `$subscribe` 落 IndexedDB、`tq-persist` 的客户端缓存持久化、`mp-cloud` 的"弱网兜底 + 服务端权威"、`exp-auth` 的会话失效处理。

---

## 自检清单

- [ ] 说出 L0~L3 四层各管什么，"谁是事实源"这条判据怎么用。
- [ ] 能写 `onupgradeneeded` 建 store + 两个索引；说清为什么结构变更只能在这做。
- [ ] 解释 `await fetch()` 夹在原生事务里为什么抛 `TransactionInactiveError`，两条修法分别是什么。
- [ ] `put` vs `add`、`getAll` vs `index.openCursor`、`IDBKeyRange` 四种形态，各在什么时候用。
- [ ] 知道换异步 storage 后首屏闪默认值的根因与两种缓解（订阅 hydration 完成 / 关键偏好同步读 localStorage）。
- [ ] 会用 `navigator.storage.estimate()/persist()`，并说清 `persist()` **不**保证什么。
- [ ] 判断"要不要在浏览器上 SQLite"的两问：需要 SQL 语法吗？需要多端一致吗？
- [ ] 四大框架的取数入口与持久化入口各说出一个，并说清"框架不能直连远程 MySQL"为什么。
- [ ] 离线写队列四步能背下来，并解释幂等键为什么要落库。

---

## 🚪 下一站

- 服务端那一侧的真本事：**09-express** `exp-prisma`（schema/迁移/事务/连接池，含 **MySQL 分支**）、`exp-pagination`（游标与深分页）、`exp-testing`（`mongodb-memory-server` 不连真库）；
- 各框架的持久化接线：**16-pinia** `pinia-persist`、**17-zustand** `za-persist-deep`、**19-tanstack-query** `tq-persist`、**12-sveltekit** `kit-server-modules`、**15-angular** `ng-http`；
- 结构化克隆与序列化边界：本包 `es-structured`（`Proxy` / 函数进不了 IDB，会抛 `DataCloneError`）。
