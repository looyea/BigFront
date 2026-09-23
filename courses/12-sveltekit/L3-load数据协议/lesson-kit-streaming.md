# 流式渲染：把 Promise 塞进 data

> 目标：掌握 server load 的流式输出协议——Promise 何时被 await、何时被下发，{#await} 骨架层编排，慢接口不拖首屏的水位设计，以及流式在真实部署环境里的五个陷阱（呼应 next-streaming、svelte-template #await）。

## 一、默认时序：全量等待，一次出页

不了解流式之前先立准绳：渲染一页时，Kit **并发**执行该页所有 load（layout + page、universal + server），**全部返回后页面才渲染**——没有请求瀑布串行，但也没有"先到先出"。客户端导航时多个 server load 的结果还会合并进同一个响应。所以默认行为下，最慢的那个 load 决定首屏时间——流式优化优化 exactly 就是这个等式。

## 二、核心机制：server load 里的 Promise 会被"直播"

**server load 返回值里的 Promise 不会被服务端等完再出页，而是随 resolve 逐个流式发送到浏览器**。于是排版权交到你手里：

```ts
// src/routes/blog/[slug]/+page.server.ts
export const load = (async ({ params }) => ({
  // 慢且非首屏必需：Promise 原样下发，但调用在这里就起飞
  comments: loadComments(params.slug),
  // 快的：await 掉，保证首块 HTML 带正文
  post: await loadPost(params.slug)
})) satisfies PageServerLoad;
```

官方示例注释点破了编排心法：**把 await 放在最后**——对象字面量按从左到右求值，先登记 comments 的 Promise（查询立刻起飞）、再 await post，两个查询才真正并行；反过来写就制造了人为瀑布。返回对象里"未解析的 Promise 进后续块、已解析的值随首块出页"。

模板侧消费靠 Svelte 5 的 `{#await}`：

```svelte
{#await data.comments}
  <p>Loading comments...</p>   <!-- 骨架层 -->
{:then comments}
  {#each comments as c}<p>{c.content}</p>{/each}
{:catch error}
  <p>error: {error.message}</p>
{/await}
```

SSR 阶段浏览器就先拿到"正文 + Loading comments 骨架"的 HTML，评论 resolve 后由流把真实内容替换进来——这正是 React 18 `Suspense` 流的 Svelte 表达，但控制面从组件树挪到了数据层。

## 三、五个环境陷阱（官方点名）

1. **JS 关闭即失效**：流式靠水合后的运行时接管拼装，无 JS 的客户端只能看到骨架——对必须全内容直达的场景（爬虫外的受限环境）别把正文也塞进 Promise；
2. **universal load 的 Promise 不流式**：SSR 渲染器没法"渲染中暂停等 Promise"，页面若服务端渲染，universal load 里返回的 Promise 会在浏览器重跑 load 时被**重建**——要流式，把 Promise 放进 **server** load；
3. **缓冲型平台吞掉流**：AWS Lambda、Firebase 这类不支持流式响应的平台会把响应整体缓冲——所有 Promise resolve 完才一次性出页，流式收益归零；自建 NGINX 反代记得关掉对上游的响应缓冲，否则同样的事以另一种方式发生；
4. **覆水难收**：响应一旦开始流出，headers 与状态码已成事实——流式 Promise 里**不能** setHeaders、不能 throw redirect（throw error 的兜底也只能靠模板 `{:catch}`），鉴权/重定向决策必须在出页前完成；
5. **未处理拒绝炸服务器**：依赖追踪不管 return 之后的事——若某个懒流 Promise 在渲染开始前就 reject 且无人 catch，服务端会以 unhandled promise rejection 崩掉。规则：用 **event.fetch 发起的** Promise 由 Kit 自动兜底；其余（直接调 DB 驱动等）给 Promise 挂一个 noop `.catch(() => {})` 标记"已处理"，模板侧的 `{:catch}` 照常工作。

## 四、版本暗坑与策略分层

SvelteKit 1.x 里**顶层 Promise 会被自动 await**、只有嵌套 Promise 才流式——老教程/老代码看到"return await 也没关系"的结论，2.x 起语义已变（顶层不 await 才能流）。排错时"明明返回了 Promise 却仍等完才出页"，先检查是否掉进 1.x 惯性写法。

策略分层收束本关：首屏必需数据 await 进壳、次要数据 Promise 流式、纯交互后数据交给 invalidate/depends 手动刷（上一关）——三档水位各司其职，配合 L2 的预取，"快"就从玄学回到编排。

## 五、自检清单
- [ ] 默认并发全等待的 load 时序；流式改写的正是"最慢 load 决定首屏"这条等式
- [ ] 官方"await 放最后"编排心法写出来：快值进首块、慢 Promise 进后续块
- [ ] 五个环境陷阱各是什么：无 JS、universal 不流式、缓冲平台/反代、覆水难收、unhandled rejection
- [ ] 流式 Promise 的兜底义务：event.fetch 自动管、其余要 noop catch
- [ ] 1.x 顶层 Promise 自动 await 的历史语义对读旧教程的影响

🚀 **下一站 L4**：kit-form-actions——<form> 直连服务端的渐进增强写法：actions 契约、_pending/$form 状态与 use:enhance 接管。
