# 面试题：表单状态（pinia-form）

### 1. (设计类) 表单状态放 store vs 放组件的判据？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

跨步骤/跨路由需保留→store；单页面一次性提交→组件局部。草稿持久化→store；纯 UI 交互反馈→组件 ref。

### 2. (对比类) vee-validate 和 Pinia 在表单中怎么分工？
**来源**：https://vee-validate.logaretm.com/v4/guide/overview

vee-validate：字段级校验、错误提示、联动。Pinia：跨步骤状态、提交流程、草稿恢复。两者不冲突——vee-validate 管"表单内部"，Pinia 管"表单之间"。

### 3. (实战类) 多步向导的 store 设计？
**来源**：https://pinia.vuejs.org/cookbook/composing-stores.html

store 含 step(ref)、各步数据(ref/reactive)、next/prev/reset action。组件只渲染当前 step 对应字段。步骤前进/后退不丢数据。

### 4. (坑类) beforeunload 里为什么不能用自定义弹窗文案？
**来源**：https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event

安全策略——浏览器忽略自定义 message，统一显示通用文案。只能 `e.preventDefault()` + `e.returnValue = ''` 触发默认确认框。

### 5. (性能类) 表单每次击键都触发 $subscribe 写 localStorage 会有问题吗？
**来源**：https://github.com/vuejs/pinia/discussions/1650

频繁 JSON.stringify + 同步写磁盘——大对象卡顿。解法：debounce 500ms 后再写；或只存 changed fields（增量）。

### 6. (TS类) store 里表单字段类型怎么与 zod schema 同步？
**来源**：https://vee-validate.logaretm.com/v4/guide/typescript

`z.infer<typeof schema>` 得到类型 → `reactive<FormState>({...})` 标注。校验规则与类型定义一处声明、多处复用。

### 7. (对比类) Pinia 做表单状态和 Redux Form 的思路差异？
**来源**：https://redux-form.com/

Redux Form 把每个字段值+touched+error 全放 store（中心化）。Pinia + vee-validate 推荐字段值留组件（useField），只把"需要跨步骤/持久化"的数据进 store——减少 store 体积与渲染风暴。

### 8. (实战类) 表单 dirty 检测的 Pinia 实现？
**来源**：https://pinia.vuejs.org/core-concepts/state.html

```ts
const initial = JSON.stringify(profile.value);
const isDirty = computed(() => JSON.stringify(profile.value) !== initial);
```
或 `$subscribe` 设 dirty ref → reset 时清。

### 9. (设计类) 草稿恢复后用户修改了→再次保存，如何避免版本冲突？
**来源**：https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

乐观锁：草稿里存 version 号或 lastModified 时间戳。保存时若服务端版本 > 本地版本 → 提示冲突让用户选择。

### 10. (SSR类) 表单向导在 SSR 中怎么处理初始值？
**来源**：https://pinia.vuejs.org/ssr/nuxt.html

服务端渲染第一步（空表单）→ 客户端水合 → 如果 localStorage 有草稿 → 恢复值 → 可能导致 hydration mismatch。解法：恢复在 `onMounted` 里做（仅客户端）。

### 11. (测试类) 如何测多步表单的 store？
**来源**：https://pinia.vuejs.org/cookbook/testing.html

setActivePinia → useOnboardingStore → store.next() → 断言 step=1；store.profile.name='x' → 断言 isDirty=true。纯 store 测无需渲染。

### 12. (综合类) 一个完整"注册向导 + 草稿 + 提交 + 重置"的 store 骨架？
**来源**：https://pinia.vuejs.org/cookbook/best-practices.html

```ts
defineStore('register', () => {
  const step = ref(0);
  const form = reactive({ email: '', pwd: '', name: '' });
  const loading = ref(false);
  const isDirty = computed(() => Object.values(form).some(Boolean));
  async function submit() { loading.value=true; try{await api.register(form)} finally{loading.value=false} }
  function reset() { step.value=0; Object.assign(form,{email:'',pwd:'',name:''}); }
  return { step, form, loading, isDirty, submit, reset };
})
```

### 13. (坑类) Setup Store 里为什么没有内置 $reset？怎么实现表单重置？
**来源**：https://pinia.vuejs.org/core-concepts/state.html

只有 Options Store 才自带 $reset。Setup Store 需自己保存初始值快照（structuredClone），在 reset() 里 Object.assign(state, snapshot) 恢复。

### 14. (性能类) 上百字段的大表单整个塞进响应式 store 有什么隐患？
**来源**：https://vuejs.org/guide/extras/reactivity-in-depth.html

深层 reactive 代理开销大、任一字段变更都触发依赖更新。解法：字段值留在 vee-validate（useField），只把跨步骤结果进 store；或对不常变子结构用 shallowRef/markRaw。

### 15. (实战类) 切换路由时如何防止误丢未提交的草稿？
**来源**：https://router.vuejs.org/guide/advanced/navigation-guards.html

组件级 onBeforeRouteLeave 里判断 store.isDirty，弹确认框——用户确认离开则先写 localStorage 再放行，取消则 return false 中止导航。
