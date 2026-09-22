# 校验体系：zod、superForms 与错误回显

> 目标：把上一关手写的 `if (!email) return fail(...)` 升级成体系——确立"服务端校验为底、客户端校验为表"的双层分工，掌握 FormData→zod 的双端复用模式、字段级错误与值回显的呈现协议，并看清 sveltekit-superforms 在生态里的位置（呼应 vue-forms-validation 的双端分工、express 校验中间件的"服务端永远是真相"）

## 一、分工铁律：客户端校验是 UX，服务端校验是安全

浏览器自带校验（`required`、`type="email"`、`pattern`）和 JS 校验都只能挡"手滑"，挡不住 curl——**任何进 action 的数据都必须重新过服务端校验**，这是本关的第一公理。客户端校验的价值是即时反馈与省一次往返：字段失焦就报"邮箱格式不对"，不用等提交转圈。两层各干各的活：
- 客户端层：HTML 约束验证属性（无 JS 也生效，渐进增强的第一道）+ 少量 JS 提前拦截（体验）；
- 服务端层：唯一有裁决权的一层，返回字段级错误 + 用户已填值。

官方 action 示例本身就是最小校验闭环：`fail(400, { email, missing: true })` → 模板 `{#if form?.missing}` 回显。手写 if 适合三条规则的表单；规则一多就该上 schema。

## 二、FormData → 对象 → zod：双端复用的标准管道

zod schema 是纯函数对象，天然同构——放 `src/lib/schema/` （注意：**不要**放 `$lib/server`，客户端也要 import 它，放 server 私域会被构建拦截，L3 的目录执法在这里反向生效）。接线时有三个 FormData 特有坑：

```ts
// src/lib/schema/login.ts —— 双端共享，零副作用
import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().email(),
  // 坑 1：表单数字是字符串！number 输入也要 coerce
  age: z.coerce.number().int().min(18),
  // 坑 2：未勾选的 checkbox 根本不在 FormData 里，undefined ≠ false
  tos: z.boolean().optional().refine(v => v === true, '必须同意条款'),
});
```

```ts
// src/routes/login/+page.server.js
import { loginSchema } from '$lib/schema/login';
import { fail } from '@sveltejs/kit';

export const actions = {
  default: async ({ request }) => {
    const raw = Object.fromEntries(await request.formData()); // 管道第一步
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors; // 坑 3：errors 展平成字段→消息映射
      // 回传原值实现"错了不用重填"，但敏感字段除外（官方：不回 password）
      return fail(400, { input: raw, errors: fieldErrors });
    }
    // TODO 用 parsed.data（类型收窄后的成品），不要再碰 raw
  }
} satisfies Actions;
```

三条坑背熟：FormData 值全是字符串（或 File）→ 数值要 coerce；未勾选的 checkbox **不会**以 false 出现，而是整个键缺失；`safeParse` + `flatten().fieldErrors` 是把 zod 错误整形进 action 返回值的惯用桥。另一个纪律：`.optional()` 用于"可能缺席"与 `.default()` 用于"缺席补默认"语义不同，筛选表单常配 `z.literal('').optional()` 处理空串。

## 三、回显协议：input + errors 的形状自由与焦点找回

action 返回值结构自由，社区自然收敛出惯例形状：`{ input, errors }`（字段名对齐 superForm 的命名，将来换库无痛）。模板侧两个细节：
- 值回显 `value={form?.input?.email ?? ''}`（上一关讲过 enhance 会重置 form 元素——**重置后靠的正是这份回显**把值填回来）；
- 焦点回显：`use:enhance` 默认"焦点重置到 appropriate element"，社区增强写法是回调里 `requestAnimationFrame` 后 `document.querySelector('[id^="error-"]')?.focus()`——错误播报跟手，无障碍审计会查这条。

## 四、sveltekit-superforms：生态位与它替你干的活

手写管道跑通后，第三方 **sveltekit-superforms**（社区库，非官方出品——面试与文档引用时注意口径）把重复劳动收编：`superValidate(schema, formData)` 在服务端一行完成 parse+整形，返回值直接 `json()` 给 action；客户端 `superForm(data)` 解构出 `form / errors / constraints / submitting / delayed` 五个状态；配 `zodClient`（其 zod 适配家族）让**同一份 schema** 在浏览器即时执行（模式：SPA 双端跑、server 只在消息回传路径上兜底）。它还白送：多表单同页的 `id` 区分、文件上传字段、无限循环防护、以及和 `use:enhance` 的挂接（`superForm` 返回的 `form` 与 action 返回值自动弥合）。
选型判断：表单 ≥ 两步流、字段互相依赖（zod 的 `superRefine`/依赖字段）、或团队要统一错误形状 → 上 superForms；三输入一条验证规则的登录页 → 手写管道更透明，别为一个小表单引入依赖面。注意 zod 大版本要与适配包对齐（zod 4 与 v3 的 flatten 行为有差异），升 zod 先查适配包支持矩阵。

## 五、HTML 约束验证：免费的渐进增强第一道

`required / type=email / minlength / pattern` 不写一行 JS 就参与校验：浏览器提交前拦截并原生弹提示。两个工程注记：
- 原生气泡样式丑且不可本地化时，`form` 加 `novalidate` 关掉自动拦截、改用约束验证 API（`element.checkValidity()` / `invalid` 事件）自己渲染错误——**关的是气泡，不是规则**，checkValidity 仍全量可用；
- HTML 校验口径永远比 zod 松（`type="email"` 只查个大致形状），所以它只做体验层，裁决仍在服务端——这正是"为表为底"分工的物理原因。

## 六、待提交态：pending 与双保险反馈

无 JS 时浏览器原生提交后用户对着转圈的地址栏等；有 JS 后 enhance 接管，反馈要自己做：`use:enhance={() => { pending = true; return ({ update }) => { pending = false; update(); }; }}` 的经典两拍子——前置函数亮 spinner、回调灭灯并**必须记得调 `update()`** 找回六件套（上一关的覆盖规则在这里生效）。SvelteKit 2.12+ 还暴露 `$app/state` 的 `form: Pending`（老写法是 `$app/stores` 的 `$form.pending`），配合 `<button disabled={form}>` 防双击重复提交。

## N、自检清单

1. 背出分工铁律：为什么客户端校验拦不住攻击、服务端校验给不了即时反馈？
2. FormData 三坑各是什么？`age` 输入为什么 `z.number()` 直接 parse 必挂？
3. `fail(400, { input, errors })` 回传 input 与 enhance 的"重置 form 元素"如何配合出"错误不清值"的体验？
4. superForms 的 server 端与 client 端 API 大致各替你干什么？什么场景不值得引入它？
5. `novalidate` 关掉的是什么、没关掉什么？pending 两拍子里为什么 `update()` 不可漏？

🚀 下一关：kit-error-boundaries——error()/redirect()/json() 三件投掷工具与 +error.svelte 的边界落点规则：预期错误与未预期错误两套世界，从 load 抛错到 fallback 页的完整呈现链。
