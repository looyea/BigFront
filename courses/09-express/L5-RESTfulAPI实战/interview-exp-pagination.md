# exp-pagination 面试题精选

> 共 15 题，覆盖 **offset/limit / 游标 / 深分页 / 排序 / 过滤 / 索引 / 元数据** 七类。

---

## 一、Offset 分页

### 1. offset/limit 分页的原理和主要缺陷？

原理：`LIMIT n OFFSET m` → 取第 m 之后的 n 行。缺陷：① 深分页慢（DB 要生成并丢弃前 m 行，OFFSET 越大越慢，非直接跳转）；② 翻页期间数据变动导致结果漂移（重复/遗漏）；③ 依赖可变的行位置。适合数据量小、需要页码跳转的后台场景。

**来源**：PostgreSQL docs — "LIMIT / OFFSET"; use the index — "Painful fast OFFSET pagination"; MySQL — "pagination performance"

### 2. 有哪些办法缓解 offset 深分页性能问题？

① 覆盖索引 + 延迟关联（先在索引上取主键 `SELECT id ... LIMIT/OFFSET`，再 join 回表取详情）；② 限制最大可翻页码（禁止跳很深）；③ 改用游标分页；④ ES `search_after`；⑤ 大表 count 缓存/估算。根本解是让"跳过"变成"定位"。

**来源**：Percona — "efficient pagination / deferred join"; Elastic — "search_after"; StackOverflow — "mysql large offset"

---

## 二、游标分页

### 3. 什么是 keyset / cursor 分页？为什么它性能恒定？

记住上一页最后一条的排序键值（cursor），下一页用 `WHERE (a,b) > (cursorA,cursorB) ORDER BY a,b LIMIT n`。因为有 `(a,b)` 复合索引，DB 直接从索引定位到游标位置往后取 n 行，**不扫描被跳过的行** → 无论第几页成本恒定。也叫 seek / keyset 分页。

**来源**：Use The Index, Luke — "Keyset pagination"; Wikipedia — "Seek method / pagination"; PostgreSQL — "keyset pagination"

### 4. 游标分页为什么要求排序键组合唯一？不唯一会怎样？

游标靠"大于某排序值"定位，若排序值有并列（如多条同 createdAt），边界处会既大于游标的漏掉等于部分、又可能重复 → 数据翻重/遗漏。解决：追加一个唯一列（id）作最后排序键，构成全序 `(createdAt,id)`。

**来源**：Supabase — "cursor based pagination / tie breaker"; StackOverflow — "keyset pagination duplicate sort values"

### 5. cursor 该怎么编码/传递才安全？

用**不透明**游标（把排序键打包成 JSON → base64，或加密/签名），不暴露内部结构（防用户构造/篡改游标做注入或探测）。服务端解析时校验签名 + 字段。别直接用裸 `createdAt` 明文当 cursor。可加 `limit` 上限、过滤条件绑定进签名防越权改条件。

**来源**：Stripe API — "cursor pagination / starting_after opaque"; RFC 7515 — "JWS signed token"; OWASP — "unvalidated redirects / param tampering"

---

## 三、排序与过滤

### 6. 多字段排序 + 深分页时，索引要怎么建？

建**与排序完全一致的复合索引**：`ORDER BY createdAt DESC, _id DESC` → 索引 `{createdAt:-1, _id:-1}`。若还有等值过滤 `status=published`，按 ESR 原则把 Equality 放最前：`{status:1, createdAt:-1, _id:-1}`。顺序错或方向不匹配会导致索引无法用于排序 → 触发内存排序（SORT stage）变慢。

**来源**：MongoDB — "Compound Indexes / ESR"; MongoDB — "Sort with Index";use the index — "ORDER BY index matching"

### 7. 过滤参数如何防 NoSQL 注入？

不把用户输入当"对象"信任。攻击例：`?email[$gt]=` 若被 qs 解析成对象 `{email:{$gt:''}}` 直接进 `find()` → 匹配所有。防御：① 用 `.strict()`/类型校验只接受标量（zod 会拒绝对象）；② 显式 `String(req.query.email)`；③ 白名单允许字段；④ 对 `$where`/正则等特殊操作符零信任。

**来源**：OWASP — "NoSQL Injection"; MongoDB — "$where operator abuse"; acunetix — "NoSQL injection"

### 8. 大表模糊搜索用 `$regex`/LIKE '%kw%' 有什么问题？替代方案？

前置通配 `%kw%` 无法用 B-Tree 索引 → 全表扫描；用户可控正则不转义 → ReDoS（灾难性回溯 CPU 打满）。替代：全文索引（MySQL FULLTEXT、MongoDB Atlas Search / text index）、专业搜索引擎（Elasticsearch/Meilisearch/Typesense）、`pg_trgm` GIN 索引。至少转义正则元字符 + 限长度。

**来源**：MongoDB — "Regex performance / index usage"; PostgreSQL — "pg_trgm full text search"; OWASP — "ReDoS"

---

## 四、响应与元数据

### 9. 列表响应里 total/totalPages 有必要吗？大集合下怎么取舍？

后台表格要页码 → 需要 total。但大集合 `count` 很慢（全索引扫描）。取舍：① 只需无限滚动 → 去掉 total，用 limit+1 探测 hasNext；② 需要总数 → 缓存 count（定期刷新）或用 DB 估算（`estimatedDocumentCount`）；③ 显示"1200+ 条"而非精确值。别为不需要的精确 total 付 count 成本。

**来源**：MongoDB — "count performance / countDocuments vs estimated"; Atlassian — "pagination metadata"; UX — "showing total counts"

### 10. 分页接口要不要返回 links（next/prev URL）？

可选但推荐（尤其游标）。`links.next` 给下一个可直接请求的完整 URL（含 cursor）→ 客户端零拼接逻辑、不易错。JSON:API / GitHub API 都用 Link 头或 links 对象。offset 分页也适用。代价是响应略大。看团队 API 风格统一即可。

**来源**：JSON:API — "Pagination links"; GitHub REST — "Link header pagination"; RFC 8288 — "Link header"

---

## 五、综合设计

### 11. 设计一个 feed 流（社交动态）分页接口，你怎么选方案？

游标分页（无限滚动、量大、深翻）+ 排序键 `(createdAt, id)`（唯一全序）+ 不透明签名 cursor + limit 上限（如 50）+ hasNext（limit+1 探测不查 total）+ 对"关注列表"结果按作者做权限过滤（防看到不该看的）+ 热数据用缓存/预取前几页。游标绑定用户视角签名，防止拿别人 cursor 越权。

**来源**：Twitter API — "timeline pagination / cursor"; Instagram — "pagination cursors"; 系统设计 — "News Feed ranking/pagination"

### 12. 如何统一实现分页/排序/过滤逻辑，避免每个列表接口重复写？

抽公共层：① 通用查询 schema（zod，含 page/limit/sort/filters）；② 中间件解析成 `{skip, sortObj, mongoFilter}` 并做白名单 + 上限保护；③ 通用 service `paginate(Model, queryOpts)` 返回 `{data, meta}`；④ 各接口只声明"允许排序/过滤的字段集 + 默认值"。既 DRY 又安全（集中防护）。

**来源**：nestjs-paginate / express-paginate 库; Martin Fowler — "Helper / shared library"; 工程实践 — "通用 CRUD/分页封装"

---

## 补充（新专题 13-15）

### 13.  offset 分页在"内容卡片带实时价格/库存"的场景下还有哪些非性能问题？整体方案怎么设计？

非性能病灶：① 插入位移——别人发帖让你翻页重复/跳过（offset 是无锚点坐标，一致性靠运气）；② 可变字段参与排序（按价格排=每页快照都在重排，翻页序列不自洽）；③ total 失真——并发增删时"共 102 页"下一刷变 98 页，UI 承诺了给不起的确定性。方案设计：排序键选"入库即不变"的字段（created_at + id 复合游标），实时字段（价格/库存）只展示不参与排序；页大小固定（游标编码里带上 size 防中途改）；总数降级为"约 X+"（估算值）或干脆只给 hasMore（无限滚动 UI 与之一致）；管理后台要精确跳页的例外场景再开 offset 通道并限深（page*size 超阈值 400）。存储细节：MySQL 复合游标 where (price, id) < (?, ?) 需行值比较且配 (sort_col, id) 联合索引，MongoDB 用 _id tiebreaker；缓存列表页要缓存"渲染前原始数据"而不是拼好的页（实时字段渲染时现取）。收口句：这个题考的是"分页是产品交互还是数据遍历"——UI 上"无限下滑 + 回到顶部刷新"永远比"精确第 N 页"诚实。

**来源**：MySQL 官方 LIMIT/OFFSET 文档；Shopify Engineering《游标分页实践》；知乎《翻到第三页价格全变了谁背锅》

### 14.  一个列表接口既要支撑 Web 分页表格、App 无限滚动、还要导出全量——一套还是三套 API？

需求解剖：Web 表格要 offset 式页码跳转+total、App 滚动要游标+hasMore、导出要全量一致快照+不受分页协议束缚。一套硬扛的症状：为页码补的 total count 拖慢滚动热路径、导出的大 limit 挤占在线查询连接池。推荐拓扑：列表主接口按 AIP-158 风格双模（默认游标、管理后台白名单开 offset），导出独立成 LRO（202+job，快照隔离+流式写文件，绕开一切分页限制）——"导出是批处理任务伪装成的 API"，它要的是快照一致性（可复制库/时间戳快照）而在线列表要的是新鲜度，两者本不可同为一路。治理层共享：过滤/排序/权限谓词的构建函数一个模块（三处复用一处改），参数校验 schema 共享但各加各的上限（在线 100、导出无 limit 走队列）。演进路线：先拆导出（它是可用性风险源），再补游标（滚动体验），页码需求最后按"是否真有用户跳页"裁决——数据表明 99% 点击只在相邻页时，用 next/prev 链接就够。加分句：分页 API 设计的成熟标志，是"每个消费模式有一条按自身约束优化的路，且共享同一套谓词逻辑"。

**来源**：Google AIP-158（分页标准）；InfoQ《一个接口三种需求的演进史》；SegmentFault《导出把库拖慢之后我们拆了接口》

### 15.  深分页攻击（page=999999 或超大 limit 打穿数据库）怎么从协议、网关、数据库三层防？

协议层：limit 服务端硬顶（请求超限截断并文档明示）、offset 深度阈值（page*limit 超过 10 万返回 400 + 指引改用游标或收窄条件——把"不该做的操作"变成有教育意义的拒绝而不是慢查询）、游标模式天然免疫深偏移。网关层：接口级资源配额（列表类按用户/租户计"扫描预算"而不仅 QPS）、对异常翻页模式（秒级连续大页码递增）走 bot 识别通道。数据库层：慢查询日志自动抓 offset 大的样本告警、max_execution_time 语句级熔断（超 5s kill，防一个查询拖连接池）、深翻页的 SQL 改写模式（延迟关联：先覆盖索引查 id 再 join 取行，把大 offset 的回表成本砍半）、读写分离让翻页类只读流量走从库。诚实边界：三层都是"缓解"不是"消灭"——合法的深翻页需求（全站搜索第 800 页）本身就要在产品设计上消灭（搜索引擎场景给"前 N 页 + 收窄建议"，Elasticsearch 的 index.max_result_window 默认 1 万就是行业共识的表达）。收口句：这个题考"把性能问题翻译成协议设计"的能力：拒绝什么、为什么拒绝、拒绝时给客户端指什么路。

**来源**：OWASP API Security（BOLA/资源消耗）；MySQL 优化文档（延迟关联）；知乎《一条 limit=500000 的慢查询》
