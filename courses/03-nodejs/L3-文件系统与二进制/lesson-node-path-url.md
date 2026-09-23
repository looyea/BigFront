# path、url 与 os：跨平台路径与地址解析

> 目标：解决 Node 里最"阴"的一类 bug——**路径**。Windows 用 `\`、类 Unix 用 `/`；相对路径到底相对谁；ESM 里怎么没有 `__dirname` 了；`file://` URL 和文件路径怎么互转；URL 查询串怎么正确解析而不手搓 `split('&')`。把 `path`、WHATWG `url`、`os` 三块一次讲清。呼应 node-basics（`process.cwd`）、node-esm-cjs（`import.meta.url`）、node-fs 第 12 题（相对路径忽快忽慢的根因）。

---

## 一、`path`：跨平台拼路径的唯一正确姿势

**永远不要手拼字符串**：

```js
import path from "node:path";

// ✗ 硬编码分隔符，Windows 上炸
const bad = "src" + "/" + "utils" + "/" + "index.js";

// ✓ path.join 自动用当前平台正确分隔符、顺带 normalize
const good = path.join("src", "utils", "index.js");     // win: src\utils\index.js  posix: src/utils/index.js
```

四个高频方法：

| 方法 | 作用 | 例子 |
| --- | --- | --- |
| `path.join(a, b, ..)` | 拼接 + 规范化（消 `.`/`..`） | `join('a','./b','..','c')` → `a/c` |
| `path.resolve(..)` | 从 `cwd` 出发解析成**绝对路径** | `resolve('src','x.js')` → `E:\proj\src\x.js` |
| `path.normalize(p)` | 规整分隔符与 `.`/`..` | `normalize('a//b/../c')` → `a/c` |
| `path.basename / extname / dirname` | 取文件名 / 扩展名 / 目录 | `extname('a.tar.gz')` → `.gz` |

`join` vs `resolve`：**`join` 只拼接、结果可能还是相对路径；`resolve` 一定给你一个绝对路径**（以 `cwd` 或遇到的第一个绝对段为锚）。要"绝对、确定"就用 `resolve`。

> 注意：`path` 用的是**运行它的那个平台**的分隔符规则。若你要在 Windows 上处理"面向 POSIX/URL 的路径"，用 `path.posix.*`；反之 `path.win32.*`。

---

## 二、`__dirname` / `__filename` 从哪来，ESM 又怎么没有

CJS 里模块被包了一层函数，注入了 `__dirname`（当前文件所在目录）、`__filename`（当前文件绝对路径）（呼应 node-modules 的包装函数）。所以"基于脚本位置"这么写最稳：

```js
// CJS
const cfg = path.join(__dirname, "config.json");   // 无论 cwd 是啥都对
```

**ESM 没有 `__dirname`/`__filename`**，取而代之的是 `import.meta.url`——一个 `file://` URL 字符串（呼应 node-esm-cjs）。还原成路径：

```js
// ESM
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cfg = path.join(__dirname, "config.json");
```

**记忆点**：`process.cwd()` = "进程从哪启动"（会变）；`__dirname`/`import.meta.url` = "这个文件在哪"（不变）。库/服务里定位**自身资源**永远用后者（呼应 node-fs 第 12 题）。

---

## 三、`url`：文件路径 ↔ file URL，以及 URL 解析

Node 的 `url` 模块有两套：老的 `url.parse`（遗留、别再学新代码用）和 **WHATWG 标准的 `new URL()`**（推荐）。

### 3.1 路径 ↔ `file://` URL 互转

```js
import { pathToFileURL, fileURLToPath } from "node:url";
pathToFileURL("src/a.js").href;   // 'file:///E:/Projects/BigFront/src/a.js'
fileURLToPath("file:///E:/Projects/BigFront/src/a.js"); // 'E:\\Projects\\BigFront\\src\\a.js'
```

动态 `import()` 一个"由变量拼出来的本地文件"时，必须先转成 `file://` URL（尤其 Windows，直接拼路径会解析失败）：`await import(pathToFileURL(p).href)`（呼应 node-esm-cjs 的动态 import）。

### 3.2 用 WHATWG `URL` 解析查询串，别手搓

```js
const u = new URL("https://api.x.com/search?q=node&page=2#top");
u.protocol; u.host; u.pathname; u.hash;   // 'https:' 'api.x.com' '/search' '#top'
u.searchParams.get("q");        // 'node'
u.searchParams.set("page", "3");
u.searchParams.append("tag", "es");
u.search;                     // '?q=node&page=3&tag=es'  ← 自动重编码
```

`URLSearchParams` 帮你正确处理 `%` 编码、多值、`+`/空格——手撕 `split('&')/split('=')` 遇到编码、无值参数、重复 key 必错（呼应 node-http 解析 query）。解析**相对** URL 要传 base：`new URL('/foo', 'https://x.com')`；URL 构造失败会**抛错**，所以校验用户输入合法性时 try/catch 它。

处理"服务器收到的原始 request URL"时，注意它只是 `/path?query` 这种相对形式，要配一个 base：

```js
import { IncomingMessage } from "node:http";
function fullUrl(req) {
  return new URL(req.url, `http://${req.headers.host}`);   // req.url 是相对路径
}
```

---

## 四、`os`：别把平台假设写进逻辑

```js
import os from "node:os";
os.platform();          // 'win32' | 'darwin' | 'linux' …（注意 mac 也是靠 platform/arch 判断）
os.arch();              // 'x64' | 'arm64'
os.EOL;                 // 平台换行符：'\r\n'（win） / '\n'（posix）—— 写多行文件用它能保持一致
os.homedir();           // 用户主目录
os.tmpdir();            // 临时目录
os.cpus();              // CPU 核数（cluster fork 几个 worker 的依据，呼应 node-cluster）
os.networkInterfaces(); // 网卡信息
```

拼"用户主目录下的配置"要 `path.join(os.homedir(), '.config', 'app')`，别硬写 `/home/xxx` 或 `C:\Users\xxx`（呼应第一节的跨平台原则）。`os.EOL` 常被忽略——跨平台生成文本文件时它是避免"Windows 打开全挤一行"的关键。

---

## 五、综合：一个"定位与资源"的健壮模板

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 定位包内资源：相对本文件，而非 cwd
const dataFile = path.resolve(__dirname, "..", "..", "data", "sample.json");
// 构造对外 URL 路径（Web 场景分隔符恒为 /）
const webPath = "assets/images/logo.png".replaceAll(path.sep, "/");
```

两条铁律收束本关：**① 文件系统路径一律走 `path`（跨平台）；② 定位自身资源用 `__dirname`/`import.meta.url`，绝不用裸相对路径 / `process.cwd()`。**

---

## 六、自检清单

- [ ] `path.join` 和 `path.resolve` 结果差别？各何时用？
- [ ] 为什么不能在代码里手拼 `"a/b"`？`path.posix` 又何时登场？
- [ ] ESM 里如何拿到 `__dirname`？`process.cwd()` 和它的本质区别？
- [ ] `pathToFileURL` 在动态 `import()` 里为什么必需？
- [ ] 解析 query 为什么用 `URLSearchParams` 而不是 `split`？解析相对 URL 要注意什么？
- [ ] `os.EOL`、`os.cpus()` 分别能派什么用场？

---

## 🚀 部署预告

- 本关的 Buffer 与字节、编码话题在下一关 **node-buffer** 补齐（`path`/`url` 处理的是"字符串路径"，Buffer 处理"字节"）；
- `os.cpus()` 决定 worker 数的伏笔，在 **node-cluster** 兑现（呼应）；
- `pathToFileURL` + 动态 `import` 的组合，回扣 **node-esm-cjs** 的加载机制；
- 正确解析 `req.url`/query，是 **node-http** 手写路由与 **09-express** 参数处理的地基（呼应）。

下一关进入 **node-buffer**：二进制数据的真相——Buffer、TypedArray 与字符编码。
