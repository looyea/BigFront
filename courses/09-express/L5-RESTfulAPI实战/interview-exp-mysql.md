# 面试题 · MySQL 与 Node 服务端的接线

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）InnoDB 和 MyISAM 有什么区别？现在还有理由用 MyISAM 吗？**

- 参考要点：InnoDB 支持**事务、行锁、外键、崩溃恢复（redo log）、聚簇主键**；MyISAM 只有表锁、无事务、崩溃后需修复、支持 FULLTEXT（旧版）。写并发一上量 MyISAM 直接堵死。**唯一残留理由**：极老的系统、只读小表、或某些遗留导出工具的行为依赖。面试要能补一句"5.5 之后 InnoDB 是默认引擎"。
- 来源：MySQL Reference Manual《The InnoDB Storage Engine / MyISAM》。

---

**2）为什么推荐用 `prepare/execute` 而不是把参数拼进 SQL？除了防注入还有什么？**

- 参考要点：① 防注入（参数永远是值，不参与语法解析）；② 服务端可复用执行计划（同形状 SQL 只优化一次）；③ 免去类型/编码转义的心智负担（Date、Buffer、null 各有规则）。**追问**：预编译能防所有注入吗？→ 不能，**语法位置**（表名、列名、`ORDER BY`、`LIMIT`）不能用占位符，那类输入必须白名单校验。
- 来源：MySQL《Prepared Statements》；OWASP SQL Injection Prevention Cheat Sheet。

---

**3）`SELECT ... FOR UPDATE` 和 `SELECT ... LOCK IN SHARE MODE` 区别？怎么用得不过度加锁？**

- 参考要点：前者取**排他行锁**（写前读，别人不能改也不能再加排他锁），后者共享读锁（能读不能改）。正确姿势：只在事务里用（自动提交下 `FOR UPDATE` 拿到的锁立刻释放，等于没锁）；锁**有索引的列**才会行锁，无索引走全表 → 锁扫过的所有行（近似锁表）。**更优解常常是不要锁**：用条件更新（`UPDATE t SET qty=qty-1 WHERE id=? AND qty>0` 看 affectedRows）把判断压进一条语句。
- 来源：MySQL InnoDB 文档《Locks Sets Granted》；《InnoDB 高并发扣减》类工程文章共识。

---

**4）索引失效的常见原因，说出至少 8 条。**

- 参考要点：① 列上做函数/运算（`WHERE DATE(created_at)=...`）；② 隐式类型转换（字符串列传数字，或字符集/排序规则不一致的 JOIN）；③ 前导模糊 `LIKE '%xx'`；④ `OR` 连接非索引列；⑤ 不满足**最左前缀**（联合索引 `(a,b,c)` 只查 `b`）；⑥ `NOT IN / <> / IS NOT NULL` 使优化器放弃；⑦ `IN` 列表过大或范围条件之后再想命中后续列（范围列右侧断链）；⑧ 覆盖列太多导致回表成本高走全表；⑨ 统计信息陈旧（`ANALYZE TABLE`）；⑩ 表太小，优化器认为全扫更快。**追问**：怎么用 `EXPLAIN` 判断？看 `type`（ALL 最差）、`key`、`rows`、`Extra`（`Using filesort`/`Using temporary` 是警报）。
- 来源：MySQL Reference Manual《Optimizing Queries with EXPLAIN》《Use Indexes to Speed Up Queries》。

---

**5）覆盖索引、回表、索引下推分别是什么？**

- 参考要点：**回表**=二级索引命中后拿主键去聚簇索引取整行；**覆盖索引**=查询列全在索引里，无需回表（`SELECT id,title FROM t WHERE author=?` 且索引含 author,title）；**索引下推 ICP**（5.6+）=把 where 中可用索引列判断的部分下推到存储引擎层，在索引遍历时先过滤再回表，减少回表次数。三者串起来正好是一条优化深分页的思路。
- 来源：MySQL 官方 InnoDB 文档；《索引下推》相关工程解读。

---

**6）深分页 `LIMIT 1000000, 20` 为什么慢？三种改法。**

- 参考要点：MySQL 要真的扫过并丢弃前 100 万行（二级索引还会顺带 100 万次回表）。改法：① **游标/键集分页**：`WHERE id < ? ORDER BY id DESC LIMIT 20`（无 offset，稳定且快，口径见 exp-pagination）；② **延迟关联**：先用覆盖索引取出 20 个主键（`SELECT id FROM t ORDER BY ... LIMIT 1000000,20`）再 JOIN 回表；③ 业务侧禁止跳页，只给"下一页/上一页"。
- 来源：MySQL 性能社区共识；Percona《Tracking down performance problems with pt-query-digest / deep pagination》类文章。

---

**7）`utf8` 和 `utf8mb4` 的区别？为什么 emoji 存不进去？**

- 参考要点：MySQL 的 `utf8` 是**最多 3 字节**的历史实现（不含 4 字节码位），emoji / 部分生僻字是 4 字节 → 报 `Incorrect string value` 或被截断。必须用 `utf8mb4`，连接侧、表侧、列侧三层都要一致。附带坑：utf8mb4 下索引前缀字节数 ×4，`VARCHAR(255)` 建索引可能超 767（旧行格式）→ 降到 191 或调 `innodb_large_prefix`/DYNAMIC 行格式；排序规则选 `utf8mb4_0900_ai_ci`（8.0）还是 `utf8mb4_unicode_ci`（5.7 无 0900 系列）要按版本定。
- 来源：MySQL《Character Set Support / utf8mb4》；Percona 博客《Detecting Incorrect Character Sets》。

---

**8）一条 UPDATE 语句执行很慢，排查顺序是什么？**

- 参考要点：① `SHOW PROCESSLIST` / `performance_schema` 看是不是**被锁等**（`State: Waiting for lock`，1205/1213）；② 是不是**没走索引**导致锁范围扩大（`EXPLAIN` 看 type=ALL）；③ 是否触发大事务/长事务未提交（`information_schema.innodb_trx`）；④ 是否有全表 `ORDER BY` + filesort、临时表；⑤ 硬件/IO 与 `slow_query_log`（配 `long_query_time=0.5`、`log_queries_not_using_indexes`）；⑥ 是不是连接层面出问题（池打满、等待时间算进业务耗时）。**加分**：说清"锁等待"与"执行慢"的区分方法。
- 来源：MySQL《Slow Query Optimization》《InnoDB Locking / Lock Waits》；Percona《MySQL troubleshooting》。

---

**9）主从复制的原理与三种复制模式？延迟会带来什么业务问题？**

- 参考要点：binlog（主库记录）→ IO 线程拉到 relay log → SQL 线程回放。**模式**：异步（默认，可能丢）、半同步（至少一从确认收到，牺牲部分延迟换安全）、组复制/MGR（一致性更强）。**复制延迟**导致"写主读从读到旧数据"（用户下单后刷新订单页看不到）。应对：读走主库的关键路径、GTID + `WAIT_FOR_EXECUTED_GTID_SET`、"会话一致性"（同一用户读自己写过的位置）、或缓存兜底。**注意**：MySQL 默认复制是**按库/语句顺序**的，异构大并发写入才有并行复制（基于组提交）。
- 来源：MySQL《Replication》《Semisynchronous Replication》《Group Replication》章节。

---

**10）binlog、redo log、undo log 三者的分工？**

- 参考要点：**redo log**（InnoDB 引擎层，物理日志，WAL，崩溃恢复，保证持久性）；**undo log**（事务回滚与 MVCC 版本链，保证原子性与一致性读）；**binlog**（Server 层，逻辑归档，主从复制与时间点恢复）。提交时的**两阶段提交**（redo prepare → binlog fsync → redo commit）保证两份日志不互相矛盾。**追问**：为什么不能只留一份？→ 一份是崩溃恢复（引擎），一份是复制/归档（服务层，跨引擎）。
- 来源：MySQL《Redo Log Archiving / The Binary Log》；《两阶段提交》官方章节。

---

**11）`REPEATABLE READ` 下 MySQL 的隔离级别到底解决到什么程度？**

- 参考要点：InnoDB 默认 RR，通过 **MVCC（快照读）+ 当前读加锁 + 间隙锁（gap/next-key lock）** 解决脏读、不可重复读，并在很大程度上避免幻读（快照读看不到，当前读靠间隙锁挡住插入）。**追问**：RR 完全没幻读吗？→ 有边界（先快照读、再当前读、或别的事务已提交插入后再做当前读的场景），标准答案承认"工程上视为已防住，规范上不是完全可重复读序列化"。想彻底串行用 SERIALIZABLE。
- 来源：MySQL《Transaction Isolation Levels》《InnoDB Locking: Gap and Next-Key Locks》。

---

**12）连接池的 `connection_limit` 怎么定？为什么说"调更大可能更慢"？**

- 参考要点：账是 **副本数 × 每进程池 ≤ `max_connections` − 预留**（迁移、DBA、监控、脚本）。更大更快的错觉来自忽略 MySQL **每连接一线程**的模型：连接数超过 CPU 核数后是上下文切换与锁竞争上涨，QPS 反而下降；同时池过大更容易撞 `Too many connections`（此时新连接直接被拒，全站雪崩）。正解：小池 + 排队 + 前置代理（ProxySQL/RDS Proxy）做多路复用，并给 SQL 加超时（`max_execution_time`）。
- 来源：MySQL《Thread-Handling Architecture》《Connection Interface / max_connections》；AWS RDS Proxy / ProxySQL 文档。

---

**13）Node 侧连 MySQL 的两个经典事故：连接泄漏与空闲断连，分别怎么定位与修？**

- 参考要点：**泄漏**——借了 `getConnection()` 没在 `finally` 里 `release()`，或事务抛错路径没走到释放；表现为一段时间后所有请求挂起、`Threads_connected` 恒定在池上限。修法：try/finally（或用封装好的 helper）、Prisma 侧看 `$disconnect` 时机。**空闲断连**——`wait_timeout` 到期服务端单方面关闭，池拿着死连接，首个请求报 `PROTOCOL_CONNECTION_LOST`；修法：`enableKeepAlive`、缩短池内空闲存活、经代理回收、**幂等操作重试 + 退避**。加分：说清哪些操作可安全重试（SELECT、带幂等键的写），哪些不行（非幂等扣款）。
- 来源：mysql2 README（pool / keepAlive 选项）；MySQL《Wait Timeout / Interactive Timeout》；本关 `lesson-exp-mysql` §五。

---

**14）遗留库（已有几百张表）接 Prisma，你怎么落地？**

- 参考要点：`prisma db pull` introspection 反向生成 model → 人工修剪命名与关系（Prisma 需要显式关系字段才能享受类型安全）→ 建**只增不改**的迁移纪律（老表 DDL 交给 DBA 审批，用 `migrate resolve`/基线对齐避免历史打架）→ 无法表达的部分用 `view` + `$queryRaw` → 类型收口在 repository 层，不要把手写的 `any` 泄漏到业务代码。红线：不要在没备份、没回滚方案时对着生产跑 `migrate deploy`；迁移文件是代码，必须进版本库。
- 来源：Prisma 文档《Introspection / Managing Migrations》《Using raw SQL / Views》；本关 `exp-prisma` §三。

---

**15）现场题：给一个日订单 50 万的电商库，说出你的 MySQL 接线方案（连接、表设计、查询、备份、扩展）。**

- 参考要点（考察是否有整体观）：① **连接**：应用账号最小权限 + 内网/VPC + 强制 TLS；池按副本数算账，前置代理复用；② **设计**：主键用自增 BIGINT（局部性优于随机 UUID，二级索引不碎片化）、金额用 `DECIMAL(18,2)`（禁止 float）、字符集 utf8mb4、时间统一 UTC 存 DATETIME(3)、状态用枚举/TINYINT + 字典；③ **查询**：列表接口只走覆盖索引 + 游标分页，`SELECT` 明确列名，报表走只读从库；④ **写**：热点行（库存）单独拆表或用条件更新 + 队列削峰，避免长事务；⑤ **备份/恢复**：全量 + binlog 增量的时间点恢复，定期演练恢复（没演练过的备份等于没有）；⑥ **扩展**：先索引/读写分离/缓存，再垂直拆库，最后分库分表（分片键选择、跨片事务与聚合的代价），以及"什么时候干脆换 Postgres/上分布式 SQL"的判断线。
- 来源：阿里/字节等公开技术栈分享中的 MySQL 规约共识（如《Java 开发手册》SQL 规约章节的转述）；MySQL 官方《Optimizing InnoDB / Scalability》。
