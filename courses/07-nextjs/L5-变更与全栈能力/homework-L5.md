# L5 课后作业 · 变更与全栈能力

> 覆盖：Server Actions 与 useActionState、表单进阶/after()/失效半径、Middleware 与三层鉴权。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 这个 Action 有两个安全级问题，指出并修：
```ts
'use server';
export async function deletePost(formData: FormData) {
  const id = formData.get('id');
  await db.post.delete({ where: { id } });     // ← ? 和 ← ?
  revalidatePath('/blog');
}
```

**2.** `page.tsx` 里 `<form action={save}>`，save 是 import 自一个**顶层写了 'use server'** 的 utils.ts，同事抱怨"为什么我的 formatMoney 也能被网络调用"。解释事故链。

**3.** useActionState 版本的风控写法，指出 state 永不更新的原因：
```ts
const [, action] = useActionState(async (prev, fd) => {
  const err = await vote(fd);
  console.log(err);            // ← 反馈去哪了？
  return null;
}, null);
```

**4.** 提交按钮一直可点导致双击下两单。isPending 有了、也 disable 了，还是双单——给出两个服务端层面的原因。

**5.** middleware 里这段代码在生产 Edge 抛 `fs is not defined`，本地 Node 却没事。为什么？改哪里？
```ts
const perms = JSON.parse(fs.readFileSync('./perms.json', 'utf8'));
```

**6.** matcher 写成 `['/:path*']`，Lighthouse 报告 middleware 总耗时暴涨。解释为什么，并给出模板修法。

**7.** 登录后 `router.push('/admin')` 偶发白屏：/admin 的 page 里 `redirect('/login')` 循环回来了。会话 cookie 明明已 Set-Cookie 成功。最可能的时序原因是什么？（提示：Action 响应期间 cookie 何时可达）

**8.** 同事把发邮件（SMTP，约 4 秒）直接 await 在 Action 里，用户点"提交"后转圈 5 秒。两种改法及取舍（after / 队列+幂等键）。

**9.** 一个 Action 里 `try { ... } catch { return { error: '出错了' } }` 包住全部——从可观测与失效一致性两个角度各批一句。

**10.** 登出后按回退键，/admin 页面还在（用户名也还在）。给出三层组合修法（缓存头、导航栈、会话侧各一手）。

---

## 第二段 · 手写编程（5 小题）

**11.** 写完整"访客留言"链路：Action（zod 校验+昵称长度+幂等 IP 限 5 条/分钟）+ useActionState 表单（pending 禁用、错误内联、成功清空），无 JS 提交路径可用。贴 actions.ts 与组件两个文件。

**12.** 用 useOptimistic 实现待办新增：即时插入带"发送中"灰态、成功转正常、失败回滚+toast。写清乐观项 id 策略与 key 稳定性怎么保证。

**13.** 写 `withAuth(actionFn)` 高阶函数：解 session → 无权时返回统一错误 → 有权注入 ctx；用它重构第 11 题 Action，对比模板层的行数与心智收益（3 句话）。

**14.** middleware：未登录访问 `/account/**` redirect 到 `/login?from=…`；登录后 login 页访问者反向 redirect 到 from；matcher 排除静态与 api；登录后 from 参数需白名单校验（防开放重定向）——写出完整文件。

**15.** 用 after() 实现"注册成功 → redirect 首页 → 后台发欢迎邮件+埋点"，并加一条：邮件失败不影响注册结果但要有日志。再回答：这个 after 在 Vercel Hobby 计划上可能撞什么限制？

---

## 第三段 · 场景题（1 小题）

**16.** 为"多租户笔记 SaaS"设计变更与鉴权全案：邮箱+OAuth 双登录、团队空间（owner/editor/viewer）、分享链接（公开只读、可设密码）、行级数据隔离。交付：① 会话方案选型（JWT vs DB session，edge 与 Node 各自职责）；② 三层纵深在此业务的每一层具体检查什么（列清单）；③ 分享链接访问路径的缓存策略（公开可缓存但要防越权串数据，如何划动静边界）；④ 变更通道（Action vs Handler）分配表。

---

## 第四段 · 简答题（3 小题）

**17.** Server Action 的"渐进增强"在无 JS 下完整走一遍网络时序（从点击到看到结果）。

**18.** revalidatePath、revalidateTag、router.refresh、useOptimistic 各自作用于哪一层/哪一侧？各举一个不可替代的场景。

**19.** middleware 能做 i18n 协商却做不了 RBAC 细判，用"运行位置与依赖材料"解释这一刀切的原理。

---

## 第五段 · 挑战题 🏆

**20.** 设计"端点攻击面审计"：结合 L5 全部知识，做一个开发期工具/流程，自动枚举应用的公网可调用面（每个 'use server' 导出、每个 route handler、每个可访问页面），并对每个端点检查三件事：有无鉴权前置（AST 找 auth()/cookies() 调用模式）、有无入参校验（safeParse/校验调用）、失效声明是否成对出现（revalidate* 与写操作配对）。要求：① 扫描策略（AST/构建产物两版思路）；② 输出格式（矩阵报告+CI 阻断规则）；③ 讨论"漏报比误报更危险"的场景该定成 error 还是 warning，如何维护例外清单防止规范崩坏（对照 L2 挑战题的守门员与 09 包 exp-testing 的护栏观）。写关键代码骨架与原理说明。
