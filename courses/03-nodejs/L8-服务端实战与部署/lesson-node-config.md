# 配置、环境变量与日志

> 目标：让同一份代码在 dev/staging/prod **不改一行**地跑起来，靠的是**配置外置**（12-Factor）与**结构化日志**。掌握 `process.env` / `process.argv`、**dotenv** 的用法与边界、**配置分层与校验**、**"密钥绝不写进代码"**、用 `console` 与**结构化日志**（pino）+ `debug` 模块做可诊断的生产观测（呼应 node-publish 私有 registry 的 `.npmrc`、下一关起进入部署）。

---

## 一、12-Factor：配置与代码分离

**配置**（数据库地址、端口、密钥、feature flag）**随环境变化**，应放**环境变量**而非代码/硬编码。理由：一次构建产物可部署到多环境；密钥不进 Git；改配置不用改代码重构建。Node 里配置的天然载体就是 `process.env`。

---

## 二、process.env 与 process.argv

```js
process.env.NODE_ENV        // "development" | "production" | "test"（事实上的环境开关）
process.env.PORT ?? 3000    // 全部是**字符串**！"8080" 不是 8080
process.env.DEBUG           // 见第六节
```

- **`process.env` 值永远是字符串或未定义**：`if (process.env.FEATURE_X)` 对 `"false"` 也成立（非空字符串 truthy）→ 要显式 `=== 'true'`；数字要 `Number(...)`；
- **`process.argv`**：`[node路径, 脚本路径, ...用户参数]`，`argv.slice(2)` 才是命令行参数（CLI 解析见下一关 node-cli）；
- `NODE_ENV` 影响很多库行为（Express 的 error 详情、日志级别），但**别把它当唯一配置**（12-Factor 主张各键独立）。

---

## 三、dotenv：本地注入，生产别依赖

`.env` 文件（**必须 gitignore**）+ `dotenv` 在启动时把键**写入 `process.env`**：

```js
// 尽早、在读取 env 之前加载（ESM 顶层 await 或 preload）
import "dotenv/config";                 // 最简：加载当前目录 .env
// 或显式：dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
```

- 只在**本地/无 secret 管理时**用；生产应由**平台注入**真环境变量（K8s Secret、系统 env、CI secrets），别把 `.env` 打进镜像（呼应 node-publish `files` 白名单、node-deploy-perf）；
- 提供默认值：`const port = Number(process.env.PORT ?? 3000)`；
- `node --env-file=.env app.js`（Node 20.6+）**内置**加载，无需 dotenv。

---

## 四、配置分层与校验（单一出口）

不要散落 `process.env.X` 到处读。**集中一个 `config.js` 出口**，分层合并 + 启动即校验：

```js
// config.js
import "dotenv/config";
const env = {
  port: Number(process.env.PORT ?? 3000),
  dbUrl: process.env.DATABASE_URL,           // 无默认=必需
  logLevel: process.env.LOG_LEVEL ?? "info",
  isProd: process.env.NODE_ENV === "production",
};
if (!env.dbUrl) throw new Error("缺少必需配置 DATABASE_URL");   // fail fast（呼应 node-async-errors）
export default Object.freeze(env);            // 冻结防误改
```

- **分层优先级**：默认值 < 配置文件 < `.env` < 真实环境变量 < 命令行参数（越具体越优先）；
- 复杂项目用 **envalid / zod / joi / convict** 做类型转换与校验，让"配置错误"在启动时立刻暴露，而不是运行时 NPE。

---

## 五、密钥管理：别写进代码/仓库/镜像

- API key、DB 密码、JWT secret **绝不硬编码**、不进 Git、不发进 npm 包（呼应 node-publish `files`）、不打进镜像层；
- 来源：平台 secret（K8s Secret / Vault / AWS Secrets Manager / CI secrets）注入为环境变量；
- `.env` 本地用、`.gitignore` 掉；仓库里放 `.env.example`（只有键名与占位值）作模板；
- **日志/错误里也别泄露**：别 `console.log(config)` 把 secret 打进日志（脱敏字段）；
- 定期轮换、最小权限（一个服务只拿它需要的密钥）。

---

## 六、日志：从 console 到结构化

`console.log` 适合本地，但生产要**结构化日志**（JSON 一行一条，可被 ELK/Loki 检索）：

```js
// pino
import pino from "pino";
const log = pino({
  level: process.env.LOG_LEVEL ?? "info",   // fatal/error/warn/info/debug/trace
  redact: ["req.headers.authorization", "password"],   // 自动脱敏（呼应第五节）
});
log.info({ userId: 42, sku: "A-1" }, "order created");  // 消息 + 结构化字段
```

要点：

- **分级别**、生产默认 `info`、排障临时 `debug`（避免刷屏 + 性能）；
- **打字段不打字符串拼接**：`log.info({user})` 而非 `log.info("user="+user)`，便于查询聚合；
- **到 stdout/stderr**，由平台收集（12-Factor：日志是事件流，别自己写文件轮转，呼应 node-deploy-perf）；
- 错误带**上下文与堆栈**（呼应 node-async-errors 的 `cause`）；给请求打 **correlation/trace id** 贯穿一条链（呼应 Express 中间件）。

---

## 七、debug 模块：可开关的调试日志

`debug` 包用命名空间 + 环境变量 `DEBUG` 精细开关，避免在生产留下 `console.log`：

```js
import debug from "debug";
const m = debug("app:db");     // 命名空间
m("query %s", sql);            // 仅当 DEBUG 匹配 app:* 时输出
// 运行：DEBUG=app:db node app.js     （设 env.DEBUG 才打印）
```

pino 也可用 `level` + `LOG_LEVEL` 达到类似"运行时不改动、按 env 开合"的效果。

---

## 八、自检清单

- [ ] `process.env` 的值类型有什么"坑"？布尔/数字怎么正确解析？
- [ ] dotenv 适合什么场景？为什么生产不该依赖 `.env` 文件？
- [ ] 配置分层的优先级是怎样的？为什么要"启动即校验、fail fast"？
- [ ] 密钥应从哪里来、绝不能出现在哪几处？日志如何脱敏？
- [ ] 结构化日志比 console.log 好在哪？级别怎么用、为何输出到 stdout？
- [ ] `debug` 模块解决什么问题？

---

## 🚀 部署预告

- `.env.example`、平台注入 secret、`npm ci --omit=dev` 只装运行依赖，都会在 **node-deploy-perf** 的 Dockerfile 里落地；
- "日志写 stdout 交给平台收集"与 **node-deploy-perf** 的容器日志/`pm2 logs` 一脉相承；
- 配置的命令行覆盖项，正是下一关 **node-cli** 要解析的东西。

下一关进入 **node-cli**：argv 解析、commander/yargs、stdin/stdout/stderr、exit code 与用 `bin` 发布一个命令行工具。
