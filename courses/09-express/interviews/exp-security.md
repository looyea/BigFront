# exp-security 面试题精选

> 共 12 题，覆盖 **OWASP / Helmet&CSP / CORS / XSS / CSRF / 注入 / 限流 / 供应链** 多类。

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
