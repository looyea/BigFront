// utils/glossary.js —— 课文术语标记 + 悬停 Tooltip 引擎
// 数据源：后端 /api/glossary-index（各包 glossary.json 的汇总，永远开放、不看进度）。
// 工作方式：课文 marked 渲染进 DOM 后，遍历 .prose 文本节点，按短语表（跳过代码块/链接/已标记区）
// 把每个术语的【首次出现】包成 <span class="term">；悬停弹卡片（tip + 直达术语表锚点链接），点击术语也跳。
// 本包没有、别的包有的术语（如 ES 课文里出现 CJS）同样能命中，Tooltip 会标注它所属的课程包。
import { api } from '../api.js';
import { router } from '../router.js';

/* ------------------------------ 索引缓存 ------------------------------ */
// 全库术语索引只拉一次；phraseMap: 短语 -> 候选术语数组（本包优先的规则在标记时做）
let indexPromise = null;
let phraseMap = null;
let phraseRegex = null;

function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function ensureIndex() {
  if (!indexPromise) {
    indexPromise = api.glossaryIndex().then((data) => {
      const map = new Map();
      for (const p of data.packages || []) {
        for (const t of p.terms || []) {
          for (const phrase of t.match || [t.term]) {
            if (!map.has(phrase)) map.set(phrase, []);
            map.get(phrase).push({ ...t, pkg: p.pkg, pkgTitle: p.pkgTitle, icon: p.icon });
          }
        }
      }
      // 长短语优先：让 "async/await" 抢在 "await" 前面、"ECMAScript Modules" 抢在 "ES" 前面
      const phrases = [...map.keys()].sort((a, b) => b.length - a.length);
      // 边界：前后不接单词字符/$/.（防止 export 命中 exports、ESM 命中 ESModules）；中文无此顾虑自然放行
      phraseRegex = new RegExp(
        '(?<![$\\w.])(' + phrases.map(escRe).join('|') + ')(?![\\w$.])',
        'g'
      );
      phraseMap = map;
      return data;
    }).catch((e) => {
      indexPromise = null; // 失败允许下次重试（如后端未重启、还没扫到 glossary.json）
      throw e;
    });
  }
  return indexPromise;
}

/* ------------------------------ DOM 标记 ------------------------------ */
const SKIP_TAGS = new Set(['PRE', 'CODE', 'A', 'SCRIPT', 'STYLE', 'BUTTON']);
const MAX_WRAPS = 120; // 单篇课文封顶，防极端长文性能塌方

function inSkipZone(node) {
  let el = node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName) || el.classList.contains('term') || el.id === 'term-pop') return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * 在 rootEl（.prose）内识别术语并包成可悬停 span。
 * currentPkg：当前课程包 id，用于同名词本包优先；每个术语（pkg:id）只标记首次出现。
 */
export async function markTerms(rootEl, currentPkg) {
  if (!rootEl) return;
  await ensureIndex();
  const seen = new Set();
  let wrapped = 0;
  const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.nodeValue.trim() && !inSkipZone(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const targets = [];
  while (walker.nextNode()) targets.push(walker.currentNode);

  for (const textNode of targets) {
    if (wrapped >= MAX_WRAPS) break;
    const text = textNode.nodeValue;
    phraseRegex.lastIndex = 0;
    let m, last = 0, changed = false;
    const frag = document.createDocumentFragment();
    while ((m = phraseRegex.exec(text)) && wrapped < MAX_WRAPS) {
      const phrase = m[1];
      const candidates = phraseMap.get(phrase) || [];
      const hit = candidates.find((c) => c.pkg === currentPkg) || candidates[0];
      if (!hit) continue;
      const key = `${hit.pkg}:${hit.id}`;
      if (seen.has(key)) continue; // 只标首次出现
      seen.add(key);
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      const span = document.createElement('span');
      span.className = 'term';
      span.tabIndex = 0;
      span.dataset.pkg = hit.pkg;
      span.dataset.tid = hit.id;
      span.dataset.title = hit.pkgTitle;
      span.dataset.tip = hit.tip || hit.term;
      span.dataset.full = hit.full || '';
      span.dataset.zh = hit.zh || '';
      span.dataset.cross = hit.pkg === currentPkg ? '0' : '1'; // 跨包术语：Tooltip 标注归属
      span.textContent = phrase;
      frag.appendChild(span);
      last = m.index + phrase.length;
      changed = true;
      wrapped++;
    }
    if (changed) {
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    }
  }
}

/* ------------------------------ Tooltip ------------------------------ */
let pop = null;      // 单例浮层
let hideTimer = null;
let boundRoot = null;

function ensurePop() {
  if (pop) return pop;
  pop = document.createElement('div');
  pop.id = 'term-pop';
  pop.className = 'term-pop';
  pop.style.display = 'none';
  document.body.appendChild(pop);
  // 鼠标从术语移进卡片要继续停留（卡片里有可点的链接），移出后再延迟收起
  pop.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  pop.addEventListener('mouseleave', () => scheduleHide());
  // 卡片内跳术语表的链接走 SPA 路由，不整页刷新
  pop.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-spa]');
    if (!a) return;
    e.preventDefault();
    router.push(a.getAttribute('href'));
    hide();
  });
  return pop;
}

function show(termEl) {
  const p = ensurePop();
  clearTimeout(hideTimer);
  const pkg = termEl.dataset.pkg;
  const tid = termEl.dataset.tid;
  const href = `/g/${pkg}#term-${tid}`;
  const cross = termEl.dataset.cross === '1';
  p.innerHTML =
    `<div class="tp-head"><b>${escHtml(termEl.textContent)}</b>` +
    (termEl.dataset.full ? `<span class="tp-full">${escHtml(termEl.dataset.full)}</span>` : '') +
    (termEl.dataset.zh ? `<span class="tp-zh">${escHtml(termEl.dataset.zh)}</span>` : '') +
    `</div>` +
    `<div class="tp-tip">${escHtml(termEl.dataset.tip)}</div>` +
    `<div class="tp-foot">` +
    `<span class="tp-pkg">${cross ? '📦 属于' : '📖'} ${escHtml(termEl.dataset.title)}${cross ? ' 术语表' : ''}</span>` +
    `<a href="${href}" data-spa>在术语表中查看 →</a></div>`;
  p.style.display = 'block';
  // 定位：术语上方优先，放不下就下方；水平夹在视口内
  const r = termEl.getBoundingClientRect();
  const pw = p.offsetWidth, ph = p.offsetHeight;
  let top = r.top - ph - 8;
  if (top < 8) top = Math.min(r.bottom + 8, window.innerHeight - ph - 8);
  let left = Math.min(Math.max(r.left, 8), window.innerWidth - pw - 8);
  p.style.top = `${top}px`;
  p.style.left = `${left}px`;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, 250);
}
function hide() {
  if (pop) pop.style.display = 'none';
}

/** 事件委托：只需绑一次，挂在课文容器上（v-html 重渲染后 span 依旧能被捕获） */
export function bindTermTips(rootEl) {
  if (!rootEl || boundRoot === rootEl) return;
  boundRoot = rootEl;
  rootEl.addEventListener('mouseover', (e) => {
    const t = e.target.closest('.term');
    if (t) show(t);
  });
  rootEl.addEventListener('mouseout', (e) => {
    if (e.target.closest('.term')) scheduleHide();
  });
  rootEl.addEventListener('focusin', (e) => {
    if (e.target.classList?.contains('term')) show(e.target);
  });
  rootEl.addEventListener('focusout', (e) => {
    if (e.target.classList?.contains('term')) scheduleHide();
  });
  // 点击术语 = 直达术语表对应条目（与卡片里的链接同目标，少一次移动）
  rootEl.addEventListener('click', (e) => {
    const t = e.target.closest('.term');
    if (!t) return;
    e.preventDefault();
    router.push(`/g/${t.dataset.pkg}#term-${t.dataset.tid}`);
    hide();
  });
}
