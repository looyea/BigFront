// 临时统计：每个题库的「正确项位置」分布，找出严重偏斜（同一位置占比过高）的整套题
// 用法：node tools/_rich-test.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.startsWith('quiz-') && name.endsWith('.json')) out.push(p);
  }
  return out;
}

const rows = [];
for (const f of walk('courses')) {
  const qz = JSON.parse(readFileSync(f, 'utf8'));
  const ans = (qz.questions ?? []).map((q) => q.answer).filter((a) => a !== undefined);
  if (ans.length < 6) continue;
  const dist = {};
  for (const a of ans) dist[a] = (dist[a] ?? 0) + 1;
  const top = Object.entries(dist).sort((x, y) => y[1] - x[1])[0];
  rows.push({ f, n: ans.length, topIdx: top[0], topPct: Math.round((top[1] / ans.length) * 100) });
}
rows.sort((a, b) => b.topPct - a.topPct);
console.log('参与统计的题库（≥6 题）:', rows.length);
console.log('占比≥60% 的套数:', rows.filter((r) => r.topPct >= 60).length);
console.log('占比=100% 的套数:', rows.filter((r) => r.topPct === 100).length);
console.log('最偏斜前 15 套:');
for (const r of rows.slice(0, 15)) console.log(`  ${r.topPct}% @idx${r.topIdx}  n=${r.n}  ${r.f}`);
