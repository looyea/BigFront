# 全栈项目实战：从空白目录到线上笔记应用

这一关不讲新知识，只做一件事：把 07 包 23 关的零件拧成一个真项目——"NoteDeck"私人笔记应用（列表、详情、Markdown 编辑、标签、登录可见）。按真实开发顺序走一遍，每一步都能指回某关的理论（项目方法论呼应 react-architecture、exp-patterns、node-cli 的脚手架思维）。

## 1. 需求与决策清单

先回答四个架构问题（这些答案决定后面所有实现）：

| 问题 | 决策 | 依据关卡 |
|------|------|----------|
| SEO 重要吗？ | 笔记私密，不重要；但落地页重要 | next-render-modes（决定渲染模式） |
| 有富交互编辑器吗？ | 有，Markdown 实时预览 | next-server-client（客户端边界） |
| 数据要不要秒级新鲜？ | 自己的笔记，写完即见即可 | next-fetch-cache（缓存层选择） |
| 部署到哪？ | Vercel（练手）+ standalone（自家机房备选） | next-deploy |

技术栈定案：Next 15 + TS + Prisma/SQLite（练手够小）+ Auth.js 凭证登录 + Tailwind + Playwright。

## 2. 骨架：目录即架构

```
src/app/
  (marketing)/        # 路由组：落地页，静态，无布局干扰
    page.tsx          # SSG ●
  (app)/              # 路由组：登录后应用区
    layout.tsx        # 侧栏 + 鉴权守卫入口
    notes/
      page.tsx        # 列表（动态渲染）
      [id]/page.tsx   # 详情
      new/page.tsx    # 新建（编辑器岛）
    actions.ts        # 'use server' 变更集中地
  api/
    auth/[...nextauth]/route.ts  # Auth.js 挂载
  layout.tsx          # 根布局：字体 + metadata + 全局 error
  global-error.tsx
src/
  lib/db.ts           # Prisma 单例
  lib/auth.ts         # Auth 配置导出
  components/         # 客户端岛组件
```

约定生效点：路由组分开"公开营销区"与"私有应用区"两套布局互不污染（next-groups-matchers 第 1 节）；变更全集中到 (app)/actions.ts 不散落（next-server-actions 的组织建议）。

## 3. 数据层：一次做对 Prisma + 缓存边界

```ts
// src/lib/db.ts —— PrismaClient 单例，防 dev 热重载连爆数据库
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { db?: PrismaClient };
export const db = globalForPrisma.db ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.db = db;
```

读路径原则：**"响应与请求者无关"才有资格被缓存**——笔记列表与详情都因登录而异，全部走动态渲染（cookies() 出现即自动动态，不必手写 force-dynamic，呼应 next-fetch-cache 第 4、5 节）；营销落地页与公开文档才配 Full Route Cache/ISR。取数在页面一次拿全再传 props，别在子组件各拉一份（瀑布预防，呼应 next-perf 第 3 节）。

## 4. 鉴权：三层纵深的落地

```ts
// middleware.ts —— 第一层：粗粒度挡在段外
export { auth as middleware } from '@/lib/auth';
export const config = { matcher: ['/((?!api/auth|_next|login|landing).*)'] };
```

第二层：(app)/layout.tsx 服务端 `await auth()` 再校验一次（middleware 的 JWT 可能过期于握手之间，呼应 next-middleware-auth 第 3 节"middleware 不是最终防线"）；第三层：actions.ts 每个变更函数开头 `const session = await auth(); if (!session) throw redirect('/login')`——**Action 是公开端点，永远假设攻击者直接 POST 它**（呼应 next-forms-mutations 防御四层模板）。

## 5. CRUD：读是组件、写是 Action

- **Create/Update/Delete 全走 Server Action**：表单 useActionState 拿结构化返回（成功→ redirect 到详情，失败→ 留在表单显示字段错误），删除按钮用 useOptimistic 秒反馈 + 失败回滚（呼应 next-forms-mutations 第 2、3 节）；
- **写完必须算好失效半径**：action 末尾 `revalidatePath('/notes')` + `revalidatePath('/notes/'+id)`——列表与详情是两个缓存位点，漏一个就出现"改完刷新才变"的幽灵 bug（呼应 next-revalidate 第 5 节失效半径选择树）；
- **编辑器是客户端岛**：`<Editor>` 标 'use client'（受控 textarea + 预览），但它的数据由服务端父组件查好传进来——props 序列化海关只过纯数据（呼应 next-boundaries 第 2、3 节）；Markdown 预览这类重组件用 next/dynamic 隔离，不进列表页首屏包（呼应 next-perf 第 2 节）。

```ts
// (app)/actions.ts 骨架
'use server';
export async function saveNote(prev: State, form: FormData) {
  const session = await auth(); if (!session?.user) return { ok: false, error: '未登录' };
  const parsed = noteSchema.safeParse(fromFormData(form));      // zod，校验在服务端
  if (!parsed.success) return { ok: false, fields: flatten(parsed.error) };
  const note = await db.note.upsert({ ... });
  revalidatePath('/notes'); revalidatePath(`/notes/${note.id}`);
  return { ok: true, id: note.id };   // 页面层 redirect 放调用方，避免 Action 里 throw 被 catch 吞
}
```

## 6. 体验件：一次配齐，不再回头

- metadata：根 layout 全站模板 + 落地页 openGraph + robots/sitemap（私密 /notes 段 `robots: 'noindex'`，防止笔记进搜索引擎——安全事故级细节，呼应 next-metadata 第 2、3 节）；
- 字体与图：next/font 自托管思源 + next/image 管封面（呼应 next-fonts-images）；
- Tailwind + cn() 组织编辑器工具栏样式（呼应 next-css 第 3 节）；
- 兜底：notes 段 error.js（展示 digest + reset）、global-error.js 自包 html、not-found.js 给回列表出口（呼应 next-error-loading 第 2、3 节）。

## 7. 测试与发布：闭环最后两环

测试按 ROI 排（呼应 next-testing D2 那题）：Action 的未登录/校验失败/成功三分支单测 → /api/health Route Handler 冒烟 → Playwright 黄金路径（登录→建笔记→改→删）。然后走发布清单：NEXT_PUBLIC_ 扫密钥、standalone Dockerfile 或 vercel --prod、Nginx immutable 头、预热再放量（next-deploy 全套自检）。上线后盯三个数：digest 错误率、LCP p75、Action 失败率——发布窗口异常即回滚。

## 8. 复盘：这个项目里每个决定都是"某关的落地"

串一遍发现：07 包没有"终章项目专属知识"，全栈项目=既有旋钮的组合正确值。这正是 Next 的学习路径红利——概念（L1-L3）→ 数据（L4-L5）→ 体验（L6）→ 工程（L7-L8），每一关的自检清单在这个项目里都真用上了。你自己做项目时，把本关当检查单逐节过。

🚀 部署预告：最后一关 next-architect 跳出"怎么用 Next"，回答"什么时候该用、什么时候不该用、它往哪去"——给出架构师视角的终局地图。
