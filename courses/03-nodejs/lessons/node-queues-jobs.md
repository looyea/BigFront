# 任务队列与定时任务：BullMQ 与 cron

> 目标：把"不能塞进请求路径的活"请出去——发欢迎邮件、生成报表、转码视频、每晚清库。学会用 BullMQ（Redis 队列）做**可靠投递**（重试/幂等/并发控制），用 node-cron 做**定时调度**，并认清 `setInterval` 在多实例下的漂移与重复执行坑（呼应 node-event-loop 的阻塞之害、node-workers、09-express 的 Redis 实战）。

---

## 一、为什么重活不能留在请求里

Node 单事件循环：一个 3 秒的同步压缩能把所有请求停摆（node-workers 已治过一次）。但队列解决的不是"卡"，而是三件 worker_threads 管不了的事：

1. **削峰**：1000 个并发上传同时转码，worker 池会瞬间爆掉；入队后按消费能力平滑流出；
2. **跨进程/跨机器**：任务不隶属于接到请求的那个进程——web 进程生产、worker 进程消费，各自独立扩缩；
3. **可靠**：进程重启，内存里的 `setTimeout` 重试全丢；队列把任务持久化，失败自动重试、死了有 stalled 兜底。

选型速览：`setTimeout/setInterval` 只配"进程内、丢了无所谓"的轻量轮询；正经业务上 **BullMQ**（Node 生态事实标准，Redis 存储）；不想引入 Redis 的系统任务用 **node-cron** + 外部锁；云上托管版（SQS/GCP Tasks）思路同构。

## 二、BullMQ：队列的四块拼图

```js
// producer.js —— web 进程里，只管投递
import { Queue } from 'bullmq'
const emailQueue = new Queue('emails', { connection: { host: '127.0.0.1' } })
await emailQueue.add('welcome',            // 任务名
  { to: user.email },                      // payload（可序列化 JSON）
  { attempts: 5, backoff: { type: 'exponential', delay: 1000 },  // 1s→2s→4s→8s
    removeOnComplete: 100, delay: 0 }      // 完成只留最近 100 条
)
```

```js
// worker.js —— 独立进程，消费要显式声明并发
import { Worker } from 'bullmq'
new Worker('emails',
  async (job) => { await smtp.send(job.data.to) },  // throw = 交给重试
  { connection: { host: '127.0.0.1' }, concurrency: 5 }
)
```

四块拼图：**Queue**（投递）、**Worker**（消费）、**Jobs/States**（wait/active/completed/failed/delayed 五态可查）、**Flows**（父子任务 DAG：全部子完成才触发父）。Redis 是唯一状态存储——队列、锁、重试计数全在里面，所以 Redis 的高可用就是队列的高可用（呼应 09-express redis 持久化）。

## 三、可靠性：面试与事故的双重考点

- **at-least-once 是默认现实**：worker 处理完但确认前宕机 → 任务重投。"exactly-once"是幻觉，正确姿势是**消费端幂等**：payload 带业务唯一键（orderId），处理前先查"已处理表"或用 `SETNX done:{jobId}` 占位（与 09-express 幂等、vue-forms-validation 提交锁是同一条防线的全链路版）；
- **stalled 与锁看门狗**：worker 拿到任务会加锁续约；进程假死不再续约 → BullMQ 判定 stalled、把任务重投别的 worker。CPU 卡死的同步代码会饿死续约定时器——所以**阻塞代码进队列前先进 worker_threads**（两课合体）；
- **重试与死信**：`attempts` 指数退避；超限后任务留在 `failed` 态，可 `job.retry()` 手动重放或搬进死信队列人工审。重试要区分**可重试错误**（网络抖动）与不可重试（参数非法）——后者在 handler 里抛打标的"永久错误"异常并在 `failed` 事件里判断跳过重试（或把 attempts 设为 1），别让非法订单重试五次刷爆日志；
- **限速**：`limiter: { max: 100, duration: 60000 }` 队列级令牌桶，保护下游第三方 API 配额。

## 四、定时任务：delay、repeat 与 cron 的坑

```js
// 延迟与日历重复都交给队列，不必自己 setInterval
await emailQueue.add('digest', {}, { delay: 3_600_000 })               // 1 小时后
await reportQueue.add('daily', {}, { repeat: { pattern: '0 9 * * *', tz: 'Asia/Shanghai' } })  // 每天早上 9 点
```

- `repeat` 任务由 Redis 里的 scheduler 统一发放——**多实例部署 web 进程也不会重复触发**；自己 `node-cron` 写在 web 进程里，cluster 四个 worker 就是四倍执行（清库 cron 跑四遍是真实事故）；
- `setInterval` 的三宗罪：只补偿不漂移对齐（跑着跑着晚了）、事件循环一堵就顺延、进程重启全忘。node-cron 有表达式与时区但同样怕多实例——**调度尽量收敛进队列的 repeat**，或独立跑一个 scheduler 单例进程；
- cron 表达式 `0 9 * * 1-5`（工作日 9 点）要能现场默写；DST 切换夜有的分钟会执行两次，关键任务加执行记录表去重。

## 五、部署形态：worker 怎么活

- **进程分离**：web（快进快出）+ worker（长任务）两套部署，worker 可独立水平扩容——和 09-express 的"应用与 Redis 分家"同构；
- **优雅退出**：收到 SIGTERM 先 `worker.close()`（停止拉新任务、等 active 跑完），超时兜底 `queue.pause(true)` 防孤儿任务（呼应 node-deploy-perf 的 graceful shutdown——那里练的信号处理在这里复用）；
- **可观测**：Bull Board / TaskForce 给队列一个"监控后台"，堆积长度、失败率一屏看清——队列的 Prometheus 指标就是 `waiting/active/failed` 计数。

## 六、自检清单

- [ ] 说得出队列相对 worker_threads 多解决的三件事（削峰/跨进程/可靠）。
- [ ] BullMQ 四块拼图与任务五态能画出草图。
- [ ] 讲得清"exactly-once 是幻觉、幂等消费才是解"，并写出 SETNX 方案。
- [ ] stalled 看门狗机制 + "同步阻塞代码会饿死续约"的连锁反应。
- [ ] 知道多实例下 node-cron 重复执行的成因与 repeat/单例 scheduler 两个解法。

---

## 🚀 部署预告

- 队列消费幂等与 **vue-forms-validation** 的提交锁、**09-express** 的 requestId 去重是同一条防线的三层阵地；
- worker 进程独立部署 + Redis 高可用，进入 **09-express** 的部署章与 **node-deploy-perf** 的 Docker/信号处理联合剧本；
- CPU 密集任务"先进队列、再进 worker_threads"的组合拳，是 L6 四关（child_process→cluster→workers→queues）的收官答案；
- 队列监控与死信审批流在真实公司往往有现成平台——面试讲清机制比背产品名值钱。

本关为 L6 加餐。下一关进入 **L7 node-npm**：scripts、bin、依赖与 semver、lockfile——把"写代码"升级到"管包与工程"。
