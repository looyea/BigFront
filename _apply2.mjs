// _apply2.mjs —— qty-expand 批处理工具
// 用法1：node _apply2.mjs scan <pkgDir>          扫描全包未满配关卡（题数/答案分布/面试格式/主题）
// 用法2：node _apply2.mjs apply <pkgDir> <dataFile>   按数据文件批量追加并校验
// dataFile 导出：{ "<lessonId>": { quiz:[{prompt,options,answer,explanation}], interview:[{q,points,src}] } }
import fs from 'node:fs';
import path from 'node:path';

const sanitize = (level) => `${level.id}-${String(level.title ?? '').replace(/[\\/:*?"<>|\s]/g, '')}`;

function load(pkgDir) {
  const m = JSON.parse(fs.readFileSync(path.join(pkgDir, 'course.json'), 'utf8'));
  const map = new Map();
  for (const lv of m.levels) {
    const stage = path.join(pkgDir, sanitize(lv));
    for (const ls of lv.lessons ?? []) map.set(ls.id, { stage, level: lv.id, title: ls.title });
  }
  return map;
}

function ivParse(txt) {
  const bold = [...txt.matchAll(/^\*\*(\d+)\uff09/gm)].map((x) => +x[1]);
  const hash = [...txt.matchAll(/^###\s*\**(\d+)\uff09/gm)].map((x) => +x[1]);
  const hashdot = [...txt.matchAll(/^###\s*(\d+)\.\s/gm)].map((x) => +x[1]);
  const boldDot = [...txt.matchAll(/^\*\*(\d+)\.\s/gm)].map((x) => +x[1]);
  const letter = [...txt.matchAll(/^###\s*[A-Z]+\d+\.\s/gm)].map((_, i) => i + 1);
  const cands = { hashdot, boldDot, hash, bold, letter };
  let fmt = 'hashdot', best = -1;
  for (const k of ['hashdot', 'boldDot', 'hash', 'bold', 'letter']) if (cands[k].length > best) { best = cands[k].length; fmt = k; }
  const nums = cands[fmt];
  const src = (txt.match(/^- \u6765\u6e90|\u6765\u6e90[:\uff1a]|\*\*\u6765\u6e90\*\*/gm) || []).length;
  return { fmt, nums, src };
}

function quizRotateTo4(q) {
  // 追加后若答案集缺档：把普通题的正确项挪到缺失 index（只动 options 顺序与 answer 号）
  const qs = q.questions;
  const used = new Set();
  for (let guard = 0; guard < 40; guard++) {
    const have = new Set(qs.map((x) => x.answer));
    const miss = [0, 1, 2, 3].find((i) => !have.has(i));
    if (miss === undefined) break;
    const cand = qs.find((x) => !used.has(x.id) && x.options.length >= 4 && x.answer !== miss);
    if (!cand) break;
    used.add(cand.id);
    const right = cand.options.splice(cand.answer, 1)[0];
    cand.options.splice(miss, 0, right);
    cand.answer = miss;
  }
  return new Set(qs.map((x) => x.answer)).size;
}

function applyOne(stage, id, spec) {
  const out = { id };
  // ---- quiz ----
  if (spec.quiz?.length) {
    const qf = path.join(stage, `quiz-${id}.json`);
    const q = JSON.parse(fs.readFileSync(qf, 'utf8'));
    const before = q.questions.length;
    if (before < 10) {
      for (const add of spec.quiz) {
        if (q.questions.length >= 10) break;
        q.questions.push({
          id: `q${q.questions.length + 1}`, type: 'single',
          prompt: add.prompt, options: add.options, answer: add.answer, explanation: add.explanation,
        });
      }
      const set = quizRotateTo4(q);
      fs.writeFileSync(qf, JSON.stringify(q, null, 2) + '\n');
      const chk = JSON.parse(fs.readFileSync(qf, 'utf8')).questions;
      out.quiz = `n ${before}->${chk.length} set=${new Set(chk.map((x) => x.answer)).size} idsOK=${chk.every((x, i) => x.id === `q${i + 1}`)} afterRotate=${set === 4}`;
      if (chk.length !== Math.max(before, Math.min(10, before + spec.quiz.length))) out.quiz += ' !!COUNT_MISMATCH';
      if (new Set(chk.map((x) => x.answer)).size < 4) out.quiz += ' !!SET<4';
    } else out.quiz = `skip n=${before}`;
  }
  // ---- interview ----
  if (spec.interview?.length) {
    const ivf = path.join(stage, `interview-${id}.md`);
    let txt = fs.readFileSync(ivf, 'utf8');
    const p = ivParse(txt);
    if (p.nums.length < 15) {
      if (!txt.endsWith('\n')) txt += '\n';
      let n = p.nums.length ? Math.max(...p.nums) : 0;
      let lastLetter = 'Z', lastIdx = 0;
      if (p.fmt === 'letter') {
        const ms = [...txt.matchAll(/^###\s*([A-Z]+)(\d+)\.\s/gm)];
        if (ms.length) { lastLetter = ms[ms.length - 1][1]; lastIdx = +ms[ms.length - 1][2]; }
      }
      if ((p.fmt === 'hashdot' || p.fmt === 'boldDot' || p.fmt === 'letter') && !txt.includes('## 补充')) {
        txt += `\n---\n\n## 补充（新专题 ${n + 1}-15）\n`;
      }
      const appendOnce = () => {
      for (const it of spec.interview) {
        if (n >= 15) break;
        n++;
        if (p.fmt === 'hashdot') txt += `\n### ${n}. ${it.q}\n\n${it.points}\n\n**来源**：${it.src}\n`;
        else if (p.fmt === 'hash') txt += `\n### ${n}）${it.q}\n\n**参考答案**\n${it.points}\n\n**来源**：${it.src}\n`;
        else if (p.fmt === 'boldDot') txt += `\n**${n}. ${it.q}**\n**来源**：${it.src}\n${it.points}\n`;
        else if (p.fmt === 'letter') { lastIdx++; txt += `\n### ${lastLetter}${lastIdx}. ${it.q}\n\n**答**：${it.points}\n\n**来源**：${it.src}。\n`; }
        else txt += `\n---\n\n**${n}）${it.q}**\n- 参考要点：${it.points}\n- 来源：${it.src}\n`;
      }
      };
      appendOnce();
      for (let r = 1; r < (spec.ivRepeat ?? 1); r++) appendOnce();
      txt = txt.replace(/\u5171 12 \u9898/, '\u5171 15 \u9898').replace(/\uff0812 \u9898\uff09/, '\uff0815 \u9898\uff09').replace(/\uff0812\u9898\uff09/, '\uff0815\u9898\uff09');
      fs.writeFileSync(ivf, txt);
      const chk = ivParse(fs.readFileSync(ivf, 'utf8'));
      out.iv = `${p.fmt} ${p.nums.length}->${chk.nums.length} seq=${chk.nums.every((x, i) => x === i + 1)} src=${chk.src}`;
    } else out.iv = `skip n=${p.nums.length}`;
  }
  return out;
}

const [, , cmd, pkgDir, arg4] = process.argv;
if (!fs.existsSync(path.join(pkgDir, 'course.json'))) { console.error('no course.json in', pkgDir); process.exit(1); }
const map = load(pkgDir);

if (cmd === 'scan') {
  for (const [id, { stage }] of map) {
    const qa = JSON.parse(fs.readFileSync(path.join(stage, `quiz-${id}.json`), 'utf8')).questions;
    const bad = qa.map((x, i) => (!x || typeof x.prompt !== 'string' || !Array.isArray(x.options) || x.options.length !== 4 || !Number.isInteger(x.answer) || x.answer < 0 || x.answer > 3 || typeof x.explanation !== 'string' || !x.explanation ? i : -1)).filter((i) => i >= 0);
    if (bad.length) console.log(`!!QUIZBAD ${id} idx=[${bad.join(',')}] ${JSON.stringify(qa[bad[0]]).slice(0, 120)}`);
    const q = qa;
    const iv = ivParse(fs.readFileSync(path.join(stage, `interview-${id}.md`), 'utf8'));
    if (q.length >= 10 && iv.nums.length >= 15) continue;
    console.log(`\n@@${id} q=${q.length} ans=[${q.map((x) => x.answer)}] iv=${iv.nums.length} fmt=${iv.fmt}`);
    console.log('  Q: ' + q.map((x, i) => (x && typeof x.prompt === 'string' ? x.prompt.replace(/\s+/g, ' ').slice(0, 30) : `!!BAD#${i}[${JSON.stringify(x).slice(0,40)}]`)).join(' | '));
    const ivTxt = fs.readFileSync(path.join(stage, `interview-${id}.md`), 'utf8');
    const topics = [...ivTxt.matchAll(/\*\*\d+\uff09(.+?)\*\*|^###\s*\**(\d+)[\uff09.]\s*(.+)/gm)].map((mt) => (mt[1] || mt[3] || '').slice(0, 30));
    console.log('  I: ' + topics.join(' | '));
  }
  process.exit(0);
}

if (cmd === 'apply') {
  const specAll = (await import('file://' + path.resolve(arg4))).default;
  const results = [];
  for (const [id, spec] of Object.entries(specAll)) {
    const ent = map.get(id);
    if (!ent) { results.push({ id, error: 'NOT_IN_MANIFEST' }); continue; }
    try { results.push(applyOne(ent.stage, id, spec)); }
    catch (e) { results.push({ id, error: e.message }); }
  }
  console.log(JSON.stringify(results, null, 0));
  if (results.some((r) => r.error || String(r.quiz || '').includes('!!') || (r.iv || '').includes('false'))) process.exitCode = 1;
  process.exit(0);
}
console.error('unknown cmd'); process.exit(1);
