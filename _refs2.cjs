const fs = require('fs'), path = require('path');
for (const pkg of ['04-vue','05-react','06-miniprogram','08-nuxt','12-sveltekit','11-svelte','13-solid']) {
  const j = JSON.parse(fs.readFileSync(path.join('e:/Projects/BigFront/courses', pkg, 'course.json'), 'utf8'));
  const ids = j.levels.flatMap(l => (l.lessons ?? []).map(x => x.id));
  fs.appendFileSync('e:/Projects/BigFront/_t.txt', pkg + ':\n' + ids.join(', ') + '\n\n', 'utf8');
}
