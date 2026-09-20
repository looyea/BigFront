# 分页、排序与过滤

> 目标：**掌握列表接口的三大通用能力**——分页（offset/limit vs cursor）、排序（单/复合）、过滤（等值/范围/模糊/多值）；理解深分页性能问题与游标分页的解法；设计规范的查询参数与响应元数据。

---

## 一、为什么需要分页

一次返回十万条 → DB 内存爆 + 网络传输巨慢 + 前端渲染卡死。分页 = 每次只取一页。但分页方式的选择直接影响**性能**和**数据一致性**。

---

## 二、Offset/Limit 分页（最直观）

```
GET /articles?page=2&limit=20
```

```js
const page = Math.max(1, +req.query.page || 1);
const limit = Math.min(100, Math.max(1, +req.query.limit || 20));  // 上限保护
const skip = (page - 1) * limit;

const [items, total] = await Promise.all([
  Article.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
  Article.countDocuments(),
]);
res.json({
  data: items,
  meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: skip + items.length < total },
});
```

- 优点：实现简单、可跳任意页（页码导航）、total 已知。
- **致命缺点：深分页性能**。`SKIP 100000` → 数据库仍需扫描并丢弃前 10 万行 → 越翻越慢（O(n)）。
- 数据一致性问题：翻页过程中有新数据插入 → 可能重复或漏项（第 2 页和第 3 页边界移动）。

---

## 三、Cursor 分页（游标 / 无限滚动）

不用页码，用"上一页最后一条的排序位置"作游标：

```
GET /articles?cursor=eyJpZDoiMTIzIn0&limit=20
```

```js
// cursor 编码了上一页末条的排序键（如 createdAt + _id）
const { createdAt, id } = decodeCursor(req.query.cursor);

const filter = req.query.cursor
  ? { $or: [{ createdAt: { $lt: createdAt } },
            { createdAt, _id: { $lt: id } }] }        // 严格在游标之后
  : {};

const items = await Article.find(filter)
  .sort({ createdAt: -1, _id: -1 })
  .limit(limit + 1);          // 多取一条判断 hasMore

const hasMore = items.length > limit;
const data = hasMore ? items.slice(0, limit) : items;
const nextCursor = data.length ? encodeCursor(data[data.length - 1]) : null;

res.json({ data, meta: { nextCursor, hasMore, limit } });
```

- 优点：**性能稳定**（用索引 `WHERE (createdAt,_id) < (...)` 直接定位，无 SKIP 扫描）；翻页一致（不受中间插入影响）；适合**无限滚动 / feed 流**。
- 缺点：不能跳页（只能顺序翻）、实现更复杂、排序键必须唯一（追加 `_id` 打破并列）。

### offset vs cursor 选择

| 场景 | 选择 |
| --- | --- |
| 后台管理表格、需要页码跳转、数据量小 | offset |
| 社交 feed、消息流、深翻页、大数据量 | cursor |

---

## 四、排序

```
GET /articles?sort=-createdAt          # 降序（- 前缀）
GET /products?sort=price,-rating       # 先价格升序，再评分降序
```

```js
function buildSort(sortStr = '-createdAt', allowed = ['createdAt', 'price', 'rating', 'name']) {
  if (!sortStr) return { createdAt: -1 };
  const sort = {};
  for (const field of sortStr.split(',')) {
    const dir = field.startsWith('-') ? -1 : 1;
    const key = field.replace(/^-/, '');
    if (allowed.includes(key)) sort[key] = dir;   // 白名单！防注入
  }
  return Object.keys(sort).length ? sort : { createdAt: -1 };
}
```

**必须白名单**——直接把 `req.query.sort` 塞进 `.sort()` → 用户可排序隐藏字段（如内部权重、其他用户数据）→ 信息泄露/性能攻击。

> 深分页时排序字段务必建**复合索引**（`{createdAt:-1,_id:-1}`），游标的排序键与索引顺序必须一致。

---

## 五、过滤

```
GET /articles?status=published
GET /products?price[gte]=100&price[lte]=500       # 范围
GET /users?tags=js,ts&role=admin                   # 多值
GET /articles?q=关键词                              # 模糊搜索
GET /orders?created_after=2026-01-01&sort=-total
```

```js
function buildFilter(q) {
  const f = {};
  if (q.status) f.status = q.status;                        // 等值
  if (q.price_gte || q.price_lte) {                         // 范围
    f.price = {};
    if (q.price_gte) f.price.$gte = +q.price_gte;
    if (q.price_lte) f.price.$lte = +q.price_lte;
  }
  if (q.tags) f.tags = { $in: q.tags.split(',') };         // 多值 OR
  if (q.q) f.$or = [                                       // 模糊（注意性能）
    { title: { $regex: q.q, $options: 'i' } },
    { summary: { $regex: q.q, $options: 'i' } },
  ];
  return f;
}
```

安全要点：
- 把用户值当**数据**传（`{status: q.status}`），**绝不拼接**成查询对象字符串 → 防 NoSQL 注入（`{"$gt":""}` 绕过）；
- `$regex` 前转义特殊字符（`_.escapeRegExp`）防 ReDoS；大表模糊搜索应用全文索引（Atlas Search / ES）而非 regex；
- 数值参数 `+q.x` 强制转数并校验范围。

---

## 六、复合查询参数（zod 统一校验，呼应 exp-validation）

```js
const ListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  status: z.enum(['draft', 'published']).optional(),
  q: z.string().max(100).optional(),
  price_gte: z.coerce.number().optional(),
  price_lte: z.coerce.number().optional(),
});
```

用 schema 兜住所有查询参数 → 类型转换 + 上限保护 + 枚举限制一步到位。

---

## 七、响应元数据设计

```json
{
  "data": [ ... ],
  "meta": {
    "page": 2, "limit": 20, "total": 137, "totalPages": 7,
    "hasNext": true, "hasPrev": true
  },
  "links": {
    "self": "/articles?page=2",
    "next": "/articles?page=3",
    "prev": "/articles?page=1"
  }
}
```

- `count/total` 前端算进度条/页码；
- `hasNext/hasPrev` 快速判断能否翻页（避免多余 count 查询时可只给 hasNext：取 limit+1）；
- `links`（HATEOAS 风格）直接给可点 URL，客户端更省心。

> `countDocuments()` 在大集合上有成本。若前端只需"下一页"按钮 → 用 `limit+1` 探测法省掉 count（呼应 cursor 的 hasMore）。

---

## 八、性能与索引

- 为**排序 + 过滤**字段建复合索引，顺序匹配查询（ESR 原则：Equality 字段 → Sort 字段 → Range 字段）；
- `limit` 设硬上限（防止 `?limit=999999` 打爆）；
- `select`/`projection` 只返回需要字段（大文档尤其重要）；
- count 缓存或用游标；
- 深分页一律优先游标。

```
db.articles.createIndex({ status: 1, createdAt: -1, _id: -1 })   // ESR 示例
```

---

## 九、自检清单

- [ ] offset 分页在翻到第 1 万页时为什么慢？
- [ ] 游标分页为什么需要排序键唯一（附加 _id）？
- [ ] sort 参数为什么必须白名单？
- [ ] 只想知道"有没有下一页"时如何省掉 count 查询？
- [ ] NoSQL 注入在查询构造里如何产生、如何防？
- [ ] 大表模糊搜索为什么不该用 regex？

---

## 🚀 部署预告

- **CDN 缓存列表**：`?page=1` 首页可短缓存（`stale-while-revalidate`）扛读峰；
- **游标编码**：cursor 用不透明 base64（别暴露内部结构），签名防篡改；
- **全文检索外置**：`q=` 搜索导到 Elasticsearch/Meilisearch/Atlas Search，别压 DB；
- **默认排序索引**：热门列表默认排序字段常驻缓存 + 覆盖索引，减少回表。

L5 到此完成，下一关进入 **L6 安全与最佳实践**（exp-security）。
