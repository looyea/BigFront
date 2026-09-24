<script setup>
// 课文页：只有课文 + 文末动手示例（单栏，无侧栏）
// 进度、小测在独立小测页；面试题在独立页；作业不再提供 UI；通关由小测及格自动触发
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import hljs from 'highlight.js';
import { api, startTracking, stopTracking } from '../api.js';

const route = useRoute();
const router = useRouter();

const lesson = ref(null);
const pkgMeta = ref(null);
const examples = ref([]);
const exampleDir = ref('');
const openExample = ref({ file: '', content: '' });
const loading = ref(true);
const error = ref('');

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
  openExample.value = { file: '', content: '' };
  const { pkgId, lessonId } = route.params;
  try {
    const data = await api.lesson(pkgId, lessonId);
    lesson.value = data;
    api.pkg(pkgId).then((p) => { pkgMeta.value = p; }).catch(() => {});
    const ex = await api.examples(pkgId, lessonId).catch(() => ({ files: [], dir: '' }));
    examples.value = ex.files || [];
    exampleDir.value = ex.dir || '';
    startTracking(pkgId, lessonId);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
  // 等课文渲染进 DOM 后再高亮代码块
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

  <div v-else-if="lesson" class="lesson-single">
    <article class="prose" v-html="marked.parse(lesson.markdown)"></article>

    <!-- 动手示例：紧跟课文末尾 -->
    <section v-if="examples.length" class="card">
      <h3>🧪 动手示例</h3>
      <div v-for="f in examples" :key="f" class="example-file">
        <span @click="viewExample(f)" style="cursor:pointer;color:var(--accent-2)">{{ f }}</span>
        <button class="btn ghost sm" @click="copyText('node courses/' + lesson.pkgId + '/' + exampleDir + '/' + f)">复制运行命令</button>
      </div>
      <template v-if="openExample.content">
        <div style="display:flex;justify-content:space-between;align-items:center;margin:8px 0 4px">
          <b style="font-size:14px;font-family:var(--mono)">{{ openExample.file }}</b>
          <button class="btn ghost sm" @click="openExample = { file: '', content: '' }">关闭</button>
        </div>
        <pre class="code-view"><code class="language-js">{{ openExample.content }}</code></pre>
      </template>
    </section>

  </div>
</template>

<style scoped>
.lesson-single { max-width: 900px; margin: 0 auto; }
</style>
