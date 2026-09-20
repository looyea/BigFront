/**
 * index.js —— 大前端学习平台后端服务
 * 职责：
 *  1. 启动时扫描 courses/ 目录下所有课程包（读取每个包的 course.json 大纲 manifest）
 *  2. 提供课程包 / 关卡 / 课文(Markdown) / 作业(Markdown) / 测验(JSON) 的只读 API
 *  3. 维护 data/progress.json：学习时长打点、关卡完成状态、每日记录（可提交到 GitHub）
 *
 * 安全要点（v1.1 加固）：
 *  - 所有文件路径参数经「白名单段校验 + safeJoin(以子目录为根) + realpath 兜底」三重防穿越
 *  - 通关链路（quiz/homework/complete）服务端强制校验关卡是否解锁，杜绝跳级
 *  - 判分与答案只在提交后返回；课文下发时剔除 answer/explanation
 *  - 进度写盘：串行化 + 临时文件原子 rename + 进程退出前刷盘，保护用户打卡记录
 *  - 仅监听 127.0.0.1，CORS 限定本地来源
 *
 * v1.2 变更：
 *  - 进度档案由 JSON 迁移为「人能读、人能改」的 Markdown（data/progress.md）；
 *    旧 progress.json 首启动自动迁移并改名为 .migrated。样例见 data/sample-progress.md。
 *  - 每个课程包新增 interviews/<lessonId>.md（面试题）；随课文一并下发给前端。
 */
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COURSES_DIR = path.join(ROOT, 'courses');
const DATA_DIR = path.join(ROOT, 'data');
// 进度档案：改用「人能读、人能改」的 Markdown（详见 data/sample-progress.md）
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.md');
const LEGACY_JSON = path.join(DATA_DIR, 'progress.json');
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
// 仅允许本地来源（开发期 Vite 已同源代理，生产模式同源托管，无需放开 *）
app.use(cors({ origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/] }));
app.use(express.json({ limit: '1mb' }));

/* ------------------------------ 工具函数 ------------------------------ */

/** 合法的单段路径名：仅字母数字._-，且不含 .. 与分隔符 */
function isSafeSegment(s) {
  return typeof s === 'string' && s.length > 0 && s.length <= 128
    && !s.includes('..') && /^[A-Za-z0-9._-]+$/.test(s);
}

/** 防目录穿越：解析并确认目标严格落在 baseDir 之内（baseDir 应是被白名单校验过的子目录） */
function safeJoin(baseDir, ...segments) {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, ...segments);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

/** 落盘后再用 realpath 兜底（防软链逃逸），确认仍在 baseDir 内 */
async function withinBase(file, baseDir) {
  const real = await fsp.realpath(file).catch(() => null);
  if (!real) return false;
  const base = path.resolve(baseDir);
  return real === base || real.startsWith(base + path.sep);
}

async function readTextIfExists(file) {
  try {
    return await fsp.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/* ---------------------------- 课程包扫描与校验 ---------------------------- */

/** 内存索引：pkgId -> { manifest, lessonMap: Map<lessonId, lessonMeta>, pkgDir } */
const courseIndex = new Map();
/** 扫描警告（文件缺失等），在 /api/integrity 可查，便于自查课程包完整性 */
const scanWarnings = [];

function buildIndex() {
  courseIndex.clear();
  scanWarnings.length = 0;
  if (!fs.existsSync(COURSES_DIR)) {
    scanWarnings.push('courses/ 目录不存在');
    return;
  }
  for (const dirEntry of fs.readdirSync(COURSES_DIR, { withFileTypes: true })) {
    if (!dirEntry.isDirectory()) continue;
    const pkgDir = path.join(COURSES_DIR, dirEntry.name);
    // 课程大纲用 course.json（刻意不用 package.json，避免与 Node 模块解析冲突）
    const manifestFile = path.join(pkgDir, 'course.json');
    if (!fs.existsSync(manifestFile)) {
      scanWarnings.push(`课程包 ${dirEntry.name} 缺少 course.json 大纲文件，已跳过`);
      continue;
    }
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch (e) {
      scanWarnings.push(`课程包 ${dirEntry.name} 的 course.json 解析失败：${e.message}`);
      continue;
    }
    if (!manifest.id || !Array.isArray(manifest.levels)) {
      scanWarnings.push(`课程包 ${dirEntry.name} 大纲缺少 id 或 levels，已跳过`);
      continue;
    }
    const lessonMap = new Map();
    for (const level of manifest.levels) {
      for (const lesson of level.lessons ?? []) {
        lessonMap.set(lesson.id, { ...lesson, levelId: level.id, pkgId: manifest.id });
        const mdFile = path.join(pkgDir, 'lessons', `${lesson.id}.md`);
        if (!fs.existsSync(mdFile)) {
          scanWarnings.push(`[${manifest.id}] 关卡 ${lesson.id} 缺少课文文件 lessons/${lesson.id}.md`);
        }
        // 面试题：每个关卡都应有 interviews/<lessonId>.md（作为课末实战）
        const ivFile = path.join(pkgDir, 'interviews', `${lesson.id}.md`);
        if (!fs.existsSync(ivFile)) {
          scanWarnings.push(`[${manifest.id}] 关卡 ${lesson.id} 缺少面试题文件 interviews/${lesson.id}.md`);
        }
      }
      const hwFile = path.join(pkgDir, 'homework', `${level.id}.md`);
      if (!fs.existsSync(hwFile)) {
        scanWarnings.push(`[${manifest.id}] 阶段 ${level.id} 缺少作业文件 homework/${level.id}.md`);
      }
    }
    if (manifest.id !== dirEntry.name) {
      scanWarnings.push(`课程包目录名 ${dirEntry.name} 与 manifest.id "${manifest.id}" 不一致`);
    }
    courseIndex.set(manifest.id, { manifest, lessonMap, pkgDir });
  }
  console.log(`[courses] 已加载 ${courseIndex.size} 个课程包：`, [...courseIndex.keys()].join(', '));
  if (scanWarnings.length) {
    console.warn(`[courses] 扫描发现 ${scanWarnings.length} 条完整性问题：`);
    scanWarnings.forEach((w) => console.warn('  -', w));
  }
}

/* ------------------------------- 进度数据结构 ------------------------------ */

function defaultProgress() {
  return {
    createdAt: new Date().toISOString(),
    totalMs: 0,
    firstStudyAt: null,
    lastStudyAt: null,
    lessons: {},   // { "pkg:lesson": {completed,quizBest,quizTotal,homeworkDone,completedAt,attempts} }
    days: {},      // { "YYYY-MM-DD": ms }
    events: [],    // 最近 500 条
  };
}

/** 把任意可疑数据归一化成合法形状，避免人工编辑/撕裂写后稳定 500 */
function normalizeProgress(obj) {
  const d = defaultProgress();
  if (!obj || typeof obj !== 'object') return d;
  const out = {
    ...d,
    ...obj,
    totalMs: Number.isFinite(obj.totalMs) ? obj.totalMs : 0,
    lessons: obj.lessons && typeof obj.lessons === 'object' ? obj.lessons : {},
    days: obj.days && typeof obj.days === 'object' ? obj.days : {},
    events: Array.isArray(obj.events) ? obj.events.slice(-500) : [],
  };
  return out;
}

/* ------------------------------ Markdown 序列化 ------------------------------
 * 进度档案以「人能读、人能改」的 Markdown 存储：
 *   ## 概览 (overview)     4 个 bullet
 *   ## 关卡 (lessons)      以 `pkg:lesson` 为主键的表格
 *   ## 每日 (days)         日期 → 毫秒
 *   ## 事件 (events)       最近 500 条
 * 小节标题与表头是硬性契约；用户可随意改数值行，服务下次加载即生效。
 * -------------------------------------------------------------------------- */
function renderProgressMd(p) {
  const L = [];
  L.push('# 大前端学院 · 学习进度档案');
  L.push('');
  L.push('> 本文件既给人看，也给人改。**请保留下面的小节标题与表头**，其余行随你便。');
  L.push('> 想从零开始打卡？删除本文件即可，服务下次启动会自动重建。');
  L.push('> 结构不确定？看同目录 `sample-progress.md`。');
  L.push('');
  L.push('## 概览 (overview)');
  L.push('');
  L.push(`- 创建时间: ${p.createdAt || ''}`);
  L.push(`- 首次学习: ${p.firstStudyAt || ''}`);
  L.push(`- 最近学习: ${p.lastStudyAt || ''}`);
  L.push(`- 累计时长毫秒: ${Number(p.totalMs) || 0}`);
  L.push('');
  L.push('## 关卡 (lessons)');
  L.push('');
  L.push('| 键(pkg:lesson) | 通关 | 小测最好 | 小测总题 | 作业完成 | 通关时间 | 尝试次数 |');
  L.push('| --- | --- | --- | --- | --- | --- | --- |');
  for (const [key, r] of Object.entries(p.lessons || {})) {
    L.push(`| ${key} | ${!!r.completed} | ${Number(r.quizBest) || 0} | ${Number(r.quizTotal) || 0} | ${!!r.homeworkDone} | ${r.completedAt || ''} | ${Number(r.attempts) || 0} |`);
  }
  L.push('');
  L.push('## 每日 (days)');
  L.push('');
  L.push('| 日期 | 时长毫秒 |');
  L.push('| --- | --- |');
  for (const [d, ms] of Object.entries(p.days || {}).sort((a, b) => a[0].localeCompare(b[0]))) {
    L.push(`| ${d} | ${Number(ms) || 0} |`);
  }
  L.push('');
  L.push('## 事件 (events)');
  L.push('');
  L.push('| 时间 | 课程包 | 关卡 | 事件 |');
  L.push('| --- | --- | --- | --- |');
  for (const e of (p.events || []).slice(-500)) {
    const safeType = String(e.type || '').replace(/\|/g, '\\|');
    L.push(`| ${e.at || ''} | ${e.pkgId || ''} | ${e.lessonId || ''} | ${safeType} |`);
  }
  L.push('');
  return L.join('\n');
}

/** 抓 `## 标题` 段落内的表格数据行（跳过表头/分隔行）。 */
function _mdTableSection(lines, header) {
  const rows = [];
  let inSec = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line === header) { inSec = true; continue; }
    if (inSec && line.startsWith('## ')) break;
    if (!inSec || !line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    if (!cells.length) continue;
    if (cells.every((c) => c === '' || /^-{2,}$/.test(c))) continue; // 分隔行 |---|---|
    // 表头行：以关键字判断（这样即使分隔行缺失也不把表头当数据）
    if (cells[0].includes('键(pkg:lesson)') || cells[0] === '日期' || cells[0] === '时间') continue;
    rows.push(cells);
  }
  return rows;
}

function parseProgressMd(text) {
  const p = defaultProgress();
  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    let m;
    if ((m = line.match(/^- 创建时间:\s*(.*)$/))) p.createdAt = m[1] || p.createdAt;
    else if ((m = line.match(/^- 首次学习:\s*(.*)$/))) p.firstStudyAt = m[1] || null;
    else if ((m = line.match(/^- 最近学习:\s*(.*)$/))) p.lastStudyAt = m[1] || null;
    else if ((m = line.match(/^- 累计时长毫秒:\s*(\d+)/))) p.totalMs = Number(m[1]) || 0;
  }
  for (const r of _mdTableSection(lines, '## 关卡 (lessons)')) {
    const [key, completed, quizBest, quizTotal, homeworkDone, completedAt, attempts] = r;
    if (!key) continue;
    p.lessons[key] = {
      completed: completed === 'true',
      quizBest: Number(quizBest) || 0,
      quizTotal: Number(quizTotal) || 0,
      homeworkDone: homeworkDone === 'true',
      completedAt: completedAt || null,
      attempts: Number(attempts) || 0,
    };
  }
  for (const r of _mdTableSection(lines, '## 每日 (days)')) {
    if (r[0]) p.days[r[0]] = Number(r[1]) || 0;
  }
  for (const r of _mdTableSection(lines, '## 事件 (events)')) {
    const [at, pkgId, lessonId, type] = r;
    if (!at) continue;
    p.events.push({ at, pkgId: pkgId || null, lessonId: lessonId || null, type: type || '' });
  }
  return normalizeProgress(p);
}

let progress = defaultProgress();
let loadPromise = null;

async function doLoad() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  const mdRaw = await readTextIfExists(PROGRESS_FILE);
  if (mdRaw !== null) {
    try {
      progress = parseProgressMd(mdRaw);
      return;
    } catch (e) {
      console.error('[progress] MD 解析失败，已备份并重建：', e.message);
      await fsp.writeFile(PROGRESS_FILE + '.corrupt', mdRaw, 'utf8').catch(() => {});
      progress = defaultProgress();
      await persist();
      return;
    }
  }
  // 一次性迁移：若旧版 progress.json 还在，读它 → 渲染为 MD → 把 JSON 改名 .migrated
  const legacyRaw = await readTextIfExists(LEGACY_JSON);
  if (legacyRaw !== null) {
    try {
      progress = normalizeProgress(JSON.parse(legacyRaw));
      console.log('[progress] 已从旧版 progress.json 迁移到 progress.md（原文件改名 progress.json.migrated）');
    } catch {
      progress = defaultProgress();
    }
    await fsp.rename(LEGACY_JSON, LEGACY_JSON + '.migrated').catch(() => {});
    await persist();
    return;
  }
  // 全新初始化：立刻落一份带说明的 MD 骨架，用户可直接打开看到结构
  progress = defaultProgress();
  await persist();
}
function loadProgress() {
  if (!loadPromise) {
    loadPromise = doLoad().catch((e) => {
      loadPromise = null; // 失败允许下次重试
      console.error('[progress] 加载失败：', e.message);
    });
  }
  return loadPromise;
}

/* --------------------------- 串行化 + 原子写 + 退出刷盘 --------------------------- */

let writeChain = Promise.resolve();
let writeTimer = null;

function persist() {
  writeChain = writeChain.then(async () => {
    const tmp = PROGRESS_FILE + '.tmp';
    await fsp.writeFile(tmp, renderProgressMd(progress), 'utf8');
    await fsp.rename(tmp, PROGRESS_FILE); // 原子替换，读者永远看到完整文件
  }).catch((e) => console.error('[progress] 写入失败：', e.message));
  return writeChain;
}

/** 高频打点：150ms 节流合并 */
function scheduleSave() {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    persist();
  }, 150);
}

/** 低频关键写（通关/判分）：立即、不节流 */
function saveNow() {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  return persist();
}

async function flushOnExit(signal) {
  if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
  await writeChain.catch(() => {});
  await persist().catch(() => {});
  console.log(`\n[server] 收到 ${signal}，进度已落盘，退出。`);
  process.exit(0);
}
process.on('SIGINT', () => flushOnExit('SIGINT'));
process.on('SIGTERM', () => flushOnExit('SIGTERM'));

function todayKey() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function lessonKey(pkgId, lessonId) { return `${pkgId}:${lessonId}`; }

function ensureLessonEntry(pkgId, lessonId) {
  const key = lessonKey(pkgId, lessonId);
  if (!progress.lessons[key]) {
    progress.lessons[key] = {
      completed: false, quizBest: 0, quizTotal: 0,
      homeworkDone: false, completedAt: null, attempts: 0,
    };
  }
  return progress.lessons[key];
}

/**
 * 关卡解锁规则（打怪升级核心逻辑）：
 *  - 每个包内，第 1 阶段默认解锁
 *  - 某阶段解锁 <=> 上一阶段的所有关卡 completed === true
 *  - 跨包之间互不锁（ES 是基础包，其他包可直接学，但地图上有推荐顺序）
 */
function computeUnlockedLevels(pkgId) {
  const entry = courseIndex.get(pkgId);
  if (!entry) return [];
  const { manifest } = entry;
  const unlocked = [];
  let lockedHit = false;
  for (const level of manifest.levels) {
    if (lockedHit) { unlocked.push({ levelId: level.id, unlocked: false }); continue; }
    unlocked.push({ levelId: level.id, unlocked: true });
    const allDone = (level.lessons ?? []).every(
      (l) => progress.lessons[lessonKey(pkgId, l.id)]?.completed
    );
    if (!allDone) lockedHit = true;
  }
  return unlocked;
}

function isLevelUnlocked(pkgId, levelId) {
  return computeUnlockedLevels(pkgId).some((u) => u.levelId === levelId && u.unlocked);
}

/**
 * 统一的关卡访问守卫：包存在 + 关卡存在 + 所属阶段已解锁。
 * 返回 { entry, meta }，否则抛出带 status 的错误（Express 5 会转交错误中间件）。
 */
function assertLessonAccessible(pkgId, lessonId) {
  const entry = courseIndex.get(pkgId);
  if (!entry) { const e = new Error('课程包不存在'); e.status = 404; throw e; }
  const meta = entry.lessonMap.get(lessonId);
  if (!meta) { const e = new Error('关卡不存在'); e.status = 404; throw e; }
  if (!isLevelUnlocked(pkgId, meta.levelId)) {
    const e = new Error('该关卡尚未解锁：请先通关上一阶段的全部关卡'); e.status = 423; throw e;
  }
  return { entry, meta };
}

function pushEvent(pkgId, lessonId, type) {
  progress.events.push({ at: new Date().toISOString(), pkgId, lessonId, type });
  if (progress.events.length > 500) progress.events = progress.events.slice(-500);
}

/* ---------------------------------- API ---------------------------------- */

// 所有课程包列表（首页地图用）
app.get('/api/packages', async (req, res) => {
  await loadProgress();
  const list = [...courseIndex.values()].map(({ manifest }) => {
    const lessonCount = manifest.levels.reduce((s, lv) => s + (lv.lessons?.length ?? 0), 0);
    const doneCount = manifest.levels.reduce(
      (s, lv) => s + (lv.lessons ?? []).filter((l) => progress.lessons[lessonKey(manifest.id, l.id)]?.completed).length, 0);
    return {
      id: manifest.id, title: manifest.title, order: manifest.order ?? 99,
      tagline: manifest.tagline, icon: manifest.icon, color: manifest.color,
      tiers: manifest.tiers, levels: manifest.levels.map(
        ({ id, title, subtitle, lessons }) => ({
          id, title, subtitle,
          lessonCount: lessons?.length ?? 0,
          doneCount: (lessons ?? []).filter((l) => progress.lessons[lessonKey(manifest.id, l.id)]?.completed).length,
        })),
      lessonCount, doneCount,
      unlockedLevels: computeUnlockedLevels(manifest.id),
    };
  }).sort((a, b) => a.order - b.order);
  res.json(list);
});

// 单个课程包详情（含进度与解锁状态）
app.get('/api/packages/:pkgId', async (req, res) => {
  await loadProgress();
  const entry = courseIndex.get(req.params.pkgId);
  if (!entry) return res.status(404).json({ error: `课程包 ${req.params.pkgId} 不存在` });
  const { manifest } = entry;
  const levels = manifest.levels.map((level) => ({
    ...level,
    lessons: (level.lessons ?? []).map((lesson) => ({
      ...lesson, progress: progress.lessons[lessonKey(manifest.id, lesson.id)] ?? null,
    })),
  }));
  res.json({
    id: manifest.id, title: manifest.title, tagline: manifest.tagline,
    icon: manifest.icon, color: manifest.color, tiers: manifest.tiers,
    levels, unlockedLevels: computeUnlockedLevels(manifest.id),
  });
});

// 课文正文 + 小测（Markdown / JSON，已剔除答案）
app.get('/api/packages/:pkgId/lessons/:lessonId', async (req, res) => {
  await loadProgress();
  const { entry, meta } = assertLessonAccessible(req.params.pkgId, req.params.lessonId);
  const markdown = await readTextIfExists(
    path.join(entry.pkgDir, 'lessons', `${meta.id}.md`));
  if (markdown === null) return res.status(404).json({ error: `课文文件缺失：lessons/${meta.id}.md` });

  let quiz = null;
  const quizRaw = await readTextIfExists(path.join(entry.pkgDir, 'quizzes', `${meta.id}.json`));
  if (quizRaw) {
    const full = JSON.parse(quizRaw); // 解析失败由错误中间件兜底为 500
    // 关键：下发给前端时剔除正确答案与解析，防止泄题
    quiz = {
      title: full.title, passRule: full.passRule,
      questions: (full.questions ?? []).map((q) => ({
        id: q.id, type: q.type, prompt: q.prompt, options: q.options,
      })),
    };
  }
  const interviewMd = await readTextIfExists(
    path.join(entry.pkgDir, 'interviews', `${meta.id}.md`));
  res.json({
    pkgId: req.params.pkgId, ...meta, markdown, quiz,
    interviews: interviewMd || '',
    progress: progress.lessons[lessonKey(req.params.pkgId, req.params.lessonId)] ?? null,
  });
});

// 作业正文（Markdown）—— levelId 必须是该包已知的阶段 id
app.get('/api/packages/:pkgId/homework/:levelId', async (req, res) => {
  const entry = courseIndex.get(req.params.pkgId);
  if (!entry) return res.status(404).json({ error: '课程包不存在' });
  const known = entry.manifest.levels.some((lv) => lv.id === req.params.levelId);
  if (!known || !isSafeSegment(req.params.levelId)) {
    return res.status(404).json({ error: '阶段不存在' });
  }
  const file = path.join(entry.pkgDir, 'homework', `${req.params.levelId}.md`);
  const markdown = await readTextIfExists(file);
  if (markdown === null) return res.status(404).json({ error: `作业文件缺失：homework/${req.params.levelId}.md` });
  res.json({ levelId: req.params.levelId, markdown });
});

// 示例代码目录列表（关卡页展示"本关示例"）
app.get('/api/packages/:pkgId/examples/:lessonId', async (req, res) => {
  const entry = courseIndex.get(req.params.pkgId);
  if (!entry) return res.status(404).json({ error: '课程包不存在' });
  if (!entry.lessonMap.has(req.params.lessonId) || !isSafeSegment(req.params.lessonId)) {
    return res.status(404).json({ error: '关卡不存在' });
  }
  const base = path.join(entry.pkgDir, 'examples', req.params.lessonId);
  let files = [];
  if (fs.existsSync(base)) {
    const dirents = await fsp.readdir(base, { withFileTypes: true });
    files = dirents.filter((d) => d.isFile()).map((d) => d.name);
  }
  res.json({ files });
});

// 单个示例文件内容（供网页内直接查看/复制运行命令）
app.get('/api/packages/:pkgId/examples/:lessonId/:file', async (req, res) => {
  const entry = courseIndex.get(req.params.pkgId);
  if (!entry) return res.status(404).json({ error: '课程包不存在' });
  const { lessonId, file: rel } = req.params;
  if (!entry.lessonMap.has(lessonId) || !isSafeSegment(lessonId) || !isSafeSegment(rel)) {
    return res.status(400).json({ error: '非法路径' });
  }
  const base = path.join(entry.pkgDir, 'examples', lessonId);
  const target = safeJoin(base, rel);
  if (!target || !(await withinBase(target, base))) return res.status(400).json({ error: '非法路径' });
  const content = await readTextIfExists(target);
  if (content === null) return res.status(404).json({ error: '文件不存在' });
  res.json({ file: rel, content });
});

/* ------------------------------ 进度写接口（POST） ------------------------------ */

// 时长打点心跳：加入服务端墙钟兜底 + 频率限制，防止脚本无限刷
const lastPingAt = new Map(); // key -> ms timestamp
app.post('/api/progress/ping', async (req, res) => {
  await loadProgress();
  const { ms = 0, pkgId = null, lessonId = null } = req.body ?? {};
  const key = pkgId && lessonId ? lessonKey(pkgId, lessonId) : 'global';
  const now = Date.now();
  const prev = lastPingAt.get(key);
  const elapsed = prev ? now - prev : 0;
  lastPingAt.set(key, now);
  // 距上次不足 5s 视为脚本连发，忽略；单次累计不超过 min(上报值, 60s, 墙钟+2s)
  if (prev && elapsed < 5000) return res.json({ ok: true, ignored: true });
  const reported = Math.max(Number(ms) || 0, 0);
  const delta = Math.min(reported, 60_000, elapsed + 2000);
  progress.totalMs += delta;
  progress.days[todayKey()] = (progress.days[todayKey()] ?? 0) + delta;
  const iso = new Date().toISOString();
  if (!progress.firstStudyAt) progress.firstStudyAt = iso;
  progress.lastStudyAt = iso;
  if (pkgId && lessonId && courseIndex.has(pkgId) && courseIndex.get(pkgId).lessonMap.has(lessonId)) {
    ensureLessonEntry(pkgId, lessonId);
  }
  scheduleSave();
  res.json({ ok: true, credited: delta });
});

// 提交小测得分（服务端判分；须已解锁）
app.post('/api/progress/quiz', async (req, res) => {
  await loadProgress();
  const { pkgId, lessonId, answers } = req.body ?? {};
  const { entry, meta } = assertLessonAccessible(pkgId, lessonId);
  const quizRaw = await readTextIfExists(path.join(entry.pkgDir, 'quizzes', `${lessonId}.json`));
  if (!quizRaw) return res.status(404).json({ error: '本关没有小测' });
  let quiz;
  try { quiz = JSON.parse(quizRaw); }
  catch (e) { return res.status(500).json({ error: `测验 JSON 解析失败：${e.message}` }); }
  const qs = Array.isArray(quiz.questions) ? quiz.questions : [];
  if (!qs.length) return res.status(404).json({ error: '本关小测没有题目' });
  const ans = Array.isArray(answers) ? answers : [];
  const graded = qs.map((q, i) => ({
    id: q.id, correct: ans[i] === q.answer, answer: q.answer, explanation: q.explanation,
  }));
  const score = graded.filter((g) => g.correct).length;
  const total = qs.length;
  const rec = ensureLessonEntry(pkgId, lessonId);
  rec.attempts += 1;
  rec.quizBest = Math.max(rec.quizBest, score);
  rec.quizTotal = total;
  saveNow();
  res.json({ score, total, pass: score >= Math.ceil(total * 0.6), graded });
});

// 勾选作业完成 / 取消（须已解锁）
app.post('/api/progress/homework', async (req, res) => {
  await loadProgress();
  const { pkgId, lessonId, done } = req.body ?? {};
  const { meta } = assertLessonAccessible(pkgId, lessonId);
  void meta;
  const rec = ensureLessonEntry(pkgId, lessonId);
  rec.homeworkDone = Boolean(done);
  pushEvent(pkgId, lessonId, rec.homeworkDone ? '作业标记完成' : '取消作业完成');
  saveNow();
  res.json({ ok: true });
});

// 通关一个关卡（要求小测>=60% 且作业已完成，且已解锁）
app.post('/api/progress/complete', async (req, res) => {
  await loadProgress();
  const { pkgId, lessonId } = req.body ?? {};
  const { entry, meta } = assertLessonAccessible(pkgId, lessonId);
  const rec = ensureLessonEntry(pkgId, lessonId);
  const quizFile = await readTextIfExists(path.join(entry.pkgDir, 'quizzes', `${lessonId}.json`));
  if (quizFile) {
    let total = 0;
    try { total = JSON.parse(quizFile).questions?.length ?? 0; } catch { total = 0; }
    if (total > 0 && rec.quizBest / total < 0.6) {
      return res.status(400).json({ error: `小测成绩未达标：需答对至少 ${Math.ceil(total * 0.6)}/${total} 题（当前最好成绩 ${rec.quizBest} 题）` });
    }
  }
  if (!rec.homeworkDone) {
    return res.status(400).json({ error: `请先完成本关作业并勾选"作业已完成"` });
  }
  if (!rec.completed) {
    rec.completed = true;
    rec.completedAt = new Date().toISOString();
    pushEvent(pkgId, meta.id, '★ 通关');
    saveNow();
  }
  res.json({ ok: true, unlockedLevels: computeUnlockedLevels(pkgId) });
});

// 总进度（悬浮导航组件轮询用）
app.get('/api/progress', async (req, res) => {
  await loadProgress();
  const totals = { lessonCount: 0, doneCount: 0 };
  const perPackage = {};
  for (const [pkgId, { manifest }] of courseIndex) {
    let c = 0, d = 0;
    for (const lv of manifest.levels) for (const l of lv.lessons ?? []) {
      c++; if (progress.lessons[lessonKey(pkgId, l.id)]?.completed) d++;
    }
    perPackage[pkgId] = { total: c, done: d, title: manifest.title, icon: manifest.icon };
    totals.lessonCount += c; totals.doneCount += d;
  }
  res.json({
    totalMs: progress.totalMs, firstStudyAt: progress.firstStudyAt, lastStudyAt: progress.lastStudyAt,
    days: progress.days, totals, perPackage,
    events: progress.events.slice(-50).reverse(),
    lessons: progress.lessons,
  });
});

// 完整性自检报告（自查课程包是否有缺文件）
app.get('/api/integrity', (req, res) => {
  res.json({ packages: courseIndex.size, warnings: scanWarnings });
});

/* ---------------------------- 生产模式托管前端 ---------------------------- */
const distDir = path.join(ROOT, 'web', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// 统一错误处理：把 assertXxx 抛出的 {status,message} 落成规范 JSON，且不回吐堆栈
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = Number.isFinite(err.status) ? err.status : 500;
  if (status >= 500) console.error('[server] 内部错误：', err);
  res.status(status).json({ error: status >= 500 ? '服务器内部错误' : err.message });
});

buildIndex();
app.listen(PORT, HOST, () => {
  console.log(`[server] 大前端学院后端已启动: http://${HOST}:${PORT}`);
});
