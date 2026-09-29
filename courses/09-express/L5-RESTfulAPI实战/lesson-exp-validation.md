# 参数校验

> 目标：**掌握 Express 参数校验的完整方案**——zod / express-validator / joi 选型；body/query/params/header 全校验；错误响应统一格式；校验作为"信任边界"的第一道防线。

---

## 一、为什么必须校验

**永远不要信任客户端输入。** 校验是服务的信任边界（trust boundary）：

- 防畸形数据污染 DB（类型错、超长、注入前置）；
- 防业务漏洞（负数量、超大金额、越权字段如客户端传 `role:'admin'`）；
- 给调用方清晰错误反馈；
- 是文档/契约的单一事实来源（schema 即文档）。

原则：**在入口尽早校验（fail fast）**，别把脏数据带到 service 层才发现。

---

## 二、三大库选型

| 库 | 风格 | 特点 |
| --- | --- | --- |
| **zod** | TS 优先，schema 推断类型 | 现代首选、类型自动推导、组合强、生态活跃 |
| **joi** | 功能最全、老牌 | 能力强但偏重、错误信息啰嗦 |
| **express-validator** | Express 中间件式 | 与 Express 深度集成、链式 API、渐进 |

新項目首选 **zod**（尤其 TS 项目，一次定义前后端共享 + 类型安全）。下面以 zod 为主，兼顾 express-validator。

---

## 三、zod 基础

```bash
# 目的：安装 zod
npm i zod
```

```js
// 目的：定义 zod schema 声明“数据长什么样”，safeParse 一次完成校验+转换+默认值
import { z } from 'zod';

const CreateUserSchema = z.object({
  name: z.string().min(1, '名字必填').max(50),              // ✅ 非空且≤50，自定义错误文案
  email: z.string().email('邮箱格式错误'),                     // ✅ 内置邮箱校验
  age: z.number().int().min(18).optional().default(0),         // ✅ 可选，不传给默认 0
  password: z.string().min(8).regex(/[A-Z]/, '需含大写').regex(/\d/, '需含数字'),  // ✅ 强度规则
  role: z.enum(['user', 'admin']).default('user'),             // ✅ 枚举白名单
});

// ✅ 校验 + 解析（返回转换后的数据）
const result = CreateUserSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: result.error.issues } });  // ✅ 失败统一 400
}
const data = result.data;   // ✅ 已过滤未声明字段（strip）、应用 default
// ❌ 客户端多传一个未在 schema 声明的 _id/role 旁路字段 → 默认被 strip 丢弃，防住 mass assignment；若改用 .passthrough() 则会原样透传进库
```

- `safeParse` 不抛错返回 `{success, data|error}`；`parse` 失败抛异常（可交给全局 error handler）。
- **默认剥离未定义字段** → 天然防"mass assignment"（客户端多传 `role`/`_id` 被丢弃）。
- 类型推断（TS）：`type CreateUser = z.infer<typeof CreateUserSchema>`。

---

## 四、封装成校验中间件

```js
// 目的：把校验封成中间件—按 source 校验 body/query/params/header，合法才放行
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);              // ✅ 根据 source 取对应部位校验
    if (!result.success) {
      return res.status(400).json({                             // ✅ 短路，不进 handler
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求参数校验失败',
          details: result.error.issues.map(i => ({              // ✅ 把 zod issues 削成字段+消息的简化结构
            field: i.path.join('.'),
            message: i.message,
          })),
        },
      });
    }
    req[source] = result.data;   // ✅ 用解析后的干净数据（含 coerce/default）替换回去
    next();
  };
}

// ✅ 使用：同一个工厂支持 body（默）/query/params，可链式叠加
router.post('/', validate(CreateUserSchema), userController.create);                 // ✅ 默认验 body
router.get('/', validate(ListQuerySchema, 'query'), userController.list);             // ✅ 验 query
router.patch('/:id', validate(ParamsSchema, 'params'), validate(PatchSchema), handler);  // ✅ 先验 params 再验 body
// ❌ validate 依赖 express.json() 已先把 req.body 解析好；body parser 没挂则 req.body 为 undefined，safeParse(undefined) 直接报 invalid_type
```

---

## 五、校验各部位

```js
// 目的：各部位分开定义 schema（params/query/header/body）
// ✅ params：id 必须是 mongodb ObjectId 或正整数
const IdParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, '非法 ID') });

// ✅ query：分页参数（query 都是 string，需 coerce 转数字）
const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),               // ✅ '2' → 2，非法回 400
  limit: z.coerce.number().int().min(1).max(100).default(20),    // ✅ 上限 100 防一次性拉全表
  sort: z.enum(['name', '-name', 'createdAt', '-createdAt']).optional(),  // ✅ 排序字段白名单，防注入任意列
});

// ✅ header：API key
const Headers = z.object({ 'x-api-key': z.string().min(1) });

// ✅ body：主体
const Body = z.object({ ... });
// ❌ 对 query 直接写 z.number() 不 coerce → '2' 是字符串，校验失败回 400；数字入 query 必用 z.coerce.number()
```

关键坑：**query 和 params 的值都是字符串** → 数字要用 `z.coerce.number()`，布尔要 `z.coerce.boolean()`（注意 `'false'` 被 coerce 成 true 的经典陷阱 → 用 `z.enum(['true','false']).transform(v=>v==='true')`）。

---

## 六、复杂校验模式

```js
// 目的：跨字段/分派类复杂校验——refine 条件必填、discriminatedUnion 按字段分 schema
// ✅ 条件必填：type=company 时 companyName 必填
const Schema = z.object({
  type: z.enum(['personal', 'company']),
  companyName: z.string().optional(),
}).refine(d => d.type !== 'company' || !!d.companyName, {   // ✅ 不满足则报错
  message: '企业用户必须填公司名', path: ['companyName'],       // ✅ path 定位到具体字段
});

// ✅ 两次密码一致
const Register = z.object({ pwd: z.string(), confirm: z.string() })
  .refine(d => d.pwd === d.confirm, { message: '两次密码不一致', path: ['confirm'] });

// ✅ 嵌套对象 + 数组
const Order = z.object({
  items: z.array(z.object({ sku: z.string(), qty: z.number().int().positive() })).min(1),  // ✅ 至少一项、qty 正整数
  address: z.object({ city: z.string(), zip: z.string().regex(/^\d{6}$/) }),                 // ✅ 6 位邮编
});

// ✅ discriminated union（按 type 字段分派不同形状）
const Event = z.discriminatedUnion('type', [
  z.object({ type: z.literal('click'), x: z.number(), y: z.number() }),      // ✅ click 必带 x/y
  z.object({ type: z.literal('keydown'), key: z.string() }),                 // ✅ keydown 必带 key
]);
// ❌ refine 只能标错不能改数据；需要转换/重命名字段用 .transform()，而非在 refine 里赋值（无效果）
```

---

## 七、express-validator（中间件式）

```bash
# 目的：安装 express-validator
npm i express-validator
```

```js
// 目的：中间件式校验—每个字段一条链式 validator，最后集中查 validationResult
import { body, param, query, validationResult } from 'express-validator';

router.post('/users',
  body('email').isEmail().normalizeEmail(),               // ✅ 邮箱格式 + 规范化
  body('name').trim().isLength({ min: 1, max: 50 }),        // ✅ 去首尾空格再判长
  body('age').optional().isInt({ min: 18 }),                 // ✅ 可选，传了才校
  (req, res) => {
    const errors = validationResult(req);                    // ✅ 汇总前面所有校验结果
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: errors.array() } });
    }
    // ✅ req.body 已被 .trim()/.toInt() 等清洗
    createUser(req.body);
  }
);
// ❌ 忘记放 validationResult 检查就直进 handler → 校验失败也不拦截，脏数据直入业务
```

优点：链式、内置大量 validator（isEmail/isIP/isMobilePhone/sanitizer）。缺点：TS 类型不如 zod 自动。

---

## 八、校验 vs 清洗 vs 授权

三者不同层次，都要做：

- **格式校验**（本关）：类型、长度、范围、必填——zod/express-validator；
- **清洗/规范化**：trim、toLowerCase、HTML sanitize（防存储型 XSS）、`normalizeEmail`；
- **业务/授权校验**（下一层）："这个用户能不能改这条记录？"——放 service 层或专门 guard，schema 管不了权限。

别把格式校验和授权混为一谈。schema 保证"数据长什么样"，controller 保证"谁能干什么"。

---

## 九、统一错误格式（呼应 L5 exp-rest）

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "details": [
      { "field": "email", "message": "邮箱格式错误" },
      { "field": "age", "message": "最小 18" }
    ]
  }
}
```

`field` 让前端把错误定位到具体输入框。这是校验/全局 error handler/前端表单的协作契约。

---

## 十、自检清单

- [ ] 为什么说校验是"信任边界"？
- [ ] zod 默认如何处理 schema 未声明的多余字段？防住了什么攻击？
- [ ] query 里的数字要注意什么？
- [ ] `z.coerce.boolean()` 对 `'false'` 会得到什么？
- [ ] 格式校验和授权校验的区别？
- [ ] 校验错误为什么要带 field 路径？

---

## 🚀 部署预告

- **Schema 复用**：zod schema 可前后端共享（同一份 TS 类型 + 校验）→ 全栈类型安全；
- **OpenAPI 生成**：`zod-to-json-schema` / `zod-openapi` → 从 schema 自动生成 API 文档 + 契约测试；
- **限流配合**：校验挡住畸形请求 + rate-limit 挡住洪水（呼应 L2/L6）；
- **不泄露内部**：校验错误只回字段级信息，绝不回显 SQL/堆栈（呼应 L2 错误处理）。

下一关 **exp-auth** 讲解鉴权：JWT / Session / OAuth2 完整链路。
