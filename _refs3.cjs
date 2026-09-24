const fs = require('fs'), path = require('path');
const all = new Set();
for (const pkg of fs.readdirSync('e:/Projects/BigFront/courses')) {
  const f = path.join('e:/Projects/BigFront/courses', pkg, 'course.json');
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const lv of j.levels ?? []) for (const ls of lv.lessons ?? []) all.add(ls.id);
}
const ang = JSON.parse(fs.readFileSync('e:/Projects/BigFront/courses/15-angular/course.json', 'utf8'));
const txt = JSON.stringify(ang);
const refs = [...txt.matchAll(/[a-z][a-z0-9]+(?:-[a-z0-9]+)+/g)].map(m => m[0]);
const bad = [...new Set(refs)].filter(r => !all.has(r) && !['15-angular','14-signals','12-sveltekit','13-solid','11-svelte','08-nuxt','@angular/ssr'].some(k => r.includes(k.split('-')[0]) && false));
const realBad = [...new Set(refs)].filter(r => !all.has(r));
fs.writeFileSync('e:/Projects/BigFront/_t.txt', 'non-id tokens (allowlist-check):\n' + realBad.join('\n'), 'utf8');
