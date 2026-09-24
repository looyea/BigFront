# 表单：Zustand + React Hook Form 分工

## 一、核心分工

- **字段级输入**：交给 React Hook Form（uncontrolled + ref），击键不触发全局 store 重渲，性能最佳。
- **需要跨步骤 / 草稿 / 撤销** 才进 Zustand。

一句话记住：**RHF 管「正在填」，Zustand 管「填到哪了」**。

## 二、为什么不全放 store

上百字段的表单若每键 setState + 订阅，会引发渲染风暴（呼应 za-selectors-deep）。RHF 用 ref 管理值，只在校验/提交时读，天然零重渲。

量化对比：一个 30 字段表单放受控 store，每敲一键 → set → 订阅组件集体重渲；RHF 模式下同一动作只有输入框自身 DOM 在动。这也是「表单值不要镜像进全局 store」这条铁律的出处（Vue 侧对应 pinia-form 的 vee-validate 分工）。

## 三、跨步骤草稿进 store

```ts
const useWizard = create(
  persist(
    (set) => ({ step: 0, data: {}, setStep: (n) => set({ step: n }), patch: (d) => set((s) => ({ data: { ...s.data, ...d } })) }),
    { name: 'wizard' }
  )
);
```
步骤切换不丢、刷新可恢复。

衔接方式：每步的 RHF `formState.isValid`/watch  debounce 后 `patch(values)` 写草稿；进入该步时 `reset(data)` 把草稿灌回 RHF。store 是账本，RHF 是工作台——数据只在这两个地方各存一份，别在第三个 useState 里再镜像。

## 四、dirty 检测 + beforeunload
用 RHF 的 formState.isDirty，或 subscribe store 变化置 dirty；离开前 `beforeunload` 提示（呼应 pinia-form）。

路由级拦截（React Router 的 useBlocker）比 beforeunload 体验好：SPA 内跳路由弹自定义确认框；beforeunload 只管关标签页，浏览器只给通用文案。

## 五、提交流程模板
提交 loading → 乐观展示 → 失败回滚：把提交态放 store，RHF 负责取值校验（呼应 za-transition 的 useOptimistic）。

```tsx
async function onSubmit(v) {
  setSubmitting(true);
  try { await api.save(v); reset(); }
  finally { setSubmitting(false); }
}
```

服务端字段错误回写：`setError('email', { message: err })`——把后端 422 映射回具体字段，是 RHF 与 store 协作的最后一块拼图。

## 六、复杂动态表单

字段数组（可增删的行项目）用 RHF 的 useFieldArray；「模板本身」（有哪些字段、什么校验）这种低频变化的结构数据放 Zustand——结构归 store、值归 RHF、校验归 schema（zod resolver 两边共用同一份 schema，一份真相）。

## 小结
字段归 RHF、跨步骤/草稿/提交态归 Zustand、schema 一份共用；isDirty + useBlocker 防丢单；后端错误映射回字段——四板斧写完表单不卡一次渲染。

## 部署预告
本地做一个 3 步向导：每步 RHF + zod，草稿 persist 进 Zustand，刷新恢复进度并停在上次步骤；故意让后端返回 422 验证字段级错误回写。
