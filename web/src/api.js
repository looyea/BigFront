// src/api.js —— 与后端交互 + 全局进度状态 + 学习时长打点
import { reactive } from 'vue';

const BASE = '/api';

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}
async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  packages: () => get('/packages'),
  pkg: (id) => get(`/packages/${id}`),
  lesson: (pkg, id) => get(`/packages/${pkg}/lessons/${id}`),
  homework: (pkg, level) => get(`/packages/${pkg}/homework/${level}`),
  examples: (pkg, id) => get(`/packages/${pkg}/examples/${id}`),
  exampleFile: (pkg, id, file) => get(`/packages/${pkg}/examples/${id}/${file}`),
  submitQuiz: (pkg, id, answers) => post('/progress/quiz', { pkgId: pkg, lessonId: id, answers }),
  setHomework: (pkg, id, done) => post('/progress/homework', { pkgId: pkg, lessonId: id, done }),
  complete: (pkg, id) => post('/progress/complete', { pkgId: pkg, lessonId: id }),
  integrity: () => get('/integrity'),
};

/* ---------------------------- 全局进度状态 ---------------------------- */
export const store = reactive({
  progress: null,     // /api/progress 返回
  integrity: null,
});

export async function refreshProgress() {
  try {
    store.progress = await get('/progress');
  } catch (e) {
    console.error('进度加载失败', e);
  }
}
export async function refreshIntegrity() {
  try {
    store.integrity = await api.integrity();
  } catch { /* ignore */ }
}

/** 判断某关卡是否已通关（悬浮导航/地图共用） */
export function isDone(pkgId, lessonId) {
  return store.progress?.lessons?.[`${pkgId}:${lessonId}`]?.completed === true;
}

/* --------------------------- 学习时长打点心跳 --------------------------- */
let active = null;   // { pkgId, lessonId }
let accMs = 0;
let last = 0;
let timer = null;

function flush(useBeacon = false) {
  if (!active || accMs < 1000) {
    if (!useBeacon) return;
  }
  const ms = accMs;
  accMs = 0;
  if (ms <= 0) return;
  const payload = JSON.stringify({ ms, pkgId: active.pkgId, lessonId: active.lessonId });
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(BASE + '/progress/ping', new Blob([payload], { type: 'application/json' }));
  } else {
    post('/progress/ping', JSON.parse(payload)).catch(() => { /* 静默 */ });
  }
}

/** 进入某个学习页面开始计时；repeat 调用会切换目标 */
export function startTracking(pkgId, lessonId) {
  if (active && active.lessonId === lessonId && active.pkgId === pkgId) return;
  stopTracking();
  active = { pkgId, lessonId };
  last = Date.now();
  accMs = 0;
  timer = setInterval(() => {
    const now = Date.now();
    accMs += now - last;
    last = now;
    flush(false);
    refreshProgress();
  }, 15000);
}

export function stopTracking() {
  if (timer) { clearInterval(timer); timer = null; }
  if (active) {
    const now = Date.now();
    accMs += now - last;
    flush(false);
  }
  active = null;
  accMs = 0;
}

// 页面隐藏/关闭时，用 sendBeacon 兜底上报
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (active) { const now = Date.now(); accMs += now - last; last = now; }
      flush(true);
    } else if (active) {
      last = Date.now();
    }
  });
}

/* ------------------------------ 格式化工具 ------------------------------ */
export function fmtDuration(ms) {
  if (!ms || ms < 1000) return '0 秒';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分 ${sec} 秒`;
  return `${sec} 秒`;
}
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
