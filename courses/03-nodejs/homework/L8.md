# L8 课后作业：服务端实战与部署

> 覆盖 **node-config / node-cli / node-deploy-perf** 三关。先读代码/找 bug，再动手写，最后场景与简答。环境：Node 20+、Docker。

---

## 一、读代码，找 bug / 预测（10 小题）

**1.** 这段配置读取有什么 bug？（提示：env 全是字符串）
```js
const config = {
  port: process.env.PORT || 3000,
  enableCache: Boolean(process.env.ENABLE_CACHE),   // 想让 "false" → false
};
```

**2.** 为什么把 `.env` 连同密钥一起提交到 Git 是严重问题？即便仓库私有？（呼应 node-config 第五节）

**3.** 这个 Dockerfile 片段有什么低效？
```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
CMD ["node", "server.js"]
```
> 指出至少三处（缓存顺序、dev 依赖、root/环境）。（呼应 node-deploy-perf 第一节）

**4.** 容器里 `docker stop` 要等满 10s 才被杀，且没有优雅收尾，最可能缺了什么？（呼应 node-deploy-perf 第二、三节）

**5.** 这段 CLI 有什么问题？
```js
if (!args.file) {
  console.log("缺少 --file");
  process.exit(1);          // 用户看到什么？退出码对不对？
}
```

**6.** `mycli | head -n1` 跑起来崩了并打印一堆堆栈，为什么？（提示 EPIPE，呼应 node-cli interview 第 8 题）

**7.** 这个进程"点关闭却不退出"，找两个可能原因。
```js
setInterval(() => tick(), 1000);
const watcher = fs.watch(dir, handler);
```

**8.** 生产 RSS 每小时涨一点、full GC 后不回落，最可能是哪类问题？怎么定位？（呼应 node-deploy-perf 第五节）

**9.** liveness 与 readiness 探针都写成"检查数据库连接"，会带来什么后果？（呼应 node-deploy-perf interview 第 12 题）

**10.** 日志用 `console.log("user=" + user.id + " req=" + req.url)` 为什么不好？生产应改成什么样？（呼应 node-config 第六节）

---

## 二、手写编程题（5 题）

**11.** 写一个集中式 `config.js`：`import "dotenv/config"` 后解析 `PORT`(Number)、`NODE_ENV`、`LOG_LEVEL`、必需项 `DATABASE_URL`；缺必需项时**启动即抛错**并打印清晰信息；导出 `Object.freeze` 的对象。（呼应 node-config 第四节）

**12.** 用 pino 建 logger：`level` 取 `config.LOG_LEVEL`、`redact` 掉 `password`/`authorization`；写一个请求中间件风格的 `logRequest({traceId, method, url, ms})` 输出结构化字段。（呼应 node-config 第六节）

**13.** 用 `commander`（或 `util.parseArgs`）做一个 `todo` CLI：子命令 `add <text>` / `list` / `done <id>`；结果走 stdout、错误走 stderr、失败设 `process.exitCode=1`；非 TTY 时自动去色。（呼应 node-cli 第三~六节）

**14.** 给第 13 题 CLI 加 shebang + `bin` 字段，`npm link` 后可全局敲 `todo`；再接受管道输入 `echo "买菜" | todo add -` 从 stdin 读。（呼应 node-cli 第二、四节）

**15.** 为一个 Express/http 服务实现**优雅退出**：监听 SIGTERM/SIGINT → `server.close()` → 等在途请求 drain → 关 DB → `exit(0)`，并加 10s 超时兜底 `exit(1)`；用 `docker stop`（或 `kill -TERM`）+ 压测验证不丢请求。（呼应 node-deploy-perf 第二节）

---

## 三、场景题（1 题）

**16.** 把一个 Express + SQLite/Postgres 的 Node 服务部署到 K8s，要求零丢包发布 + 可诊断。请给出方案：
- (a) 多阶段 Dockerfile 关键点（依赖缓存、`--omit=dev`、非 root、tini 作 PID1）；配置与密钥如何注入？（呼应 node-deploy-perf 第一、三节、node-config）
- (b) liveness / readiness 探针分别探测什么，为什么 readiness 才查 DB？（呼应 node-deploy-perf interview 第 12 题）
- (c) 滚动更新的零丢包：preStop sleep + `server.close()` drain + 超时兜底如何配合？（呼应 node-deploy-perf 第二节、interview 第 6 题）
- (d) 上线后 p99 偶发飙高，如何用事件循环延迟指标 + `--cpu-prof` 定位并决定"是否需要 worker_threads"？（呼应 node-workers、node-deploy-perf 第四节）

---

## 四、简答题（3 题）

**17.** 用 12-Factor 观点说明"配置与代码分离""日志是事件流"两条对本关三关的落地影响。（呼应 node-config 第一、六节）

**18.** `process.exit()` 与设 `process.exitCode` 的区别？容器里 PID1 直接跑 node 为什么要 tini？（呼应 node-cli 第五节、node-deploy-perf 第三节）

**19.** 列出你负责的 Node 服务的"生产就绪清单"至少 8 项，并标注每项对应本包的哪一关。（呼应 node-deploy-perf 第六节）

---

## 五、挑战题 🏆

**20.** 🏆 端到端工程化：把前面 L1–L8 的能力拧成一条流水线——
- 为一个含 **cluster 多核**（node-cluster）+ **worker_threads 处理一张重计算**（node-workers）的 API，编写：`config.js`（env 校验）、结构化日志（pino + trace id）、`node:test` 单元+集成测试并出 lcov（node-testing）、优雅退出（本关第 15 题）；
- 写多阶段 Dockerfile（依赖缓存、`--omit=dev`、非 root、tini、HEALTHCHECK）；
- 配 GitHub Actions：`npm ci` → `node --test --experimental-test-coverage` → 构建镜像 → 扫描 → 推 registry；
- 附一段说明：压测前后对比"事件循环延迟 / RSS / p99"，证明 worker 化把阻塞解决了（呼应 node-event-loop、node-deploy-perf 第四、五节）。
（这是 03-nodejs 全包的毕业实战。）
