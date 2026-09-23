# vite-env 面试题精选

> 共 15 题，覆盖 **模式系统 / .env 加载 / 静态替换原理 / define / 安全 / 多环境实战** 六类。

---

## 一、模式系统

### 1. Vite 的 mode 和 Node.js 的 NODE_ENV 有什么关系？

Vite 6 中 `mode` 默认在 dev 时 = 'development'、build 时 = 'production' → **同步设置** `process.env.NODE_ENV`。自定义 `--mode staging` 时 NODE_ENV 也变 staging。可在 config 里覆盖：`define: { 'process.env.NODE_ENV': JSON.stringify('production') }`。

**来源**：Vite Env docs — "Modes"; Node.js — "process.env.NODE_ENV"

### 2. 同一个项目有 dev/staging/production 三环境，最简洁的配置方式是什么？

三个 .env 文件：`.env.development` / `.env.staging` / `.env.production`，写不同的 `VITE_API_BASE`。package.json scripts 对应：`"dev": "vite"`, `"build:staging": "vite build --mode staging"`, `"build": "vite build"`。

**来源**：Vite — "Production Deployment / Env Variables"

---

## 二、.env 加载

### 3. .env 文件里能引用另一个变量吗？

可以——dotenv 支持 **变量展开**（`${VAR}` 语法）：

```bash
DB_HOST=localhost
DB_URL=postgres://${DB_HOST}:5432/mydb
```

`DB_URL` 自动展开为 `postgres://localhost:5432/mydb`。Vite 用 dotenv + dotenv-expand 加载。

**来源**：dotenv-expand GitHub; Vite loadEnv docs

### 4. 命令行环境变量和 .env 文件谁优先？

**命令行优先**。`VITE_PORT=9999 vite` → `import.meta.env.VITE_PORT === '9999'`，即使 .env 里写 `VITE_PORT=3000`。同理 `process.env` 已有的值不被 dotenv 覆盖。

**来源**：dotenv docs — "does not override existing env vars"

---

## 三、静态替换原理

### 5. import.meta.env.VITE_FOO 为什么不能动态拼接访问？

```js
// ❌ 不能
import.meta.env['VITE_' + suffix]
// ✅ 能
import.meta.env.VITE_API_URL
```

Vite 做的是**编译时文本替换**——扫描源码找 `import.meta.env.VITE_xxx` 字面量 → 替换成实际值。动态表达式无法静态分析 → 替换不了 → 运行时 import.meta.env 只有 MODE/DEV/PROD/BASE_URL。

**来源**：Vite Env docs — "Dynamic keys won't work"; Rollup — "DefinePlugin" equivalent

### 6. 如果确实需要动态 env 怎么办？

两种方案：① 在 vite.config 里手动读 `loadEnv` → 通过 `define` 注入为 JSON 对象 `__ENV__: JSON.stringify({API_URL: '...'})` → 运行时 `__ENV__[key]`；② 用运行时全局变量（SSR 注入 `window.__INITIAL_ENV__`）。

**来源**：Vite define docs; StackOverflow — "dynamic env in vite"

---

## 四、define

### 7. define 替换和 Tree Shake 如何配合？

```js
define: { __DEV__: JSON.stringify(false) }
// 源码
if (__DEV__) { enableHotReload(); }
// 编译后
if (false) { enableHotReload(); }
// Rollup → 删除 if(false) 分支 → enableHotReload 死代码 → 摇掉
```

这就是为什么 `import.meta.env.DEV` 代码块在生产 bundle 中不存在。

**来源**：Vite define docs; Rollup Tree Shaking — "dead code elimination"

### 8. define 能替换 class 名或函数名吗？

不推荐。define 是纯文本替换——`__X__: 'MyClass'` → 每个 `MyClass` 出现处替换 → 可能误伤（如字符串里含 MyClass）。只对**全局常量标识符**使用。

**来源**：Vite define docs — "Caveats"

---

## 五、安全

### 9. 如何确保密钥不泄露到客户端 bundle？

1. 密钥变量**不加 VITE_ 前缀** → 不会暴露；
2. `vite build` 后 `grep -r "SECRET" dist/` 检查产物；
3. CI 加 `secretlint` / `gitleaks` 扫描；
4. 只通过 Vite proxy 转发带密钥的请求（密钥留在 Node.js config 内）。

**来源**：Vite — "Security"; OWASP — "Secrets in frontend apps"

### 10. .env.local 没加 gitignore 的后果？

真实密钥被 commit → GitHub 公开 → bot 爬取 → 数据库被入侵/AWS 账单爆炸。补救：立即换密钥 + `git filter-branch` 清历史。**预防**：项目初始化就写 `.gitignore` 含 `.env.local` / `.env.*.local`。

**来源**：GitHub Secret Scanning; dotenv README — "never commit .env"

---

## 六、多环境实战

### 11. Vite SSR 中 import.meta.env 和 process.env 的区别？

SSR 在 Node.js 运行 → 两个都能用。`import.meta.env.VITE_*` 仍然被静态替换（和客户端一样）→ 只有 VITE_ 前缀的能拿到。`process.env.SECRET` → SSR 代码里直接读（不进客户端 bundle → 安全）。**关键**：Vite SSR build 后 import.meta.env 仍然被 inline。

**来源**：Vite SSR guide — "Env variables in SSR"

### 12. 如何实现构建后仍可调 env（运行时环境变量）？

Vite 是编译时替换——构建后改不了。方案：① `window.__RUNTIME_CONFIG__` + 容器启动时 `sed` 替换 HTML 里 script 标签；② 启动时从后端接口 `/api/config` 拉 env；③ 用 Service Worker 注入。12-Factor 应用一般选方案 ②。

**来源**：Vite GitHub Discussions — "runtime env"; 12-Factor App — "Config"

---

## 补充（新专题 13-15）

### 13.  构建期常量注入（define/env）与运行时配置（接口下发/容器 env）的边界怎么划？各举一个用错层的事故。

判据一句话："改它要不要重新发布前端产物"——要重发的进构建期（特性开关固化、API 路径前缀这类与应用版本绑定的），不要重发的进运行时（接口下发配置、容器注入的 _app.js 引导脚本、k8s ConfigMap 生成 index 占位替换）。用错层的事故：① 构建期做运行时的事——镜像里焊死 API_BASE，同一镜像从 staging 提到 prod 连后端都换了还得重构建（"一次构建多处部署"破产，溯源链也乱）；② 运行时做构建期的事——密钥进了"运行时可配"结果被 fetch 打印/误发到客户端 bundle（envPrefix 那道墙是构建期的，运行时通道没有这保护）。混合形态（最稳的实践中答案）：构建产物全环境一致 + 运行时配置壳（启动时拉 /config.json 或注入 window.__CONFIG__），env 差异全收进配置服务；代价是首帧前多一次配置获取——要处理失败与默认值。加分句：能讲出"我们的镜像 digest 在四个环境完全相同，差异只有挂载的 config"这一句，这题就赢了——它证明你分清了不可变产物与可变注入两个世界。

**来源**：12-Factor 配置与构建分离；Vite define 文档；K8s 镜像复用实践

### 14.  前端泄露密钥的完整攻击面清单（不止 .env），以及工程化的堵漏手段。

攻击面全景：① 构建注入无过滤（早期 Vite 无 envPrefix 概念时全量 process.env 进 bundle；自定义 define 里塞了机密；loadEnv 第三参空串读了全部前缀再手滑 JSON 进产物）；② source 通道（sourcemap 里的原始代码含硬编码、console.log 未删（drop 配置）、错误上报平台带 env dump）；③ 仓库历史（.env.local 曾提交过——删文件不等于历史清除，gitleaks 全史扫描）；④ 运行时旁路（前端持有的"密钥"本就不该是机密——第三方可解包 SPA bundle 提取，API 设计要假设客户端无秘密）；⑤ 构建系统（CI 日志打印了 env、artifacts 里的中间产物）。工程堵漏：pre-commit + CI 双层 secret 扫描（gitleaks 规则进模板库）、Vite 的 define 白名单化（只允许 __VERSION__ 类枚举项）、构建后产物扫描（grep 密钥特征串/blocklist 匹配，命中 fail——呼应插件关的构建守卫）、上报平台配 PII/密钥脱敏与"敏感字段"过滤。认知纠偏：前端没有"保密"只有"暴露面管理"——任何配给前端的东西按公开设计；"这个 key 只能做 X 且额度 Y"的细粒度临时凭证（STS）才是正解。收口句：泄露治理的成熟度=扫描自动化+产物门禁+凭证设计三层各就位，缺一层都靠运气。

**来源**：GitGuardian 年报（前端密钥泄露占比趋势）；gitleaks 文档；OWASP 敏感数据暴露

### 15.  一个项目的模式体系（mode）失控了：dev/staging/beta/pre/test/gray… 十几个 .env 文件。你怎么治理？

病根诊断：mode 数量膨胀几乎总是"环境×渠道×用途"三维被压平成一维 mode 字符串（prod-cn、prod-sg、test-mock…组合爆炸）。治理三步：① 收敛正交轴——环境（dev/staging/prod，进 mode）与配置类别（密钥、地址、特性）分层：mode 管"连哪 world"，配置内容管行为，渠道/租户进运行时不进构建；② 每个 env 键登记制（schema 化：一个 zod 的 env 模块定义全键+类型+按 mode 的必填矩阵，启动/CI 校验，缺键的 .env 文件当场红）；③ 默认值折叠（.env 基座尽量全，mode 文件只放差异——diff 最小化让"staging 和 prod 到底差哪"一屏看清）。配套流程：新 mode 申请要回答"为什么现有组合表达不了"；发布系统注入而非文件承载（K8s env 覆盖 .env 的天然优先级已经给了标准答案，把文件数向 0 收敛才是终局）。加分句：mode 治理与配置中心是同一问题在不同规模下的形态——小项目 .env 文件卫生、中项目 schema 化、大项目运行时配置，路线图画出来面试官自然知道你带过不止一个项目。

**来源**：Vite 官方 Modes 文档；12-Factor 环境对等原则；知乎《我们的第 11 个 .env 文件》
