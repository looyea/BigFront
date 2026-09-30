# 面试题 · 浏览器本地数据库与数据分层

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）localStorage / sessionStorage / IndexedDB / Cookie 有什么区别？分别适合放什么。**

| 维度 | Cookie | localStorage | sessionStorage | IndexedDB |
|---|---|---|---|---|
| 容量 | ~4KB | 约 5MB | 约 5MB | 按磁盘配额（数百 MB 起，`estimate()` 可查） |
| 生命周期 | 有 `Expires/Max-Age`，否则会话结束 | 持久，除非用户/浏览器清理 | 标签页关闭即清 | 持久，受驱逐策略约束 |
| 是否随请求发送 | **是**（每个同源 HTTP 请求都带） | 否 | 否 | 否 |
| API 形态 | 字符串（要自己编解码） | 同步 KV | 同步 KV | **异步 + 索引 + 事务** |
| 能否查询 | 不能 | 只能按 key 整块读 | 只能按 key | 能（index / IDBKeyRange / cursor） |
| 典型用途 | 会话凭据（httpOnly）、跨子域标记 | 主题/字号等偏好、小缓存 | 表单向导中间态、一次性提示 | 离线数据、草稿、大对象/Blob、写队列 |

- 参考要点：还要点出 **Cookie 的 origin 不含端口**（同主机的 3001 与 5173 共享 Cookie），而 **Web Storage 按 origin 隔离含端口**——这就是"换了端口，本地存的主题字号全丢"的原因，也是很多站点要把偏好再存一份到服务端的动机。
- 来源：MDN《Cookie》《Web storage》；HTML 标准 origin 定义。

---

**2）为什么说 localStorage 会"卡主线程"？配额超了抛什么错？**

- 参考要点：它是**同步** API，每次 `setItem` 都要完成序列化并落盘（不同实现时机不同，Safari 早期会在页面卸载时批量写），写大 JSON（几 MB）能观测到几十毫秒级阻塞；`getItem` 读大值同样有解析开销。**配额**按 origin 聚合，主流实现 5MB，注意是按 **UTF-16 字符 × 2 字节**算，中文实际只能存 ~2.5M 字符。超限抛 `QuotaExceededError`（Safari 早期叫 `DOMException: Quota exceeded`），且**是同步抛出**，不写成 try/catch 就会中断业务。
- **追问**：怎么安全写？答：try/catch + 淘汰策略（按 `updatedAt` 删最旧）+ 大对象改走 IndexedDB。
- 来源：MDN `Storage.setItem`；web.dev《Best practices for extending your app's storage quota》。

---

**3）`storage` 事件有什么坑？跨标签页同步怎么做。**

- 参考要点：事件**只派发给"其他"同源文档，写入方自己收不到**；只在同一 origin（含端口）内传播；隐私模式（旧 Safari）下会抛错。所以"本页改完立刻广播给本页"要自己调用一次本地应用函数，事件只负责别的页。要求更高时用 `BroadcastChannel`（同源、任意消息结构、不受"自己收不到"限制）。
  ```js
  // 目的：字号在 A 标签页改完，B 标签页立刻跟随
  // ✅ storage 事件只在别的页触发，e 上带 key/oldValue/newValue/url
  addEventListener('storage', (e) => {
    if (e.key === 'bigfront.fs') applyFs(Number(e.newValue));    // ✅ 直接应用，不再写一次 localStorage（会成环）
  });
  // ❌ 在事件回调里再 setItem 同一个 key → 又被别的页收到；虽然值相同不会无限循环，
  //    但多标签页互相回写会产生 N 次无意义事件，排查极痛
  ```
- 来源：HTML 标准《storage events》；MDN `StorageEvent`。

---

**4）IndexedDB 里为什么"事务里不能 await 异步"？报错叫什么，怎么修。**

- 参考要点：IDB 事务是**主动（active）→ 闲置即自动提交**的模型：只要事件循环里没有该事务排队的请求，浏览器就认为你干完了，事务转 inactive。`await fetch()` 让事件循环转了一圈，事务早就关了，再操作对象存储抛 **`TransactionInactiveError`**（有时表现为 `TransactionError`/事务 abort）。修法两条：① **先取完异步数据，再开事务**（绝大多数场景）；② 事务内只 await **IDB 请求自身**的 promise（请求不会让事务闲置），或用 Dexie 这种自带事务 zone 的封装（`db.transaction('rw', ...)` 里的 await 被它接管）。
- **追问**：`tx.done` 与 `tx.oncomplete` 的区别？→ `oncomplete` 表示已提交；`tx.done` 是较新的 promise 形态（且能区分 abort/error），Chromium 支持较全，跨浏览器要自己包。
- 来源：MDN《IndexedDB API > Transactions and the event loop》；w3c/IndexedDB issue 讨论。

---

**5）IndexedDB 的 index、复合索引、多值索引分别怎么用？怎么分页。**

- 参考要点：`createIndex(name, keyPath, {unique, multi})`；`multi: true` 让数组字段每个元素都可命中（`where('tags').equals('db')`）；复合索引用数组键 `createIndex('byAB', ['a','b'])`，查询时范围也要按同序数组给：`IDBKeyRange.bound(['lisa',0], ['lisa',Infinity])`。**分页**用游标：`store.index('byCreated').openCursor(range, 'prev')` + `cursor.advance(n)` 或 `openCursor(range, 'prev', 'readline')` 配 `count`；比 offset 深扫更省。**没有 JOIN**：关联靠"取回主键列表再 `getAll`"或冗余存储（一次事务多 store）。
- 来源：MDN `IDBObjectStore.createIndex`；Dexie 文档《Compound keys / MultiEntry index》。

---

**6）哪些值存不进 IndexedDB？抛什么错。**

- 参考要点：走**结构化克隆**，因此函数、Symbol（作值）、DOM 节点、Proxy/带拦截器的对象、`Error` 的部分字段、已分离（detached）的 ArrayBuffer 都不行，报 **`DataCloneError`**；类实例能进去但**原型链丢失**（取回是普通对象，`instanceof` 失效）——和 `structuredClone` 同一套规则。Vue 的 `ref` 对象、DOM 引用直接塞进去就是这个下场，要先 `.value` / `toRaw` / `snapshot` 拍扁。
  ```js
  // 目的：把框架里的响应式状态存进 IndexedDB
  import { snapshot } from 'svelte';           // Svelte 5 的 snapshot；Vue 用 toRaw + 手工脱 ref
  await store.put(snapshot(pageState));        // ✅ 纯数据快照，可克隆
  // ❌ await store.put(pageState) → DataCloneError（Proxy 不可克隆）或存进一堆内部字段
  ```
- 来源：HTML 标准《Structured clone》；MDN `DataCloneError`；Svelte 5 文档《snapshot()》。

---

**7）两个标签页，一个用版本 2 打开着库，另一个 `open(name, 3)`，会发生什么？怎么处理。**

- 参考要点：后者触发 **`blocked`** 事件并一直等待前者关闭；前者会收到 **`versionchange`** 事件。不处理就会"新版本永远打不开"。标准做法：老页监听 `versionchange` → `db.close()`（或提示用户刷新）。这也是**不要在页面里长期持有 db 引用**、以及移动端"升级结构要发版"的原因。
  ```js
  const req = indexedDB.open('notes-app', 3);
  req.onblocked = () => console.warn('老标签页占着库，等待其关闭');   // ✅ 给用户可感知的提示
  // ✅ 每个持有 db 的页面都要写这一句，否则升级永远卡住
  db.onversionchange = () => { db.close(); promptReload(); };
  ```
- 来源：MDN《IDBDatabase: blocked event / versionchange event》。

---

**8）OPFS 是什么？和 IndexedDB 怎么分工？为什么说"同步 API 只能在 worker 用"。**

- 参考要点：`await navigator.storage.getDirectory()` 拿到**源私有文件系统**根目录，能按文件流式读写任意二进制（`createWritable` / `getFileHandle`）。`FileSystemSyncAccessHandle`（同步 read/write，性能最好）**只能在 Dedicated Worker 里 `createSyncAccessHandle()` 获得**，主线程拿不到——所以 SQLite-wasm 这类方案都是"worker 里跑库 + 落 OPFS"。分工：**要查询/事务 → IndexedDB；要连续大二进制/自建索引/跑 wasm SQL → OPFS**；大 Blob 存 IDB 也能，但整块进出内存，OPFS 可以流式。
- 来源：MDN《Origin Private File System》；web.dev《A storage future: the Origin Private File System》；SQLite Wasm 官方文档（OPFS VFS）。

---

**9）浏览器会偷偷清掉本地数据吗？怎么申请"别清我"。**

- 参考要点：会。① 存储压力驱逐；② **ITP/衰减策略**——Safari 对 7 天无交互的站点清走前端存储，Chrome 也对低交互站点做 partition/清理；③ 用户手动清站点数据；④ 无痕模式页面关闭即清。`navigator.storage.persist()` 申请持久化存储（**Safari 不支持**，各浏览器是否需要用户手势/自动授予策略不同），`estimate()` 看 usage/quota。**红线**：`persist()` 只保证"不被启发式清理"，**不保证不丢**，业务事实源必须在服务端。
- 来源：MDN `StorageManager.persist/estimate`；web.dev《Best practices for extending your app's storage quota》。

---

**10）前端能直连 MySQL 吗？为什么？正确链路是什么。**

- 参考要点：**不能**。① 浏览器只有 HTTP/WebSocket 出站能力，MySQL 是 TCP 上的二进制协议，没有 `connect(host, 3306)` 这种 API；② 就算用 wasm 编一个客户端，也没有用户可信的 TLS 链与凭据来源——把 `user/pass/host` 写进前端等于**把钥匙印在公开 JS 里**，devtools 一屏就读完；③ 连接池、事务隔离、权限模型都无从谈起。正确链路：`组件 → 服务端 API（Express/Nitro/Kit load/RSC）→ ORM/驱动 → 内网 MySQL`。全栈框架里 Next Server Component、SvelteKit `+page.server.js`、Nuxt Nitro route 确实**可以直连库**，但那些代码**跑在服务器**，且必须保证不被打进客户端 bundle（`import` 到客户端组件里构建期就该报错）。
- **追问**：`runtimeConfig.public` 与私有的区别？→ Nuxt 里非 public 键不会下发客户端；写错位置就等于泄露连接串（同类题：`NEXT_PUBLIC_` 前缀）。
- 来源：MySQL 协议文档；MDN《Fetch》；Prisma/Next.js 官方 "Database connections" 指南。

---

**11）sql.js 和 wa-sqlite + OPFS 各自适合什么？有什么硬限制。**

- 参考要点：`sql.js` 是**内存库**，改完必须 `db.export()` 自己落盘（写文件/IndexedDB/OPFS），忘了就是"刷新全没"；适合小工具与可接受手动保存的场景。`wa-sqlite`/官方 `sqlite-wasm` + **OPFS VFS** 做真增量落盘，但 OPFS VFS 依赖 `SharedArrayBuffer`，页面必须**跨源隔离**（COOP/COEP，`crossOriginIsolated === true`），这会牵动第三方资源加载策略。两者都别指望"多端一致"——那是服务端库的职责。
- 来源：sql.js README；SQLite 官方《WebAssembly build / OPFS VFS》；MDN《SharedArrayBuffer 与跨源隔离》。

---

**12）"离线优先"的写队列怎么设计？为什么幂等键必须服务端落库。**

- 参考要点：四步——① 本地把操作写进 IDB 的 pending 队列（`opId / entity / payload / localAt`），UI 立即乐观反馈；② 上线后按序重放，服务端用 `opId` 去重；③ 成功后用服务端返回的权威数据覆盖本地；④ 冲突按 `version/updatedAt` 判定（服务端新 → 丢弃并提示；可合并 → 字段级 merge 或 CRDT）。**幂等键必须服务端存**的原因：客户端"只发一次"不可信（重试、页面刷新、多标签页、断网重连都会重发），去重只能在**唯一写入点**做；且服务端要存最近 `opId` 集合（唯一索引 + 定期归档）才能挡住重放。
  ```sql
  -- ✅ 落库的幂等键：唯一约束让重复插入直接失败，业务据此返回"已处理"
  INSERT INTO ops (op_id, ...) VALUES (?, ...);   -- op_id 上有 UNIQUE 索引
  -- ❌ 只在客户端记"这条我已经发过了" → 换设备/清缓存/并发标签页全部失效
  ```
- **追问**：丢失更新怎么防？→ 乐观锁（`update ... where id=? and version=?`，0 行 = 冲突返 409），别把"最终值"从客户端提交，提交**增量**或提交**意图**。
- 来源：MDN《Background Sync》；Google《Offline Foundations》；HTTP 幂等性语义（RFC 9110 §9.2.2）。

---

**13）四大框架的状态持久化各自踩过什么坑？**

- 参考要点（按框架各说一条，能举出迁移函数最好）：
  - **Vue/Pinia**：`$subscribe` 里直接 stringify 带 `ref` 的状态会报错或存进内部字段；SSR 场景必须**只在客户端读回**（服务端拿到用户私有数据 = 串号事故）；`pinia-plugin-persistedstate` 要配 `pick` 白名单。
  - **React/Zustand**：`persist` 换异步 storage（IDB）后首帧渲染的是初始值 → 主题闪一下；用 `onRehydrateStorage`/`finishHydration` 或**关键偏好仍走同步 localStorage**。`version` + `migrate` 处理老数据结构，否则用户带着旧 state 撞新代码。
  - **Angular**：没有内置持久化，通常在 service 里订阅 state 写 IDB；**SSR（Angular Universal）里没有 `window.indexedDB`**，必须判平台，否则服务端渲染直接崩。
  - **Svelte/SvelteKit**：`$effect` 写 localStorage 要 `snapshot` 脱响应式；SSR 侧只能在 `+layout.server.ts`/`+page.server.ts` 读 cookie 做"服务端也知道的主题"，客户端偏好与水合时序要错开。
- 来源：Pinia 官方《 SSR 与插件》；zustand `persist` 文档（`createJSONStorage`/`onRehydrateStorage`）；Angular Universal SSR 文档；SvelteKit `load` 与 cookie 文档。

---

**14）token 存 localStorage 为什么被喷？该存哪？**

- 参考要点：localStorage 里的 token 任何 XSS 脚本都能一行读走并长期重放（同源 JS 全可读、无 HttpOnly 保护）；而放 `HttpOnly + Secure + SameSite=Lax/Strict` cookie 后脚本读不到，但要用 CSRF 防护补上。折中主流答案：**refresh token 走 httpOnly cookie（路径收窄、服务端可撤销），access token 只放内存**（短 TTL，配合刷新），别进持久化存储。附带：敏感数据不落本地是通则（`vue-pinia-advanced`、`exp-security` 同口径），必须落也要考虑加密与设备共享风险。
- 来源：OWASP《Session Management Cheat Sheet》《HTML5 Security Cheatsheet》；OAuth 2.0 BCP（浏览器端最佳实践）。

---

**15）现场设计题：一个"离线可写、多端一致"的笔记应用，说出每一层放什么。**

- 参考要点（分层清楚 + 说出判据）：① **内存态**：当前编辑缓冲区、UI 态；② **L1 浏览器**：草稿与待同步操作队列（IndexedDB，含 `note` store + `pendingOp` store + 按 `updatedAt` 的索引），UI 偏好（localStorage，零延迟避免首屏闪）；③ **服务端**：API + 独立数据库（MySQL/Postgres）为**唯一事实源**，`version` 字段做乐观锁，操作表做幂等；④ 同步：`online`/后台任务重放、增量提交、冲突走服务端权威 + 提示；⑤ 容量：`estimate()` 到 90% 先淘汰已同步的旧草稿，永不淘汰未同步操作（改提示"空间不足，请联网同步"）；⑥ 迁移：IDB `onupgradeneeded` 版本链 + 前端 state 的 `migrate`。**加分项**：说清"为什么主题字号可以放心只放浏览器，而笔记正文不行"。
- 来源：综合本题 §1/§4/§8/§12 所列文档；本关课文 `lesson-es-local-db.md`（四层数据地图与本平台的 appearance 双层记忆实现）。
