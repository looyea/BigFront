const fs = require('fs'), path = require('path');
const refs = ['react-usestate','vue-reactivity-theory','svelte-reactive-runes','solid-signals','solid-effect-tracking','tc39-core','sig-map','sig-scenarios','za-core','za-patterns','za-middleware','sig-auth','sig-server','sig-vs-streams','sig-size','sig-perf','sig-landscape','sig-mutability','sig-migrate','sig-roadmap','rx-basics','kit-routing','kit-load-universal','kit-forms','kit-streams','nuxt-ssr','next-routing','vue-router','react-context','react-jsx','vue-template','svelte-template','vue-directives','solid-internals','vite-vitest','vite-ci-perf','vite-deps-perf','mp-events','mp-login','mp-cross','mobx-stores','react-render-model','svelte-overview','solid-overview','vue-cli-vite','solid-directives','vue-computed-watch','react-form-library','nuxt-modules','kit-performance','svelte-kit','tc39-frameworks'];
const all = new Set();
for (const pkg of fs.readdirSync('e:/Projects/BigFront/courses')) {
  const f = path.join('e:/Projects/BigFront/courses', pkg, 'course.json');
  if (!fs.existsSync(f)) continue;
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const lv of j.levels ?? []) for (const ls of lv.lessons ?? []) all.add(ls.id);
}
const missing = refs.filter(r => !all.has(r));
fs.writeFileSync('e:/Projects/BigFront/_t.txt', 'TOTAL=' + all.size + '\nMISSING:\n' + missing.join('\n'), 'utf8');
