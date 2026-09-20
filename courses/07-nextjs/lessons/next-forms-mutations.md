# 表单进阶与变更模式

> 目标：把 Action 接进真实表单工程：`useFormStatus` 按钮自查提交态、**useOptimistic** 先行渲染、React Hook Form + zod 双侧共享 schema、`after()` 延后杂活、以及变更后的数据同步选择树（revalidatePath vs revalidateTag vs router.refresh）。呼应 **react-forms**（受控/非受控之争）、**next-server-actions**（防御模板）、**mp-setdata**（"少动数据"的成本观）。

---

## 一、提交态下沉：useFormStatus 与 useOptimistic

```tsx
'use client';
import { useFormStatus, useOptimistic } from 'react';  // 19：Action 相关 hook 归 React 本体

function SubmitBtn() {
  const { pending } = useFormStatus();     // 读"父 form 是否正在执行 Action"——父不用传 props
  return <button disabled={pending}>{pending ? '…' : '保存'}</button>;
}

export function TodoList({ todos }: { todos: Todo[] }) {
  const [optimistic, addOptimistic] = useOptimistic(
    todos,                                  // 真实数据
    (state, newItem: Todo) => [...state, newItem],   // 纯函数 reducer
  );
  async function create(formData: FormData) {
    const text = formData.get('text') as string;
    addOptimistic({ id: 'pending', text });          // ← 先渲染"想象中的它"
    await createTodo(formData);                      // Action：失败自动回滚 optimistic
  }
  return <form action={create}>{optimistic.map(renderTodo)}</form>;
}
```

两件套的共性：**状态从"你手动 setState"变成"框架在 Action 生命周期里替你维护"**——pending 随 Action 起落、optimistic 随成功/失败提交或回滚。老代码里手搓的 `setLoading(true)/try/catch/setLoading(false)` 三件套整体退役（对照 mp-interaction 的 feedback 封装：同一件事换了宿主）。

---

## 二、React Hook Form + zod：重表单仍是标配

Action 的 FormData 只适合"三五个字段的朴素表单"。复杂表单（多步、动态字段、即时校验）用 RHF 接管 UI，**提交那一刻打包 FormData 或直接调 Action**：

```tsx
const { register, handleSubmit } = useForm({ resolver: zodResolver(ProfileSchema) });
// ProfileSchema 从 lib/schemas.ts import —— 同一份 schema，前端即时反馈 + Action 内 safeParse 兜底
const onSubmit = handleSubmit((values) => startTransition(async () => {
  const err = await saveProfile(values);   // 直接调用 Action（参数可以是普通对象！）
  if (err) setError('root', { message: err });
}));
```

纪律没变、只是分工：**客户端校验是体验，服务端（Action 内）校验是安全**——两侧同一份 zod schema（ts-utility 的 z.infer 类型贯通在这回收，呼应 exp-validation 首尾同一条军规）。

---

## 三、after()：响应之后再干杂活

```ts
'use server';
import { after } from 'next/server';

export async function publish(post: PostDto) {
  await db.post.create({ data: post });
  revalidateTag('posts');
  after(async () => {                 // ← 响应已发出，这里继续跑
    await notifyFollowers(post);      //   发通知、审计日志、埋点上报
    await imageCache.warm(post.cover);
  });
  redirect('/blog');
}
```

价值：把"用户不必等"的副作用移出关键路径（TTFB 立省）；限制：平台有超时窗（真重活仍进队列——Action 内 await 30s 邮件是反模式，呼应 next-route-handlers 面试 12 的"接口只做状态机一步"）。同类心智：小程序 request 回调里别 setData 大对象后再发请求（mp-setdata 的成本阶梯）。

---

## 四、变更后的同步选择树

数据变了，界面上哪份缓存该失效？——按**影响面**选最小半径：

```text
只影响当前页的展示数据 ──▶ Action 里 revalidatePath(本页)
影响一批共享数据的页   ──▶ revalidateTag('price-x')（L4 的 tag 体系）
需要保留客户端 state   ──▶ useRouter().refresh()（仅刷新当前路由 payload）
纯本组件乐观态         ──▶ 什么都不用：useOptimistic 在成功后自动换真值
跨标签页/他人会话      ──▶ 没有魔法：轮询/SSE/共享缓存版本号（L4 面试 11 的现实面）
```

反面模式：每个 Action 末尾无脑 `revalidatePath('/', 'layout')` 全站刷新——等于把缓存金字塔拆了重来（"我全都要刷新"是最贵的谦虚，呼应 next-fetch-cache 军规③：失效半径=变更影响面）。

---

## 五、'use server' 的两种家庭位置

| 写法 | 场景 | 坑 |
|---|---|---|
| 就地函数内 `'use server'` | 页面私有的一次性提交逻辑 | 无法复用、藏不住大逻辑 |
| 独立 `actions/*.ts` 顶部声明 | 团队标准：**Action 即端点清单** | 全导出皆端点（上关推论 3），查询函数别乱放 |

团队约定建议：目录名就叫 `actions/`，一个业务域一个文件，函数签名一律 `(formData | DTO)` + 返回 `{ error? } | void | redirect`——让"这是公网面"在目录结构上一眼可辨（呼应 next-groups-matchers 的"位置即语义"）。

---

## 六、自检清单

- [ ] useFormStatus 为什么不需要父组件传 pending？它读的是什么？
- [ ] useOptimistic 的回滚由谁触发、什么时机？
- [ ] 客户端校验和服务端校验各自"身份"是什么？共享什么？
- [ ] after() 适合哪些活、不适合哪些活？
- [ ] "新评论提交后原地可见"该用四种同步方式里的哪种组合？

---

## 🚀 部署预告

- L5 收官 **next-middleware-auth**：变更与鉴权的"外围防线"——边缘中间件（ matcher、rewrite、第一道会话闸门），与本课 Action 内鉴权组成完整纵深；
- RHF/zod 双侧共享那一段，L8 全栈项目实战会作为"类型贯通主线"完整走一遍。
