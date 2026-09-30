// src/themes.js —— 外观（主题 + 正文字号）：清单、应用、以及「双层记忆」持久化
//
// 为什么要两层记忆（这正是"下次打开被调成默认"的根因）：
//  ① localStorage —— 零延迟、后端没起也管用；index.html 的内联脚本在样式表加载前读它，首屏不闪默认值。
//  ② 后端 data/appearance.json —— localStorage 按 origin（协议+主机+端口）隔离：
//     dev 用 http://localhost:5173、prod 用 http://localhost:3001 或 http://127.0.0.1:3001，
//     这三个 origin 各存一份，于是"在 A 端口调好、到 B 端口打开就成了默认"；清缓存/换浏览器/无痕同理。
//     所以挂载后再跟后端对一次账。
// 合并规则：后端有记录（updatedAt 非空）→ 后端赢，回灌本地；后端从没记过 → 把当前本地值种上去。
//
// 主题约定：id 'night' 是默认暗色，theme.css 的 :root 即它（html 上不带 data-theme 属性）；
// 其余 id 对应 theme.css 里一个 html[data-theme="id"] token 块。新增主题两边各登记一处即可；
// 清单顺序 = ThemeSwitcher 面板里的分组出现顺序（kind 相同的会归到同一组）。
import { reactive } from 'vue';
import { api, appearanceBeacon } from './api.js';

export const THEMES = [
  {
    id: 'night', name: '深夜墨蓝', kind: '深色', desc: 'VS Code Dark+ 灵感，原版默认',
    swatch: ['#1e1e1e', '#d4d4d4', '#007acc', '#4ec9b0'],
  },
  {
    id: 'solarized', name: 'Solarized 夜', kind: '深色', desc: '低对比经典暗色，蓝绿调',
    swatch: ['#002b36', '#93a1a1', '#268bd2', '#2aa198'],
  },
  {
    id: 'dimmed', name: '柔和暗灰', kind: '深色·护眼', desc: 'Dark Dimmed 系，暗色里最不刺眼',
    swatch: ['#22272e', '#adbac7', '#539bf5', '#6cb6a6'],
  },
  {
    id: 'paper', name: '纸感浅色', kind: '浅色', desc: '清透明亮，投影/演示场景',
    swatch: ['#f7f8fa', '#2f3437', '#2563eb', '#0d9488'],
  },
  {
    id: 'mist', name: '冷雾蓝灰', kind: '浅色', desc: '低饱和冷调，亮而不刺',
    swatch: ['#eaeef2', '#2b333b', '#0b6b8f', '#1a7f6e'],
  },
  {
    id: 'eyecare', name: '护眼豆绿', kind: '浅色·护眼', desc: '豆绿底低刺激，长时间阅读首选',
    swatch: ['#dceedd', '#2d3a2e', '#2f8a4c', '#10796f'],
  },
  {
    id: 'sepia', name: '护眼米黄', kind: '浅色·护眼', desc: 'sepia 暖调，仿纸质书页',
    swatch: ['#f0e6d2', '#433a2c', '#b0702a', '#5c7d3a'],
  },
];

// ---------------- 正文字号：5 档，面板按「从大到小」的顺序渲染 ----------------
// scale 被写到 html 的 --fs 上，由 theme.css 的 .wrap/.topbar { zoom: var(--fs) } 消费：
// 整块等比放大（文字、行距、代码块一起变大），语义等同浏览器缩放，
// 课文 / 小测 / 作业 / 面试题这些运行时渲染出来的结构不用逐条改 font-size 就能跟随。
// 正文基准 17px：1.35≈23 / 1.18≈20 / 1 标准 / 0.9≈15 / 0.8≈14
export const FS_LEVELS = [
  { scale: 1.35, name: '特大' },
  { scale: 1.18, name: '大' },
  { scale: 1, name: '标准' },
  { scale: 0.9, name: '小' },
  { scale: 0.8, name: '紧凑' },
];

export const DEFAULT_THEME = 'night';
export const DEFAULT_FS = 1;
export const THEME_KEY = 'bigfront.theme';
export const FS_KEY = 'bigfront.fs';

// 形状校验：只认清单里的值，挡掉手改 localStorage / 后端数据被写坏时的脏值
function validTheme(id) { return THEMES.some((t) => t.id === id) ? id : null; }
function validFs(v) { const n = Number(v); return FS_LEVELS.some((l) => l.scale === n) ? n : null; }

function readThemeLocal() { return validTheme(localStorage.getItem(THEME_KEY)) || DEFAULT_THEME; }
function readFsLocal() { return validFs(localStorage.getItem(FS_KEY)) ?? DEFAULT_FS; }

// 全局外观状态：组件直接绑它，于是「用户点的」和「后端同步回来的」走同一条路，UI 不会各说各话
// sync：local 仅本机 / saving 同步中 / saved 已存到后端 / offline 后端没连（自动只记本机）
export const appearance = reactive({
  theme: readThemeLocal(),
  fs: readFsLocal(),
  sync: 'local',
});

/** 应用主题：night 走 :root 缺省（移除属性），其余写到 html[data-theme] */
export function applyTheme(id) {
  const root = document.documentElement;
  if (id === DEFAULT_THEME) root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', id);
}

/** 应用字号：标准档不写内联变量，保持「缺省 = theme.css 里的 --fs: 1」 */
export function applyFs(scale) {
  const v = Number(scale) || DEFAULT_FS;
  if (v === DEFAULT_FS) document.documentElement.style.removeProperty('--fs');
  else document.documentElement.style.setProperty('--fs', String(v));
}

function applyBoth() { applyTheme(appearance.theme); applyFs(appearance.fs); }
function saveLocal() {
  localStorage.setItem(THEME_KEY, appearance.theme);
  localStorage.setItem(FS_KEY, String(appearance.fs));
}

/* ------------------------- 写后端：防抖合并 + 关页面兜底 ------------------------- */
let pushTimer = null;
let pending = false;

function schedulePush() {
  appearance.sync = 'saving';
  pending = true;
  if (pushTimer) return;               // 400ms 内连点只发最后一次
  pushTimer = setTimeout(() => { pushTimer = null; pushToServer(); }, 400);
}

async function pushToServer() {
  if (!pending) return;
  pending = false;
  const body = { theme: appearance.theme, fs: appearance.fs };
  try { await api.saveAppearance(body); appearance.sync = 'saved'; }
  catch { appearance.sync = 'offline'; }   // 只跑 vite、后端没起：静默降级为本机记忆，不影响使用
}

// 刚调完就关页面 / 切后台时防抖还没发出去 → sendBeacon 兜住最后一份（与时长打点同一套做法）
function pushBeacon() {
  if (!pending) return;
  appearanceBeacon({ theme: appearance.theme, fs: appearance.fs });
}
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', pushBeacon);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') pushBeacon();
  });
}

/* ---------------------------- 读后端：以服务端为准回灌 ---------------------------- */
async function syncFromServer() {
  try {
    const remote = await api.getAppearance();
    if (remote && remote.updatedAt) {
      // 后端有记录 → 覆盖本地（换端口、换浏览器、清缓存后都能带回，这是"不会一下变默认"的关键）
      const t = validTheme(remote.theme);
      const f = validFs(remote.fs);
      if (t && f && (t !== appearance.theme || f !== appearance.fs)) {
        appearance.theme = t;
        appearance.fs = f;
        saveLocal();
        applyBoth();
      }
      appearance.sync = 'saved';
    } else {
      // 后端从没记过（第一次用）→ 把当前本地选择种上去
      pending = true;
      await pushToServer();
    }
  } catch {
    appearance.sync = 'offline';
  }
}

/** 切换主题并记住（本地即时 + 后端持久化） */
export function setTheme(id) {
  const t = validTheme(id);
  if (!t) return;
  appearance.theme = t;
  saveLocal();
  applyBoth();
  schedulePush();
}

/** 切换正文字号并记住：点完正文立刻变大/变小，无需刷新 */
export function setFs(scale) {
  const f = validFs(scale);
  if (f === null) return;
  appearance.fs = f;
  saveLocal();
  applyBoth();
  schedulePush();
}

// 兼容旧调用：外观是单例状态，读取一律走 appearance
export const getTheme = () => appearance.theme;
export const getFs = () => appearance.fs;

/** 入口调用一次（main.js）：先按本地值即时生效，再跟后端对一次账 */
export function initAppearance() {
  applyBoth();
  syncFromServer();
}
