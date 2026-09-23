# node-queues-jobs 面试题精选

> 共 12 题，覆盖 定位与选型 / BullMQ 机制 / 可靠性设计 / 调度与定时 / 生产运维 五类。

---

## 一、定位与选型

### 1. 用户上传视频后要转码，为什么不能"请求里 await 转完再响应"？三个理由。

①转码几十秒到几分钟，HTTP 必超时；②占着连接与并发额度，10 个上传就能拖垮服务；③进程部署/重启，这次转码直接蒸发且无人知晓。正解：请求只做校验+落库+入队，秒回"已受理"，转码由 worker 消费（呼应 node-queues-jobs 第一节）。

**来源**：Node 后端通识；YouTube/TikTok 公开架构分享惯例

### 2. 队列和 worker_threads 都叫"worker"，怎么划清界限？

worker_threads 是**进程内线程**：解决"这一个请求里那段 CPU 密集计算卡事件循环"，任务随请求生灭、重启即丢。队列是**任务的基础设施**：持久化（Redis）、跨进程跨机器、重试/限速/调度/可观测。典型合体：队列 worker 进程内部再用 worker 池跑重计算（呼应 node-workers、node-queues-jobs 第一节）。

**来源**：Node.js 官方 worker_threads 文档；BullMQ docs

### 3. BullMQ vs 纯 node-cron vs 云托管（SQS/Cloud Tasks）怎么选？

有周期任务/重试/并发控制诉求且已有 Redis → BullMQ（Node 生态事实标准）；只是"本机每天跑一次、丢了无所谓"→ node-cron 够用；不想自运维队列/需要跨语言 → 云托管。三者模型同构（投递/消费/重试），转岗迁移成本低（呼应 node-queues-jobs 第一节选型表）。

**来源**：BullMQ — "Comparison / Why BullMQ"

---

## 二、BullMQ 机制

### 4. BullMQ 的任务有哪几种状态？生产环境怎么监控？

wait / active / delayed / completed / failed（另有 paused、wait-removed 等形态）。监控看三数：`waiting` 堆积长度（消费者够不够）、`failed` 增速（下游坏没坏）、active 持续贴顶（该扩容了）；图形化用 Bull Board/TaskForce。Redis 是全部状态的存储地——它挂了整个队列系统瘫痪，要高可用（呼应 node-queues-jobs 第二、五节）。

**来源**：BullMQ — "Job states"；Bull Board 项目文档

### 5. Flows（父子任务）解决什么问题？举个例子。

"三个子任务全部完成后才触发汇总"这种 DAG 依赖：生成月报 = 分别导出订单/财务/用户三份数据（并行子任务），都 completed 后父任务才进 active 做合并。没有 Flows 就得自己在 handler 里计数聚合，重启就丢计数（呼应 node-queues-jobs 第二节）。

**来源**：BullMQ — "Flows (Parent-Child)"

---

## 三、可靠性设计

### 6. "队列保证任务 exactly-once 执行"——这句话对吗？

错。BullMQ 默认 **at-least-once**：处理完成但锁确认前宕机，stalled 检测会把任务重投，副作用执行两次（发两封邮件、扣两次款）。exactly-once 投递在分布式里本就是幻觉，工程答案是**消费端幂等**：payload 带业务唯一键，处理前 `SET done:{key} NX EX` 占位或查已处理表（呼应 node-queues-jobs 第三节、09-express 幂等）。

**来源**：BullMQ docs — "At-least-once delivery"；Kafka 幂等消费者同源讨论

### 7. 什么是 stalled 任务？哪些代码行为会制造它？

worker 取任务后要对锁续约（看门狗）；进程假死/长 GC/同步阻塞导致续约饿死 → BullMQ 判 stalled、任务重投别处。最阴的情况：原 worker 其实还活着且继续执行完副作用，重投后再执行一遍——幂等 + 限制 handler 内同步重活（转投 worker_threads）双管齐下（呼应 node-queues-jobs 第三节）。

**来源**：BullMQ — "Stalled jobs / lock renewal"

### 8. 重试策略里最容易被忽略的设计点是什么？

**错误分类**。网络超时该退避重试；参数非法/业务规则拒绝属于"永久失败"，重试五次只是刷日志+打爆下游——在 handler 抛打标异常、`failed` 事件里识别后跳过重试（或利用 attempts=1），并送死信队列人工审。第二忽略点：重试风暴——下游正在故障，等间隔高频重试是补刀，务必指数退避+ jitter（呼应 node-queues-jobs 第三节）。

**来源**：AWS Builders Library — "Retries, timeouts, exponential backoff"

---

## 四、调度与定时

### 9. 默写 cron 表达式并解释：每周一至周五凌晨 3 点半。

`30 3 * * 1-5`（分 时 日 月 周）。坑位三连：①服务器 UTC 与业务时区差——node-cron 与 BullMQ repeat 都可指定 `tz`；②DST 切换夜同一小时跑两次/跳过一次；③"几月几日"与"星期"同时限定非 `*` 时是**或**关系（经典背诵题）（呼应 node-queues-jobs 第四节）。

**来源**：crontab(5) man page；node-cron — "Timezones"

### 10. setInterval(fn, 3600000) 做每小时任务，会出哪三档子事？

①漂移：定时器只保证"至少延后"，事件循环一堵就顺延，越跑越晚；②不对齐整点（启动时刻决定相位）；③进程重启归零，跨重启不补跑。cron 表达式是"日历对齐"语义，天然避前两条；第三条靠队列 repeat 把调度状态放 Redis（呼应 node-queues-jobs 第四节、node-event-loop）。

**来源**：MDN — "setInterval 注意事项"；Node 官方 timers 文档

### 11. 多实例部署（K8s 三副本）都注册了 node-cron 任务，怎么办？

三副本=三倍执行。方案分层：①首选把调度收敛进 BullMQ `repeat`——scheduler 状态在 Redis，只发一份；②独立部署单例 scheduler Deployment（只 1 副本，专职投递）；③无法上队列时抢外部锁（`SET cron:{name}:{slot} NX EX`，按时间槽占位，抢到才执行）（呼应 node-queues-jobs 第四节）。

**来源**：分布式定时任务通识；K8s CronJob 单实例语义对照

---

## 五、生产运维

### 12. 队列 worker 的部署与优雅退出，给出你的生产清单。

①web 与 worker 分 Deployment 独立扩缩（worker 按队列深度 HPA）；②SIGTERM → `worker.close()` 停止取新任务、等 active 完成 → 超时上限后退出并让 stalled 机制接管残余；③并发度 `concurrency` 显式设置并压测定，不能默认裸奔；④监控三数（waiting/failed/active）+ 告警阈值；⑤Redis 持久化（AOF）与高可用评估——它是单点（呼应 node-queues-jobs 第五节、node-deploy-perf graceful shutdown）。

**来源**：BullMQ — "Graceful shutdown"；12-Factor Process Model
