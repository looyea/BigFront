<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api, isDone } from '../api.js';

const router = useRouter();
const packages = ref([]);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  try {
    packages.value = await api.packages();
  } catch (e) {
    error.value = '加载课程包失败：' + e.message + '（请确认后端已启动 npm --prefix server run dev）';
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function pipClass(pkg, level) {
  const unlocked = pkg.unlockedLevels.find((u) => u.levelId === level.id)?.unlocked;
  const allDone = level.lessonCount > 0 && level.doneCount === level.lessonCount;
  if (!unlocked && !allDone) return 'pip locked';
  return allDone ? 'pip done' : 'pip';
}
</script>

<template>
  <h1 class="page-title">🗺️ 大前端学习地图</h1>
  <p class="page-sub">从 JavaScript 地基一路打到全栈框架。点一张卡进入对应课程包，按「打怪升级」逐关通关——每一关 <b>读完课文 + 看完示例后，小测 ≥60% 即自动通关</b>并解锁下一关。</p>

  <div class="tier-legend">
    <span class="tier-chip">🟨 青铜 · JS 地基</span>
    <span class="tier-chip">🔷 白银 · 类型护甲</span>
    <span class="tier-chip">🟩 黄金 · 服务端</span>
    <span class="tier-chip">🟦 铂金 · 视图框架</span>
    <span class="tier-chip">🟢 钻石 · 小程序</span>
    <span class="tier-chip">▲💚 大师 · 全栈框架</span>
  </div>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="error-box">{{ error }}</div>
  <div v-else class="pkg-grid">
    <div
      v-for="pkg in packages"
      :key="pkg.id"
      class="pkg-card"
      :style="{ '--pkg-color': pkg.color }"
      @click="router.push('/p/' + pkg.id)"
    >
      <div class="pkg-head">
        <div class="pkg-icon">{{ pkg.icon }}</div>
        <div>
          <div class="pkg-title">{{ pkg.title }}</div>
          <div class="pkg-tier">{{ pkg.tier }}</div>
        </div>
      </div>
      <div class="pkg-tag">{{ pkg.tagline }}</div>
      <div class="pkg-foot">
        <div class="level-pips">
          <span
            v-for="lv in pkg.levels"
            :key="lv.id"
            :class="pipClass(pkg, lv)"
            :title="lv.title"
          ></span>
        </div>
        <span class="progress-num">{{ pkg.doneCount }}/{{ pkg.lessonCount }}</span>
      </div>
    </div>
  </div>
</template>
