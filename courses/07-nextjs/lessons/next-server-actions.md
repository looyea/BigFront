# Server Actions 与 useActionState

> 目标：把"提交表单=调接口"的三件套（handler、fetch、loading 状态）压缩成**直接调用一个服务端函数**。本课讲 Server Actions 的序列化机制、渐进增强红利、`useActionState` 的状态编排，以及最重要的安全课：**Action 是公网端点**。呼应 **react-forms**（受控表单旧路）、**exp-validation**（校验不能只在前端）、**mp-network**（端点与鉴权心智）。

---

## 一、最小闭环：表单的 action 收一个服务端函数

```tsx
// app/guestbook/page.tsx —— 整页可以都是服务端组件
export default function GuestBook() {
  async function sign(formData: FormData) {
    'use server';                                  // ← 就地声明：这个函数是 Action
    const name = (formData.get('name') as string) || '';
    await db.entry.create({ data: { name } });
    revalidatePath('/guestbook');                  // 写侧失效（L4 闭环兑现）
  }
  return (
    <form action={sign}>
      <input name="name" />
      <button type="submit">签名</button>
    </form>
  );
}
```

没有 API、没有 fetch、没有 onClick——**但别被表象骗了**：浏览器提交的仍是 POST 到当前页面 URL，Next 在背后把表单数据路由给这个函数。

---

## 二、机制：'use server' 到底编译出了什么

服务端组件里的 `'use server'` 函数会被**编译成一个带密钥 ID 的公网端点**（隐藏 route），客户端表单/调用方拿到的只是"引用令牌"。推论三条，每条都有安全后果：

1. **Action = API**：任何能访问页面的人都能直接 POST 那个端点——鉴权、校验必须在 Action 体内做，"它藏在组件里"不是防线（对照 exp-security：前端一切皆可伪造）；
2. 参数与返回值必须**可序列化**（L3 海关课的"函数不能传"在此有了特例：**Action 引用本身是唯一可跨边界的函数**）；
3. 文件里的 `'use server'` 顶层声明则**该文件所有导出**都是 Action——把纯工具混进这种文件会意外公网化（review 时盯文件顶指令，呼应 next-boundaries 的边界审计）。

---

## 三、渐进增强：无 JS 也能提交

`<form action={serverAction}>` 在 JS 未加载/禁用时**降级为原生表单 POST**，服务端执行 Action 后返回重渲染的 HTML——用户完全无感。React 19 还给配套细节：

```tsx
<input name="name" formAction={sign} />        // 按钮级指定 action（列表里的删除钮）
<button formMethod="dialog">                   // method="dialog" 关闭 <dialog> 而不提交
```

这是 Web 标准"表单即 RPC"的复活——小程序的 `<form report-submit>` 老功能、以及"URL 即状态"哲学在变更侧的镜像（呼应 mp-interaction、next-link-router 第四节）。**面试金句：Server Actions 不是省了几行 fetch，是把"可用性底线"从 JS 成功执行提前到了 HTML 送达。**

---

## 四、useActionState：状态编排三合一

原生 form 拿不到"提交中/错误消息"，于是有 hook（原 useFormState 改名）：

```tsx
'use client';
import { useActionState } from 'react';
import { createEntry } from './actions';        // 从单独文件 import Action 的常见姿势

export function SignForm() {
  const [state, submitAction, isPending] = useActionState(
    async (prev, formData) => {                 // prev = 上次返回值
      const err = await createEntry(formData);
      if (err) return { error: err };           // 返回 = 新 state（不 throw 的失败路径）
      return null;                              // 成功 → 清空
    },
    null,                                       // 初始 state
  );
  return (
    <form action={submitAction}>
      <input name="name" disabled={isPending} />
      {state?.error && <p className="err">{state.error}</p>}
      <button disabled={isPending}>{isPending ? '提交中…' : '签名'}</button>
    </form>
  );
}
```

要点：① Action 在客户端组件包一层再喂给 hook（服务端原件保持纯净）；② **失败用返回值、成功用重定向**（`redirect()`）是官方建议的姿势——成功即导航，新数据自然到手（router cache 与服务端重渲染联动）；③ 防重复提交靠 isPending 只是 UX，**幂等**要在服务端做（唯一约束/幂等键，呼应 mp-network 的 seq 防重）。

---

## 五、Action 的标准防御模板（背下来）

```ts
// actions.ts
'use server';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { EntrySchema } from '@/schemas';          // zod schema 两侧共享（ts-utility 的推断回收）

export async function createEntry(formData: FormData) {
  const session = await auth();
  if (!session) redirect('/login');              // 鉴权永远第一位：Action 是公网端点（redirect 内部自会 throw 中断）
  const parsed = EntrySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return parsed.error.issues[0].message;   // 校验失败→返回文案
  await db.entry.create({ data: { ...parsed.data, uid: session.user.id } });
  revalidatePath('/guestbook');
}
```

四层防御链：**鉴权 → 校验（共享 schema，前端同份只做体验） → 最小权限写库 → 声明失效**。与 09-express 的接口规范逐层同构——换了语法没换纪律（呼应 exp-validation 的"服务端是唯一可信边界"）。

---

## 六、自检清单

- [ ] 无 JS 用户提交 form+Action 会发生什么？
- [ ] 为什么说"Action 的安全模型等于 API"？
- [ ] useActionState 的 prev 从哪来？失败/成功分别建议什么姿势？
- [ ] 文件顶层 'use server' 的副作用是什么？
- [ ] 默写四层防御模板的顺序与每层防谁。

---

## 🚀 部署预告

- 下一关 **next-forms-mutations** 把 Action 接上真实表单生态：useFormStatus、客户端校验库协作、after() 延后杂活、乐观更新（Action 时代 React Query 还来吗）；
- 本课"成功即 redirect"一句在 L7 的 error/not-found 体系里还有后半段故事（redirect 抛的其实也是一种"控制流错误"）。
