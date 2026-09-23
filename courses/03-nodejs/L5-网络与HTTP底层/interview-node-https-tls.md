# node-https-tls 面试题精选

> 共 15 题，覆盖 **协议分层 / 证书与 PKI / 握手 / 校验与误用 / SNI 与 mTLS / HTTP/2 / 生产运维** 七类。

---

## 一、协议分层

### 1. 用一句话解释 HTTPS。它在 Node 里是怎么实现的？

HTTPS = **HTTP over TLS**：应用层仍是 HTTP，但传输走 TLS 加密信道（承载在 TCP 上）。Node 里 `https` 模块复用 `http` 的全部 req/res 语义，只是底层连接由 `tls` 模块的 `TLSSocket`（一个包裹 TCP socket 的 Duplex 流）提供加密（呼应 node-https-tls 第一、二节、node-streams）。所以 `http` 与 `https` 的 handler 写法完全一致，差别只在 `createServer` 多传 `{key,cert}`、`listen` 用 TLS。

**来源**：Node.js — "https / tls modules"; RFC 8446 — "TLS 1.3"

---

## 二、证书与 PKI

### 2. 一张 TLS 证书里有什么？浏览器/Node 如何"信任"它？

X.509 证书含：**主体公钥**、**身份（SAN 域名列表，现代以 SAN 为准、忽略 CN）**、**颁发者（CA）**、**有效期**、**用途/扩展**、以及**CA 对以上内容的数字签名**。信任来自 **PKI 信任链**：客户端内置一批**受信任根 CA** 公钥，用它们逐级验证"根 CA → 中间 CA → 你的叶子证书"的签名链，链通且域名/有效期匹配即信任（呼应 node-https-tls 第三节）。所以自签证书不被信任——它的"签发者"不在根列表里。

**来源**：RFC 5280 — "X.509 PKI Certificate"; Node.js — "TLS certificate / CA list"

### 3. "证书是用来加密的吗？"——纠正这个常见误解。

不完全是。证书的核心作用是**身份认证 + 公钥分发**（证明"这个公钥属于该域名"），防止中间人冒充。**真正加密业务数据的是握手协商出的对称密钥**（AES-GCM/ChaCha20），非对称（证书里的公钥/私钥）只用于握手阶段的认证与密钥交换。所以"证书=公钥的身份证"，不是"数据加密器"（呼应 node-https-tls 第三、四节、quiz 第 2/3 题）。

**来源**：RFC 8446 — "key exchange vs record protection"

---

## 三、握手

### 4. 描述 TLS 1.3 握手大致过程，以及它比 1.2 快在哪、引入了什么安全改进。

TLS 1.3：**ClientHello**（带支持的套件 + `key_share` 密钥协商参数）→ **ServerHello**（选定套件 + 自己的 key_share）+ 证书 + CertificateVerify（用私钥签名握手 Transcript 以证明持有私钥）→ 双方即刻算出**共享密钥**，切换到加密，再发 Finished。1-RTT 完成握手（1.2 需 2-RTT），还支持 0-RTT（会话恢复，但有重放风险）。安全改进：**砍掉所有过时/易破的算法**（RSA 密钥传输、CBC、SHA1、压缩、自定义 DHE 参数等），强制前向保密（ECDHE）。

**来源**：RFC 8446 — "TLS 1.3"; Cloudflare/SSL Labs — "TLS 1.3 vs 1.2"

### 5. 什么是前向保密（PFS/Perfect Forward Secrecy）？为什么重要？

指**即使服务器的长期私钥未来泄露，攻击者也无法解密之前录下的历史密文流量**。实现靠 **ECDHE**（临时 Diffie-Hellman）：每次会话生成**一次性**密钥对、协商出会话密钥后即刻丢弃临时私钥——历史会话密钥不在长期私钥里，故泄露私钥也解不开旧流量（呼应 quiz 第 7 题）。反之，老式 RSA 密钥交换会用服务器长期公钥加密预主密钥，一旦私钥泄露所有历史流量暴露。TLS 1.3 强制 PFS（呼应 node-https-tls 第四节）。

**来源**：RFC 8446 — "forward secrecy / (EC)DHE"; Cloudflare — "what is perfect forward secrecy"

---

## 四、校验与误用

### 6. `self-signed certificate` / `unable to verify the first certificate` 报错的成因与正确修法（至少两种）。

成因：服务器证书**不能追溯到客户端信任的根 CA**——可能① 真的自签；② 由私有/内部 CA 签发；③ **服务器没配全证书链**（只发了叶子证书、漏了中间 CA），导致验证断链。修法：① 若是私有 CA——把该 CA（或完整链）通过 `ca` 选项/系统信任库提供（呼应 node-https-tls 第五节）；② 若是漏中间证书——**服务端补齐 fullchain**（叶子+中间 CA）；③ 生产用 Let's Encrypt 等公共 CA。**绝不要用 `rejectUnauthorized:false` 掩盖**——那是关掉 MITM 防护（呼应 Express L6）。

**来源**：Node.js — "self-signed certificate error"; SSL Labs — "incomplete certificate chain"

### 7. 为什么 `NODE_TLS_REJECT_UNAUTHORIZED=0` 被称作"反模式"？临时调试更安全的替代是什么？

它**全局**关闭进程内所有出站 TLS 证书校验，一次性废掉所有 https 请求的 MITM 防护，且极易从"本地临时"一路带进生产（供应链级事故）。更安全替代：① 用 `new https.Agent({ ca: <指定CA> })` 只信任**特定** CA、只作用于**这一个**请求/agent，而非全局关校验；② 或把开发 CA 导入 OS/Node 信任库；③ 环境变量方案务必用启动脚本隔离、设代码审查红线，别写进镜像默认。原则：**缩小信任范围、别一刀切关安全**。

**来源**：Node.js — "rejectUnauthorized / tls.checkServerIdentity"; OWASP — "TLS certificate validation bypass"

---

## 五、SNI 与 mTLS

### 8. SNI 是什么？没有它会怎样？它有什么隐私副作用，怎么缓解？

**SNI**：客户端在 TLS **ClientHello**（握手最初、明文）里带上要访问的主机名，使**同一 IP:443 上托管多域名**的服务器能选择正确证书返回。没有 SNI，一 IP 只能配一张默认证书（早年靠多个 IP 或通配符）。副作用：主机名以明文暴露给网络路径上的观察者（隐私）。缓解：**ECH（Encrypted Client Hello，前身 ESNI）**把含 SNI 的 ClientHello 扩展部分加密（呼应 node-https-tls 第六节）。Node 服务端用 `server.addContext(host,{key,cert})` 支持多证书。

**来源**：RFC 6066 — "SNI"; RFC — "Encrypted Client Hello (ECH)"

### 9. 双向 TLS（mTLS）与普通 TLS 的区别？典型使用场景？

普通 TLS 只**客户端验证服务端**证书；**mTLS 再加一步：服务端要求客户端出示证书并验证其 CA 签名**，双向互证身份。场景：**服务间/微东西向流量**、零信任网络内部、银行/合作伙伴 API、IoT 设备认证——"每个调用方都有独立身份证书"。Node：服务端 `requestCert:true, rejectUnauthorized:true, ca:<客户端CA>`，客户端 `https.request({key,cert})`（呼应 node-https-tls 第七节）。与"应用层 JWT/API key"相比，mTLS 把认证下沉到连接层、更强绑定但证书管理更重。

**来源**：RFC 8446 — "client authentication"; Node.js — "tls.requestCert"

---

## 六、HTTP/2 与其它

### 10. `http2` 模块和 TLS 什么关系？为什么要给它 `key/cert`？

`http2` 有 `createSecureServer({key,cert,...}, handler)`：**互联网上的 HTTP/2 实践上要求 TLS（h2）**，只有明文 h2c 用于内部/测试。HTTP/2 的多路复用、头部压缩(HPACK)、服务器推送都跑在一条 TLS 连接上（呼应 node-http keep-alive 的进阶版）。Node 也支持通过 ALPN（TLS 握手里协商应用协议）让一个 https server 同时对外说 h2 或 http/1.1。

**来源**：Node.js — "http2.createSecureServer"; RFC 9113 — "HTTP/2"

---

## 七、生产运维

### 11. 生产环境，TLS 应该在 Node 里终结，还是交给反向代理/负载均衡？

两种都合法，权衡（呼应 node-https-tls 第八节）：**边缘终结（Nginx/ALB/Cloudflare）**——证书集中、自动续期、卸载 CPU、易上 HTTP/2/3 与 WAF；Node 收明文（内网），但**必须**正确从 `X-Forwarded-Proto/For` 还原真实协议与客户端 IP，并设 `app.set('trust proxy', ...)`（否则 secure cookie、重定向到 https、限流拿到的 IP 都会错，呼应 Express L6/L8、node-http interview 第 11 题）。**Node 直接终结**——端到端加密、少一跳，但证书/续期/TLS 参数都归你管、消耗应用进程 CPU。高并发常见"边缘终结 + 内网再加密"。

**来源**：Nginx/AWS docs — "TLS termination at LB"; Express — "trust proxy"

### 12. 你会给一个 Node HTTPS 服务定哪些"TLS 安全基线"？

① **最低 TLS 1.2、力争 1.3**，`minVersion:'TLSv1.2'`；② **只保留强套件**（含 ECDHE 前向保密、AEAD），**禁用**压缩(TLS 层，防 CRIME)、弱曲线、导出套件；③ 证书用公共 CA + **自动续期**（certbot/ACME）+ **到期监控告警**；④ **HSTS** 响应头（`Strict-Transport-Security`，含 `max-age`、`includeSubDomains`、必要时 `preload`）强制后续走 https（呼应 Express L6）；⑤ http→https **301 跳转**、防降级；⑥ 私钥权限 600、绝不入库；⑦ 关闭证书校验仅限本地（第 7 题）；⑧ 定期用 SSL Labs/`testssl.sh` 扫描。这些是"面向公网"的必做项（呼应 node-deploy-perf 生产就绪清单）。

**来源**：Mozilla — "Server Side TLS"; OWASP — "Transport Layer Security cheat sheet"

---

## 补充（新专题 13-15）

### 13. 用 Node 起一个生产级 HTTPS 服务，TLS 层面逐项给配置与理由。

证书：ACME 自动续期（lego/greenlock 或让 LB 管）+ 链完整（fullchain 含中间证书，缺链在部分安卓/老客户端才暴露）；协议：minVersion TLSv1.2（内部全 1.3 可 min 1.3）、maxVersion 1.3；套件：默认即安全（1.3 无套件可选，1.2 留 ECDHE+AES-GCM）、禁用静态 RSA 密钥交换（保 PFS）；会话：sessionTimeout 收敛、复用 resumption 提 QPS；SNI：多域用 SNICallback 动态选证（别一次性 allCerts 内存摊大饼）；OCSP stapling 让客户端免查 CA（隐私+速度）；HTTP：加 HSTS（确认全域 HTTPS 再 preload）、 ALPN 声明 h2,http/1.1；监控：过期倒计时告警（本关基线题的闭环）、SSLLabs 外测定期回归。进程层：TLS 在 Node 终结意味着私钥进内存——高敏业务把终结外移（本关「谁终结」题），Node 只接回源明文/双向校验放边缘。

**来源**：Mozilla SSL Configuration Generator；Node tls.createSecureContext 选项文档与 SSLLabs 评级实践。

### 14. mTLS 与普通 TLS 在 Node 里各配什么？证书轮换工程怎么做？

配置差异：服务端 requestCert:true + rejectUnauthorized:true + ca=客户端 CA（不是服务端证书！），客户端 secureContext 带 key/cert 自身证书；Node 侧取证书：res.getPeerCertificate()（详细链）——授权把 CN/SAN 映射身份（别把「能握手」当「有权限」，RBAC 在应用层）。轮换：证书寿命 ≤90 天 + 提前 1/3 自动换（SPIFFE/小证书思路）；服务端热换：server.setSecureContext 不重启（ACME webhook 触发）；客户端连接池要能感知对端重签（长连接 mTLS 的服务发现联动）。信任模型：内部 CA（Vault step-certificate）分层签发，吊销走短期证书代替 CRL；排障：握手失败先分清「证书不被信 vs hostname vs 链不完整 vs 时钟漂移」。

**来源**：Node tls 文档 requestCert/getPeerCertificate；SPIFFE 短期证书与 Vault PKI 轮换实践。

### 15. TLS 在 Node 终结还是交给 Nginx/云 LB？决策矩阵给一个。

Node 终结的理由：端到端加密（零信任内部也要 TLS）、免一层代理开销与 hop 审计、WebSocket/mTLS 细节可控、单机部署省事。交给 LB 的理由：证书集中管理（几十实例一处续）、硬件/OS 级优化与会话票据共享、DDoS/卸载在边缘、HTTP/3 与灰度能力、合规审计边界清晰。折中：re-encrypt（LB 到 Node 仍 https，内网自签/mTLS）——兼顾集中与端到端；TLS 终结在 LB 时 Node 必须处理 forwarded/proto 伪造（X-Forwarded-Proto 只信来自可信 LB、HSTS 只在可信处加——本关安全基线题与 Express trust proxy 呼应）。决策变量：实例数、证书自动化成熟度、合规（数据明文落地面）、性能预算（Node crypto 占主线程之外的线程池，但 handshake CPU 仍是你账单）。

**来源**：云厂商 LB TLS 终结文档（ALB/NLB 对比）；Zero Trust 内部 TLS 实践（Google cloud next 案例）。
