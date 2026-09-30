/*
 * 题库正确项位置打乱工具（quiz-shuffle）
 * ─────────────────────────────────────────────────────────────
 * 背景：quiz-audit 发现大量套题的「正确项位置」严重偏斜（同一位置占比 ≥60%），
 *       而小测的通关线正好是 60% —— 只蒙同一个选项就能及格，测验失去意义。
 * 做法：对每套题按 0,1,2,3 轮转分配目标位置，把该题的选项数组**整体循环移位**，
 *       使正确项落到目标位置。选项文字一字不改，只是顺序变；答对的那一项内容始终不变。
 * 安全阀（这两类题一律跳过，交人工判）：
 *   R1 选项含「以上/上述都对、全都、都不对、所有选项、A 和 B、①②③」等**靠选项位置指代**的表述 —— 移位后语义就错
 *   R2 解析里用字母指代选项（如「故选 B」「A 项错在…」）—— 移位后字母对不上
 *   （注：「两者等价」「两者都行」这类**不列入**风险——已逐条核对 149 处，它们指代的是**题干里的两个事物**
 *    （isNaN 与 Number.isNaN、pipe 与 compose、any 与 unknown…），与选项位置无关，轮换安全）
 *   「应」字不进 RISK_LETTER：它会误命中「响应 B→A→组件」这类描述性写法（「应该选 A」仍被「选 A」覆盖）
 *   踩线但经人工逐题核实为假阳性的套题，列在 ALLOW 里放行，并写明理由（改一条就必须重新核一次）
 * 学习记录不受影响：progress 只存 best 分数，不存当时选了哪个位置。
 * 课文/面试题/作业也不受影响：2026-10 全库 md 扫过一遍「选 A / A 项」这类按位置指代，5 处命中全为假阳性
 * （To C 项目 / RSC 项目 / MPA 项目 / SWC 选项、“A 项目配置变了”里的 A B 指代项目），文档里从不按选项位置引用小题。
 *
 * 用法：
 *   node tools/quiz-shuffle.cjs --dry-run   # 只打印计划，不落盘
 *   node tools/quiz-shuffle.cjs             # 真正改写
 *   node tools/quiz-shuffle.cjs --all       # 连 <60% 偏斜的套题也一并均衡
 *   QS_REPORT=路径 node tools/quiz-shuffle.cjs   # 额外把明细写成 UTF-8 文件（Windows 控制台中文会被转码弄乱时用）
 */
const fs = require('node:fs');
const path = require('node:path');

const DRY = process.argv.includes('--dry-run');
const ALL = process.argv.includes('--all');
const ROOT = path.resolve(__dirname, '..');
const SKEW_PCT = 60;
const MIN_QUESTIONS = 6; // 题太少的套题本来就没法均衡，不动

// 靠选项位置指代的表述：挪了位置语义就坏（「两者」不在此列，理由见文件头注 R1 条）
const RISK_OPTION = /(以上|上述|全都|均正确|都对|都不对|都不正确|所有选项|A\s*[+、和,，]\s*B|B\s*[+、和,，]\s*C|①|②|③)/;
// 解析里用字母指代选项：挪了位置字母对不上
const RISK_LETTER = /[选答]\s*[ABCD]\b|[ABCD]\s*(项|选项)|\b[ABCD]\s*(是对|正确|错在|错误)/;

// 人工放行清单：正则踩线但逐题核实过、挪位置不改变语义的套题（键 = 相对路径，值 = 核实理由）
const ALLOW = {
  'courses/04-vue/L4-组件通信与逻辑复用/quiz-vue-provide-inject.json':
    '#5 选项「全都一样，任选」是错误项，指代的是题干里的 provide/inject、props/emits、Pinia 三者，与选项排列无关',
  'courses/07-nextjs/L2-路由进阶/quiz-next-dynamic.json':
    '#2 选项「/docs/a/b/c 等一级以上全部」是正确项，「以上」指数值层级而非选项位置',
};

function walkQuizFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkQuizFiles(p, out);
    else if (name.startsWith('quiz-') && name.endsWith('.json')) out.push(p);
  }
  return out;
}

const changed = [];
const skipped = [];
const unchanged = [];

for (const file of walkQuizFiles(path.join(ROOT, 'courses'))) {
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let data;
  let eolCRLF = false;
  try {
    const rawText = fs.readFileSync(file, 'utf8');
    // 仓库 core.autocrlf=true 且无 .gitattributes：工作区里的课程文件是 CRLF，写回时要保持同一行尾，
    // 否则一改就是上百个文件的行尾大扫除（git 满屏 LF→CRLF 警告，真实 diff 反而淹没在噪声里）
    eolCRLF = rawText.includes('\r\n');
    data = JSON.parse(rawText);
  } catch (e) {
    skipped.push(`${rel} —— JSON 解析失败，未动：${e.message}`);
    continue;
  }
  const qs = Array.isArray(data.questions) ? data.questions : [];
  if (qs.length < MIN_QUESTIONS) { unchanged.push(rel); continue; }

  // 只看有效题（answer 是整数且落在选项范围内）
  const valid = qs.filter((q) => Number.isInteger(q.answer) && q.answer >= 0 && Array.isArray(q.options) && q.answer < q.options.length);
  const dist = {};
  for (const q of valid) dist[q.answer] = (dist[q.answer] ?? 0) + 1;
  const top = Object.entries(dist).sort((a, b) => b[1] - a[1])[0];
  const topPct = top ? Math.round((top[1] / valid.length) * 100) : 0;
  if (!ALL && topPct < SKEW_PCT) { unchanged.push(rel); continue; }

  // 整套体检安全阀：任一题踩线就整套不动，免得半套挪完后位置语义打架
  const risk = [];
  if (!ALLOW[rel]) qs.forEach((q, i) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    if (opts.some((o) => RISK_OPTION.test(String(o)))) risk.push(`#${i + 1} 选项含顺序依赖表述`);
    if (RISK_LETTER.test(String(q.explanation ?? ''))) risk.push(`#${i + 1} 解析用字母指代选项`);
  });
  if (risk.length) {
    skipped.push(`${rel}（偏斜 ${topPct}%）—— 跳过：${risk.slice(0, 3).join('；')}${risk.length > 3 ? ` …共 ${risk.length} 处` : ''}`);
    continue;
  }

  // 逐题把正确项轮换到 i % 选项数 的位置：四选项套题得到 0,1,2,3,0,1,2,3… 的均衡布局
  const before = valid.map((q) => q.answer).join(',');
  let slot = 0;
  for (const q of qs) {
    if (!Number.isInteger(q.answer) || q.answer < 0 || !Array.isArray(q.options) || q.answer >= q.options.length) continue;
    const n = q.options.length;
    const target = slot % n;
    slot++;
    if (target === q.answer) continue;
    const correctText = q.options[q.answer];
    const shift = (target - q.answer + n) % n;
    q.options = q.options.map((_, j) => q.options[(j - shift + n) % n]);
    q.answer = target;
    // 落盘前最后校验：正确项文字必须一个字节都没变
    if (q.options[target] !== correctText) throw new Error(`${rel} 轮换后正确项内容漂移，已中止`);
  }
  const after = valid.map((q) => q.answer).join(',');
  if (before === after) { unchanged.push(rel); continue; }

  changed.push({ rel, before, after, topPct });
  if (!DRY) {
    let text = JSON.stringify(data, null, 2) + '\n';
    if (eolCRLF) text = text.replace(/\r?\n/g, '\r\n');
    fs.writeFileSync(file, text, 'utf8');
  }
}

console.log(`${DRY ? '[dry-run] ' : ''}计划改写 ${changed.length} 套；跳过 ${skipped.length} 套；无需改动 ${unchanged.length} 套`);
if (skipped.length) {
  console.log('\n—— 需人工确认（未动）——');
  skipped.forEach((s) => console.log('  ·', s));
}
if (process.env.QS_DETAIL) {
  console.log('\n—— 改写明细（before → after 为各题正确项位置）——');
  changed.forEach((c) => console.log(`  ${c.topPct}%  ${c.rel}\n     ${c.before}\n  → ${c.after}`));
}
// Windows PowerShell 5.1 会把子进程的 UTF-8 输出按本地代码页重新解码，中文报告落盘再读更可靠
if (process.env.QS_REPORT) {
  const body = [
    `${DRY ? '[dry-run] ' : ''}计划改写 ${changed.length} 套；跳过 ${skipped.length} 套；无需改动 ${unchanged.length} 套`,
    '',
    '—— 需人工确认（未动）——',
    ...skipped.map((s) => '  · ' + s),
    '',
    '—— 改写明细 ——',
    ...changed.map((c) => `  ${c.topPct}%  ${c.rel}\n     ${c.before}\n  → ${c.after}`),
  ].join('\n');
  fs.writeFileSync(process.env.QS_REPORT, body + '\n', 'utf8');
  console.log(`报告已写出：${process.env.QS_REPORT}`);
}
