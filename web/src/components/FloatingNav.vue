<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, store, refreshProgress, refreshIntegrity, isDone, fmtDuration, fmtDate } from '../api.js';

const route = useRoute();
const router = useRouter();
const open = ref(false);
const tab = ref('nav');       // nav | search | log
const keyword = ref('');
const tree = ref(null);       // 全部课程树缓存

async function ensureTree() {
  if (tree.value) return;
  try {
    const pkgs = await api.packages();
    const details = await Promise.all(pkgs.map((p) => api.pkg(p.id)));
    tree.value = details.map((d, i) => ({
      id: d.id, title: d.title, icon: d.icon, color: pkgs[i].color,
      levels: d.levels.map((lv) => ({
        id: lv.id, title: lv.title,
        lessons: lv.lessons.map((l) => ({ id: l.id, title: l.title })),
      })),
    }));
  } catch { /* 后端未启动：保持 tree=null，面板继续显示“加载课程树…” */ }
}

function openPanel(t) {
  tab.value = t || 'nav';
  open.value = true;
  refreshProgress();
  refreshIntegrity();
  ensureTree();
}

const current = computed(() => {
  const { pkgId, lessonId } = route.params;
  if (!tree.value) return null;
  const pkg = tree.value.find((p) => p.id === pkgId);
  if (!pkg) return null;
  if (!lessonId) return { pkg, level: null, lesson: null };
  for (const lv of pkg.levels) {
    const l = lv.lessons.find((x) => x.id === lessonId);
    if (l) return { pkg, level: lv, lesson: l };
  }
  return { pkg, level: null, lesson: null };
});

const results = computed(() => {
  if (!tree.value) return [];
  const kw = keyword.value.trim().toLowerCase();
  const out = [];
  for (const p of tree.value) {
    for (const lv of p.levels) {
      for (const l of lv.lessons) {
        const hay = (p.title + lv.title + l.title).toLowerCase();
        if (!kw || hay.includes(kw)) {
          out.push({ pkgId: p.id, pkgTitle: p.title, icon: p.icon, color: p.color, level: lv.title, lessonId: l.id, lessonTitle: l.title });
        }
      }
    }
  }
  return out;
});

const doneCount = (pkg) =>
  pkg.levels.reduce((s, lv) => s + lv.lessons.filter((l) => isDone(pkg.id, l.id)).length, 0);
const totalCount = (pkg) => pkg.levels.reduce((s, lv) => s + lv.lessons.length, 0);

const dayList = computed(() => {
  const days = store.progress?.days || {};
  return Object.entries(days).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
});

// 路由变化时刷新进度显示
watch(() => route.fullPath, () => { if (open.value) refreshProgress(); });

function go(path) {
  router.push(path);
  open.value = false;
}
</script>

<template>
  <!-- 悬浮按钮 -->
  <button class="fab" @click="open ? (open = false) : openPanel('nav')" :title="'学习导航'">
    <span class="fab-icon">🧭</span>
    <span v-if="store.progress" class="fab-badge">{{ store.progress.totals.doneCount }}</span>
  </button>

  <!-- 面板 -->
  <transition name="slide">
    <div v-if="open" class="nav-panel">
      <div class="nav-top">
        <div class="nav-tabs">
          <button :class="{ on: tab === 'nav' }" @click="tab = 'nav'">📍 导航</button>
          <button :class="{ on: tab === 'search' }" @click="tab = 'search'; ensureTree()">🔎 查找</button>
          <button :class="{ on: tab === 'log' }" @click="tab = 'log'; refreshProgress()">📈 记录</button>
        </div>
        <button class="nav-close" @click="open = false">✕</button>
      </div>

      <div class="nav-body">
        <!-- 导航 -->
        <template v-if="tab === 'nav'">
          <div v-if="current" class="whereami">
            <div class="wa-title">当前位置</div>
            <div>{{ current.pkg.icon }} {{ current.pkg.title }}</div>
            <div v-if="current.level" class="wa-dim">↳ {{ current.level.title }}</div>
            <div v-if="current.lesson" class="wa-cur">▶ {{ current.lesson.title }}</div>
          </div>
          <div v-else class="whereami">
            <div class="wa-title">当前位置</div>
            <div class="wa-dim">在「学习地图」首页 — 选一个课程包开始</div>
          </div>

          <div v-if="!tree" class="nav-loading">加载课程树…</div>
          <div v-else>
            <div v-for="p in tree" :key="p.id" class="nav-pkg">
              <div class="nav-pkg-head" @click="go('/p/' + p.id)">
                <span :style="{ color: p.color }">{{ p.icon }}</span>
                <span class="nav-pkg-title">{{ p.title }}</span>
                <span class="nav-pkg-num">{{ doneCount(p) }}/{{ totalCount(p) }}</span>
              </div>
              <div v-for="lv in p.levels" :key="lv.id" class="nav-level">
                <span class="nav-level-id">{{ lv.id }}</span>
                <div class="nav-lessons">
                  <div
                    v-for="l in lv.lessons"
                    :key="l.id"
                    class="nav-lesson"
                    :class="{ cur: current && current.lesson && current.lesson.id === l.id && current.pkg.id === p.id }"
                    @click="go('/l/' + p.id + '/' + l.id)"
                  >
                    <span>{{ isDone(p.id, l.id) ? '✅' : '▫️' }}</span>
                    <span class="nav-lesson-title">{{ l.title }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 查找 -->
        <template v-else-if="tab === 'search'">
          <input v-model="keyword" class="nav-search" placeholder="搜索关卡 / 阶段 / 课程包…" />
          <div v-if="!tree" class="nav-loading">建立索引…</div>
          <div v-else>
            <div v-for="(r, i) in results" :key="i" class="nav-result" @click="go('/l/' + r.pkgId + '/' + r.lessonId)">
              <div class="nav-result-title">
                <span :style="{ color: r.color }">{{ r.icon }}</span>
                {{ r.lessonTitle }}
                <span v-if="isDone(r.pkgId, r.lessonId)" class="done-tick">✅</span>
              </div>
              <div class="nav-result-path">{{ r.pkgTitle }} › {{ r.level }}</div>
            </div>
            <div v-if="!results.length" class="nav-loading">无匹配结果</div>
          </div>
        </template>

        <!-- 记录 -->
        <template v-else>
          <div class="log-grid" v-if="store.progress">
            <div class="log-cell"><div class="log-num">{{ fmtDuration(store.progress.totalMs) }}</div><div class="log-lab">累计时长</div></div>
            <div class="log-cell"><div class="log-num">{{ store.progress.totals.doneCount }}/{{ store.progress.totals.lessonCount }}</div><div class="log-lab">通关进度</div></div>
            <div class="log-cell"><div class="log-num">{{ Object.keys(store.progress.days || {}).length }}</div><div class="log-lab">打卡天数</div></div>
            <div class="log-cell"><div class="log-num" style="font-size:15px">{{ fmtDate(store.progress.lastStudyAt) }}</div><div class="log-lab">最近学习</div></div>
          </div>
          <div class="wa-title" style="margin-top:16px">每日记录（提交到 GitHub 即成打卡历史）</div>
          <div v-if="!dayList.length" class="nav-loading">还没有记录，去学习页待一会儿试试 ⏱️</div>
          <div v-for="[day, ms] in dayList" :key="day" class="log-row">
            <span>{{ day }}</span>
            <span class="log-bar-wrap"><i class="log-bar" :style="{ width: Math.min(100, ms / 60000 * 8) + '%' }"></i></span>
            <span class="log-dur">{{ fmtDuration(ms) }}</span>
          </div>
          <div v-if="store.integrity && store.integrity.warnings.length" class="integrity">
            <div class="wa-title">⚠️ 课程包完整性自检</div>
            <div v-for="(w, i) in store.integrity.warnings" :key="i" class="wa-dim">· {{ w }}</div>
          </div>
        </template>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fab {
  position: fixed; right: 24px; bottom: 24px; z-index: 50;
  width: 58px; height: 58px; border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), #0a5a8c);
  border: 1px solid #0a5a8c; color: #fff; cursor: pointer;
  box-shadow: 0 6px 22px rgba(0, 122, 204, 0.5);
  display: grid; place-items: center; transition: transform 0.15s;
}
.fab:hover { transform: scale(1.08); }
.fab-icon { font-size: 26px; }
.fab-badge { position: absolute; top: -4px; right: -4px; background: var(--gold); color: #1e1e1e; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 10px; display: grid; place-items: center; padding: 0 4px; }
.nav-panel {
  position: fixed; right: 24px; bottom: 92px; z-index: 50;
  width: 380px; max-width: calc(100vw - 32px); height: 60vh; max-height: 560px;
  background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: var(--shadow); display: flex; flex-direction: column; overflow: hidden;
}
.nav-top { display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; border-bottom: 1px solid var(--border); }
.nav-tabs { display: flex; gap: 4px; }
.nav-tabs button { background: transparent; border: none; color: var(--text-dim); padding: 6px 12px; border-radius: 7px; cursor: pointer; font-size: 13px; }
.nav-tabs button.on { background: var(--bg-elev2); color: var(--text); }
.nav-close { background: transparent; border: none; color: var(--text-faint); cursor: pointer; font-size: 15px; }
.nav-body { overflow-y: auto; padding: 12px; flex: 1; }
.nav-loading { color: var(--text-faint); text-align: center; padding: 20px; font-size: 13px; }
.whereami { background: var(--panel); border: 1px solid var(--border); border-left: 3px solid var(--accent); border-radius: 8px; padding: 10px 12px; margin-bottom: 14px; font-size: 13px; }
.wa-title { font-size: 12px; color: var(--accent-2); font-weight: 700; margin-bottom: 4px; }
.wa-dim { color: var(--text-dim); font-size: 12px; }
.wa-cur { color: var(--gold); font-weight: 600; margin-top: 2px; }
.nav-pkg { margin-bottom: 10px; }
.nav-pkg-head { display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px 4px; border-radius: 6px; }
.nav-pkg-head:hover { background: var(--bg-elev2); }
.nav-pkg-title { font-weight: 650; font-size: 14px; flex: 1; }
.nav-pkg-num { font-size: 12px; color: var(--text-dim); }
.nav-level { display: flex; gap: 8px; padding: 2px 0 2px 8px; }
.nav-level-id { font-family: var(--mono); font-size: 11px; color: var(--text-faint); min-width: 20px; padding-top: 3px; }
.nav-lessons { flex: 1; }
.nav-lesson { display: flex; gap: 8px; align-items: center; padding: 4px 8px; border-radius: 6px; cursor: pointer; font-size: 13px; }
.nav-lesson:hover { background: var(--bg-elev2); }
.nav-lesson.cur { background: rgba(0, 122, 204, 0.18); outline: 1px solid var(--accent); }
.nav-lesson-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav-search { width: 100%; padding: 9px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); margin-bottom: 10px; font-size: 14px; }
.nav-result { padding: 8px 10px; border-radius: 8px; cursor: pointer; border: 1px solid var(--border-soft); margin-bottom: 6px; }
.nav-result:hover { background: var(--bg-elev2); }
.nav-result-title { font-size: 14px; }
.done-tick { margin-left: 6px; }
.nav-result-path { font-size: 12px; color: var(--text-faint); }
.log-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.log-cell { background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 12px; text-align: center; }
.log-num { font-size: 18px; font-weight: 700; color: var(--gold); }
.log-lab { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
.log-row { display: flex; align-items: center; gap: 10px; font-size: 12px; padding: 5px 2px; border-bottom: 1px solid var(--border-soft); }
.log-bar-wrap { flex: 1; height: 6px; background: var(--bg); border-radius: 3px; overflow: hidden; }
.log-bar { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); }
.log-dur { color: var(--text-dim); min-width: 70px; text-align: right; }
.integrity { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 10px; }
.slide-enter-active, .slide-leave-active { transition: opacity 0.18s, transform 0.18s; }
.slide-enter-from, .slide-leave-to { opacity: 0; transform: translateY(12px); }
</style>
