# node-path-url 面试题精选

> 共 12 题，覆盖 **path 语义 / __dirname 与 cwd / ESM 路径 / file URL 互转 / WHATWG URL 解析 / os 与跨平台 / 安全** 七类。

---

## 一、path 语义

### 1. `path.join` 和 `path.resolve` 有什么区别？分别适合什么？

`join` 把若干段用平台分隔符拼起来，再 `normalize`（消解 `.`、`..`、多余分隔符），**结果可能仍是相对路径**：`join('a','..','b')` → `'b'`。`resolve` 从**右往左**拼，遇到第一个绝对路径就停，最终以 `cwd`（或那个绝对段）为锚，**一定返回绝对路径**：`resolve('src','x.js')` → `<cwd>/src/x.js`。经验：**"要绝对、确定的落盘路径"用 resolve；"纯相对拼接"用 join**。

**来源**：Node.js — "path.join vs path.resolve"

### 2. `path.normalize` 会碰文件系统吗？`path` 模块整体是纯字符串操作吗？

`path` 模块（除极少数外）是**纯字符串/语法处理，不访问文件系统、不检查路径是否存在**。`normalize('a//b/../c')` → `'a/c'` 只是按规则折叠，哪怕 `b` 根本不存在也照样算。要知道"是否真存在/是不是目录"必须问 `fs.stat`（呼应 node-fs）。这点常被误解——`path.resolve` 给出的绝对路径也**不代表它存在**。

**来源**：Node.js — "path module (no I/O)"

---

## 二、__dirname、cwd 与 ESM

### 3. `__dirname`、`__filename` 和 `process.cwd()` 三者区别？为什么定位脚本自身资源别用 cwd？

- `__filename`：当前**文件**的绝对路径；`__dirname`：它的**目录**（由模块包装函数注入，呼应 node-modules）。
- `process.cwd()`：**进程启动时的工作目录**，随"你在哪个目录敲 `node`"或 pm2/systemd 配置而变。
定位"我这个库自带的模板/config 文件"必须用 `__dirname`（文件在哪、恒定），用 `cwd` 会因启动目录不同而 ENOENT（呼应 node-fs 第 12 题）。

**来源**：Node.js — "__dirname vs process.cwd()"; 社区 — "why not use cwd to find module files"

### 4. ESM 里没有 `__dirname`，怎么拿到它？为什么 ESM 改成了 `import.meta.url`？

```js
import { fileURLToPath } from "node:url";
import path from "node:path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```

ESM 是**标准化、跨环境**的模块系统（浏览器/Node 共用语法），`__dirname`/`require` 这类是 Node/CJS 专有的"全局注入"，不该出现在标准里；ESM 提供 `import.meta`（含模块自身 `url`）作为标准钩子。Node 用 `file://` URL 表示本地模块身份，所以要 `fileURLToPath` 还原成 OS 路径（呼应 node-esm-cjs）。

**来源**：Node.js — "ESM __dirname replacement / import.meta.url"; TC39 — "import.meta"

---

## 三、file URL 互转

### 5. `pathToFileURL` / `fileURLToPath` 什么时候必须用？

两个高频场景：**① 动态 `import()` 本地文件**：specifier 需是合法 URL/模块路径，Windows 下裸 `C:\a\b.js` 会被误解析，必须 `await import(pathToFileURL(p).href)`；**② 处理 `import.meta.url` / `url.fileURLToPath`** 反推路径。还有把配置里的文件路径转成资源 URL 时。核心：**"OS 路径" 与 "`file://` URL" 是两个域，跨域就转**，别手动拼 `file://` + 路径（编码、盘符、UNC 都会踩坑）。

**来源**：Node.js — "url.pathToFileURL / fileURLToPath"; 社区 — "dynamic import windows path"

---

## 四、WHATWG URL 解析

### 6. `new URL()` 和遗留的 `url.parse()` 有什么区别？为什么推荐前者？

`url.parse` 是 Node 自创的旧 API，行为有历史怪癖、不严格遵循标准；`new URL()` 是 **WHATWG URL 标准**实现，与浏览器一致、解析更严格、带 `searchParams`（`URLSearchParams`）这套完整查询操作。新项目一律 `new URL()`。关键差异：`URL` 构造**相对地址时必须传 base**（`new URL('/x', 'https://host')`），且**构造非法 URL 会抛 `TypeError`**（正好用于校验输入，呼应 node-async-errors try/catch）。

**来源**：Node.js — "WHATWG URL API vs legacy"; WHATWG — "URL Living Standard"

### 7. 服务器 handler 里 `req.url` 能直接 `new URL(req.url)` 吗？为什么？

不能。`req.url` 只是 **`/path?query`（相对、无协议无主机）**，`new URL('/a?b=1')` 会因缺 base 抛错。要补一个 base：`new URL(req.url, \`http://${req.headers.host}\`)`（呼应 node-http）。这也解释了为何 Express 的 `req.query` 底层要先把原始 query 串喂给解析器——裸相对 URL 无法独立成对象。

**来源**：Node.js — "http.IncomingMessage.url (relative)"; WHATWG — "URL constructor base"

### 8. 为什么解析/构造查询参数要用 `URLSearchParams`，而不是自己 split？

因为查询串语义比看上去复杂：**百分号编码**（`%E4%B8%AD`）、**`+` 代表空格**、**重复 key**（`?a=1&a=2` 要 `getAll`）、**无值参数**（`?flag`）、**值里含 `=`/`&`**。手搓 `split('&')/split('=')` 一定在这些点上出错，还可能引入**参数污染/双重编码**类安全问题（呼应 Express L6 安全）。`URLSearchParams` 把编码/解码、多值、追加/设置都标准化了。

**来源**：WHATWG — "URLSearchParams"; MDN — "URLSearchParams getAll"

---

## 五、os 与跨平台

### 9. `os.EOL` 有什么用？为什么在 Windows 生成的日志用 Linux 打开有时"全挤一行"或反之？

`os.EOL` 是当前平台换行符（win `\r\n`，posix `\n`）。跨平台文本若换行符不匹配，某些编辑器/工具会把 `\r` 当普通字符或把整块当一行。生成给人/工具读的**本地多行文件**时用 `os.EOL` join 行可保持一致；但**网络协议（HTTP/CRLF）、被 Git 管理的文件**往往要求固定换行（别盲目用 EOL）。要分清"面向 OS 的文件" vs "面向协议/标准"的换行约定。

**来源**：Node.js — "os.EOL"; 社区 — "CRLF vs LF cross platform"

### 10. 你想让程序"在用户主目录下读写配置"，怎么做才跨平台？

`path.join(os.homedir(), '.config', 'myapp', 'settings.json')`。绝不硬编码 `/home/user` 或 `C:\Users\name`——不同 OS、不同用户名、Windows 下 AppData 惯例都不同。`os.homedir()` 给正确主目录、`path.join` 给正确分隔符，两者配合（呼应第四节）。macOS/Linux 有 XDG 约定、Windows 更常用 `%APPDATA%`（`process.env.APPDATA`），讲究的库（如 `env-paths`）会按平台选规范目录。

**来源**：Node.js — "os.homedir()"; 社区 — "XDG base dir / app config location"

---

## 六、安全与实战

### 11. 用用户输入拼文件路径有什么安全风险？怎么防？

**路径遍历（Path Traversal / Zip Slip）**：`readFile(\`uploads/${name}\`)`，若 `name = '../../etc/passwd'`，`normalize` 后就跳出预期目录读到任意文件（呼应 `path.normalize` 会折叠 `..`）。防护：**别信任拼接结果**——把基准目录 `path.resolve` 成绝对，再 `path.resolve(base, userInput)` 得目标，校验 `target.startsWith(base + path.sep)`（等于 base 或在其子树内），否则拒绝；或对输入做白名单/`basename` 剥离目录部分。上传文件名还要防 `\0`、编码、超长。

**来源**：OWASP — "Path Traversal"; Node.js — "path.normalize and .."; 社区 — "prevent directory traversal node"

### 12. 一段代码同时处理"文件系统路径"和"Web URL 路径"，要注意什么？

它们是**两套分隔符与编码规则**：文件系统走 `path`（平台分隔符、`%` 不一定编码）、URL 恒用 `/` 且有百分号编码、`#`/`?` 是保留字符（呼应 3.2）。把磁盘路径当 URL 片段前要 `replaceAll(path.sep, '/')` 并做 `encodeURIComponent`；反之从 URL 映射到磁盘路径要 decode 后再过一遍第 11 题的遍历防护（静态文件服务的高危点，呼应 Express L4 静态、node-http）。别用 `path.join` 去拼"对外暴露的 URL"——Windows 会插进 `\`，浏览器不认。

**来源**：Node.js — "path vs URL separators"; MDN — "encodeURIComponent"; OWASP — "static file serving traversal"
