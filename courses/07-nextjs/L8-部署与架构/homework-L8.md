# L8 作业：部署、全栈项目与架构视野

> 覆盖关卡：next-deploy / next-fullstack-project / next-architect。五段式 20 题，这是 07 包的收官作业。

## 第一段：读代码找 Bug（10 题）

**题 1**
```dockerfile
FROM node:20
COPY . /app
RUN npm install && npm run build
CMD ["npm", "start"]
```
这个 Next Dockerfile 至少有三个问题（体积/缓存/安全各一），指出并给出修正思路。

**题 2**
```js
// next.config.js
module.exports = { /* 没有配 output */ };
// 部署脚本只拷了 .next/ 目录进镜像 → 启动即 Cannot find module '@prisma/client'
```
为什么只拷 .next 跑不起来？开哪个配置能生成自足产物？

**题 3**
```bash
# 容器启动命令
CMD ["node", "server.js"]
# 环境里没设任何变量；宿主机 curl 容器IP:3000 不通
```
standalone server 在容器内监听地址是什么？该补哪个环境变量？

**题 4**
```nginx
location / {
  proxy_pass http://next;
  # 未配置任何 X-Forwarded-* 头
}
```
HTTPS 站点上登录重定向后跳回了 http 且 req.ip 全是 172.17.0.1。缺了哪些头？

**题 5**
```ts
// .env.production
NEXT_PUBLIC_STRIPE_SECRET_KEY=sk_live_xxx
```
这个变量名犯了什么致命错误？它何时被注入 bundle？

**题 6**
```ts
// app/(app)/actions.ts
'use server';
export async function deleteNote(id: string) {
  await db.note.delete({ where: { id } });
  revalidatePath(`/notes/${id}`);   // 只此一行
}
```
用户删除后在列表页仍偶尔看到该笔记。问题在哪？

**题 7**
```ts
try {
  await saveNote(formData);
} catch (e) {
  captureException(e);
  return { ok: false };
}
```
上线后部分用户提交成功后不跳转，Sentry 里出现大量 `NEXT_REDIRECT` 事件。为什么？

**题 8**
```ts
// src/lib/prisma.ts
export const prisma = new PrismaClient();
```
dev 挂一整天后数据库报 too many connections。给出修复代码。

**题 9**
```ts
export async function getServerSideProps() {
  const data = await fetch('https://api.x/all', { cache: 'force-cache' });
  return { props: { data } };
}
```
页面明明要每天更新新内容，却永远是构建时快照。两个概念混用了，指出矛盾。

**题 10**
```ts
// middleware.ts
import { signJwt } from '@/lib/crypto'; // 内部使用了 node:crypto 的 createHmac
```
Vercel 部署后 middleware 500，本地自托管却正常。为什么？

## 第二段：手写编程（5 题）

**题 11** 手写一个多阶段 Dockerfile：deps → builder（next build，开启 standalone）→ runner（alpine、非 root、HOSTNAME=0.0.0.0、只拷三样产物），并写出 docker build/run 命令。

**题 12** 给 NoteDeck 的 `togglePin(noteId)` Action 写完整实现 + 单测：要求包含鉴权第三层检查、乐观锁冲突处理（version 字段）、失效半径覆盖 /notes 与该详情页、成功返回 `{ok:true,pinned}`。

**题 13** 写一个 /api/health Route Handler：并发检查 DB（SELECT 1）与缓存 ping，各 500ms 超时，任一失败返回 503 并附分项状态 JSON；全过返回 200 + git sha。

**题 14** 用伪代码设计"预热脚本"：发布后从路由清单读取 Top 50 URL，并发 4 逐个请求并校验 200 与 LCP 元素标记存在，全部通过才把实例挂入负载均衡。

**题 15** 为"官网(Next) + 管理后台(待定) + 定时报表(待定)"写一页选型备忘录：每项给出方案、放弃的方案、放弃理由——练习 next-architect 的三连问格式。

## 第三段：场景题（1 题）

**题 16** 电商站迁移评估：现状 Vite SPA + Express 单体，日活 30 万，痛点是 SEO 与首屏。老板拍板"全量重写为 Next 单体，三个月上线"。请列出你会支持的点、会反对的点、以及你建议的渐进路线（提示：按路由分区分批迁移、双栈期的会话与 CDN 如何处理）。

## 第四段：简答（3 题）

**题 17** 画（或列）出 standalone 部署与 Vercel 部署在"Full Route Cache 存储位置"上的本质区别，以及自托管多实例时你会给的两种补救。

**题 18** "RSC 终结的是所有代码必须进浏览器的假设"——用你自己的话解释这句话，并举一个它不成立的场景。

**题 19** 从本包学到的所有"缓存/失效"知识中，挑出你认为最重要的三条安全线（碰了就会出事故的那种），各配一句反面案例。

## 第五段：挑战题 🏆（1 题）

**题 20** 🏆 毕业设计：把 NoteDeck 做成真项目并上线——schema 至少 Note/Tag/Session 三表；三层鉴权完整；含 error/not-found/loading 全套兜底；质量门禁（lint+typecheck+测试+build 红线）进 CI；Vercel 或 自家 Docker 部署；最后写一页"架构决策记录（ADR）"：渲染分区、缓存策略、失效半径、部署形态各一段，说明你放弃了什么、为什么。这一题没有标准答案，做完它就是你的作品集主项目。
