<script setup>
// 关卡资料独立视图：小测 / 面试题 / 作业 三选一，点进去只看对应内容
// 作业是阶段级内容（homework-<阶段id>.md），仍从关卡页进入；勾选完成仅作记录，通关仍由小测及格自动触发
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import Quiz from '../components/Quiz.vue';
import { api, refreshProgress, startTracking, stopTracking } from '../api.js';

const route = useRoute();
const router = useRouter();

// 由路由名判定当前是哪一块资料
const PART_BY_ROUTE = { 'lesson-quiz': 'quiz', 'lesson-homework': 'homework' };
const part = computed(() => PART_BY_ROUTE[route.name] || 'interview');
const PART_META = {
  quiz: { icon: '🧪', name: '本关小测' },
  interview: { icon: '🎓', name: '本关面试题' },
  homework: { icon: '📝', name: '本阶段作业' },
};

const lesson = ref(null);
const pkgMeta = ref(null);
const loading = ref(true);
const error = ref('');
const quizPassed = ref(false);
const completed = ref(false);
const homeworkMd = ref('');
const homeworkDone = ref(false);
const homeworkMissing = ref(false);

async function loadAll() {
  loading.value = true;
  error.value = '';
  lesson.value = null;
  const { pkgId, lessonId } = route.params;
  try {
    const data = await api.lesson(pkgId, lessonId);
    lesson.value = data;
    api.pkg(pkgId).then((p) => { pkgMeta.value = p; }).catch(() => {});
    const p = data.progress ?? {};
    quizPassed.value =
      data.quiz && p.quizTotal > 0 && p.quizBest / p.quizTotal >= 0.6;
    completed.value = p.completed ?? false;
    homeworkDone.value = p.homeworkDone ?? false;
    // 作业是阶段级文件，只在作业页拉取
    if (part.value === 'homework') {
      try {
        const hw = await api.homework(pkgId, data.levelId);
        homeworkMd.value = hw.markdown;
        homeworkMissing.value = false;
      } catch {
        homeworkMd.value = '';
        homeworkMissing.value = true;
      }
    }
    startTracking(pkgId, lessonId);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(loadAll);
watch(() => [route.params.pkgId, route.params.lessonId, route.name], loadAll);
onBeforeUnmount(() => stopTracking());

// 勾选/取消本阶段作业完成（仅记录，不影响通关判定）
async function toggleHomework() {
  const { pkgId, lessonId } = route.params;
  homeworkDone.value = !homeworkDone.value;
  try {
    await api.setHomework(pkgId, lessonId, homeworkDone.value);
    await refreshProgress();
  } catch {
    homeworkDone.value = !homeworkDone.value; // 失败回滚
  }
}

// 小测及格：后端已自动通关，这里刷新本地进度并同步展示通关状态
async function onQuizPassed() {
  quizPassed.value = true;
  completed.value = true;
  await refreshProgress();
}
</script>

<template>
  <div class="crumb">
    <router-link to="/">🗺️ 地图</router-link>
    <template v-if="lesson">
      / <router-link :to="'/p/' + lesson.pkgId">{{ pkgMeta?.title || lesson.pkgId }}</router-link>
      / <router-link :to="'/l/' + lesson.pkgId + '/' + lesson.id">{{ lesson.title }}</router-link>
      / {{ PART_META[part].icon }} {{ PART_META[part].name }}
    </template>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="error-box">
    <p>{{ error }}</p>
    <button class="btn ghost sm" @click="router.back()">返回</button>
  </div>

  <div v-else-if="lesson" class="part-wrap">
    <div class="part-head">
      <h1 class="page-title">{{ PART_META[part].icon }} {{ PART_META[part].name }}</h1>
      <router-link class="btn ghost sm" :to="`/l/${lesson.pkgId}/${lesson.id}`">← 回到课文</router-link>
    </div>

    <!-- 小测：本关进度只在此页展示 -->
    <template v-if="part === 'quiz'">
      <div class="card progress-card">
        <h3>📋 本关进度</h3>
        <div class="prog-rows">
          <div>
            <span class="k">小测最好成绩</span>
            <span class="v">
              {{ lesson.progress?.quizTotal ? `${lesson.progress.quizBest} / ${lesson.progress.quizTotal}` : '—' }}
              <em :class="quizPassed ? 'ok' : 'todo'">{{ quizPassed ? '✅ 及格（≥60%）' : '⬜ 需 ≥60%' }}</em>
            </span>
          </div>
          <div>
            <span class="k">本关状态</span>
            <span class="v"><em :class="completed ? 'ok' : 'todo'">{{ completed ? '🏆 已通关' : '⬜ 未通关' }}</em></span>
          </div>
        </div>
        <p class="hint" style="margin-top:8px">通过小测（答对 ≥60%）即自动通关本关并解锁下一阶段，无需手动点击。</p>
      </div>

      <section class="card">
        <Quiz v-if="lesson.quiz" :key="lesson.id" :pkg-id="lesson.pkgId" :lesson-id="lesson.id" :quiz="lesson.quiz" @passed="onQuizPassed" />
        <p v-else class="hint">本关暂无小测。</p>
      </section>
    </template>

    <!-- 作业：阶段级 markdown + 完成勾选（仅记录，通关仍由小测及格触发） -->
    <section v-else-if="part === 'homework'" class="card">
      <div v-if="homeworkMd" class="prose" style="border:none;padding:0;background:transparent"
           v-html="marked.parse(homeworkMd)"></div>
      <p v-else-if="homeworkMissing" class="hint">本阶段作业文件待补充。</p>
      <label class="quiz-opt" style="margin-top:12px;display:flex;align-items:center;gap:8px;cursor:pointer"
             @click="toggleHomework">
        <input type="checkbox" :checked="homeworkDone" @click.stop="toggleHomework" />
        我已完成本阶段作业{{ homeworkDone ? ' ✅' : '' }}
      </label>
    </section>

    <!-- 面试题 -->
    <section v-else class="card">
      <div v-if="lesson.interviews" class="prose" style="border:none;padding:0;background:transparent"
           v-html="marked.parse(lesson.interviews)"></div>
      <p v-else class="hint">本关尚未提供面试题。</p>
    </section>
  </div>
</template>

<style scoped>
/* 与课文页同理：小测/作业/面试题页也左对齐面包屑、宽度铺满页面 */
.part-wrap { max-width: none; margin: 0; }
.part-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.part-head .page-title { margin: 0; }
.progress-card .prog-rows > div {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0; border-bottom: 1px dashed var(--border);
}
.progress-card .prog-rows > div:last-child { border-bottom: none; }
.progress-card .k { color: var(--text-dim); font-size: 15px; }
.progress-card .v { font-size: 16px; }
.progress-card .v em { font-style: normal; margin-left: 8px; font-size: 14px; }
.progress-card .v em.ok { color: var(--ok); }
.progress-card .v em.todo { color: var(--warn); }
</style>
