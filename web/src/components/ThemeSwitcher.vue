<script setup>
// ThemeSwitcher.vue —— 全局浮动「外观」组件：主题（7 组）+ 正文字号（5 档）
// 挂在 App.vue 上，因此课文 / 每小节小测 / 作业 / 面试题 / 地图任何滚动位置都能就地调；
// 自身配色全走 theme token，换肤后按钮与面板也跟着变色，无需刷新。
// 面板不在 .wrap 内，所以它的文字不受字号档位影响（控件尺寸保持稳定），
// 但字号按钮上的 "Aa" 按各自倍率显示，所见即所得。
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { THEMES, FS_LEVELS, appearance, setTheme, setFs } from '../themes.js';

// 与导航面板互斥：任一面板打开时广播事件关掉另一侧，避免两个浮层重叠
const CLOSE_OTHERS = 'bigfront:close-panel';
const open = ref(false);

// 按 kind（深色 / 深色·护眼 / 浅色 / 浅色·护眼）分组渲染，分组顺序取 themes.js 清单顺序
const groups = computed(() => {
  const out = [];
  for (const t of THEMES) {
    let g = out.find((x) => x.kind === t.kind);
    if (!g) out.push((g = { kind: t.kind, items: [] }));
    g.items.push(t);
  }
  return out;
});

const currentName = computed(() => THEMES.find((t) => t.id === appearance.theme)?.name || '');
const fsName = computed(() => FS_LEVELS.find((l) => l.scale === appearance.fs)?.name || '');
const dotColor = computed(() => THEMES.find((t) => t.id === appearance.theme)?.swatch[2]);

// 记忆去向说清楚，免得用户以为"只存在这一页"
const SYNC_TEXT = {
  local: '已记在本机浏览器',
  saving: '正在同步到后端…',
  saved: '已记住：本机 + 后端各存一份，换端口 / 换浏览器也会带回',
  offline: '后端未连接：这次只记在本机浏览器（本地记忆依旧有效）',
};
const syncText = computed(() => SYNC_TEXT[appearance.sync] || '');

// 字号档位的正文实际像素（课文基准 17px），拿来当 tooltip，选档时心里有数
const fsPx = (scale) => Math.round(17 * scale);
// 按钮角标上的 A 按当前倍率显示：调完字号一眼能看出「这个钮管字号」
const badgePx = computed(() => Math.round(10 * appearance.fs));

function pick(id) { setTheme(id); }
function pickFs(scale) { setFs(scale); }

function toggle() {
  open.value = !open.value;
  if (open.value) window.dispatchEvent(new CustomEvent(CLOSE_OTHERS, { detail: 'theme' }));
}

onMounted(() => window.addEventListener(CLOSE_OTHERS, closeOthers));
onBeforeUnmount(() => window.removeEventListener(CLOSE_OTHERS, closeOthers));
function closeOthers(e) {
  if (e.detail !== 'theme') open.value = false;
}
</script>

<template>
  <!-- 外观浮动按钮：与导航 🧭 同排、叠在其左侧 -->
  <button class="tbtn" :class="{ open }" @click="toggle" title="外观：正文字号（5 档）与主题（7 组），选择会自动记住">
    🎨
    <span class="tbtn-fs" :style="{ fontSize: badgePx + 'px' }">A</span>
    <span class="tbtn-dot" :style="{ background: dotColor }"></span>
  </button>

  <transition name="tpop">
    <div v-if="open" class="tpanel">
      <div class="tp-head">
        <b>{{ currentName }} · {{ fsName }}</b>
        <button class="tp-close" @click="open = false">✕</button>
      </div>

      <!-- 正文字号排在主题清单之前：面板高度有限，字号放在后面时打开面板看不到，用户会以为没有这个功能 -->
      <div class="tp-fs">
        <div class="tp-kind">正文字号 · 课文 / 小测 / 作业 / 面试题一起放大</div>
        <div class="fs-row">
          <button
            v-for="l in FS_LEVELS"
            :key="l.scale"
            class="fs-btn"
            :class="{ on: l.scale === appearance.fs }"
            :style="{ fontSize: 12 * l.scale + 'px' }"
            :title="`${l.name}（正文约 ${fsPx(l.scale)}px）`"
            :aria-pressed="l.scale === appearance.fs"
            @click="pickFs(l.scale)"
          >Aa</button>
        </div>
        <div class="fs-note">当前「{{ fsName }}」，正文约 {{ fsPx(appearance.fs) }}px；点一下立刻生效，无需刷新</div>
      </div>

      <div v-for="g in groups" :key="g.kind" class="tp-group">
        <div class="tp-kind">{{ g.kind }}</div>
        <button
          v-for="t in g.items"
          :key="t.id"
          class="tp-item"
          :class="{ on: t.id === appearance.theme }"
          @click="pick(t.id)"
        >
          <span class="tp-swatch">
            <i :style="{ background: t.swatch[0] }"><b :style="{ background: t.swatch[1] }"></b></i>
            <u>
              <s :style="{ background: t.swatch[2] }"></s>
              <s :style="{ background: t.swatch[3] }"></s>
            </u>
          </span>
          <span class="tp-meta">
            <span class="tp-name">{{ t.name }} <em v-if="t.id === appearance.theme">✓</em></span>
            <span class="tp-desc">{{ t.desc }}</span>
          </span>
        </button>
      </div>

      <div class="tp-foot">{{ syncText }}</div>
    </div>
  </transition>
</template>

<style scoped>
.tbtn {
  position: fixed; right: 92px; bottom: 31px; z-index: 51;   /* 92 = 导航 24+58+10；31 = 与 58 圆钮垂直居中 */
  width: 44px; height: 44px; border-radius: 50%;
  background: var(--panel); border: 1px solid var(--border);
  font-size: 19px; cursor: pointer; display: grid; place-items: center;
  box-shadow: var(--shadow); transition: transform 0.15s, border-color 0.15s;
}
.tbtn:hover { transform: scale(1.08); border-color: var(--accent); }
.tbtn.open { border-color: var(--accent); }
.tbtn-dot {
  position: absolute; right: -1px; bottom: -1px; width: 14px; height: 14px;
  border-radius: 50%; border: 2px solid var(--panel);
}
/* 字号角标：左上角的小 A，尺寸跟随当前档位，本身就是状态指示器 */
.tbtn-fs {
  position: absolute; left: -4px; top: -6px; min-width: 15px; height: 15px;
  padding: 0 2px; display: grid; place-items: center;
  border-radius: 8px; border: 1px solid var(--panel);
  background: var(--accent); color: var(--on-accent); font-weight: 700; line-height: 1;
}
.tpanel {
  position: fixed; right: 24px; bottom: 96px; z-index: 51;   /* 两钮上方；与导航面板同位，靠互斥事件保证不同时出现 */
  width: 330px; max-width: calc(100vw - 32px);
  max-height: calc(100vh - 130px); overflow-y: auto;         /* 矮窗口下顶部不裁掉，内部滚动 */
  background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px;
  box-shadow: var(--shadow); padding: 10px 12px 12px;
}
.tp-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.tp-head b { font-size: 14px; }
.tp-close { background: transparent; border: none; color: var(--text-faint); cursor: pointer; font-size: 14px; }
.tp-kind { font-size: 11.5px; color: var(--accent-2); font-weight: 700; margin: 8px 0 4px; letter-spacing: 0.5px; }
.tp-item {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
  padding: 7px 8px; border-radius: 9px; cursor: pointer;
  background: transparent; border: 1px solid var(--border-soft); margin-bottom: 5px;
  transition: background 0.12s, border-color 0.12s;
}
.tp-item:hover { background: var(--bg-elev2); }
.tp-item.on { border-color: var(--accent); outline: 1px solid var(--accent); }
.tp-swatch { display: flex; align-items: center; gap: 4px; flex: none; }
.tp-swatch i {
  width: 30px; height: 22px; border-radius: 5px; border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
}
.tp-swatch i b { display: block; width: 18px; height: 4px; border-radius: 2px; }
.tp-swatch u { display: flex; flex-direction: column; gap: 3px; }
.tp-swatch s { display: block; width: 6px; height: 6px; border-radius: 2px; }
.tp-meta { display: flex; flex-direction: column; min-width: 0; }
.tp-name { font-size: 13.5px; color: var(--text); font-weight: 600; }
.tp-name em { font-style: normal; color: var(--ok); margin-left: 4px; }
.tp-desc { font-size: 11.5px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* 字号档位行：五个等宽按钮，Aa 的实际字号就是该档倍率 */
.tp-fs { margin-bottom: 2px; }
.fs-note { font-size: 11.5px; color: var(--text-dim); margin-top: 5px; }
.fs-row { display: flex; gap: 6px; }
.fs-btn {
  flex: 1; padding: 5px 0 6px; line-height: 1.1; cursor: pointer;
  background: var(--bg-elev2); border: 1px solid var(--border); border-radius: 8px;
  color: var(--text-dim); transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.fs-btn:hover { color: var(--accent); border-color: var(--accent); }
.fs-btn.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 700; }

.tp-foot { font-size: 11.5px; color: var(--text-dim); margin-top: 8px; border-top: 1px dashed var(--border); padding-top: 6px; line-height: 1.5; }
.tpop-enter-active, .tpop-leave-active { transition: opacity 0.16s, transform 0.16s; }
.tpop-enter-from, .tpop-leave-to { opacity: 0; transform: translateY(10px); }
</style>
