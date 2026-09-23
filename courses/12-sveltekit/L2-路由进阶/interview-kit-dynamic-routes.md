# kit-dynamic-routes 面试题精选

> 共 15 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) 说出 SvelteKit 路由参数家族的完整语法，以及 [...rest] 最容易被忽略的行为。
**来源**：SvelteKit 进阶面试高频题的转述。

`[id]` 必填、`[[x]]` 可选、`[...rest]` 剩余、`[[...rest]]` 可选剩余，外加 `[x+nn]`/`[u+nnnn]` 两种编码转义。最易忽略的行为：**rest 能匹配零段**——`/foo/[...rest]` 连 `/foo` 都命中，`params.rest` 为空字符串。官方要求对 rest 值做有效性校验（matcher 或 load 内）。另一个禁区：`[[optional]]` 不能排在 `[...rest]` 之后，贪婪匹配下前者永远轮空。

### 2. (A) 多个路由同时能匹配一个 URL 时，谁赢？给出官方排序规则。
**来源**：社区答疑高频题的转述。

四条：①更具体的优先（无参 > 单参 > 双参……）；②带 matcher 的参数（`[name=type]`）优先于裸参数；③`[[optional]]`/`[...rest]` 不在路由末尾则排序时忽略、在末尾则最低优先级；④平手按字母序。追问点：参数**名**本身不构成优先级，只在 tie-break 时以字符串身份参与——`[slug]` vs `[date]` 同构时字母序裁决。

### 3. (A) (group) 目录的作用与官方给出的使用边界？
**来源**：SvelteKit 布局分组相关面试讨论的转述。

括号目录（如 `(app)`）参与文件系统与布局层级、**不进入 URL**；组内可直接放 `+page`（首页归属某组场景）；把子树留在组外即"breaking out"，不继承任何组的布局。官方泼冷水：过度分组会造成深层难读结构，纯 UI 复用应走组件/函数组合或 if 判断，组留给"独立布局层/error boundary"这类真正的路由行为分层。

### 4. (A) +page@ 与 +layout@ 的布局重置语义？
**来源**：进阶路由面试高频题的转述。

默认布局层级镜像路由层级。`+page@<segment>.svelte` 让**该页面**跳出继承链，@ 后写目标段名、根布局写空（`+page@.svelte`）；`+layout@...` 同理但作用于**该层的全部子路由**。与 (group) 的差别：group 是整棵子树换布局，@ 后缀是单页面/单布局精确越级。

### 5. (B) 线上发现 /blog 本身 404，但 /blog/[slug] 与 [slug] 路由都在，参数还捕获到了 "blog"——为什么？
**来源**：社区排坑帖高频案例的转述。

大概率是排序事故：存在同层更泛化的路由抢了位。检查①是否有 `[[page]]`/`[...rest]` 类可选/剩余路由在排序中意外接盘；②`/blog` 期望命中的可选参数写法是否写成了 `blog[[page]]` 后又存在别的同前缀路由；③字母序 tie-break 是否让 `[slug]` 赢过了本该命中的静态 `blog` 子目录——静态目录永远更具体，赢不了说明你根本没有 `/blog/+page.svelte`，要么补文件要么挂重定向。

### 6. (B) 需要 /docs/a/b/c 任意深度都进同一个页面组件并在页内解析路径，怎么做才不留坑？
**来源**：文档站实现相关面试题的转述。

`src/routes/docs/[...path]/+page.svelte` + load 里 `params.path.split('/')`。三个坑按序处理：①空段（`/docs` 本身会命中，`params.path === ''` 要渲染目录页或 redirect）；②越权路径段（`..`、绝对 URL 片段）必须白名单校验，matcher 挂 `[...path=docslug]` 或 load 里 throw error(404)；③别在 rest 后面再挂可选段（非法）。

### 7. (B) 同事把 404 页做成了 src/routes/+error.svelte，结果子树 /marx-brothers/wrong 的 404 全屏裸奔、导航栏没了，怎么修？
**来源**：官方 404 文档节经典案例的转述。

全屏是 +error.svelte 的默认行为——它替换整个页面。官方解法：在需要保住布局的子树放 catch-all 路由 `marx-brothers/[...path]/+page.ts`，其 load 里对一切走到兜底的请求 `throw error(404, 'Not Found')`——错误由这条真实路由触发，自然嵌在它的祖先布局里。另一提示：不显式处理 404 的话它们会流进 handleError 被当异常统计。

### 8. (C) Next.js（App Router）与 SvelteKit 在"动态段+可选段+catch-all"三个概念上怎么互相翻译？
**来源**：跨框架迁移面试题的转述。

`[id]` ↔ `[id]`；`[[page]]` ↔ Next 没有逐段可选的对应物，最接近的是可选 catch-all `[[...slug]]`（但它吞的是整段尾巴不是单个可选段）；`[...rest]` ↔ `[...slug]`；(group) ↔ `(group)` 语义几乎一致。Kit 的独有项：matcher 参与排序裁决、`+page@` 布局越级——Next 靠嵌套 layout.tsx 手工组织，没有单文件重置语法；排序方面 Next 静态优先于动态与 Kit 规则 ① 一致，但没有公开的字母序 tie-break 心智模型。

### 9. (C) 文件路由的"约定优于配置"在 Kit 里具体约定了什么？哪些东西反而不需要配置？
**来源**：框架设计讨论高频观点的转述。

目录=路径、文件名=职责（+page/+layout/+error/+load 全家）、参数语法=目录名、matcher=目录内文件名、组=括号。不需要配置的：路由表生成、排序算法、布局层级推导、代码分包边界（每路由自动 chunk）。需要配置的只在外围：adapter、prerender/SSR 开关、前缀 path。对比 Vue Router 手写 routes 数组：Kit 把"结构即路由"推到极致，代价是排错时要懂排序规则。

### 10. (D) 设计 URL：/user/[id]/posts/[[page]]、/archive/[...path]、/(marketing)/pricing——说出每处选择的理由与要补的校验。
**来源**：系统设计类面试的转述。

`[id]` 必填 + `id=uuid` matcher；`[[page]]` 让列表第一页无尾巴（/user/1/posts 与 /posts/2 同页），load 里对 page 做数值校验；`[...path]` 归档是深链兜底，必须校验空值、非法段并允许子树内 404；`(marketing)` 组只为让 pricing 吃营销页布局、URL 保持 /pricing 干净。加分点：主动说出"rest 后不再挂可选段""同层冲突交给 matcher 不交给字母序"。

### 11. (D) 站内要有 /r/xxx 短链跳转层（数据库查目标），路由与校验怎么分层？
**来源**：短链服务设计面试题的转述。

`src/routes/r/[slug]/+server.ts`——无 UI 的纯端点路由，不必是 +page。slug 格式（如 `[a-z0-9]+` 长度上限）用 matcher 挡在路由层；查库与不存在判断放 load/handler，查无链接 `throw error(404)` 或跳兜底页；命中走 `redirect(302, target)`（动态目标别用 301，缓存中毒难回收）。层级分工一句话：matcher 管"长得对不对"，load 管"存不存在"。

### 12. (B) 用 [x+nn] 转义创建 .well-known 路由的工程动机是什么？还有哪些字符必须走转义？
**来源**：官方编码文档节延伸面试题的转述。

动机：TS 工具链对前导 `.` 目录支持差，`[x+2e]well-known` 两全。必须转义的三类：文件系统禁忌字符（Linux 的 `/`；Windows 的 `\ / : * ? " < > |`）、URL 特殊字符 `#` `%`、Kit 保留语法字符 `[ ] ( )`。查码方法一行 JS：`':'.charCodeAt(0).toString(16)` → `3a` → `[x+3a]`。

🚀 **下一组**：kit-route-matchers 面试题——matcher 契约、双端执行与排序兜底的深水区。

---

## 补充（新专题 13-15）

### 13.  路由匹配为什么选择按文件树的静态/动态/可选/rest 固定排序，而不是注册顺序？ 

 可预测性优先：任何人看目录就能推断匹配结果，不用追注册链；Next 的 App Router 同理按段类型排序，Express 才用顺序匹配，两种模型对比是高频追问点。 

**来源**： https://svelte.dev/docs/kit/advanced-routing#Matching 

### 14.  [[lang]] 可选段与 (group)+matcher 收紧语言码，两种 i18n 路由方案各自代价？ 

 可选段省一套重定向但会让任意首段都命中路由、404 判定滞后靠 matcher 补；分组+必选段边界清晰，代价是默认语言要写 redirect 或 reroute，权衡点在 404 语义与路由表复杂度。 

**来源**： https://svelte.dev/docs/kit/advanced-routing#Advanced-matching 

### 15.  把散落的动态路由重构成带 (group) 布局层，data 继承与 load 层级会踩什么坑？ 

 分组会引入新 layout 层，原本页面级 load 的数据被上提后 key 遮蔽关系改变；layout 重置（+page@）可跳出继承，但要重审 $page.data 在组件里的读取路径，建议配 E2E 兜底。 

**来源**： https://svelte.dev/docs/kit/load#Layouts-and-parallelism 
