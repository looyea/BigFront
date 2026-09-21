const fs = require('fs'), path = require('path')
function walk(d) { let r = []; for (const f of fs.readdirSync(d)) { const p = path.join(d, f); const s = fs.statSync(p); if (s.isDirectory()) r = r.concat(walk(p)); else if (/\.(md|json)$/.test(f)) r.push(p) } return r }
const files = walk(process.argv[2])
for (const k of process.argv.slice(3)) {
  let n = 0, where = []
  const re = new RegExp(k.replace(/[$()*+.?[\\\]^{|}]/g, m => '\\' + m), 'gi')
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8')
    const c = (t.match(re) || []).length
    if (c) { n += c; where.push(path.basename(f) + ':' + c) }
  }
  console.log(k.padEnd(22), n, where.slice(0, 6).join(' | '))
}
