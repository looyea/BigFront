# Vite 环境变量与模式系统

> 目标：**精通 Vite 的 .env 文件体系、`import.meta.env` API、mode 机制、以及 define 编译时替换**；能在多环境（dev/staging/prod）项目中正确配置与使用。

---

## 一、模式（mode）概念

Vite 有两个内置模式：
- **development**：`vite` / `vite dev` 默认；
- **production**：`vite build` 默认。

自定义模式通过 `--mode` 指定：
```bash
# 目的：自定义模式—--mode 决定加载哪个 .env.[mode] 及 import.meta.env.MODE 的值
vite build --mode staging   # ✅ mode='staging' → 加载 .env.staging（而非默认 .env.production）
# ❌ 建了 .env.staging 却忘了 --mode staging → build 默认 production，只读 .env.production，staging 变量全不生效
```

mode 影响：加载哪个 `.env.[mode]` 文件 + `import.meta.env.MODE` 的值。

---

## 二、.env 文件加载规则

### 2.1 文件优先级（从低到高，后者覆盖前者）

```
.env                → 所有模式共用
.env.local          → 所有模式，gitignore
.env.[mode]         → 指定模式
.env.[mode].local   → 指定模式，gitignore
```

### 2.2 变量暴露规则

```bash
# 目的：变量暴露规则—只有 VITE_ 前缀才静态替换进客户端代码
# .env
VITE_API_URL=https://api.example.com   # ✅ 前端可读（VITE_ 前缀）
VITE_APP_TITLE=My App                  # ✅ 前端可读
DATABASE_URL=postgres://...            # ✅ 无前缀→仅 vite.config.ts/插件内可读，不进 bundle
SECRET_KEY=abc                         # ✅ 仅 Node.js 进程可读
# ❌ 把密钥写成 VITE_SECRET_KEY → 被编译进客户端 bundle，攻击者直接从 JS 里拿到
```

**只有 `VITE_` 前缀的变量**才被静态替换进客户端代码。无前缀的只暴露在 `process.env`（vite.config / 插件内部使用）。

### 2.3 特殊处理

- 变量值不能换行（用 `\n` 转义）；
- 值不需要引号（除非含特殊字符）；
- 已存在的 `process.env.VITE_*` 优先级最高（命令行 `VITE_FOO=bar vite build`）。

---

## 三、import.meta.env API

```js
// 目的：import.meta.env 内置变量一览—均为构建时静态替换，非运行时对象查找
// 内置变量
import.meta.env.MODE         // ✅ 'development' | 'production' | 'staging'
import.meta.env.DEV          // ✅ boolean（mode !== 'production'）
import.meta.env.PROD         // ✅ boolean（mode === 'production'）
import.meta.env.BASE_URL     // ✅ 配置的 base
// 自定义
import.meta.env.VITE_API_URL // ✅ .env 里定义的 VITE_ 变量
// ❌ 想动态拼键 import.meta.env[`VITE_${name}`] → 静态替换不支持动态访问，得到 undefined
```

### 3.1 编译时静态替换

`import.meta.env.VITE_API_URL` → 构建时直接替换成 `"https://api.example.com"` 文本。不是运行时对象查找——Rollup 能做 Tree Shake：

```js
// 目的：编译时静态替换—import.meta.env.DEV 被换成字面量，使 if(false) 整块被 Tree Shake 删除
if (import.meta.env.DEV) {
  // ✅ 生产构建时 → if(false) → 整块代码被删除，devtools 不打包
  enableVueDevtools();
}
// ❌ 将 DEV 存进变量再判断 const d=import.meta.env.DEV; if(d){...} → Rollup 难以静态判定，死代码删不掉
```

---

## 四、define 配置

### 4.1 与 env 的区别

| 维度 | `.env` (VITE_*) | `define` |
| --- | --- | --- |
| 暴露方式 | 静态替换 `import.meta.env.VITE_*` | 静态替换任意标识符 |
| 命名限制 | 必须 VITE_ 前缀 | 无限制 |
| 文件位置 | `.env` 文件 | `vite.config.ts` |
| 场景 | 多环境 URL/key | 版本号/feature flag/编译开关 |

### 4.2 用法

```ts
// 目的：define—静态替换任意标识符（无 VITE_ 前缀限制），值必须 JSON.stringify 成字面量
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),   // ✅ 字符串必须 stringify
    __ENABLE_DEVTOOLS__: JSON.stringify(true),                          // ✅ 布尔也 stringify
    'process.env.NODE_ENV': JSON.stringify('production'),  // ✅ 兼容依赖 process.env 的老代码
  }
})
// ❌ __APP_VERSION__: process.env.npm_package_version（不 stringify）→ 被当代码表达式插入，报 ReferenceError/undefined
```

```js
// 目的：使用 define 常量—编译后标识符直接变字面量（无运行时变量存在）
console.log(__APP_VERSION__);  // ✅ '1.2.0'（编译后 __APP_VERSION__ 就地替换为字面量）
// ❌ 在浏览器 DevTools 里想看 __APP_VERSION__ 变量→找不到，它不是真变量只是文本替换
```

**注意**：define 的值必须是字符串（`JSON.stringify`），否则被当代码表达式。

---

## 五、多环境实战

### 5.1 项目结构

```
.env                    # VITE_API_BASE=/api
.env.development        # VITE_API_TARGET=http://localhost:3001
.env.staging            # VITE_API_BASE=https://staging-api.example.com
.env.production         # VITE_API_BASE=https://api.example.com
.env.local              # （gitignore）开发者个人覆盖
```

### 5.2 scripts

```json
// 目的：多环境脚本—用 --mode 为 staging 单独出一条构建命令
"scripts": {
  "dev": "vite",                                          // ✅ development 模式
  "build:staging": "vite build --mode staging",            // ✅ 加载 .env.staging
  "build": "vite build",                                  // ✅ 默认 production
  "preview": "vite preview"
}
// ❌ 把 --mode staging 写成 staging build（参数位错）→ vite 把 staging 当 root 目录，构建失败
```

### 5.3 TypeScript 类型

```ts
// vite-env.d.ts
// 目的：给 import.meta.env 声明类型—补全 + 编译期拦截拼写错误
/// <reference types="vite/client" />   // ✅ 引入 Vite 客户端类型

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;        // ✅ 声明后访问此键有自动补全
  readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;           // ✅ 把 env 收窄为上面接口
}
// ❌ 不声明就 import.meta.env.VITE_API_BSE（拼错）→ TS 不报错也不补全，运行期静默 undefined
```

自动补全 + 编译时类型检查。

---

## 六、在 vite.config 中读取 mode

```ts
// 目的：在 vite.config 里读 mode—用 loadEnv 手动加载全量变量（含无前缀密钥），按模式条件装配
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '');  // ✅ prefix='' 加载所有变量（含无 VITE_ 前缀）

  return {
    plugins: [
      mode === 'production' && visualizerPlugin(),   // ✅ 仅生产启用分析插件
    ],
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),   // ✅ 注入构建时刻
    },
    server: {
      proxy: command === 'serve' ? { '/api': env.VITE_API_TARGET } : undefined,   // ✅ 只 dev 配代理
    },
  };
});
// ❌ 把 loadEnv 读到的无 VITE_ 前缀密钥再写进 define → 密钥被静态替换进客户端 bundle（泄露）
```

`loadEnv(mode, cwd, prefix)` 手动加载 .env → prefix='' 加载全部（含密钥）。

---

## 七、常见坑

### 7.1 为什么改 .env 后 dev server 不生效？

Vite 只在**启动时**加载 .env → 改了需**重启 server**（不会 HMR）。

### 7.2 为什么 import.meta.env.VITE_FOO 在浏览器里是 undefined？

检查：① .env 文件里是否拼写正确；② 是否有 `VITE_` 前缀；③ 当前 mode 是否匹配（.env.production 的变量在 dev 里加载不到）；④ 是否需要重启。

### 7.3 define 里能引用外部变量吗？

不能。define 做的是**文本替换**——`__X__: myVar` 会把 `myVar` 当**代码表达式**插入每个出现点。如果 myVar 不在全局 → 报错。安全做法：`JSON.stringify(value)` → 变成字面量。

---

## 八、安全实践

- **永远不把密钥放 VITE_ 前缀**（会被打进客户端 bundle）；
- .env.local 加 .gitignore；
- CI/CD 中用 Secrets 注入环境变量；
- `loadEnv(mode, cwd, '')` 读敏感变量只用于 vite.config 内部（proxy target / plugin option）→ 不暴露。

---

## 九、自检清单

- [ ] 开发时 process.env.VITE_FOO 和 import.meta.env.VITE_FOO 有什么区别？
- [ ] .env.staging 在什么时候被加载？
- [ ] define 的值为什么要 JSON.stringify？
- [ ] 改 .env 需要重启还是热更？
- [ ] 如何在 TypeScript 中获得 env 自动补全？
- [ ] loadEnv 和 import.meta.env 的区别？

---

## 🚀 部署预告

- **Dockerfile 多阶段**：`RUN VITE_API_BASE=https://api.example.com npm run build`；
- **运行时 env 注入**（12-Factor）：Vite 编译时替换 → 不能运行时改 → 用 `window.__RUNTIME_CONFIG__` 外挂 JSON 绕过；
- **Turborepo**：`turbo build --filter=web --mode production` → 各包各自 .env。

下一关进入 L3 构建优化。
