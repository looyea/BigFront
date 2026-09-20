# 面试题 · 字符串与 Unicode

> 本关所有面试题**整理自公开互联网题库**，每题末尾给出来源。题目已用中文重新表述，代码示例为业界通用范例。

---

**1）JS 字符串底层是什么编码？为什么 `'😀'.length` 是 2 而不是 1？**
- 参考要点：UTF-16 码元序列。U+1F600 在 BMP 之外，UTF-16 用**代理对**（高代理 U+D83D + 低代理 U+DE00）表示；length 返回**码元**数而不是**字符**数。
- 来源：MDN《JavaScript's Unicode guide》；Unicode Standard；mathiasbynens.be《JavaScript: The world's most misunderstood programming language》。

---

**2）举出至少 3 种正确按**码点**分割字符串的方法，并说明 `str.split('')` 为什么错。**
- 参考要点：`[...str]`；`Array.from(str)`；`for (const c of str)`；`str.match(/./gu)`（u flag）。`split('')` 按**码元**分割，会把代理对拆两半，产生**孤立代理**（illegal code unit）。
- 来源：MDN；StackOverflow《How does string split work with surrogate pairs》。

---

**3）什么是 NFC、NFD、NFKC、NFKD？为什么搜索和文件名要 normalize？**
- 参考要点：
  - **NFC**：规范化合成（推荐）——`á` → U+00E1。
  - **NFD**：规范化分解——`á` → `a` + U+0301。
  - **NFKC / NFKD**：兼容——`⽇` (Kangxi 部首) → `日`；全角 `Ａ` → `A`。
  搜索/文件名要 normalize 因为不同输入源可能给不同形式，视觉上一样但码点不同，`===` 会 false。macOS HFS+ 强制 NFD，Linux 通常 NFC，跨平台文件名冲突经典。
- 来源：Unicode Standard TR15；MDN `String.prototype.normalize`。

---

**4）`'á'.length === 'á'.length` 会是真的吗？解释。**
- 参考要点：取决于源码字节。若一个是 U+00E1（length 1）另一个是 'a' + U+0301（length 2），字面量看起来一样但 length 不同。**修法**：`a.normalize('NFC') === b.normalize('NFC')`。
- 来源：MDN normalize 页；Unicode TR15。

---

**5）`localeCompare` 与 `<` / `>` 有什么区别？举两个 locale 排序结果不同的例子。**
- 参考要点：`<` 按 UTF-16 码元；localeCompare 按 locale 规则（Collation Table，Unicode UTS #10）。例子：① 德语 `ä` 在 `a` 之后、`z` 之前（≈ ae）；瑞典语 `ä` 在 `z` 之后（是独立第 27 字母）。② 中文默认按 Unicode 码点分组（大致按部首笔画），传 `'zh-Hans-CN'` 才按拼音。
- 来源：MDN `localeCompare`；Unicode Collation Algorithm。

---

**6）`String.raw` 干什么用？给两个真实例子。**
- 参考要点：模板字符串的标签函数，返回**未处理转义**的原始字符串。用途：① 正则——`String.raw`\d+\.\d+`` 免写 `\\d+\\.\\d+`；② 路径——`String.raw`C:\Users\test``；③ LaTeX。
- 来源：MDN `String.raw`；javascript.info。

---

**7）`'hello'.replace('l', 'L')` 结果是什么？`'hello'.replace(/l/, 'L')` 呢？`'hello'.replace(/l/g, 'L')` 呢？**
- 参考要点：'heLlo' / 'heLlo' / 'heLLo'。**关键**：字符串或无 g flag 都只替换第一次。ES2021 有 `replaceAll`（若传 regex 必须带 g flag，否则抛 TypeError）。
- 来源：MDN `replace` / `replaceAll`。

---

**8）写出**用户输入的 emoji 家庭** `'👨‍👩‍👧‍👦'` 的**码元数、码点数、字素簇数**。**
- 参考要点：
  - **码元数**：11（每个 emoji 2 + 每个 ZWJ 2 = 4×2 + 3×2 但 ZWJ 在 BMP 内 1 码元 → 4 emoji×2 + 3 ZWJ×1 = 11）
  - **码点数**：7（4 emoji + 3 ZWJ）
  - **字素簇**：1（整个是**一个** emoji）
- 来源：Unicode UTS #51（Emoji ZWJ Sequence）；`Intl.Segmenter`。

---

**9）`padStart` 与 `padEnd` 的第二个参数有什么限制？**
- 参考要点：填充字符串必须能**用重复+截断**拼到目标宽度；传 `''` 无效（长度不变）。**追问**：多字符填充时会**从头截取**填充满：`'7'.padStart(5, 'ab')` → `'abab7'`。第二参数若含 BMP 外字符仍按码元算长度——padding 可能拆代理对。
- 来源：MDN `padStart`；StackOverflow 相关。

---

**10）`String.prototype.at(-1)` 与 `str[str.length - 1]` 有什么**行为**差异（不考虑可读性）？数组场景呢？**
- 参考要点：字符串场景：含 emoji 时，`str.at(-1)` 依然是**码元**（不是码点），拿到的可能是低代理；`[...str].at(-1)` 才是最后一个码点。**数组场景**：`arr.at(-1)` 与 `arr[arr.length-1]` 结果一致，但 at 稀疏数组会返回 undefined（`new Array(3).at(0)` → undefined，索引读也一样）。at 的主要优势是**负下标**。
- 来源：MDN `at`；TC39 relative-indexing-method 提案。

---

**11）说出 `matchAll` 相比 `match(/g)` 的优势。**
- 参考要点：`String.match(regex)` 带 g flag 只返回**匹配字符串数组**（**无捕获组、无 index**）；`matchAll` 返回**迭代器**，每项是完整 match 结果（含捕获组、index、input）。且 matchAll 要求 g flag，不传抛 SyntaxError。
- 来源：MDN `matchAll`；TC39 提案。

---

**12）现场手写：一个 `truncate(str, maxGraphemes)`，按**字素簇**截断到 maxGraphemes 个字符，超长时结尾加 `…`。**
- 参考要点：
  ```js
  function truncate(str, max) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    const arr = [...seg.segment(str)].map(s => s.segment);
    return arr.length <= max ? str : arr.slice(0, max).join('') + '…';
  }
  ```
  无 Intl.Segmenter 时的 fallback：`grapheme-splitter` 库或 `[...str]`（对 emoji 家庭会拆错，但覆盖大多数场景）。
- 来源：MDN Intl.Segmenter；多份中文 UI 库截断字符串实现。
