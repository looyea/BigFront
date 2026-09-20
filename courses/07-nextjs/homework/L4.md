# L4 课后作业 · 数据获取与缓存

> 覆盖：fetch 扩展与三层缓存、段配置与 ISR/PPR、Route Handlers。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 这段取数有什么双重问题（错误处理 + 缓存污染）？
```ts
const res = await fetch(API + '/config');
return res.json();     // 上游 500 时……？默认参数下这份"错误 JSON"会被……？
```

**2.** 父组件 `await getStats()`，子组件又 `await getStats()`，用户网络面板看到 2 次上游请求。但本地 dev 只有一次——解释差异可能出在哪两个参数写法上。

**3.** 加了这行之后页面再也不静态化了，为什么？一行修复（保留读取需求）：
```ts
const token = cookies().get('auth_token')?.value;   // 其实本页只有页脚用户名需要它
```

**4.** 后台调 revalidateTag('goods') 后，自己浏览器里商品页仍是旧的。给出两个可能原因（分属不同缓存层）与验证方法。

**5.** 这个 handler 在 Vercel 上偶尔 500，本地复现不了。指出两个隐患：
```ts
export async function GET() {
  const rows = await db.query('select * from huge_table');   // ← ?
  return NextResponse.json(rows);
}
```

**6.** `unstable_cache(getUser, ['user'], { revalidate: 60 })` ——所有用户 1 分钟后看到的都是同一个人的资料。错在哪？

**7.** 为什么这段里 `export const dynamic = 'force-static'` 反而是个危险信号？该页代码里有哪行让它行为诡异？
```ts
export default async function P() { const c = cookies().get('x'); ... }
```

**8.** 同事把页面取数全改成客户端 fetch('/api/xxx') 调自家 handler，说"统一入口"。L4 两课里各有一句批评，写出来。

**9.** 这个 SSE 接口首个消费者能收流，但经常"整段一起到"。两处可能元凶（一个在代码、一个在链路）：
```ts
export const runtime = 'edge';
export async function GET() { return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }); }
```

**10.** 商品页 revalidate=300，运营刚改的价格 20 分钟后还有用户看旧价——除了等 TTL，你的完整补救链条应该早已含哪一步？写侧代码该长什么样？

---

## 第二段 · 手写编程（5 小题）

**11.** 写 `lib/api.ts`：统一的 `apiFetch(path, { tags, revalidate })`，自动拼 base、查 res.ok 抛带状态码错误、失败时不写缓存（no-store 降级可选）。附 3 个调用例。

**12.** 用 unstable_cache 包装"用户订单列表"：键含 uid、revalidate 30、tag 为 `orders-{uid}`；写一个 handler 完成"创建订单+按该 uid 精确失效"。

**13.** 实现 `/api/health`：Node 运行时，并发探测 DB（SELECT 1）与上游搜索接口（HEAD），300ms 超时，返回 `{ db: 'up|down', search: 'up|down|timeout' }` 与整体状态码（全 up=200 否则 503）。

**14.** 给 `/blog/[slug]` 配 ISR（revalidate=60）+ generateStaticParams 3 篇；再写一个 `/api/revalidate` handler：校验 secret 头后 revalidatePath('/blog', 'layout')，用 curl 验证发布链路生效。

**15.** 写一个最小 SSE handler（3 秒内每 500ms 推一条时间）+ 页面用 EventSource 消费；再解释为什么该页本身保持纯静态也不影响推流。

---

## 第三段 · 场景题（1 小题）

**16.** 新闻站（日更 500 篇、突发要闻要 1 分钟内全站可见、历史文章几乎不改、评论实时）+ 3 台自建 Node + Nginx+CDN。请设计：① 页面级策略（列表/详情/评论各自 revalidate 值与动态化方式）；② tag 命名体系与"突发"发布链路（谁调、调什么、多实例如何同步失效——L4 面试 6/9 的落地）；③ CDN 层参数（max-age、stale-while-revalidate）如何与源站策略配合而不互相打脸；④ 你如何度量这套设计的命中率。

---

## 第四段 · 简答题（3 小题）

**17.** 画出三层缓存金字塔，标出每层的存储位置、键构成与失效手段。

**18.** Route Handler 三正当用途与"页面取数不该绕自家 API"的理由各一句话。

**19.** edge 与 node runtime 的分界：列 3 个 edge 不可用能力和 2 个 edge 独占优势。

---

## 第五段 · 挑战题 🏆

**20.** 设计"缓存策略守门+可观测"方案：① 用 ESLint 自定义规则禁止无第三个参数缓存声明的裸 fetch（AST 层怎么判？误报场景如客户端文件如何豁免？）；② 一个开发期 `/api/__cache-report` handler：输出当前进程 Data Cache 键清单与 tag 索引（平台 API 拿不到时你如何自造埋点层——提示：lib/api.ts 单口必经）；③ 把 build manifest 的 ○/●/ƒ 快照纳入 CI，路由模式意外变化时阻断合并。写出关键代码骨架与原理说明（对照 vite-plugin-write 的钩子时机与 mp-publish 的盯盘指标思想）。
