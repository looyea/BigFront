# kit-route-matchers 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 写一个 matcher 的完整契约：放哪、导出什么、怎么挂载？
**来源**：SvelteKit 路由面试高频题的转述。

`src/params/<名字>.ts`，文件名即 matcher 名；导出 `export const match`，类型契约 `ParamMatcher = (param: string) => boolean`，官方示例姿势是 `satisfies ParamMatcher`（保留返回类型里的 `param is 'a' | 'b'` 收窄信息）。挂载：目录名 `[page=fruit]`。可选参数同样可挂 `[[page=fruit]]`，rest 也行 `[...path=doc]`。

### 2. (A) matcher 返回 false 后，请求的最终命运由什么决定？
**来源**：社区答疑高频题的转述。

不是直接 404。失配只是把这条路由划出候选，Kit 按排序规则继续尝试其他可匹配路由（裸参数版、catch-all 版……），**全部失败才 404**。所以 matcher 是"路由竞争"的一环：激进加 matcher 不会堵死流量，只会把 URL 导向你路由集合里更泛化的兜底——前提是你知道自己埋了哪些兜底。

### 3. (A) "Matchers run both on the server and in the browser" 对实现施加了哪些纪律？
**来源**：官方文档一句话延伸的面试题转述。

服务端首请求与客户端导航各裁决一遍，因此：①必须纯同步函数（签名没有 async 余地）；②禁止读环境变量、全局状态、发请求——双端结果不一致会出现"服务端进得去、客户端 404"的分裂路由；③模块顶层也别放重计算（双端都会加载执行），但纯查表/正则预编译无害。

### 4. (B) 你给 /orders/[id] 加了 id=uuid matcher，上线后 /orders/latest 这个老营销链接全 404，为什么、怎么救？
**来源**：线上事故复盘类面试的转述。

`latest` 不是合法 UUID → matcher false → 若路由集合里没有其他能匹配 `/orders/latest` 的路由（比如专门建的 `orders/latest/+page.svelte` 或裸兜底），排序链走完全败 404。救法按语义选：静态页真实存在就检查它是否被创建（静态目录优先级最高，存在即赢）；短期应急把 matcher 放宽或临时移除。教训：收窄路由准入前先盘一遍存量 URL 流量。

### 5. (B) 面试官要求"matcher 也要有测试"，文件放哪、会被误当 matcher 吗？
**来源**：工程实践类面试的转述。

放 `src/params/` 同址（如 `uuid.test.ts`）——官方明确 `*.test.js` / `*.spec.js` 是该目录唯二不被识别为 matcher 的文件。跑法配合 Vitest 即可，matcher 是纯函数，单测成本近零。这题考的是"读过文档细节"还是"只背过概念"。

### 6. (B) 需求：/blog/[slug] 只允许小写字母数字连字符且 ≤64 字符。给出方案并说明校验放 matcher 还是 load 的理由。
**来源**：代码评审式面试题的转述。

`src/params/slug.ts`：`return /^[a-z0-9-]{1,64}$/.test(param)` satisfies ParamMatcher，目录改 `[slug=slug]`。理由：**格式类约束归 matcher**——失配后 URL 自动流向其他路由/干净 404，不进入业务代码；load 里的 throw error(404) 会让这条 URL 依然"属于"该路由并在 handleError 里留下记录。存在性（查库）才归 load——matcher 看不到数据。

### 7. (C) matcher 与 Zod/手动校验的分工边界在哪？
**来源**：分层校验设计讨论的转述。

三层：①matcher=路由准入，输入只有单段字符串，失配改变**路由归属**；②load 内校验（常配 Zod）=业务合法性，作用于参数、查询串、请求体全集，失败产出 error(400/404)；③表单/接口层的 schema 校验管用户输入。关键差异：matcher 拒绝是"这 URL 不该归你管"，load 拒绝是"归我管但我处理不了"——HTTP 语义与错误页层级都不同。

### 8. (C) Next.js 中间件正则路由、Express 的 pattern、Kit matcher，三者本质区别？
**来源**：跨框架路由机制对比题的转述。

Express pattern（如 `/users/:id(\\d+)`）与 Kit matcher 同属**路由匹配层**的值约束，失配都走下一候选；Kit 的差异是"代码即 matcher、可单测、双端执行"。Next 中间件是请求级的另一物：在最终路由匹配**之前**的边缘拦截层执行，能看完整 Request、可 rewrite/redirect 改变去向，但不参与"哪条路由接这个请求"的文件层排序裁决。三者抽象层级不同，面试翻译时别混为一家。

### 9. (A) 为什么官方示例用 satisfies 而不是类型标注？差别在哪？
**来源**：TS 工程细节结合 Kit 源码的面试题转述。

`: ParamMatcher` 把函数签名擦成 `(param: string) => boolean`，丢掉实现者写得更精确的返回类型（如类型谓词 `param is 'apple' | 'orange'`）；`satisfies ParamMatcher` 双向检查（符合契约）又保留推导出的窄类型。matcher 本体运行在路由层不吃这个收窄，但这个姿势在"返回值参与后续类型推理"的通用工具函数里是决定性差别——面试官考的是 satisfies 心智，不是 Kit 特异。

### 10. (D) 多语言站 /[lang]/docs/[...path]，lang 只允许 en/ja，给出完整守门设计。
**来源**：i18n 路由设计面试题的转述。

`src/params/lang.ts` 白名单 matcher（`['en','ja'].includes(param)`，可导出 const 数组复用为类型源）挂 `[lang=lang]`；失配的 `/fr/docs/x` 沿排序链流向兜底（可选：`[[lang=lang]]` 版路由或 redirect 到默认语言）。path 侧 rest 校验非空、段白名单。加分点：主动区分"matcher 白名单是路由问题，翻译缺失是 load/渲染层问题"，以及提到 L7 会讲的 handle hook 按 lang 设 Content-Language。

### 11. (D) 有人提议"用 matcher 查 Redis 做灰度路由"（命中白名单才进 v2 路由），你评审会批吗？
**来源**：架构评审类面试的转述。

不批，并给出正确落点：matcher 契约是纯同步字符串判断——查 Redis 违反签名（要 async）、违反双端一致性（浏览器端没有你的 Redis）、且每个候选路由评估都可能触发查询。灰度属于 load/handle：服务端 load 里查灰度名单后 `redirect` 或直接渲染分支，天然异步、单端执行、可控缓存。这题考的是"知道边界比知道 API 更重要"。

### 12. (B) 团队新人写了 [id=[0-9]+] 想直接塞正则，报编译怪错。指出问题并给正解。
**来源**：社区新手坑答疑的转述。

`=` 后面是 **matcher 名**（对应 src/params 下的文件），不是内联正则——Kit 没有 Next.js 那种 `[id([0-9]+)]` 内联 pattern 语法（这是两派文件路由最易口误的差别）。正解：建 `src/params/numeric.ts` 写 `/^[0-9]+$/.test(param)`，目录改 `[id=numeric]`。顺带记忆：matcher 名即文件名，全项目复用。

🚀 **下一组**：kit-navigation-preload 面试题——预取档位、saveData 与导航生命周期的深水区。

---

## 补充（新专题 13-15）

### 13.  用 matcher 挡非法参数与在 load 里校验返回 404，两种防线的分工与先后？ 

 matcher 是格式级、零成本、两端统一的入口闸门，适合正则可表达的形状；存在性/业务性校验（查库、权限）只能放 load，因为 matcher 被禁止带副作用；两层配合形成格式→业务的递进防御。 

**来源**： https://svelte.dev/docs/kit/advanced-routing#Matching ； https://zod.dev 

### 14.  matcher 返回 false 走 404，高流量站如何监控哪条规则误伤率最高？ 

 在 handle 里对未命中路由的响应打点（记录 pathname 与候选 matcher 名），或临时在 handleError 兜底处采样 404 分布；发现误伤后收紧正则的迭代要靠 e2e 用例锁住边界样本。 

**来源**： https://svelte.dev/docs/kit/hooks#server ； https://opentelemetry.io 

### 15.  为什么官方 matcher 示例用 satisfies ParamMatcher 而不是 : ParamMatcher 标注？ 

 satisfies 既做类型检查又保留字面量推断，match 的参数联合类型与返回类型不被 erode 成宽类型；对 matcher 这种要求导出形状严格的约定文件，satisfies 是检查与推断的最优交集。 

**来源**： https://svelte.dev/docs/kit/advanced-routing#Matching ； https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html 
