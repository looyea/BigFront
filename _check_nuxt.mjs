// temp checker for 08-nuxt integrity & quality (delete after package done)
import fs from 'fs';
const R = 'courses/08-nuxt/';
const course = JSON.parse(fs.readFileSync(R + 'course.json', 'utf8'));
let problems = 0;
const notes = [];
for (const lv of course.levels) {
  const hw = R + 'homework/' + lv.id + '.md';
  if (!fs.existsSync(hw)) { problems++; notes.push('MISS homework ' + lv.id + '.md'); }
  else if (fs.statSync(hw).size < 1500) { problems++; notes.push('SMALL homework ' + lv.id + '.md ' + fs.statSync(hw).size + 'B'); }
  for (const ls of lv.lessons) {
    const L = R + 'lessons/' + ls.id + '.md';
    const I = R + 'interviews/' + ls.id + '.md';
    const Q = R + 'quizzes/' + ls.id + '.json';
    if (!fs.existsSync(L)) { problems++; notes.push('MISS lesson ' + ls.id + '.md'); }
    else if (Buffer.byteLength(fs.readFileSync(L, 'utf8'), 'utf8') < 4000) { problems++; notes.push('SMALL lesson ' + ls.id + '.md'); }
    if (!fs.existsSync(I)) { problems++; notes.push('MISS interview ' + ls.id + '.md'); }
    if (!fs.existsSync(Q)) { problems++; notes.push('MISS quiz ' + ls.id + '.json'); }
    else {
      try {
        const q = JSON.parse(fs.readFileSync(Q, 'utf8'));
        const qs = q.questions || [];
        if (qs.length < 5) { problems++; notes.push('FEW quiz ' + ls.id + ' (' + qs.length + ')'); }
        const ans = qs.map(x => x.answer);
        for (const [i, x] of qs.entries()) {
          if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= (x.options || []).length) { problems++; notes.push('BADIDX quiz ' + ls.id + ' q' + (i + 1)); }
        }
        if (new Set(ans).size === 1 && ans.length >= 5) { problems++; notes.push('uni-answer ' + ls.id); }
      } catch (e) { problems++; notes.push('BADJSON quiz ' + ls.id + ': ' + e.message); }
    }
  }
}
const levels = course.levels.length;
const lessons = course.levels.reduce((s, l) => s + l.lessons.length, 0);
notes.forEach(n => console.log(n));
console.log('levels=' + levels + ' lessons=' + lessons + ' problems=' + problems);
