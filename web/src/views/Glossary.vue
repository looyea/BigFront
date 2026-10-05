<script setup>
// 术语表页 /g/:pkgId —— 每个课程包一份自己的术语表，永远开放、不受进度与解锁影响。
// 课文里的术语 Tooltip 点击后直达本页锚点 #term-<id>；跨包术语（本包没讲、别包有）也在这里互链。
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { marked } from 'marked';
import { api } from '../api.js';

const route = useRoute();
const router = useRouter();

const glossary = ref(null);
const pkgMeta = ref(null);       // 包详情（取 title/icon 做面包屑）
const withGlossary = ref([]);    // 全库已配备术语表的包（渲染顶部互跳条 + 解析 seeAlso）
const loading = ref(true);
const error = ref('');
const query = ref('');

// seeAlso 指向的包还没有术语表时，链接降级为纯文本提示，不给死链
const hasGlossarySet = computed(() => new Set(withGlossary.value));

async function load() {
  loading.value = true;
  error.value = '';
  glossary.value = null;
  const pkgId = route.params.pkgId;
  try {
    const [g, idx] = await Promise.all([api.glossary(pkgId), api.glossaryIndex().catch(() => ({ withGlossary: [] }))]);
    glossary.value = g;
    withGlossary.value = idx.withGlossary || [];
    api.pkg(pkgId).then((p) => { pkgMeta.value = p; }).catch(() => {});
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
    await nextTick();
    scrollToHash();
  }
}
onMounted(load);
watch(() => route.params.pkgId, load);
// 同页换锚点（从一篇课文点另一个术语进来）也要跳位
watch(() => route.hash, () => { nextTick(scrollToHash); });

function scrollToHash() {
  if (!route.hash) return;
  const el = document.getElementById(decodeURIComponent(route.hash.slice(1)));
  if (!el) return;
  el.scrollIntoView({ block: 'center' });
  el.classList.remove('term-flash');
  void el.offsetWidth; // 重启动画
  el.classList.add('term-flash');
}

// 按阶段分组（L1..Ln 原序），无 level 的落「其他」；搜索时打平过滤
const grouped = computed(() => {
  const terms = glossary.value?.terms ?? [];
  const q = query.value.trim().toLowerCase();
  const hit = (t) =>
    !q || [t.term, t.full, t.zh, t.tip, t.desc, ...(t.match || [])]
      .some((s) => String(s || '').toLowerCase().includes(q));
  const groups = [];
  const byLevel = new Map();
  for (const t of terms.filter(hit)) {
    const key = t.level || '其他';
    if (!byLevel.has(key)) { byLevel.set(key, []); groups.push(key); }
    byLevel.get(key).push(t);
  }
  const levelTitle = new Map((glossary.value?.levels ?? []).map((l) => [l.id, l.title]));
  return groups.map((key) => ({
    key,
    title: levelTitle.has(key) ? `${key} · ${levelTitle.get(key)}` : key,
    terms: byLevel.get(key),
  }));
});

function md(s) { return marked.parseInline(String(s || '')); }
function goPkg(p) { router.push(`/g/${p}`); }
</script>

<template>
  <div class="crumb">
    <router-link to="/">🗺️ 学习地图</router-link>
    <template v-if="glossary"> / <router-link :to="'/p/' + glossary.pkgId">{{ pkgMeta?.title || glossary.pkgId }}</router-link> / 📖 术语表</template>
  </div>

  <div v-if="loading" class="loading">加载术语表…</div>
  <div v-else-if="error" class="error-box">
    <p>{{ error }}</p>
    <button class="btn ghost sm" @click="router.back()">返回</button>
  </div>

  <template v-else-if="glossary">
    <div class="gl-head">
      <h1 class="page-title">📖 {{ glossary.pkgTitle || glossary.pkgId }} · 术语表</h1>
      <router-link class="btn ghost" :to="`/p/${glossary.pkgId}`">📚 返回课程目录</router-link>
    </div>
    <p class="page-sub">{{ glossary.intro || '本课用到的专业术语速查：课文里鼠标悬停术语也会弹出这里的解释。' }}</p>

    <!-- 全库术语表互跳：跨技术栈的术语可以顺着链接过去查 -->
    <div v-if="withGlossary.length > 1" class="gl-pkgbar">
      <span class="gl-pkgbar-label">其他课程包术语表：</span>
      <button
        v-for="p in withGlossary" :key="p"
        :class="['part-btn', { on: p === glossary.pkgId }]"
        @click="p !== glossary.pkgId && goPkg(p)"
      >{{ p === glossary.pkgId ? '📖 ' : '🔗 ' }}{{ p }}</button>
    </div>

    <input v-model="query" class="gl-search" type="search" placeholder="🔍 搜索术语（名称 / 缩写 / 释义）…" />

    <section v-for="grp in grouped" :key="grp.key" class="gl-group">
      <h2 class="gl-level">{{ grp.title }}<span class="gl-count">{{ grp.terms.length }} 条</span></h2>
      <div v-for="t in grp.terms" :key="t.id" :id="'term-' + t.id" class="card gl-term">
        <div class="gl-term-head">
          <b class="gl-term-name">{{ t.term }}</b>
          <span v-if="t.full" class="badge">{{ t.full }}</span>
          <span v-if="t.zh" class="badge">{{ t.zh }}</span>
          <span v-if="t.level" class="badge done">{{ t.level }}</span>
        </div>
        <div class="gl-term-desc rich" v-html="md(t.desc)"></div>
        <div v-if="t.seeAlso?.length" class="gl-see">
          相关：
          <template v-for="(s, i) in t.seeAlso" :key="s.pkg + s.id">
            <span v-if="i" class="gl-see-sep">、</span>
            <router-link v-if="hasGlossarySet.has(s.pkg)" :to="`/g/${s.pkg}#term-${s.id}`">{{ s.pkg }} · {{ s.term }}</router-link>
            <span v-else class="gl-see-plain" :title="`${s.pkg} 的术语表尚未上线`">{{ s.pkg }} · {{ s.term }}（术语表建设中）</span>
          </template>
        </div>
      </div>
    </section>

    <div v-if="query && !grouped.length" class="loading">没有匹配「{{ query }}」的术语，换个词试试。</div>

    <div class="lesson-foot">
      <router-link class="btn" :to="`/p/${glossary.pkgId}`">📚 返回课程目录 · 选下一节</router-link>
    </div>
  </template>
</template>

<style scoped>
.gl-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.gl-pkgbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0 0 14px; }
.gl-pkgbar-label { font-size: 13px; color: var(--text-dim); }
.part-btn.on { border-color: var(--accent-2); color: var(--accent-2); cursor: default; }
.gl-search {
  width: 100%; box-sizing: border-box; margin-bottom: 18px;
  background: var(--bg-elev); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text); font-size: 14px; padding: 8px 12px; outline: none;
}
.gl-search:focus { border-color: var(--accent); }
.gl-group { margin-bottom: 22px; }
.gl-level { display: flex; align-items: baseline; gap: 10px; font-size: 18px; color: var(--blue); margin: 18px 0 10px; }
.gl-count { font-size: 12px; color: var(--text-faint); font-weight: normal; }
.gl-term { margin-bottom: 10px; scroll-margin-top: 20px; }
.gl-term-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
.gl-term-name { font-size: 16px; color: var(--accent-2); font-family: var(--mono); }
.gl-term-desc { font-size: 14.5px; line-height: 1.7; color: var(--text); }
.gl-see { margin-top: 8px; font-size: 13px; color: var(--text-dim); }
.gl-see a { color: var(--blue); }
.gl-see-plain { color: var(--text-faint); }
.gl-see-sep { margin: 0 2px; }
/* 底部返回条：与课文页同款样式（原先是 Lesson.vue 的 scoped 私货，这里复制一份） */
.lesson-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border); }
</style>
