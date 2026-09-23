# exp-validation 面试题精选

> 共 15 题，覆盖 **信任边界 / zod / 类型转换 / 清洗 / 越权 / 选型 / 契约** 七类。

---

## 一、信任边界

### 1. 为什么说输入校验是"信任边界"？不校验会有什么后果链？

外部输入（body/query/params/header/cookie）来自不可信的客户端，进入系统的第一道闸。不校验 → ① 类型错导致下游运行时崩溃；② 超长/超大导致 DB 存储爆炸或 DoS；③ 越权字段（role/isAdmin）被信任导致提权；④ 注入攻击前置条件；⑤ 脏数据永久污染。校验把这些挡在最外层。

**来源**：OWASP — "Input Validation Cheat Sheet"; Martin Fowler — "Trust Boundaries"; Microsoft — "SDL input validation"

### 2. 校验、清洗（sanitize）、授权是三件事吗？分别谁负责？

是。① 校验：数据"长什么样"合法（类型/范围/必填）——zod/joi；② 清洗：规范化并去除危险（trim、toLowerCase、HTML sanitize 防存储型 XSS）——express-validator sanitizer / DOMPurify；③ 授权："当前用户能不能对该资源做此操作"——service/guard 层，schema 管不了。三者都在入口链路上依次执行，职责分明。

**来源**：express-validator — "sanitizers"; OWASP — "XSS / sanitization"; NIST — "Access Control"

---

## 二、zod

### 3. zod 相比手写 if 校验好在哪？

① schema 即单一事实来源（可推 TS 类型、可生成 JSON Schema/OpenAPI）；② 组合式复用（.partial/.pick/.extend）；③ 自动收集所有错误（非遇错即停）；④ 内置丰富 validator + transform + default；⑤ 类型安全消除手抄字段的漂移。手写 if 分散、易漏、无类型联动。

**来源**：zod docs — "Why Zod / Schema Validation"; zod — "API / top-level"; Colby Fayock — "zod vs manual"

### 4. 用 zod 如何在 TS 里实现"一次定义，前后端共享类型"？

定义 schema 后 `type T = z.infer<typeof Schema>` 拿到静态类型；把 schema 文件放进共享包（monorepo 的 packages/shared），前端用它做表单校验 + 类型，后端用它做请求校验 + DTO 类型 → 单一来源，改一处全链路类型同步、契约不破。

**来源**：zod — "Type Inference"; tRPC docs — "end-to-end typesafety"; Turbo — "monorepo shared package"

### 5. zod 的 `.strict()`、`.passthrough()`、默认 strip 有何不同？

object 默认 `strip`（丢弃未知键）；`.strict()`（旧版；新版 `.strict()` 已 deprecated → 用 `.strictObject`）遇到未知键报错；`.passthrough()`（新版 `.catchall(z.any())`）保留未知键透传。默认 strip 最安全（防 mass assignment）。要严格拒绝多余字段用 strict，要原样转发用 passthrough。

**来源**：zod — "Objects / unknownkeys"; zod v4 changelog — "strictObject / passthroughObject"

---

## 三、类型转换陷阱

### 6. query/params 为什么不能直接用 z.number()？怎么解决？

HTTP 传输层所有 query 和 params 都是字符串（`?page=2` → '2'）。z.number() 收到 '2'（string）校验失败。解决：`z.coerce.number()` 先 `Number()` 转换再校验；或 `.transform(Number)`。body（JSON）才有真正类型。

**来源**：Express — "req.query strings"; zod — "coerce"; StackOverflow — "zod number query param"

### 7. 布尔型 query `?active=false` 校验的坑与正确写法？

坑：`z.coerce.boolean()` = `Boolean('false')` = true（任何非空字符串都真）。正确：`z.enum(['true','false']).transform(v => v === 'true')`，或 `z.preprocess(v => v==='true'||v===true, z.boolean())`，或用 `'1'/'0'` 约定。

**来源**：MDN — "Boolean / truthiness"; zod — "transform / preprocess"; StackOverflow — "'false' coerces to true"

---

## 四、越权与业务

### 8. 什么是 mass assignment（批量赋值）攻击？校验如何防御？

客户端在 PATCH/POST body 里塞入本不该由它控制的字段（`role:'admin'`、`balance:999999`、`isVerified:true`），若后端 `Model.create(req.body)` 直接写入 → 提权。防御：① zod schema 只声明允许字段（默认 strip 丢弃其余）；② 或显式白名单 pick；③ 敏感字段只在服务端按授权设置，永不来自 body。

**来源**：OWASP — "Mass Assignment"; Rails Guides — "Strong Parameters"; Badge — "mass assignment vulnerabilities"

### 9. 校验通过的邮箱格式，注册时仍可能失败，为什么？还要做什么？

格式合法（`a@b.com`）≠ 业务可行：邮箱可能已被注册（唯一性 → 查库 → 409）、可能是 burner 域名（策略拒绝）、可能未真实存在（需发验证邮件确认可达）。格式校验只是第一层，唯一性/存在性/策略属业务校验，要查 DB / 发验证。

**来源**：OWASP — "Email verification"; Google — "Account signup best practices"; UX — "email validation vs verification"

---

## 五、选型与集成

### 10. zod / joi / express-validator / class-validator 如何选？

- TS 全栈、要强类型推断 → **zod**（现代首选，前后端共享）；
- 需要极丰富内置 validator、非 TS 或 JSON schema 驱动 → **joi**；
- 已在用 Express 中间件流、想渐进 + 内置清洗 → **express-validator**；
- NestJS / 装饰器风格 DTO → **class-validator**。团队栈与技术偏好决定，别混用多套造成分裂。

**来源**：npm trends — "zod vs joi vs express-validator"; NestJS docs — "Validation"; Reddit r/node — "validation library"

### 11. 如何让校验 schema 自动生成 API 文档？

`zod-to-json-schema` / `zod-openapi` / `@asteasolutions/zod-to-openapi` 把 zod schema 转成 OpenAPI 3 定义 → 用 Swagger UI / Scalar / Stoplight 渲染 `/docs` → 契约即代码，schema 改文档自动更新，还能在 CI 生成 SDK + 跑契约测试防 breaking change。

**来源**：OpenAPI Specification; zod-to-openapi GitHub; Scalar — "OpenAPI docs"; Atlassian — "contract testing"

### 12. 全局 error handler 如何统一处理校验错误？

约定校验中间件失败时 `throw` 一个带 `status=422/400` + `code='VALIDATION_ERROR'` + `details` 的自定义错误（或 HttpError）→ 全局 error handler 识别该 code → 统一组装响应体，屏蔽 zod 原始 issues 的内部结构，保持 API 输出格式一致；非校验错误走通用 500 分支（生产隐藏堆栈）。

**来源**：Express — "Error handling middleware"; NearForm — "error handling pattern"; zod — "ZodError structure"

---

## 补充（新专题 13-15）

### 13.  schema 定义在工程上怎么组织？一套 zod 库、每接口一份、还是前后端共享包——给出你的演进路线。

三形态对比：① 就地定义（每个路由文件里写 schema）起步最快，三月后必现"同字段五处五种规则"（密码长度两个体系）；② 应用内公共库（src/schemas 按域组织 + z.infer 导出类型给 TS）解决单项目复用，边界规则：实体 schema 按"资源"聚合而非按接口，接口级裁剪用 .pick/.omit 派生；③ 跨端共享包（monorepo 里 workspace 包或私有 npm）让表单校验与接口校验同一事实源——收益最大的形态也最易翻车：后端 schema 顺手升级会静默打破旧前端（发布序耦合），需要 semver 与两端 CI 互验。深层原则：schema 是"契约"，应放消费方定义（接口属主的服务端），前端引用后端产物（或由 OpenAPI 生成），"共享包"实为"两端都依赖的契约包"。演进路线：路由内联 → 域聚合目录 → 抽象出 contracts 包（有第二消费端时才做，过早抽包也是债）。加分句：判断标准只有一条——"改一个字段规则，需要同步改几处"，答案大于 2 就该收拢。

**来源**：zod 官方文档（schema 组合）；tRPC 设计理念；InfoQ《前后端类型共享的三种拓扑》

### 14.  校验跑在哪个环节、花多少 CPU？高 QPS 服务的校验性能预算怎么做？

成本解剖：zod parse 对大嵌套对象有可感知的 CPU 占用（遍历+构造错误信息+结果复制），热点接口压测下"校验层 2-4ms"在 5k QPS 下就是两位数核。优化清单按性价比：① schema 模块级单例（每次请求新建 builder 是最常见事故，编译成本白付）；② 成功路径短路——只要 parse 不抛就丢弃 error 树，确认没用 safeParse 在热路径反复构造 issues；③ 分级校验——"信封级快检"（content-length/类型/条数上限）前置粗挡，完整 schema 校验在可信负载后再做；④ 数据层信任传递——经网关校验的内部流量到服务后免重复深校验（内部调用可关，入站边界必开——"信任边界在哪，校验就在哪"反过来读也对）；⑤ 极端热路径换轻量库（手写 validator/ajv 编译后 JIT 快于 zod 组合式，2-10 倍），但保留 zod 类型推断的导出（用 zod 定义、ajv 编译执行的双库桥接是进阶玩法，复杂度要显式认领）。度量方法：autocannon 对典型 payload 压测开关校验两组对照、火焰图里把 validate 中间件单独圈占比，写进接口 SLO——"校验占预算多少"应该是评审字段，不是玄学。收口：性能优化的尽头是边界设计——先回答"这份数据谁保证过合法性"，再决定这层校验要不要跑满。

**来源**：zod 官方 Benchmarks 讨论；Fastify 团队校验性能分析；掘金《我们把 zod 换成了手写函数》

### 15.  输入校验防住了格式，防不住什么？讲讲校验之后仍要过的关卡全景。

格式之外的敌情清单：① 语义非法——邮箱格式完美但不存在（要验证邮件）、手机号是空号段、地址城市对不上邮编（外部数据源核验是第二关）；② Unicode 沼泽——同形异码（NFC/NFD 的 é、西里尔字母冒充拉丁的 homoglyph 钓鱼昵称）、零宽字符、RTL 重写——校验通过存储后"看起来一样"的字符串绕过黑名单（用户名唯一性在 NFC 规范化后才可靠）；③ 截断错位——utf8mb4 下 VARCHAR(20) 按字节算长度，emoji 4 字节把"合法长度"入库截断成残缺（校验按字符、列按字节的错位）；④ 数值边界外的精度——1e21 转 Number 安全整数溢出（金额要字符串 decimal 校验）、超大整数绕过 int 范围检查；⑤ 结构与深度的 DoS——嵌套千层数组（parse 栈爆）、深 JSON（qs 的 depth 上限原理）；⑥ 授权盲区——每个字段合法但"这个用户不能改这个字段"（mass assignment 的另一半：可改字段集按角色裁剪）；⑦ 幂等与并发——校验"库存充足"通过后再扣减的 TOCTOU（校验是快照、执行要重判或原子化）。全景结论：校验是"信任边界的翻译层"（把外部字节翻译进类型系统），但翻译正确不等于内容真实、更不等于允许执行——三道门"格式（校验）→真实（外部核验）→允许（授权+并发重判）"一扇都不能并。收口句：这个题的高分姿势是把"校验通过"当成攻击的起点而不是终点。

**来源**：OWASP Input Validation Cheat Sheet；知乎《校验全过、上线即挂的字段》；MDN Unicode 规范化
