<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';

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

// 参照「大前端生态架构图」的分层格式，把课程包按生态层自上而下排布。
// 未归类的新包会自动落在最后的「其他」组，不影响框架零配置扫描的约定。
const LAYERS = [
  { key: 'lang',    name: '基础语言层',    color: '#4f8ef7', desc: '一切的起点：JS 语法地基 + TS 类型护甲',                       ids: ['01-es', '02-typescript'] },
  { key: 'fw',      name: '视图框架层',    color: '#2ec4a6', desc: '四大 + 新势力：Vue / React / Svelte / Solid / Angular',       ids: ['04-vue', '05-react', '11-svelte', '13-solid', '15-angular'] },
  { key: 'meta',    name: '元框架 · 全栈层', color: '#9b6ef3', desc: '框架之上叠加路由 / SSR / 全栈能力',                           ids: ['07-nextjs', '08-nuxt', '12-sveltekit'] },
  { key: 'server',  name: '服务端 · 运行时层', color: '#ff9f68', desc: 'JS 走出浏览器：Node 运行时与后端框架',                      ids: ['03-nodejs', '09-express'] },
  { key: 'multi',   name: '跨端层',        color: '#f5a623', desc: '一套前端技能走向多端：微信小程序',                            ids: ['06-miniprogram'] },
  { key: 'state',   name: '状态与数据层',  color: '#ef6c8e', desc: '响应式原语 + 客户端状态 + 服务端状态',                          ids: ['14-signals', '16-pinia', '17-zustand', '18-jotai', '19-tanstack-query'] },
  { key: 'build',   name: '构建 · 编译层', color: '#3ec9f5', desc: 'Vite 构建管线 + SWC Rust 编译器：Go/Rust 替换 JS 工具链',     ids: ['10-vite', '20-swc'] },
  { key: 'quality', name: '质量 · 测试层', color: '#7ede6f', desc: 'Biome 格式化与 Lint + Vitest 测试：横跨以上所有层',           ids: ['21-biome', '22-vitest'] },
];

const layers = computed(() => {
  const byId = Object.fromEntries(packages.value.map((p) => [p.id, p]));
  const out = LAYERS
    .map((l) => ({ ...l, pkgs: l.ids.map((id) => byId[id]).filter(Boolean) }))
    .filter((l) => l.pkgs.length);
  const known = new Set(LAYERS.flatMap((l) => l.ids));
  const rest = packages.value.filter((p) => !known.has(p.id));
  if (rest.length) out.push({ key: 'other', name: '其他', color: '#8fa0bf', desc: '尚未归类的新课程包', pkgs: rest });
  return out;
});

function pipClass(pkg, level) {
  const unlocked = pkg.unlockedLevels.find((u) => u.levelId === level.id)?.unlocked;
  const allDone = level.lessonCount > 0 && level.doneCount === level.lessonCount;
  if (!unlocked && !allDone) return 'pip locked';
  return allDone ? 'pip done' : 'pip';
}
</script>

<template>
  <h1 class="page-title">🗺️ 大前端学习地图</h1>
  <p class="page-sub">首页按<b>大前端生态分层架构</b>自上而下排布：基础语言 → 视图框架 → 元框架/全栈 → 服务端 → 跨端 → 状态与数据 → 构建编译 → 质量测试。点一张卡进入对应课程包，按「打怪升级」逐关通关——每一关 <b>读完课文 + 看完示例后，小测 ≥60% 即自动通关</b>并解锁下一关。</p>

  <div v-if="loading" class="loading">加载中…</div>
  <div v-else-if="error" class="error-box">{{ error }}</div>
  <div v-else>
    <div class="tier-legend">
      <span v-for="l in layers" :key="l.key" class="tier-chip">
        <i class="cat-dot" :style="{ background: l.color }"></i>{{ l.name }} · {{ l.pkgs.length }} 包
      </span>
    </div>

    <div v-for="(l, i) in layers" :key="l.key">
      <div v-if="i > 0" class="flow-arrow">▼</div>
      <section class="arch-layer" :style="{ '--layer-color': l.color }">
        <h2 class="arch-head"><i></i>{{ l.name }} <small>— {{ l.desc }}</small></h2>
        <div class="pkg-grid">
          <div
            v-for="pkg in l.pkgs"
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
      </section>
    </div>
  </div>
</template>
