<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import FloatingNav from './components/FloatingNav.vue';
import { store, refreshProgress, fmtDuration } from './api.js';

const router = useRouter();
onMounted(() => { refreshProgress(); });
</script>

<template>
  <header class="topbar">
    <div class="brand" @click="router.push('/')">
      <span class="logo">▲</span> 大前端学院
      <span style="font-weight:400;color:var(--text-faint);font-size:13px"> BigFront Academy</span>
    </div>
    <div class="spacer"></div>
    <div class="stat" v-if="store.progress">
      累计学习 <b>{{ fmtDuration(store.progress.totalMs) }}</b>
      &nbsp;·&nbsp; 通关 <b>{{ store.progress.totals.doneCount }}/{{ store.progress.totals.lessonCount }}</b>
    </div>
  </header>

  <main class="wrap">
    <router-view />
  </main>

  <FloatingNav />
</template>
