<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api.js';

const route = useRoute();
const router = useRouter();
const pkg = ref(null);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    pkg.value = await api.pkg(route.params.pkgId);
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => route.params.pkgId, load);

function isLevelUnlocked(levelId) {
  return pkg.value?.unlockedLevels.find((u) => u.levelId === levelId)?.unlocked ?? false;
}
function lessonStatus(lesson, levelUnlocked) {
  const p = lesson.progress;
  if (p?.completed) return { icon: '✅', cls: '' };
  if (!levelUnlocked) return { icon: '🔒', cls: 'locked' };
  if (p) return { icon: '🟡', cls: '' };  // 进行中
  return { icon: '⚔️', cls: '' };           // 可挑战
}
function open(lesson, levelId, part) {
  if (!isLevelUnlocked(levelId)) return;
  router.push(`/l/${pkg.value.id}/${lesson.id}${part ? '/' + part : ''}`);
}
// 课文之外的三块独立视图：小测 / 面试题 / 作业
const parts = [
  { slug: 'quiz', icon: '🧪', name: '小测', title: '只做本关小测' },
  { slug: 'interview', icon: '🎓', name: '面试题', title: '只看本关面试题' },
  { slug: 'homework', icon: '📝', name: '作业', title: '只看本阶段作业' },
];
</script>

<template>
  <div class="crumb"><router-link to="/">🗺️ 学习地图</router-link> / {{ pkg?.title }}</div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="error-box">{{ error }}</div>

  <template v-else-if="pkg">
    <h1 class="page-title">{{ pkg.icon }} {{ pkg.title }}</h1>
    <p class="page-sub">{{ pkg.tagline }}</p>

    <div
      v-for="level in pkg.levels"
      :key="level.id"
      class="level-block"
    >
      <div class="level-head">
        <span :class="['level-badge', { locked: !isLevelUnlocked(level.id) }]">{{ level.id }}</span>
        <span class="level-name">{{ level.title }}</span>
        <span class="level-sub">
          {{ level.subtitle }}
          <span v-if="!isLevelUnlocked(level.id)" class="badge locked">🔒 需通关上一阶段</span>
        </span>
      </div>
      <div
        v-for="lesson in level.lessons"
        :key="lesson.id"
        :class="['lesson-row', lessonStatus(lesson, isLevelUnlocked(level.id)).cls]"
        @click="open(lesson, level.id)"
      >
        <div class="lesson-status">{{ lessonStatus(lesson, isLevelUnlocked(level.id)).icon }}</div>
        <div class="lesson-main">
          <div class="lesson-title">{{ lesson.title }}</div>
          <div class="lesson-goal">🎯 {{ lesson.goal }}</div>
        </div>
        <div class="lesson-parts" @click.stop>
          <router-link
            v-for="p in parts" :key="p.slug"
            :class="['part-btn', { disabled: !isLevelUnlocked(level.id) }]"
            :to="isLevelUnlocked(level.id) ? `/l/${pkg.id}/${lesson.id}/${p.slug}` : ''"
            @click.prevent="isLevelUnlocked(level.id) && open(lesson, level.id, p.slug)"
            :title="p.title"
          >{{ p.icon }} {{ p.name }}</router-link>
        </div>
        <div v-if="lesson.progress?.completed" class="badge done">已通关</div>
        <div v-else-if="lesson.progress && lesson.progress.quizTotal > 0" class="badge">
          小测 {{ lesson.progress.quizBest }}/{{ lesson.progress.quizTotal }}
        </div>
        <div v-else-if="lesson.progress" class="badge">学习中</div>
      </div>
    </div>
  </template>
</template>
