// tools/theme-contrast-check.cjs —— 主题配色对比度自检（WCAG 2.1 相对亮度）
// 用途：新增/调整 web/src/styles/theme.css 的主题 token 后，跑一遍确认代码高亮与正文在
//       各自底色上都不低于阈值（默认 3:1），避免浅色主题下字符串/注释糊成一片。
// 用法：node tools/theme-contrast-check.cjs
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'web', 'src', 'styles', 'theme.css'), 'utf8');

/** 解析一个 token 块（:root 或 html[data-theme="x"]）里的自定义属性 */
function parseBlocks(css) {
  const blocks = [];
  const re = /(:root|html\[data-theme="([a-z]+)"\])\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[3].replace(/\/\*[\s\S]*?\*\//g, '');   // 先剔除块内注释，避免行尾说明被当成值的一部分
    const vars = {};
    // 值里可能含逗号（radial-gradient），按行取 --name: value;
    for (const line of body.split('\n')) {
      const vm = /^\s*(--[\w-]+):\s*(.+?)\s*;?\s*$/.exec(line);
      if (vm) (vars[vm[1]] = vars[vm[1]] ? vars[vm[1]] + ' ' + vm[2] : vm[2]);
      else if (vm === null && /^\s{4,}\S/.test(line) && Object.keys(vars).length) {
        const last = Object.keys(vars).pop();
        vars[last] += ' ' + line.trim();           // 多行值（渐变）续接到上一个变量
      }
    }
    blocks.push({ id: m[2] || 'night', vars });
  }
  return blocks;
}

const hex = (h) => {
  h = h.trim().replace(/;$/, '');
  if (!/^#[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const lum = ([r, g, b]) =>
  [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
const ratio = (fg, bg) => {
  const [l1, l2] = [lum(fg), lum(bg)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};

const blocks = parseBlocks(CSS);
// :root 提供缺省 token，[data-theme] 块整组覆盖：先铺缺省再合并
const root = blocks.find((b) => b.id === 'night').vars;
const resolve = (b, name) => b.vars[name] ?? root[name];

const HL = ['--hl-keyword', '--hl-string', '--hl-number', '--hl-title', '--hl-attr', '--hl-builtin', '--hl-comment', '--hl-literal'];
const TH = ['--text', '--text-dim', '--text-faint', '--gold', '--blue', '--purple', '--accent-2', '--ok', '--warn'];
let bad = 0;

for (const b of blocks) {
  const codeBg = hex(resolve(b, '--code-bg'));
  const pageBg = hex(resolve(b, '--bg'));
  const panel = hex(resolve(b, '--panel'));
  const rows = [];
  for (const t of HL) {
    const c = hex(resolve(b, t));
    if (c && codeBg) rows.push([t, ratio(c, codeBg)]);
  }
  for (const t of TH) {
    const c = hex(resolve(b, t));
    // 正文类色块同时会出现在页面底与卡片底上，取较差的一侧
    if (c && pageBg) rows.push([t, Math.min(ratio(c, pageBg), panel ? ratio(c, panel) : 99)]);
  }
  const fails = rows.filter(([, r]) => r < 3);
  const weak = rows.filter(([, r]) => r >= 3 && r < 4.5);
  console.log(`\n[${b.id}] code-bg=${resolve(b, '--code-bg')} 最低 ${Math.min(...rows.map(([, r]) => r)).toFixed(2)}:1`);
  for (const [t, r] of rows.sort((x, y) => x[1] - y[1]).slice(0, 4)) console.log(`   ${r.toFixed(2)}:1  ${t}`);
  if (fails.length) { bad++; console.log(`   ❌ 低于 3:1：${fails.map((f) => f[0]).join(', ')}`); }
  else if (weak.length) console.log(`   ✅ 达标（${weak.length} 项处于 3~4.5:1 的装饰性用色）`);
  else console.log('   ✅ 全部 ≥4.5:1');
}
console.log(bad ? `\n❌ ${bad} 个主题未达标` : '\n✅ 全部主题通过（≥3:1）');
process.exit(bad ? 1 : 0);
