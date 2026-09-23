# 字符串 API 与 Unicode：为什么 `'👨‍👩‍👧'.length` 不等于 1

> 目标：**理解 UTF-16 码元、码点、字素簇三层的区别**；掌握 `at` / `codePointAt` / `String.fromCodePoint` / `normalize` / `localeCompare` / `Intl.Segmenter` 处理 emoji 与多语言；知道 `padStart/padEnd/matchAll/replace 回调` 等现代 API。

---

## 一、字符串的**三层**结构

| 层 | 单位 | 谁定义 | JS 里的表现 |
| --- | --- | --- | --- |
| **Code Unit** | UTF-16 码元（2 字节） | JS 引擎原生 | `str.length` / `str[i]` / `codeUnitAt` |
| **Code Point** | Unicode 码点（U+xxxxxx） | Unicode 标准 | `codePointAt(i)` / `String.fromCodePoint` |
| **Grapheme Cluster** | 字素簇（用户看到的「一个字符」） | Unicode 分簇规则 | **JS 原生不知道**；`Intl.Segmenter` |

**关键事实**：JS 字符串**不是「字符」数组，是「UTF-16 码元」数组**。这是很多 emoji / 中文生僻字翻车的根源。

```js
'hi'.length;         // 2
'中文'.length;         // 2（BMP 内，每字 1 码元）
'😀'.length;          // 2（U+1F600 需要代理对 surrogate pair）
'👨‍👩‍👧'.length;       // 8（3 emoji + 2 ZWJ = 8 码元）
'👨‍👩‍👧'.codePointAt(0); // 128104（U+1F468）
```

---

## 二、代理对：surrogate pair

BMP（U+0000 - U+FFFF）之外的字符在 UTF-16 里编码为**两个码元**：
- **高代理**（High surrogate）：`U+D800 - U+DBFF`
- **低代理**（Low surrogate）：`U+DC00 - U+DFFF`

```js
'😀'.charCodeAt(0);  // 55357 = 0xD83D（高代理）
'😀'.charCodeAt(1);  // 56832 = 0xDE00（低代理）
'😀'.codePointAt(0); // 128512 = 0x1F600（真正的码点）
```

**⚠️ 拆半个代理对会**产生非法字符**：`'😀'.slice(0, 1)` 得到**孤立高代理**，显示为 ``。ES2019 加了 `isWellFormed` / `toWellFormed` 修正。

---

## 三、正确的遍历：`for-of` 走迭代器

```js
for (const ch of 'a😀b') console.log(ch);   // 'a' '😀' 'b'   ✅ 按码点
for (let i = 0; i < 'a😀b'.length; i++) console.log('a😀b'[i]);  // 'a' '' 'b'    ❌ 按码元
[...'a😀b'];   // ['a', '😀', 'b']  ✅ 走迭代器
```

**规则**：**永远**用 `for-of` 或 `[...str]` 或 `Array.from(str)` 遍历含 emoji / 非 BMP 字符的字符串；不要用 `str[i]`。

---

## 四、`at` / `codePointAt` / `fromCodePoint`

```js
'hello'.at(0);      // 'h'
'hello'.at(-1);     // 'o'    （ES2022，支持负下标）
'abc'.codePointAt(0); // 97
String.fromCodePoint(0x1F600);  // '😀'
String.fromCharCode(0xD83D, 0xDE00); // '😀'（老写法，要自己拆代理对）
```

**⚠️ fromCharCode vs fromCodePoint**：fromCharCode **只处理 16 位单元**，处理不了 BMP 外字符——一律用 `fromCodePoint`。

---

## 五、字素簇：`Intl.Segmenter`（**处理 emoji / 泰文 / 韩文**）

```js
const family = '👨‍👩‍👧‍👦';
family.length;               // 11
[...family].length;           // 7（按码点拆，仍不对）

const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
[...seg.segment(family)].map(s => s.segment);   // ['👨‍👩‍👧‍👦']  真正的 1 个"字"
```

**用途**：
- **输入框长度校验**（用户以为「打了 1 个 emoji」，实际 11 码元）；
- **删除键**逻辑（Backspace 应删**整个字素簇**，不是码元）；
- **换行**分词（CJK 需按字，英文需按词）。

**⚠️ 兼容性**：Safari 14.1+、Chrome 87+、Node 16+；老环境用 `grapheme-splitter` polyfill。

---

## 六、大小写与本地化：`localeCompare` 与 `toLocaleLowerCase`

```js
'i'.toLocaleLowerCase('tr');   // 'ı'（土耳其小写 i 无点）
'i'.toLowerCase();              // 'i'（默认英文）

['ä', 'a', 'ö', 'o'].sort((x, y) => x.localeCompare(y, 'sv'));  // 瑞典语排序：ä 在 a 前
['ä', 'a', 'ö', 'o'].sort((x, y) => x.localeCompare(y, 'de'));  // 德语：ä ≈ ae
```

**⚠️ 别用 `<` / `>` 或默认 sort 做多语言比较**——按 UTF-16 码元排，中文会按 Unicode 码点分组、不按拼音；带变音符号的欧洲语言顺序错乱。

---

## 七、规范化：`normalize`（NFC / NFD / NFKC / NFKD）

同样「看起来一样」的两个字符串，可能**码点不同**：

```js
const a = 'á';                        // 单码点 U+00E1
const b = 'á';                        // a + 组合重音 U+0301
a === b;                              // false
a.length, b.length;                    // 1, 2
a.normalize('NFC') === b.normalize('NFC'); // true ✅
```

**四种形式**：
- **NFC**（推荐）：合成——最常用，与用户看到的字面对应。
- **NFD**：分解。
- **NFKC / NFKD**：兼容合成/分解——把「⽇」（表意文字补充）→「日」、全角 `Ａ` → `Ａ` 半角。

**用途**：**搜索引擎 / 表单校验 / 文件名校验**——一律先 normalize。macOS HFS+ 文件系统强制 NFD，Windows 用 NFC，跨平台文件名撞车经典案例。

---

## 八、现代字符串 API 快速表

| API | 引入 | 干什么 |
| --- | --- | --- |
| `padStart / padEnd` | ES2017 | 补零/补字符到固定宽度 |
| `trimStart / trimEnd / trimLeft / trimRight` | ES2019 | 单侧 trim |
| `matchAll(re)` | ES2020 | 迭代所有匹配（含捕获组） |
| `replaceAll(str \| re, fn \| str)` | ES2021 | 一次替换全部（re 必须 global） |
| `String.raw\`...\`` | ES6 | 标签函数，禁转义 |
| `isWellFormed / toWellFormed` | ES2024 | 检测/修正孤立代理 |
| `Intl.Segmenter` | ES2022 | 字素簇 / 词 / 句分割 |

```js
// padStart：格式化
String(7).padStart(3, '0');   // '007'

// matchAll：全局捕获
const re = /(\w+)=(\w+)/g;
[...'a=1 b=2'.matchAll(re)].map(m => [m[1], m[2]]);  // [['a','1'], ['b','2']]

// replaceAll 回调
'foo bar foo'.replaceAll(/(\w)/g, (m, p1, idx) => `[${idx}]`);
```

**⚠️ `replace` 只替换第一次**（除非传 `/g` 正则）——这是社区公认的老 API 缺陷，ES2021 补上 `replaceAll`。

---

## 九、`String.raw` 与模板字符串

```js
const path = String.raw`C:\new\test.txt`;   // 'C:\\new\\test.txt'（原始反斜杠）
const t = (s, ...vals) => s.raw.join('|');
t`a\nb`;   // 'a\\nb'
```

**用途**：正则、路径、LaTeX。**追问**：`\n` 在 String.raw 里是**两个字符**（`\` 和 `n`），不是换行——**别混淆**。

---

## 十、自检清单

- [ ] 说清码元 / 码点 / 字素簇三层，各自 API 入口。
- [ ] 为什么 `'👨‍👩‍👧'.length` 不等于 1？说出这个家庭 emoji 的构成（3 emoji + 2 ZWJ）。
- [ ] 手写：正确遍历一个含 emoji 的字符串（**不能**用 `str[i]`）。
- [ ] NFC 与 NFD 有什么区别？为什么搜索/文件名要 normalize？
- [ ] `localeCompare` 与 `sort()` 的差异？中文按拼音排序怎么写？
- [ ] `replaceAll('a', 'b')` 与 `replace(/a/g, 'b')` 有什么区别？

---

## 🚀 部署预告（本关点到，细节在 L10）

**Unicode 与字符串在构建/部署阶段最容易出问题的是哪几件事？**

1. **源码文件编码必须是 UTF-8**：Node / Vite / Babel 都假设 UTF-8。Windows 记事本另存为「ANSI」→ 中文全乱。团队 `.editorconfig` / `git config core.autocrlf false` + `.gitattributes` 强制 `* text=auto eol=lf working-tree-encoding=UTF-8`。
2. **HTTP 响应头 Content-Type charset**：`Content-Type: text/html; charset=utf-8` 少了 charset → 浏览器按系统 ANSI 猜——中文乱码。构建时确保 HTML 模板有 `<meta charset="utf-8">`。
3. **JS 文件里的 emoji**：某些 CDN 或后端拼接时把 emoji 转成 `\uD83D\uDE00` 转义序列——**能显示**但**体积膨胀 6 倍**（4 字符变 12 字符）。terser `--charset=utf8` 保留 emoji 原样。
4. **`Intl.Segmenter` polyfill 巨大**：`grapheme-splitter` 约 5KB gzip。target 只 Modern 就不用。
5. **normalize 影响哈希/缓存**：文件名 `café`（NFC）与 `café`（NFD）在 CDN 缓存键里是**两个 URL**；上传/去重一定要先规范化。

细节 L10 `es-build` 展开。**你现在只需要记住**：**中文乱码 & emoji 拆半 & 文件名不匹配——90% 都发生在你以为字符串就是字符数组的那一刻。**
