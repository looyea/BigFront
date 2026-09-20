<script setup>
import { ref, reactive, watch } from 'vue';
import { api } from '../api.js';

const props = defineProps({
  pkgId: { type: String, required: true },
  lessonId: { type: String, required: true },
  quiz: { type: Object, required: true },
});
const emit = defineEmits(['passed']);

const answers = reactive({});   // questionId -> optionIndex
const result = ref(null);       // 提交后的判分结果
const submitting = ref(false);
const err = ref('');

// 换关卡时重置
watch(() => props.lessonId, () => {
  for (const k of Object.keys(answers)) delete answers[k];
  result.value = null;
  err.value = '';
});

function pick(qid, idx) {
  if (result.value) return;         // 提交后锁定
  answers[qid] = idx;
}

const allAnswered = () =>
  props.quiz.questions.every((q) => answers[q.id] !== undefined);

async function submit() {
  submitting.value = true;
  err.value = '';
  try {
    const payload = props.quiz.questions.map((q) => answers[q.id]);
    const r = await api.submitQuiz(props.pkgId, props.lessonId, payload);
    result.value = r;
    if (r.pass) emit('passed', r);
  } catch (e) {
    err.value = e.message;
  } finally {
    submitting.value = false;
  }
}

function retry() {
  result.value = null;
  for (const k of Object.keys(answers)) delete answers[k];
}

// 提交后把 graded 转成 map 便于渲染
function gradedOf(qid) {
  return result.value?.graded.find((g) => g.id === qid);
}
</script>

<template>
  <div>
    <div v-if="!result" class="quiz-form">
      <p class="hint" style="margin:0 0 12px;color:var(--text-dim);font-size:13px">{{ quiz.passRule }}</p>
      <div v-for="(q, qi) in quiz.questions" :key="q.id" class="quiz-q">
        <div class="q-title">{{ qi + 1 }}. {{ q.prompt }}</div>
        <label
          v-for="(opt, oi) in q.options"
          :key="oi"
          class="quiz-opt"
          :style="answers[q.id] === oi ? 'border-color:var(--accent)' : ''"
        >
          <input type="radio" :name="q.id" :checked="answers[q.id] === oi" @change="pick(q.id, oi)" />
          {{ opt }}
        </label>
      </div>
      <div v-if="err" style="color:var(--danger);margin-bottom:8px">{{ err }}</div>
      <button class="btn block" :disabled="!allAnswered() || submitting" @click="submit">
        {{ submitting ? '判分中…' : '提交小测' }}
      </button>
      <p v-if="!allAnswered()" class="hint" style="margin-top:8px">请回答全部题目后再提交。</p>
    </div>

    <div v-else>
      <div :class="['quiz-result', result.pass ? 'pass' : 'fail']">
        得分 <b>{{ result.score }}/{{ result.total }}</b>
        —— {{ result.pass ? '🎉 通过！可继续完成作业并通关' : '未达标（需 ≥60%），看看解析再战' }}
      </div>
      <div v-for="(q, qi) in quiz.questions" :key="q.id" class="quiz-q" style="margin-top:16px">
        <div class="q-title">{{ qi + 1 }}. {{ q.prompt }}</div>
        <div
          v-for="(opt, oi) in q.options"
          :key="oi"
          class="quiz-opt"
          :class="{
            correct: gradedOf(q.id)?.answer === oi,
            wrong: answers[q.id] === oi && gradedOf(q.id)?.answer !== oi,
          }"
        >
          {{ opt }}
          <span v-if="gradedOf(q.id)?.answer === oi"> ✅</span>
          <span v-else-if="answers[q.id] === oi"> ❌</span>
        </div>
        <div class="explain">💡 {{ gradedOf(q.id)?.explanation }}</div>
      </div>
      <button class="btn ghost block" style="margin-top:10px" @click="retry">重做本关小测</button>
    </div>
  </div>
</template>
