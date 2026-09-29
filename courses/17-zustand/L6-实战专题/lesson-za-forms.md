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
// 目的：跨步骤草稿进 persist store——step 与 data 落盘，刷新可恢复到上次进度
const useWizard = create(
  persist(
    (set) => ({
      step: 0, data: {},                                                     // 当前步 + 已填草稿
      setStep: (n) => set({ step: n }),                                      // 切步
      patch: (d) => set((s) => ({ data: { ...s.data, ...d } })),            // 函数式合并局部字段，不覆盖整块 data
    }),
    { name: 'wizard' }                                                       // 存 localStorage 的 key
  )
);
// ✅ patch 取最新 s 再展开合并，多次连点草稿不互相覆盖
// ❌ patch 写成 set({ data: d }) 整体替换→传部分字段就把已填的其它字段清空，草稿越填越少
```
步骤切换不丢、刷新可恢复。

衔接方式：每步的 RHF `formState.isValid`/watch  debounce 后 `patch(values)` 写草稿；进入该步时 `reset(data)` 把草稿灌回 RHF。store 是账本，RHF 是工作台——数据只在这两个地方各存一份，别在第三个 useState 里再镜像。

## 四、dirty 检测 + beforeunload
用 RHF 的 formState.isDirty，或 subscribe store 变化置 dirty；离开前 `beforeunload` 提示（呼应 pinia-form）。

路由级拦截（React Router 的 useBlocker）比 beforeunload 体验好：SPA 内跳路由弹自定义确认框；beforeunload 只管关标签页，浏览器只给通用文案。

## 五、提交流程模板
提交 loading → 乐观展示 → 失败回滚：把提交态放 store，RHF 负责取值校验（呼应 za-transition 的 useOptimistic）。

```tsx
// 目的：提交流程——loading 置位、成功 reset、finally 收尾，杜绝按钮卡在半转
async function onSubmit(v) {
  setSubmitting(true);                          // 提交态进 store，按钮据此禁用/转圈
  try { await api.save(v); reset(); }          // 成功才清空表单（RHF reset）
  finally { setSubmitting(false); }            // 无论成败都落回非提交态，防异常下永远 loading
}
// ✅ finally 保证 setSubmitting(false) 一定执行，请求抛错也不会让按钮永远转圈
// ❌ 不写 finally、把 setSubmitting(false) 放 try 末尾→api.save 抛错就跳过，按钮永久禁用假死
```

服务端字段错误回写：`setError('email', { message: err })`——把后端 422 映射回具体字段，是 RHF 与 store 协作的最后一块拼图。

## 六、复杂动态表单

字段数组（可增删的行项目）用 RHF 的 useFieldArray；「模板本身」（有哪些字段、什么校验）这种低频变化的结构数据放 Zustand——结构归 store、值归 RHF、校验归 schema（zod resolver 两边共用同一份 schema，一份真相）。

## 小结
字段归 RHF、跨步骤/草稿/提交态归 Zustand、schema 一份共用；isDirty + useBlocker 防丢单；后端错误映射回字段——四板斧写完表单不卡一次渲染。

## 部署预告
本地做一个 3 步向导：每步 RHF + zod，草稿 persist 进 Zustand，刷新恢复进度并停在上次步骤；故意让后端返回 422 验证字段级错误回写。
