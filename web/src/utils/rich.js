// src/utils/rich.js —— 题库文本的轻量渲染器（题干 / 选项 / 解析）
//
// 为什么不用 marked：题库 JSON 里大量出现 `<script setup>`、`defineProps<Props>()`、
// `{{ msg }}` 这类尖括号与花括号。marked 会把它们当 HTML 标签输出，而未闭合的标签会
// 直接吞掉后面的内容（题目文字凭空少半截）；更糟的是这是**用户可见的内容错误**，很难被发现。
// 所以这里自己走一条更保守的路：
//   ① 先把整段 HTML 转义（尖括号变实体，谁都别想当标签）；
//   ② 再在转义后的文本上识别 ``` 围栏与 `行内码`、**粗体**，把围栏还原成 <pre><code>；
//   ③ 代码块交给 highlight.js 做**字符串级**高亮（不碰 DOM，省一次全页扫描）。
// 结果：任何奇奇怪怪的题干最多多显示一对反引号，绝不会吞字、绝不会注入 HTML。

import hljs from 'highlight.js';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** HTML 转义：所有产出 HTML 的入口都必须先过这一道 */
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

/**
 * 行内片段：转义后把 `code`、**粗体** 变成标签。
 * 先转义再替换是安全的——转义产物只有实体，不会新造出反引号或星号。
 */
function inline(text) {
  return escapeHtml(text)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')      // 行内码：`tx.note` → <code>tx.note</code>
    .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');     // 粗体：**必须** → <b>必须</b>
}

/** 代码块：语言已知就高亮，未知/缺省只转义（宁可不高亮，也不要 hljs 瞎猜语言猜出彩色乱码） */
function codeBlock(code, lang) {
  const known = lang && hljs.getLanguage(lang);
  let inner;
  let cls = 'nohighlight';
  if (known) {
    inner = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    cls = `language-${lang} hljs`;
  } else {
    inner = escapeHtml(code);
  }
  return `<pre class="rich-code"><code class="${cls}">${inner}</code></pre>`;
}

/**
 * 块级渲染：用于题干、解析这类可能带 ``` 围栏的长文本。
 * 返回的 HTML 由调用方 v-html 注入，外层需带 .rich 类（样式见 theme.css）。
 */
export function renderRich(text) {
  const src = String(text ?? '').replace(/\r\n/g, '\n');
  const out = [];
  let cursor = 0;
  // 围栏匹配：```lang\n …… \n``` ；行首允许有空格（部分题干的围栏缩进过）
  const fence = /^[ \t]*```([a-zA-Z0-9+#._-]*)[ \t]*\n?([\s\S]*?)^[ \t]*```[ \t]*$/gm;
  let m;
  while ((m = fence.exec(src)) !== null) {
    if (m.index > cursor) pushText(src.slice(cursor, m.index));
    out.push(codeBlock(m[2].replace(/\n$/, ''), m[1]));
    cursor = m.index + m[0].length;
  }
  // 收尾：不成对的围栏（题目只写了开头）就当普通文本处理，绝不吞掉后文
  pushText(src.slice(cursor));

  function pushText(raw) {
    const trimmed = raw.replace(/^\n+/, '').replace(/\n+$/, '');
    if (!trimmed) return;
    // 空行分段；段内保留换行（.rich-p 用 white-space: pre-wrap，无需插 <br>）
    for (const para of trimmed.split(/\n{2,}/)) {
      out.push(`<p class="rich-p">${inline(para)}</p>`);
    }
  }
  return out.join('');
}

/**
 * 行内渲染：用于选项这类短文本——不换行、不出代码块，只处理 `code` 与 **粗体**。
 * 选项里若混入围栏（少见），退化为纯文本显示，避免撑破选项行高。
 */
export function renderInline(text) {
  return inline(String(text ?? '').replace(/```[a-zA-Z0-9+#._-]*\n?([\s\S]*?)```/g, '$1').trim());
}
