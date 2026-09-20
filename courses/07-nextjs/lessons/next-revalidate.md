# ISR、动态渲染与缓存控制

> 目标：上一关管"数据进不进缓存"，本课管"**页面**按什么策略渲染与缓存"——段配置旋钮全家桶（`dynamic / revalidate / fetchCache / runtime`）、把页面变成动态的"反应物"清单、以及新范式 **cacheComponents + PPR**（缓存优先世界）。学完你应能解释：为什么一个 `cookies()` 调用拖垮全页静态化。呼应 **next-render-modes**（推断表）、**next-fetch-cache**（金字塔）、**node-deploy-perf**（CDN 命中策略）。

---

## 一、段配置旋钮：导出一行改全段

段内任意 page/layout 顶部都可以放这些**导出的段配置**（对整段生效）：

```ts
export const dynamic = 'auto';          // 默认：静态优先，遇动态反应物自动转动态
                        // 'force-dynamic' 强制每次请求渲染
                        // 'force-static' 强制静态（cookies/headers 返回空桩！慎用）
export const revalidate = 3600;         // 本段产物缓存 1h 后后台翻新（= ISR）
export const fetchCache = 'default-cache' | 'force-no-store' | ...;  // 段内 fetch 默认姿态
export const runtime = 'nodejs' | 'edge';   // 执行运行时（L5 middleware、L8 部署关联）
```

优先级：`layout` 段配置向下层**继承**，子段可再覆盖——和 CSS 层叠一个味，排查"这页到底动没动"要沿目录向上看一圈（呼应 next-routing 布局持久化）。

---

## 二、动态反应物：什么会"电"变动态

静态优先的世界里，这些调用会把所在段标为 **Dynamic**（请求时渲染、不落 Full Route Cache）：

- `cookies() / headers()` 读写（请求态）；
- `searchParams / params` 在未提供 generateStaticParams 的动态段；
- `revalidate: 0 / no-store` 的 fetch、`unstable_cache(..., {revalidate:0})`；
- Route Handler 里读了 Request 的 body/headers（默认动态）；
- `connection()` ——**主动**声明动态的官方钩子（比如按请求 IP 出内容）。

反直觉但重要的一条：**动态只污染到边界，不污染兄弟**——`<Suspense>` 内的动态子树不拖垮外层静态壳（这正是 PPR 的立足点，见第四节；L3 流式课埋的"祖先链"伏笔在此回收）。

---

## 三、ISR 完整生命周期（App Router 版）

```text
build ──预渲染──▶ /blog/[slug] 全部参数页 HTML+Payload 落盘
用户请求 ──▶ 命中新鲜缓存 → 直接吐（CDN 可再叠一层）
            超过 revalidate → 吐【旧页】+ 后台重渲染 → 新页替换缓存
revalidatePath/tag 主动失效 → 该条目立即标 stale（下次请求走后台翻新）
```

三特性背熟：① **永不 500 阻塞**（SWR 语义，首访者当冤种大头没了）；② 失效是**异步**的——`revalidatePath` 返回时新页还没生成（面试高频："所以它不能保证下一个请求就是新数据，强一致场景要走客户端渲染或带版本查询"）；③ 后台重渲染并发去重（同页多请求只触发一次再生）。

---

## 四、新范式：cacheComponents 与 PPR（方向必答题）

传统模型是"默认静态、动态例外"；`cacheComponents: true` 翻转为"**默认全静态 + 动态必须显式 Suspense 申报**"：

```ts
// next.config.ts
experimental: { ppr: true, cacheComponents: true }   // 版本演进中，名字/形态可能再变

// app/time/page.tsx
export default function Page() {
  return (
    <>
      <h1>静态壳 —— 构建时就定稿</h1>
      <Suspense fallback={<Skeleton />}>
        <ServerClock />   {/* 内部 connection()/cookies() → 动态 hole，请求时流式补 */}
      </Suspense>
    </>
  );
}
```

- **PPR = 静态壳（CDN 秒发）+ 动态 hole（流式补齐）**——L1"模式四选一"彻底终结为"一页多模式并存"；
- 配套的细粒度旋钮：`cacheLife('max'/...)`（payload 在 CDN/浏览器侧存活期）、`cacheBoundary`（跨请求复用 hole 数据）、`'use cache' + cacheTime`（函数级缓存，取代 unstable_cache 的方向）；
- 面试安全答法：说清**趋势**（缓存单元从"页"细化到"hole/函数"、声明式而非魔法推断）+ 标注"实验特性，生产锁版本评估再用"（呼应 next-architect 的未来题）。

---

## 五、Router Cache 调优（浏览器那层）

```ts
experimental: {
  routerCacheLife: 60,        // payload 内存存活秒数（默认动态 2min/静态 5min 量级，版本有别）
  routerCacheState: ...       // 导航返回时是否保留旧 payload
}
```

症状对应：Link 预取后半小时再点仍拿到旧 payload → routerCacheLife 过长或该页没进失效广播；SPA 感"回退数据新、前进数据旧"→ state 策略问题。**这层没有 revalidateTag 直达**——tag 失效管服务端，浏览器侧靠 TTL/版本兜（L2 面试 11 的跨标签页脏读同款根源）。

---

## 六、一张决策表收束 L4 上半

| 需求 | 组合拳 |
|---|---|
| 内容站，改文后 1 分钟内全站可见 | revalidate:60 + 写侧 revalidateTag；CDN 短 max-age+stale-while-revalidate |
| 大屏看板实时数 | 页面 force-dynamic + 数据 no-store，或静态壳+hole 轮询（PPR 思想） |
| 营销页极限首屏 | 纯静态 + next/image/字体自托管（L6）+ 边缘 CDN |
| 按人千面但可容忍 30s | 用户段数据 unstable_cache 键含 uid + revalidate:30（缓存粒度=新鲜度粒度） |

---

## 七、自检清单

- [ ] dynamic 三个取值各何时用？force-static 下 cookies() 会怎样？
- [ ] 列出四类"动态反应物"，以及 Suspense 如何限制污染半径；
- [ ] revalidatePath 之后下一个请求拿到的是新页吗？为什么？
- [ ] PPR 相对"全页 SSR"省掉了什么？
- [ ] Router Cache 与服务端缓存的失效为什么不同步？

---

## 🚀 部署预告

- 读的一侧（渲染缓存）齐了，下一关 **next-route-handlers** 补写的通道：Route Handler 的缓存姿态、与 09-express 的分工宣言；
- L5 Server Actions 登场后，本课"写侧失效"从口头承诺变成真枪实弹（`after()` + revalidate 组合）。
