# exp-validation 面试题精选

> 共 12 题，覆盖 **信任边界 / zod / 类型转换 / 清洗 / 越权 / 选型 / 契约** 七类。

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
