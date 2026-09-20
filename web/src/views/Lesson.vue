<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import hljs from 'highlight.js';
import Quiz from '../components/Quiz.vue';
import { api, refreshProgress, startTracking, stopTracking, store } from '../api.js';

const route = useRoute();
const router = useRouter();

const lesson = ref(null);
const pkgMeta = ref(null);
const homework = ref('');
const examples = ref([]);
const openExample = ref({ file: '', content: '' });
const loading = ref(true);
const error = ref('');
const homeworkDone = ref(false);
const quizPassed = ref(false);
const completing = ref(false);
const completeMsg = ref('');

marked.setOptions({ gfm: true, breaks: false });

async function highlight() {
  await nextTick();
  document.querySelectorAll('.prose pre code').forEach((el) => {
    if (!el.dataset.hl) { hljs.highlightElement(el); el.dataset.hl = '1'; }
  });
}

async function loadAll() {
  loading.value = true;
  error.value = '';
  lesson.value = null;
  const { pkgId, lessonId } = route.params;
  try {
    const data = await api.lesson(pkgId, lessonId);
    lesson.value = data;
    api.pkg(pkgId).then((p) => { pkgMeta.value = p; }).catch(() => {});
    homeworkDone.value = data.progress?.homeworkDone ?? false;
    quizPassed.value =
      data.quiz && data.progress?.quizTotal > 0 &&
      data.progress.quizBest / data.progress.quizTotal >= 0.6;
    // 并行拉作业与示例
    const [hw, ex] = await Promise.all([
      api.homework(pkgId, data.levelId).catch(() => ({ markdown: '_（本阶段作业待补充）_' })),
      api.examples(pkgId, lessonId).catch(() => ({ files: [] })),
    ]);
    homework.value = hw.markdown;
    examples.value = ex.files || [];
    startTracking(pkgId, lessonId);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
  // 必须等 loading=false 且 v-else-if 分支把课文渲染进 DOM 后再高亮
  await nextTick();
  highlight();
}
onMounted(loadAll);
watch(() => [route.params.pkgId, route.params.lessonId], loadAll);
onBeforeUnmount(() => stopTracking());

async function viewExample(file) {
  const { pkgId, lessonId } = route.params;
  const r = await api.exampleFile(pkgId, lessonId, file);
  openExample.value = { file: r.file, content: r.content };
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); } catch { /* ignore */ }
}

async function toggleHomework() {
  const { pkgId, lessonId } = route.params;
  homeworkDone.value = !homeworkDone.value;
  await api.setHomework(pkgId, lessonId, homeworkDone.value);
  refreshProgress();
}

function onQuizPassed() {
  quizPassed.value = true;
  refreshProgress();
}

async function doComplete() {
  const { pkgId, lessonId } = route.params;
  completing.value = true;
  completeMsg.value = '';
  try {
    await api.complete(pkgId, lessonId);
    completeMsg.value = '🏆 通关成功！正在进入下一关…';
    await refreshProgress();
    setTimeout(() => gotoNext(pkgId, lessonId), 900);
  } catch (e) {
    completeMsg.value = '⚠️ ' + e.message;
  } finally {
    completing.value = false;
  }
}

// 通关后跳到本包下一个未通关且已解锁的关卡
async function gotoNext(pkgId, curLessonId) {
  try {
    const pkg = await api.pkg(pkgId);
    const flat = pkg.levels
      .filter((lv) => pkg.unlockedLevels.find((u) => u.levelId === lv.id)?.unlocked)
      .flatMap((lv) => lv.lessons);
    const idx = flat.findIndex((l) => l.id === curLessonId);
    const next = flat.slice(idx + 1).find((l) => !l.progress?.completed) || flat.find((l) => !l.progress?.completed);
    if (next) router.push(`/l/${pkgId}/${next.id}`);
    else router.push(`/p/${pkgId}`);
  } catch {
    router.push(`/p/${pkgId}`);
  }
}
</script>

<template>
  <div class="crumb">
    <router-link to="/">🗺️ 地图</router-link>
    <template v-if="lesson"> / <router-link :to="'/p/' + lesson.pkgId">{{ pkgMeta?.title || lesson.pkgId }}</router-link> / {{ lesson.title }}</template>
  </div>

  <div v-if="loading" class="loading">加载课文…</div>
  <div v-else-if="error" class="error-box">
    <p>{{ error }}</p>
    <button class="btn ghost sm" @click="router.back()">返回</button>
  </div>

  <div v-else-if="lesson" class="lesson-layout">
    <!-- 左：课文 + 面试题 -->
    <div class="main-col">
      <article class="prose" v-html="marked.parse(lesson.markdown)"></article>
      <section v-if="lesson.interviews" class="card interviews-card">
        <details open>
          <summary><h3 style="display:inline">🎓 本关面试题（课末实战）</h3></summary>
          <div class="prose" style="border:none;padding:0;background:transparent;margin-top:10px"
               v-html="marked.parse(lesson.interviews)"></div>
        </details>
      </section>
      <section v-else class="card">
        <h3>🎓 本关面试题</h3>
        <p class="hint">本关尚未提供面试题，可在 <code>courses/{{ lesson.pkgId }}/interviews/{{ lesson.id }}.md</code> 新建。</p>
      </section>
    </div>

    <!-- 右：侧栏 -->
    <aside class="side">
      <div class="card">
        <h3>📋 本关进度</h3>
        <div class="hint">
          <div>小测：{{ quizPassed ? '✅ 已通过' : '⬜ 需 ≥60%' }}</div>
          <div>作业：{{ homeworkDone ? '✅ 已完成' : '⬜ 未完成' }}</div>
        </div>
        <button
          class="btn ok block"
          style="margin-top:10px"
          :disabled="!quizPassed || !homeworkDone || completing"
          @click="doComplete"
        >
          {{ lesson.progress?.completed ? '✅ 已通关' : '🏆 通关本关' }}
        </button>
        <div v-if="completeMsg" style="margin-top:8px;font-size:13px">{{ completeMsg }}</div>
      </div>

      <div class="card">
        <h3>🧪 动手示例</h3>
        <p v-if="!examples.length" class="hint">本关暂无示例文件。</p>
        <div v-for="f in examples" :key="f" class="example-file">
          <span @click="viewExample(f)" style="cursor:pointer;color:var(--accent-2)">{{ f }}</span>
          <button class="btn ghost sm" @click="copyText('node courses/' + lesson.pkgId + '/examples/' + lesson.id + '/' + f)">复制运行命令</button>
        </div>
        <template v-if="openExample.content">
          <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 4px">
            <b style="font-size:12px;font-family:var(--mono)">{{ openExample.file }}</b>
            <button class="btn ghost sm" @click="openExample = { file: '', content: '' }">关闭</button>
          </div>
          <pre class="code-view"><code class="language-js">{{ openExample.content }}</code></pre>
        </template>
      </div>

      <div class="card">
        <h3>📝 本阶段作业</h3>
        <div class="prose" style="border:none;padding:0;background:transparent" v-html="marked.parse(homework)"></div>
        <label class="quiz-opt" style="margin-top:12px" @click="toggleHomework">
          <input type="checkbox" :checked="homeworkDone" @click.stop="toggleHomework" />
          我已完成本关作业
        </label>
      </div>

      <div class="card" v-if="lesson.quiz">
        <h3>🎯 本关小测</h3>
        <Quiz :pkg-id="lesson.pkgId" :lesson-id="lesson.id" :quiz="lesson.quiz" @passed="onQuizPassed" />
      </div>
    </aside>
  </div>
</template>
