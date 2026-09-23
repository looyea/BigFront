# vite-env 面试题精选

> 共 12 题，覆盖 **模式系统 / .env 加载 / 静态替换原理 / define / 安全 / 多环境实战** 六类。

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
