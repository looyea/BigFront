# exp-pagination 面试题精选

> 共 12 题，覆盖 **offset/limit / 游标 / 深分页 / 排序 / 过滤 / 索引 / 元数据** 七类。

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
