# exp-security 面试题精选

> 共 15 题，覆盖 **OWASP / Helmet&CSP / CORS / XSS / CSRF / 注入 / 限流 / 供应链** 多类。

---

## 一、OWASP 与思维

### 1. 简述 OWASP Top 10 中与 Express 后端最相关的几类及防御。

- A01 失效的访问控制（IDOR/越权）→ 每操作校验归属；
- A02 加密失效（明文传输/弱哈希）→ HTTPS + bcrypt/argon2；
- A03 注入（SQLi/NoSQLi/命令）→ 参数化 + 校验；
- A05 安全配置错误（默认凭据/暴露堆栈/x-powered-by）→ 加固 + helmet；
- A06 带漏洞组件 → npm audit / Snyk；
- A07 认证失败（弱口令/暴力）→ 限流 + MFA + 安全 cookie；
- A08 软件与数据完整性失败（供应链/未校验更新）→ lockfile + 签名。

**来源**：OWASP — "Top 10 Web Application Security Risks (2021)"; OWASP — "Cheat Sheet Series"

### 2. 什么是"纵深防御"？为什么不能只靠一层？

多层独立防护叠加：任一层被绕过仍有下一层拦截。因为攻击手法不断演进（能绕过输入过滤的 payload 层出不穷），单点防御一旦失效即全线沦陷；分层让攻击者必须同时突破多道，成本剧增。例：防 XSS = 输入校验 + 输出转义 + CSP + httpOnly cookie 四层。

**来源**：NIST SP 800-53 — "Defense in Depth"; Microsoft — "SDL"; OWASP — "Secure by Design"

---

## 二、Helmet 与 CSP

### 3. helmet 能防住所有前端攻击吗？它的局限是什么？

helmet 只设置 HTTP 响应头，是"加固"而非"隔离漏洞"。它降低 XSS/点击劫持/嗅探风险，但：不防业务逻辑漏洞、不防已存在的 XSS 注入点（只是 CSP 兜底）、不防 SSRF/越权。CSP 若配 `unsafe-inline`/`unsafe-eval` 会被大幅削弱。它是纵深防御的一层，不能替代输入校验和输出转义。

**来源**：helmet GitHub README; MDN — "Content-Security-Policy"; OWASP — "CSP bypass"

### 4. X-Frame-Options 和 CSP frame-ancestors 有什么关系？

都用于防点击劫持（限制页面被谁 iframe）。X-Frame-Options 是老指令（DENY/SAMEORIGIN），CSP `frame-ancestors` 是新且更强的替代（可指定白名单来源）。现代浏览器优先认 frame-ancestors；为兼容老浏览器可同时设。helmet 默认都给。

**来源**：MDN — "X-Frame-Options" / "frame-ancestors"; OWASP — "Clickjacking Defense Cheat Sheet"

---

## 三、CORS

### 5. 简单请求和预检请求的区别？哪些会触发 OPTIONS 预检？

简单请求（GET/POST/HEAD + 仅限少数安全头 + Content-Type 为 form/text 等）直接发。非简单（自定义头如 Authorization、PUT/DELETE、Content-Type: application/json）先发 **OPTIONS 预检**问服务器是否允许 → 允许才发真实请求。预检结果可用 max-age 缓存。这也让 CSRF 难以用复杂请求伪造。

**来源**：MDN — "CORS / preflighted requests"; Fetch spec — "CORS check"; web.dev — "CORS"

### 6. 为什么说 CORS 不能替代 CSRF 防护？

CORS 只限制"跨源 JS 能否读取响应"，但不阻止跨源请求被**发出**（尤其 simple request 不发预检、浏览器自动带 cookie）。攻击者站点可发跨源 POST 触发你站点的状态改变（响应读不到但副作用已产生）。所以 cookie 认证仍需 SameSite/CSRF token；CORS 管读、CSRF 管写。

**来源**：OWASP — "CSRF Prevention"; portswigger — "CORS vs same-origin"; web.dev — "CORS security"

---

## 四、XSS

### 7. 三种 XSS 的区别？后端能防哪些？

存储型（恶意脚本存 DB，取用时执行）、反射型（请求参数直接回显到响应）、DOM 型（前端 JS 危险 API 如 innerHTML 处理输入，不经服务器）。后端主要防存储/反射：输出转义 + 富文本白名单清洗 + CSP。DOM 型偏前端责任（但仍可共享转义库）。后端不能只信任"数据是从自己 DB 来的"。

**来源**：OWASP — "XSS Prevention Cheat Sheet"; PortSwigger — "XSS types"; MDN — "Cross-site scripting"

### 8. 为什么不建议自己写正则过滤 `<script>` 来防 XSS？

黑名单式过滤极易绕过：大小写 `<ScRiPt>`、编码 `%3C`、换行 `<scr\nipt>`、其他向量（`<img onerror>`、`<svg>`、事件属性、`javascript:` URL、CSS expression）。正则在 HTML 这种非正则语言上本就不可靠。正确用**白名单**成熟库（DOMPurify/sanitize-html）+ 默认转义 + CSP。

**来源**：OWASP — "XSS Filter Evasion Cheat Sheet"; DOMPurify docs — "why not regex"; Michael Coates — "DOM Puri fy"

---

## 五、CSRF / SSRF

### 9. SameSite=Lax 能完全防 CSRF 吗？还有什么缺口？

不能完全防。Lax 阻止跨站 POST 携带 cookie，但**允许顶层导航的 GET 请求带 cookie** → 若你的"改状态"接口错误地用 GET（`GET /delete?id=1`）仍可被 CSRF。且子资源、部分场景 lax 不覆盖。因此仍需：不用 GET 改状态 + CSRF token（针对非幂等）+ Origin 校验做纵深。strict 更严但影响正常外链跳转登录态。

**来源**：MDN — "SameSite cookie / Lax"; OWASP — "CSRF"; datatracker — "SameSite updates"

### 10. 什么是 SSRF？后端如何防？

Server-Side Request Forgery：服务端根据用户提供的 URL 去发请求（抓图/ webhook / 拉取远程资源）→ 攻击者传内网地址（`http://169.254.169.254` 云元数据、`http://localhost:6379`）探测内网。防御：URL 白名单域名、解析 IP 后禁私网/回环段、禁重定向或每跳校验、协议限 http(s)、独立出网代理。

**来源**：OWASP — "SSRF Prevention Cheat Sheet"; PortSwigger — "SSRF"; AWS — "IMDSv2 / metadata SSRF"

---

## 六、限流与供应链

### 11. 除限流外，防止暴力破解 / 撞库还有哪些手段？

① 账号级失败锁定 / 指数退避；② 验证码 / 图形挑战 / 风险检测；③ 统一错误信息（不区分"用户不存在/密码错"防枚举，见 L5）；④ MFA/2FA；⑤ 密码强度 + 泄露密码库比对（Have I Been Pwned）；⑥ IP/设备指纹 + 异常告警；⑦ 凭证填充检测（大量不同账号来自同 IP）。

**来源**：OWASP — "Authentication / Brute force"; NIST SP 800-63B;  Auth0 — "credential stuffing"

### 12. npm 供应链攻击（如 typosquatting、恶意 postinstall）怎么缓解？

① 锁版本 lockfile + `npm ci` 可复现；② `ignore-scripts` 禁安装期脚本；③ 用 `npm audit`/Snyk/Socket 扫依赖行为；④ 私有 registry + 版本 pin + 签名/provenance（npm provenance）；⑤ 审查新增依赖（下载量/维护者/最后更新）防仿冒名；⑥ lockfile 变更走 review；⑦ SBOM + Dependabot 更新；⑧ 最小依赖面。

**来源**：GitHub — "npm supply chain attacks"; npm — "Provenance / Sigstore"; OWASP — "A06 Vulnerable & Outdated Components"

---

## 补充（新专题 13-15）

### 13.  SQL 注入的防线里，"参数化查询"之外还有哪些必须补齐的角落？按代码位置讲。

参数化覆盖不了的角落逐个点名：① 标识符位置（order by 列名、表名、列名过滤）——参数占位符只进值得进结构不进，唯一解是白名单字典映射（前端传排序 key 不传列名，从协议上消灭自由标识符）；② 动态 SQL 拼装片段（搜索多字段 like、IN 列表动态长度——IN 用参数展开或 ANY(数组)，手拼引号=经典面）；③ raw SQL 逃生口（$queryRaw 模板字符串在 Prisma 里是安全的参数化、但 queryRawUnsafe 是裸奔；sequelize 的 literal/where 字符串混部）——用 lint/评审规则把 Unsafe 类 API 列为红线（grep 即审计）；④ 二阶注入（存进库的"已清洗"值下次取出拼 SQL——存储不是消毒池，出口同样要参数化）；⑤ 数字型无引号直觉（?id=1 OR 1=1 不带引号的入口最易被"反正是数字"的错觉漏防）。ORM 时代的新分布：ORM 默认安全后，注入集中出现在报表/后台动态查询/自研查询构建器——"最后 30% 手写 SQL"才是审查重点。纵深补充：最小权限账号（应用账号不给 DROP、按库授权）、WAF 兜底但不计防线、错误不外显（报错信息泄露方言与表结构是注入的助推剂）。收口句：参数化是"默认动作"不是"全部动作"，这题考的就是你知不知道哪些角落它够不着。

**来源**：OWASP SQL Injection Prevention Cheat Sheet；Prisma/Sequelize 官方安全警告；CSDN《order by 注入三年没人发现的那个后台》

### 14.  线上发现 JWT 私钥泄露（进了 git 历史/日志），你的应急响应方案是什么？

预案平时写好（事发时执行而不是发明）：① 评估面——泄露密钥能伪造什么（全部会话？某租户？refresh 链？），有效期窗口多长，先定损害范围再定动作烈度；② 止血——立即启用新钥签发（kid 轮换，旧钥验签窗口按"泄露程度"决定：确认外流则零容忍——吊销接口+强制重登，仅可疑则短窗口+加强异常检测：一个 token 多 IP 并发使用即拦）；③ 高敏面并行处理——refresh 与内部服务间凭证（同钥签的内部 token 是横向移动跳板）一起换；④ 取证——token 使用日志回溯（伪造者用过哪些会话）、git 历史扫描（gitleaks/BFG 清历史并认识到"进了历史=已泄露"）；⑤ 复盘与防复发：密钥入 CI secret 扫描门禁、pre-commit 钩子、密钥管理从 env 明文升级到运行时注入（Vault/KMS），日志脱敏规则把"任何 Authorization 头/密钥变量名"列黑名单。组织细节：强制全员重登的用户沟通模板要预先准备（预案含公关文案是成熟标志）；演练——密钥轮换做成季度例行（从不轮换的密钥出事时才发明流程）。加分句：这题真正的考点是"你有没有把泄露当成必然事件设计过系统"——kid/JWKS、短 TTL、吊销通道、审计日志四件平时都在，应急才只是按下按钮。

**来源**：NIST 事件响应框架；Auth0 密钥泄露处置指南；知乎《我们的私钥在 Sentry 面包屑里躺了半年》

### 15.  后端安全监控与检测：除了防，你怎么"知道正在被攻击"？给一个 Express 服务设计监测面。

信号分三层：① 应用指标层——4xx 比例分端点告警（登录 401 突增=撞库、/admin 403 突增=越权探测、404 尖刺=路径扫描）、错误签名新增（一个从未出现的新 error type 上线常是攻击或 0day 的第一信号）、请求体大小与参数分布漂移（payload 结构变化=绕过尝试）；② 行为层——单账号/IP/设备的失败登录梯度、密码喷洒特征（同一密码打一批账号——与撞库反向，检测逻辑完全不同）、注册手机号/邮箱段聚集、API 调用的"指纹"（UA/TLS/JA3 与声明客户端不符）；③ 数据层——大批量导出（分页扫描式遍历所有 id 的"自动化拖库"形态：同一 session 连续单调游标请求）、权限敏感字段的异常读频（每个用户查 500 人资料）。落地形态：事件进审计日志（结构化、独立存储、只追加）+ 规则引擎（简单阈值先行，别一步到 UEBA）+ 告警分级（人工可行动的才配呼机级）。诚实边界：检测假阳性代价高（误封真人客服成本），动作分级（加验证>限流>封禁）而不是默认封；自家后台的"内部威胁"同样在监测面内（离职拖库是最贵的事件）。闭环：每周看一次"哪条规则触发过且经核实为真"——零触发的规则是装饰，全是误报的规则在制造告警疲劳，两种都要修剪。

**来源**：OWASP API Security Top 10（检测相关）；Google SRE 监控四大信号；InfoQ《从日志里捞出撞库团伙》
