# 服务端取数与 fetch 缓存

> 目标：进入 L4——Next 真正的护城河"**缓存**"。本课三件武器：① 组件内 `async/await` 取数的组织方式（含与 L3 并行/Suspense 的接口）；② Next 对全局 `fetch` 的扩展（`cache` / `next.revalidate` / `next.tags`）；③ 三层缓存金字塔（Data Cache / Full Route Cache / Router Cache）与"请求记忆化"。呼应 **react-data-fetching**（客户端取数库）、**exp-rest**（被取的那一端）、**node-deploy-perf**（CDN 缓存分层心智）。

---

## 一、取数即渲染：async 组件的姿势

```tsx
// 库层：统一出口，方便加日志/超时/重试（lib/api.ts）
export async function getPosts() {
  const res = await fetch(`${process.env.API_BASE}/posts`, { next: { revalidate: 60, tags: ['posts'] } });
  if (!res.ok) throw new Error(`posts ${res.status}`);   // ← 非 2xx 必须自己处理（fetch 不自动 throw！）
  return res.json();
}
```

```tsx
// 组件层：谁需要数据，谁 await（lib 层函数）
export default async function Blog() {
  const posts = await getPosts();       // 命中缓存则毫秒返回
  return <List posts={posts} />;
}
```

与 09-express 的客户端视角对偶：以前"页面调 API"，现在"**组件调数据源**"——中间那层 HTTP API 很多时候被省了（组件→lib→DB）。但记住本课的戒律：**取数函数与组件分离**（lib 层可被 Action/Route Handler/SSG 复用，呼应 exp-patterns 的分层）。

---

## 二、Next 对 fetch 的扩展：第三参数改变命运

原生 fetch 的 `cache` 字段被 Next 接管扩展：

```tsx
fetch(url, { cache: 'no-store' })                    // 每次请求都回源（动态）
fetch(url, { next: { revalidate: 3600 } })           // 1 小时新鲜期 → Data Cache + 到期 ISR 式回源
fetch(url, { next: { tags: ['posts', 'post-42'] } }) // 贴标签 → 精确主动失效（revalidateTag 用）
fetch(url)                                           // 默认：GET 且未标动态时 = 缓存(构建期/无限期*)
```

\* 默认行为在 14/15 间反复调整（缓存默认开关之争），**团队必须锁死一种写法**：要么显式 `cache`，要么在 config 里定 `fetchCache` 策略——"隐式默认"是事故温床（对照 ts-strict 反 any 的立场）。

**请求记忆化（memoization）**：同一次渲染中，**相同 URL+相同选项**的 fetch 只发一次——父组件 await 了，子组件再调 `getPosts()` 不重复请求。这是把 React 的"同参数函数调两次"旧病在框架层治掉（对照 mp-network 手动 seq 去重的手工活）。

---

## 三、三层缓存金字塔（背结构）

```text        ▲ 命中率递增、新鲜度递减
Router Cache      浏览器内存：预取的 payload（标签页级，秒级 TTL）
Full Route Cache  服务端/CDN：整段路由的 HTML+Payload（静态产物）
Data Cache        服务端：fetch 结果（跨请求、按 URL+tag 键）
     └── 你的真数据源：DB / 上游 API（第 0 层）
```

- **写进哪层由你控制**：fetch 选项决定 Data Cache；段配置（下关的 `revalidate/dynamic`）决定 Full Route Cache；Link 预取自动进 Router Cache；
- **失效链路自上而下**：`revalidateTag('posts')` → 清 Data Cache 相关项 + 使含该 tag 的路由缓存过期 → 下次导航重渲染重下发。Router Cache 客户端侧靠版本/时间自然轮换兜底；
- 心智锚点：这就是 mp-storage 的"信封 TTL + sweep"与服务端化的 CDN/接口缓存的**三合一编排**——只是键空间从 10MB 本地换成了你服务器的内存。

---

## 四、什么能缓存、什么绝对不能

| 场景 | 处置 |
|---|---|
| 千人一面（文章、商品主信息、汇率） | ✅ tags+revalidate 组合拳 |
| 按人不同（购物车、订单列表） | ❌ no-store，或直接 DB 查询走动态渲染 |
| 含用户输入的查询 | ❌ 别把 token 拼进 URL 当缓存键——**缓存键泄漏=信息泄漏**（面试陷阱题） |
| 写操作后的读 | 立即 `revalidatePath/tag`，别等 TTL（L5 与 Server Actions 会师） |

安全线：**Data Cache 是服务器级共享**——A 用户的响应绝不会喂给 B 用户，前提是**你别把用户态混进缓存键**（同 URL 同选项即同缓存条目，若该接口的响应其实随 cookie 变化，缓存就串号了）。自查口诀：**"进缓存的 fetch，响应必须与请求者无关"**（呼应 exp-auth 的"资源归属校验"在缓存层的镜像）。

---

## 五、非 fetch 数据源（ORM/直连 DB）怎么进缓存

`await db.query(...)` 不经过 fetch 扩展，**没有免费缓存**。三条路：
1. `unstable_cache(fn, keys, { revalidate, tags })`：给任意异步函数套 Data Cache 语义（键数组=你的缓存主键）；
2. `cache(fn)`：仅**请求内**去重（React 级 memo，不跨请求）；
3. 承认它动态：把 DB 页设计成 SSR/no-store，缓存交给 CDN 层或 DB 连接池。

```ts
import { unstable_cache } from 'next/cache';
export const getUserOrders = unstable_cache(
  async (uid: string) => db.order.findMany({ where: { uid } }),
  ['orders'],                       // 键前缀，uid 自动拼接
  { revalidate: 30, tags: [(uid) => `orders-${uid}`] }   // 按人失效
);
```

注意第 2、3 条的教训同样适用于 Redis/内存 Map 手搓缓存——**手搓要自备失效**，unstable_cache 只是把 fetch 的模型推广了一下（呼应 mp-storage 的 TTL 信封设计）。

---

## 六、自检清单

- [ ] fetch 四种缓存写法的语义与默认值风险？
- [ ] 请求记忆化和 Data Cache 的作用范围差别（单次渲染 vs 跨请求）？
- [ ] 三层缓存各存在哪里、TTL 什么量级？
- [ ] "响应与请求者无关"防的是哪类事故？
- [ ] ORM 直连想复用 tag 失效，用什么 API？

---

## 🚀 部署预告

- 缓存的**控制旋钮**（revalidate 段配置、dynamic 全家桶、PPR 开关）在下一关 **next-revalidate** 系统展开——本课是"数据怎么进缓存"，下关是"页面怎么定策略"；
- L4 收官 **next-route-handlers** 再回头写接口：有了缓存观，才懂 Route Handler 与 09-express 的分工边界。
