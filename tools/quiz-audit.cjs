/*
 * 题库体检探针（quiz-audit）
 * ─────────────────────────────────────────────────────────────
 * 目的：小测是「通关」的唯一判据（≥60% 即自动通关），所以题库本身必须是可信的。
 *       本脚本一次性把四类隐患摊开，改完题库随手跑一遍，不用靠眼睛翻 JSON。
 *
 * 检查项：
 *   A 硬错误（exit 1）
 *     A1 JSON 解析失败 —— 后端扫描会整关跳过，前端拿不到题
 *     A2 answer 不是整数 / 越界（<0 或 ≥options.length）—— 判分永远判不出正确
 *     A3 options 少于 2 项 / 有重复项 —— 重复项会让「两个都对」，判分口径失效
 *     A4 ``` 代码围栏数量为奇数 —— 前端渲染会把后文一起吞进代码块
 *     A5 题目 id 在同一套题内重复 —— 判分与进度记录按 id 键控，会互相覆盖
 *     A6 题干缺失（prompt / stem 两个都没有）—— 整道题只剩题号
 *   B 质量告警（默认不阻断，加 --strict 才 exit 1）
 *     B1 正确项位置偏斜：同一位置占比 ≥60%（可只蒙一个选项就及格，测验失去意义）
 *     B2 缺 id / 缺 type / 题干叫 stem：旧式写法，靠服务端 normalizeQuiz 抹平，不阻断但应了于账上
 *
 * 用法：
 *   node tools/quiz-audit.cjs            # 全库体检
 *   node tools/quiz-audit.cjs --strict   # 把 B1 偏斜也当失败（存量修完后建议常开）
 */
const fs = require('node:fs');
const path = require('node:path');

const STRICT = process.argv.includes('--strict');
const ROOT = path.resolve(__dirname, '..');
const SKEW_WARN_PCT = 60; // 同一位置占比达到这个数，就认为「蒙也能及格」

/** 递归收集 courses/ 下所有 quiz-*.json */
function walkQuizFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walkQuizFiles(p, out);
    else if (name.startsWith('quiz-') && name.endsWith('.json')) out.push(p);
  }
  return out;
}

/** 统计一段文本里 ``` 围栏出现次数（奇数即未闭合） */
function fenceCount(text) {
  return (String(text ?? '').match(/```/g) ?? []).length;
}

const errors = [];
const skews = [];
let files = 0;
let questions = 0;
let noType = 0;
let noId = 0;
let stemStyle = 0; // 题干只给 stem 的新式写法
const globalPos = {}; // 全库正确项位置分布

for (const file of walkQuizFiles(path.join(ROOT, 'courses'))) {
  files++;
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push(`[A1] ${rel} JSON 解析失败：${e.message}`);
    continue;
  }
  const list = data.questions;
  if (!Array.isArray(list) || list.length === 0) {
    errors.push(`[A1] ${rel} 缺少 questions 数组或为空`);
    continue;
  }

  const seenId = new Map();
  const posCount = {};
  list.forEach((q, i) => {
    questions++;
    const tag = `${rel} #${i}(${q.id ?? '无id'})`;
    const rawOpts = Array.isArray(q.options) ? q.options : [];
    // 选项归一：个别题库把换行续写的代码选项写成了数组的数组，展平后再判重/判越界
    const opts = rawOpts.flat(Infinity).map((o) => (typeof o === 'string' ? o : JSON.stringify(o)));
    if (rawOpts.length !== opts.length) {
      errors.push(`[A3] ${tag} options 存在嵌套数组（${rawOpts.length} → 展平 ${opts.length}），应改为字符串数组`);
    }

    if (opts.length < 2) errors.push(`[A3] ${tag} 选项不足 2 项（实际 ${opts.length}）`);
    const dup = opts.filter((o, k) => opts.indexOf(o) !== k);
    if (dup.length) errors.push(`[A3] ${tag} 选项重复：${JSON.stringify(dup[0]).slice(0, 60)}`);

    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= opts.length) {
      errors.push(`[A2] ${tag} answer 越界或非整数：${JSON.stringify(q.answer)}（选项数 ${opts.length}）`);
    } else {
      posCount[q.answer] = (posCount[q.answer] ?? 0) + 1;
      globalPos[q.answer] = (globalPos[q.answer] ?? 0) + 1;
    }

    if (!q.type) noType++;
    if (!q.id) noId++;
    if (!q.prompt && q.stem) stemStyle++;
    if (q.id) {
      if (seenId.has(q.id)) errors.push(`[A5] ${tag} 题目 id 与本套题第 ${seenId.get(q.id)} 题重复`);
      else seenId.set(q.id, i);
    }
    // 题干：新式写法只给 stem，服务端 normalizeQuiz 会映射成 prompt，故不报错；两者都空才是真错
    if (!String(q.prompt ?? q.stem ?? '').trim()) {
      errors.push(`[A6] ${tag} 题干为空（prompt / stem 都没内容）`);
    }

    for (const [field, text] of [['prompt', q.prompt ?? q.stem], ['explanation', q.explanation], ...opts.map((o, k) => [`options[${k}]`, o])]) {
      const n = fenceCount(text);
      if (n % 2 !== 0) errors.push(`[A4] ${tag} 字段 ${field} 的 \`\`\` 围栏数量为奇数（${n}），前端渲染会吞后文`);
    }
  });

  // B1：整套题的正确项位置偏斜
  const total = Object.values(posCount).reduce((a, b) => a + b, 0);
  if (total >= 6) {
    const [topIdx, topN] = Object.entries(posCount).sort((x, y) => y[1] - x[1])[0];
    const pct = Math.round((topN / total) * 100);
    if (pct >= SKEW_WARN_PCT) skews.push({ rel, total, topIdx, pct });
  }
}

console.log(`题库体检：${files} 套 / ${questions} 题`);
console.log(`硬错误：${errors.length} 条；偏斜告警（同位置≥${SKEW_WARN_PCT}%）：${skews.length} 套`);
console.log(`旧式写法计数（靠服务端 normalizeQuiz 抹平，不阻断）：缺 id ${noId} 题 / 缺 type ${noType} 题 / 题干用 stem ${stemStyle} 题`);
console.log('全库正确项位置分布：', JSON.stringify(globalPos));

if (errors.length) {
  console.log('\n—— 必须修（A 类）——');
  errors.slice(0, 60).forEach((e) => console.log('  ✗', e));
  if (errors.length > 60) console.log(`  …其余 ${errors.length - 60} 条`);
}
if (skews.length) {
  console.log('\n—— 建议修（B1 偏斜，蒙同一选项即可及格）——前 20 套：');
  skews.sort((a, b) => b.pct - a.pct).slice(0, 20).forEach((s) => {
    console.log(`  ! ${s.pct}% @位置${s.topIdx}（${s.total} 题）  ${s.rel}`);
  });
}

const failHard = errors.length > 0;
const failStrict = STRICT && skews.length > 0;
if (failHard || failStrict) {
  console.log(failHard ? '\n结论：FAIL（存在 A 类硬错误）' : '\n结论：FAIL（--strict 下偏斜不允许）');
  process.exit(1);
}
console.log('\n结论：PASS' + (skews.length ? `（${skews.length} 套偏斜待打乱，非阻断）` : ''));
