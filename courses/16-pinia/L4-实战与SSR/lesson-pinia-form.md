# 表单状态：向导 / 草稿 / 与 vee-validate 分工

## 什么时候表单进 store

**判据**：跨步骤保留 / 草稿自动保存 / 多组件协同 → 进 store。单页面内一次性表单 → 组件局部 ref。

```ts
// stores/onboarding.ts（多步向导）
export const useOnboardingStore = defineStore('onboarding', () => {
  const step = ref(0);
  const profile = ref({ name: '', email: '' });
  const preferences = ref({ theme: 'dark', lang: 'zh' });

  const isDirty = computed(() =>
    profile.value.name !== '' || profile.value.email !== ''
  );

  function next() { step.value++; }
  function prev() { step.value--; }
  function reset() { step.value = 0; profile.value = { name: '', email: '' }; }

  return { step, profile, preferences, isDirty, next, prev, reset };
});
```

进 store 的向导还白得两样：DevTools 里 step/字段变化全程可追踪（比组件 ref 好调试一个量级）；`reset()` 语义与 $reset 对齐，提交成功一键清场。

## 与 vee-validate / zod 的分工

| 职责 | 归谁 |
| --- | --- |
| 字段值 + 校验规则 + 错误提示 | vee-validate + zod schema |
| 跨步骤状态保留 + 草稿恢复 | Pinia store |
| 提交（POST 数据） | store 的 async action |

vee-validate 管"表单内部"（实时校验、字段联动）；Pinia 管"表单之间"（多步流转、持久化）。

边界细则：字段值放 vee-validate 还是 store？单步表单放 vee-validate（useField 本地即可）；**跨步骤回填**的字段放 store，进入步骤时把 store 值灌给 useForm 的 initialValues——真相在 store，校验态在 vee-validate，提交时从 store 取数、由 action 发请求。

## 草稿自动保存

```ts
// 在 store 或组件里
const debouncedSave = useDebounceFn(() => {
  localStorage.setItem('draft', JSON.stringify(store.profile));
}, 500);

watch(() => store.profile, debouncedSave, { deep: true });
```

也可以把持久化收进 store 本身（pinia-plugin-persistedstate 给向导 store 开 sessionStorage 持久化），watch 手写版记得三件事：deep 监听开销、组件卸载时 flush 最后一次、草稿带版本号防结构变更后的脏数据回填失败。

## beforeunload 脏检测

```ts
onBeforeMount(() => {
  window.addEventListener('beforeunload', (e) => {
    if (store.isDirty) { e.preventDefault(); e.returnValue = ''; }
  });
});
```

SPA 内部切页不走 beforeunload——路由级守卫要另补一刀：`router.beforeEach` 里 `if (store.isDirty && !confirm('放弃编辑？')) return false`（呼应 pinia-vueuse 的 useRouteChangeEvents）。两道闸各司其职：浏览器关标签归 beforeunload，应用内跳路归守卫。

## 部署预告

本地用 vee-validate + Pinia 做一个 3 步注册向导，验证跨步骤状态保留与草稿恢复；再手动改坏 localStorage 草稿的 JSON，确认回填有 try/catch 兜底不白屏。
