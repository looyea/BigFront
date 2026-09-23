# exp-auth 面试题精选

> 共 15 题，覆盖 **认证授权 / JWT / 密码存储 / Token 存放 / 刷新吊销 / OAuth2 / 越权** 七类。

---

## 一、认证与授权

### 1. Authentication 和 Authorization 的区别？在中间件链里如何体现？

认证 = 确认"你是谁"（登录、验 token）；授权 = 确认"你能做什么"（角色/属主判断）。Express 里体现为两段中间件：先 `auth`（解析 token → req.user，失败 401），再 `requireRole('admin')` 或属主检查（不通过 403）。顺序不能反——授权依赖认证结果。

**来源**：OWASP — "Authentication / Authorization"; RFC 6749 (OAuth2) — "concepts"; MDN — "HTTP authentication"

### 2. 401 和 403 分别在认证还是授权失败时返回？

401 Unauthorized（实为"未认证"）= 认证失败（没带 token / token 无效过期）→ 提示"请先登录"。403 Forbidden = 认证通过但授权失败（登录了但没权限干这事）。前端据此：401 跳登录页，403 显示"无权限"。

**来源**：RFC 9110 §15.5 — "401 403"; MDN — "401 Unauthorized naming"; StackOverflow — "401 vs 403"

---

## 二、JWT

### 3. JWT 由哪三部分组成？如何保证不被篡改？

`header.payload.signature`。header 声明算法，payload 放 claims（同样 Base64Url 编码，非加密），signature = 用密钥对 `header.payload` 按声明算法算出的签名。验证时用相同密钥重算签名比对 → 改 payload 会导致签名不匹配 → 拒绝。注意：保证的是完整性/真实性，不是机密性。

**来源**：RFC 7519 — "JSON Web Token"; jwt.io — "An Introduction to JWT"; Auth0 — "JWT the complete guide"

### 4. 为什么 JWT 不适合需要即时吊销的场景？有什么补救？

JWT 自包含 + 无状态 → 服务端不存 → 签发后在 exp 到期前总是有效，无法直接作废（登出/封号/改权限无法立即生效）。补救：① Access Token 设很短（5-15m）靠快速过期；② Redis 黑名单存已撤销 jti（牺牲部分无状态性）；③ tokenVersion 字段（改密时 +1，旧 token 全失效）；④ Refresh Token 存 DB 可删。

**来源**：Auth0 — "When to avoid JWT / revocation"; OWASP — "Testing JWT"; okta — "JWT revocation strategies"

### 5. HS256 和 RS256 有什么区别？多微服务验证该选哪个？

HS256 对称：签发和验证用同一个 secret → 每个服务都要持有 secret（泄露即可伪造）。RS256 非对称：私钥签发（仅认证服务持有），公钥验证（各服务分发公钥，只能验不能签）。多服务/第三方验证场景选 RS256/ES256 → 缩小密钥信任面，配合 JWKS 端点动态取公钥。

**来源**：RFC 7518 — "JWA algorithms"; Auth0 docs — "RS256 vs HS256"; OIDC — "JWKS"

---

## 三、密码存储

### 6. 为什么不能明文/MD5/SHA 存密码？bcrypt 强在哪？

明文泄露即全崩。MD5/SHA 是快速通用哈希 → GPU 每秒数十亿次 + 彩虹表 → 秒破；且无 salt → 相同密码相同哈希可批量比对。bcrypt 专为口令设计：① 自带随机 salt（相同密码哈希不同）；② 可调 cost 使其慢（抗暴力）；③ 基于 Blowfish 内存困难。argon2 更进一步抗 GPU/ASIC（2015 密码哈希竞赛冠军）。

**来源**：OWASP — "Password Storage Cheat Sheet"; bcrypt paper — "A Future-Adaptable Password Scheme"; RFC 9106 — "Argon2"

### 7. cost factor（bcrypt 的 rounds）设多少？设太高有什么问题？

现代经验值 12-14（单次哈希约 100-300ms）。越高越安全但登录/注册越慢：① 用户等待；② 高并发下大量 CPU 哈希请求会拖垮服务（bcrypt 故意吃 CPU）。要针对服务器测在可接受延迟下取尽量高的 cost。防暴力可叠加登录限流。

**来源**：OWASP — "work factor"; bcrypt docs — "cost"; Cloudflare — "reasonably secure passwords / hashing"

---

## 四、Token 存放

### 8. JWT 存 localStorage 和存 httpOnly cookie，安全上如何权衡？

localStorage：JS 完全可读 → XSS 可直接偷 token（但天然免疫 CSRF，因为不自动携带）。httpOnly cookie：JS 读不到（抗 XSS 窃取），但会随请求自动发送 → 需防 CSRF（SameSite + CSRF token）。综合：httpOnly + Secure + SameSite cookie 更安全（现代推荐），但要配 CSRF 防护。SPA 纯 localStorage 方案把安全全押在防 XSS 上。

**来源**：Auth0 — "Where to store JWT in browser / XSS CSRF"; OWASP — "Session Management"; web.dev — "SameSite cookies"

### 9. 把 JWT 放 httpOnly cookie 后，还需要防 CSRF 吗？为什么？

需要。攻击者网站可诱导浏览器对已登录站点发起带 cookie 的跨站请求（SameSite 缓解但不彻底：lax 允许顶层 GET、部分场景仍脆弱）。防御：① 严格 SameSite；② CSRF Token（双提交/ synchronizer）；③ 校验 Origin/Referer；④ 自定义 Header（如 X-Requested-With，跨域需预检无法伪造）。纯 cookie 认证尤其危险。

**来源**：OWASP — "CSRF Prevention"; synchronizer token pattern; MDN — "CSRF"

---

## 五、刷新与吊销

### 10. Refresh Token 轮换（rotation）和复用检测解决什么问题？

轮换：每次用 refresh 换新 access 时同时签发新 refresh 并使旧 refresh 失效 → 缩短被盗 refresh 的可用窗口。复用检测：若一个已被轮换掉的旧 refresh 再次出现 → 说明它曾被窃贼和正常用户同时使用（可能被偷）→ 判定令牌被盗 → 撤销该用户全部会话，强制重登。抵御"refresh token 被静默窃取长期滥用"。

**来源**：OAuth 2.0 Security BCP — "Refresh Token Rotation"; Auth0 — "refresh token rotation & reuse detection"; okta docs

---

## 六、OAuth2 / 越权

### 11. 讲清 Authorization Code + PKCE 流程，PKCE 防什么？

流程：① 客户端生成随机 code_verifier，算 SHA256 → code_challenge，跳授权端点带上；② 用户授权后回调带 code；③ 客户端用 code + code_verifier 向 token 端点换 token，授权服务器校验 challenge==SHA256(verifier)。PKCE 防**授权码拦截攻击**：即使恶意 app/中间人截获了 code，没有 code_verifier 也无法换成 token。对无 secret 的 SPA/移动 public client 尤其关键（防 CSRF 仍需 state）。

**来源**：RFC 7636 — "PKCE"; OAuth 2.0 for Browsers/Mobile — "Best Current Practice"; Auth0 — "PKCE explained"

### 12. 什么是 IDOR？在 Express 资源路由里如何防？

Insecure Direct Object Reference：客户端直接传对象 ID（`/posts/5`），后端不校验归属就操作 → 改 ID 即可读写他人数据。防御：**每个涉及具体资源的操作都做属主校验**——`if (post.authorId !== req.user.sub && !isAdmin) return 403/404`。可提取通用中间件/guard；无法用属主判断时用权限表。别只靠前端隐藏按钮或不可猜 ID（用 UUID 也需校验）。

**来源**：OWASP Top 10 — "A01 Broken Access Control / IDOR"; PortSwigger — "IDOR"; CWE-639

---

## 补充（新专题 13-15）

### 13.  设计"同一账号多端登录 + 设备管理 + 一键全员下线"的令牌体系，把状态放哪、TTL 怎么配？

模型先立：身份会话（session，一次登录）与访问凭证（token，会话的派生物）两层——设备列表管理的是 session，token 只带 session_id。状态放置：session 记录进 Redis（user→sessions 反向索引，含设备 UA/指纹、IP、地理位置、最后活跃），access token 保持自包含验签（不查存储），refresh token 每次使用轮换（rotation，旧 rtk 复用=会话劫持信号→整条 session 吊销并通知）。TTL 策略：access 5-15 分钟、refresh 按设备类型分级（网页 30 天滑动、移动 90 天、TV 更长）、session 绝对上限（refresh 续命也不能无限，半年强制重登）防爆破得逞后永续驻留。全员下线：删 sessions 索引即让所有 refresh 失效 + 版本号方案（user.tokenVersion 递增编进 access claims，验证时比对缓存的版本号——用一次 Redis GET 换"立即吊销"能力，关键敏感操作接口才走这档）；改密码触发全员下线是默认预期（NIST 800-63 精神）。设备指纹的诚实边界：UA 可伪造、指纹可重装漂移，它的定位是"异常提醒与人工核对的信息"而不是鉴权因子。监控面：新设备登录通知邮件/推送（用户侧发现盗号的最后防线）、同 session 异地并发使用告警。收口句："JWT 无状态所以不能吊销"是半句话——准确说法是"验证路径无存储查询，所以吊销要另建状态"，这题就是考你状态该另建在哪。

**来源**：OAuth 2.0 规范（refresh token）；Auth0 文档（Session management）；掘金《改密码后旧设备为什么还在登录》

### 14.  RBAC 在你的 Express 项目里怎么落地？角色爆炸和"数据级权限"两个坑各怎么解？

落地骨架三表：role、permission、role_permission（映射可配置）+ 用户-角色关联；Express 形态：authn 中间件解出身份 → authz 层提供 requirePerm(can:xxx) 路由级中间件 + service 层复查（路由中间件挡"入口"，service 挡内部调用路径——两处同源规则函数）。角色爆炸的病根与解法：把"角色"当权限的直接容器，每客户/每场景新增一角色（47 个角色的终点是没人敢删）；解法是"角色=打包模板、能力=实际授予"两层——授予落到 user-permission 直挂（角色派生+少量例外直授），定期审计"从未被使用的角色"回收，新角色审批制。数据级权限（行级）：RBAC 只管"能不能调这个操作"，"能不能碰这条数据"要额外机制——① 谓词注入（查询层强制拼 owner/team_id 条件，防的是忘加 where 而不是拒答）；② ABAC/规则引擎（资源属性+环境判断：本人创建的 7 天内可编辑——规则声明化如 casbin/OPA，复杂到一定规模后比 if 森林可维护）；③ 混合：粗粒度入口 RBAC + 行级谓词。事故防线：权限变更的操作审计（谁授了谁的什么、何时）本身是安全事件源；测试矩阵（角色 × 资源的预期可访问表）进 CI——权限系统的回归成本极高，矩阵测试是唯一便宜解。收口句：权限设计没有银弹，成熟度标志是"回答得出：新增一种人要改几个地方、改一处权限谁会被影响"。

**来源**：NIST RBAC (INCITS 351)；OPA 文档；知乎《我们的角色表加了 47 行之后》

### 15.  完整走一遍微信扫码登录（OAuth2 授权码 + 二维码变种）的接线，说清 state、pkce 各挡什么，以及回调之后你的系统里发生了什么。

时序六步：① 前端请求登录页时服务端生成 state（随机+短 TTL 存 Redis，含回跳地址快照）下发二维码端点；② 用户扫码确认后平台重定向到 redirect_uri?code=..&state=..；③ 后端校验 state（挡 CSRF 与"把攻击者的 code 塞给你登录"的会话固定式攻击）→ 用 code + client_secret（+ PKCE 的 code_verifier）在后端换 token——code 泄露面从浏览器收缩到 TLS 通道内；④ 拿 access token 调用户信息接口，校验返回的 id_token 签名与 aud/iss（防令牌挪用）；⑤ 按 (provider, openid/unionid) 查 identity 表：有则登录、无则建号（昵称头像此时才可信落库——用户提交的注册信息只来自这个 API，绝不采信前端传参）；⑥ 签发本站会话（自有 JWT/session，第三方 token 单独加密存储用于刷新/解绑），重定向完成且 URL 里绝不携带任何本站令牌。各挡什么再钉一遍：state 挡 CSRF/登录混淆、PKCE 挡授权码截获换 token（公网分发的移动端无 secret 时尤其）、后端换 token 挡前端接触 secret、id_token 验签挡假身份。微信特有细节：unionid 打通同主体多应用、扫码的"已扫码未确认"中间态轮询、redirect_uri 白名单精确到路径（前缀匹配会被开放重定向组合拳利用）。收口：第三方登录的产物是"一个可信的外部身份声明"，你的系统把它变成内部会话的每一步都该像处理外部输入一样校验——这条线讲清楚，这题就赢了。

**来源**：OAuth 2.1 草案；微信开放平台网站应用文档；OWASP OAuth 攻击场景
