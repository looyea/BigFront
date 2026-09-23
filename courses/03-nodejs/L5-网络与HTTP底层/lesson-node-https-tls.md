# HTTPS 与 TLS：给 HTTP 套上加密层

> 目标：把明文 `http` 升级成加密的 `https`，并真正理解 TLS 在做什么。核心认知：**HTTPS = HTTP over TLS，TLS = 在 TCP 与 HTTP 之间插入的一层加密流**（在 socket 上再套一个 `tls.TLSSocket`，呼应 node-net-dns、node-streams）。讲清 `https.createServer`/`https.request`、证书的构成（公钥/私钥/CA 签名）、TLS 握手（非对称协商对称密钥）、证书链与校验、自签名证书与 `rejectUnauthorized` 的危险、SNI、以及"生产到底该不该在 Node 层终结 TLS"。呼应 Express L6/L8、node-deploy-perf。

---

## 一、TLS 在协议栈的哪一层

```
应用层    HTTP（req/res）
─────────────────────────  ← TLS 记录层在这里
传输层    TLS（加密、完整性、身份）
─────────────────────────
传输层    TCP（字节流，node-net-dns）
网络层    IP
```

HTTP 的字节不再直接写进 TCP socket，而是先交给 **TLS 层加密**再落到 socket；收到的字节先经 TLS **解密**再交给 HTTP 解析器。在 Node 里，`tls.TLSSocket` 是一个 **Duplex Stream**，它"包裹"底层 TCP socket，对上层暴露"读明文/写明文"的假象（呼应 node-streams Duplex）。`https` 模块就是"`http` + `tls`"的拼装。

---

## 二、HTTPS 服务器

```js
import https from "node:https";
import fs from "node:fs";

const options = {
  key:  fs.readFileSync("server.key"),      // ★ 私钥（务必保密、权限 600）
  cert: fs.readFileSync("server.crt"),      // 服务器证书（含公钥 + CA 签名）
  // ca: 双向认证时验证客户端证书用（mTLS）
};

https.createServer(options, (req, res) => {   // 回调签名和 http 完全一样
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("secure hello");
}).listen(3443);
```

`req`/`res` 用法与 `http` 一模一样（本关因此是 node-http 的"加密皮"）。区别只在：底层连接被 TLS 包裹，`req.socket.getPeerCertificate()` 能拿到对端证书、`req.socket.authorized` 表示是否通过校验。Express 的 app 直接传给 `https.createServer(opts, app)` 即可跑 HTTPS（呼应 09-express、node-http interview 第 1 题）。

---

## 三、证书是什么：公钥 + 身份 + CA 签名

一张 X.509 证书绑定了三样东西：**① 主体的公钥**；**② 身份标识**（CN / SAN `subjectAltName`，即它代表哪些域名）；**③ 某个 CA 用其私钥对前两者的数字签名**。浏览器/Node 内置了一份**受信任根 CA 列表**，用根 CA 公钥去验证签名链，从而信任你证书里的公钥——这就是**公钥基础设施（PKI）的信任链**。

关键：**证书用于"证明公钥归属"（身份认证），不是用来加密数据本身**。今天看证书主要看 **SAN**（现代校验忽略 CN，只认 SAN 列表）。

---

## 四、TLS 握手（TLS 1.3 视角）要解决的三件事

1. **协商密码套件与版本**（ClientHello 里给支持列表，ServerHello 选定）；
2. **身份认证 + 密钥交换**：服务器出示证书，客户端验证签名/域名；双方用**非对称/混合（ECDHE）**算法协商出一个**临时共享的对称密钥**（TLS 1.3 的 (EC)DHE 提供**前向保密 PFS**——日后私钥泄露也解不了历史流量）；
3. **切换到对称加密**（AES-GCM/ChaCha20-Poly1305）传输应用数据——非对称只用于"安全地商量出对称密钥"，真正传数据用对称（快）。

一句话：**非对称解决"如何在不安全信道上建立共享密钥 + 验证身份"，对称负责"高效加密后续数据"**。

---

## 五、自签名证书、`rejectUnauthorized` 与校验

开发环境常自签证书（`openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 30 -nodes -subj "/CN=localhost"`）。客户端访问自签/内网 CA 证书会得到 `unable to verify the first certificate` / `self-signed certificate`——因为签发者不在信任根列表。

```js
// ❌ 危险做法：关掉证书校验（等于放弃 MITM 防护，千万别带到生产）
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
https.get(url, { rejectUnauthorized: false }, ...);

// ✅ 正确做法：把【签发你证书的那个 CA】的证书作为 ca 传进去
import https from "node:https";
import fs from "node:fs";
const agent = new https.Agent({ ca: fs.readFileSync("my-ca.crt") });
await fetch(url, { duplex: undefined }, ...);   // 或 https.request({ agent })
```

`rejectUnauthorized:false` / `NODE_TLS_REJECT_UNAUTHORIZED=0` 关闭了**身份验证**，任何人可做中间人（MITM）篡改/窃听——这是高危配置，只允许出现在本地临时调试（呼应 Express L6 安全）。生产要么用公共 CA（Let's Encrypt）签发的证书，要么把私有 CA 装进信任链。

---

## 六、SNI：一个 IP、多个 HTTPS 站点

一个服务器/一个 IP 上托管多个 HTTPS 域名，靠 **SNI（Server Name Indication）**：客户端在 **ClientHello 明文**里带上"我要访问 `api.foo.com`"，服务器据此**选择对应域名的证书**返回。Node 服务器用 `server.addContext(hostname, {key,cert})` 为不同主机名挂不同证书（呼应 node-events）。SNI 的副作用是"域名在握起手阶段是明文可见"（ECH/ESNI 正在解决）。

---

## 七、HTTPS 客户端与 mTLS

```js
import https from "node:https";
// 带 CA（验证服务端）、带客户端证书（mTLS 双向认证）
const req = https.get("https://api.example.com/ping", {
  // ca: fs.readFileSync("ca-bundle.pem"),   // 私有 CA
  // key: clientKey, cert: clientCert,        // mTLS：向服务端证明"我"的身份
}, (res) => { /* ... */ });
req.on("error", console.error);
```

**mTLS（双向 TLS）**：不仅客户端验证服务器，服务器也要求客户端出示证书并验签——用于服务间/零信任内网（呼应 node-child-process 之外的微服务通信）。现代默认出站请求也可用 `fetch` + 自定义 `undici.Agent({ connect: { ca, key, cert } })`。

---

## 八、生产决策：谁终结 TLS？

常见两种：

- **反向代理/负载均衡终结 TLS**（Nginx / ALB / Cloudflare）：TLS 在边缘解密，内网走明文或内网再加密。优点：证书集中管理、自动续期、HTTP/2/3、卸载 CPU 负担；Node 只处理 `http` + 从 `X-Forwarded-Proto/For` 还原真实协议与 IP（要 `app.set('trust proxy', ...)`，呼应 Express L6、node-http interview 第 11 题、node-deploy-perf）。
- **Node 直接终结 TLS**（`https.createServer`）：少一跳、端到端加密，但要自己在 Node 侧管证书/续期、配 `secureOptions`、注意性能（非对称运算 CPU 开销，呼应 node-deploy-perf）。

无论哪种，都要：**TLS 1.2+（力争 1.3）、禁用弱套件与压缩（CRIME/BEAST）、HSTS 头、证书到期监控**。

---

## 九、自检清单

- [ ] HTTPS、TLS、TCP、HTTP 的层次关系？TLS 在 Node 里是什么流？
- [ ] 证书里装了什么？为什么说"证书证明公钥归属而非用来加密数据"？
- [ ] 握手解决哪三件事？为什么最终用对称加密、非对称只做密钥交换/认证？什么是前向保密？
- [ ] `rejectUnauthorized:false` 为什么危险？访问自签证书的正确姿势？
- [ ] SNI 解决什么问题、有什么明文副作用？
- [ ] 反代终结 TLS vs Node 终结 TLS 各自取舍？`trust proxy` 为何重要？

---

## 🚀 部署预告

- 本关 `https.createServer(opts, app)` 把 **09-express** 直接升加密；`X-Forwarded-Proto` + `trust proxy` 与 Express 的 secure cookie、重定向到 https 联动（呼应 Express L6/L8）；
- 证书自动续期（Let's Encrypt/certbot）、TLS 参数基线、CPU 开销与 HTTP/2，都进 **node-deploy-perf** 的"生产就绪清单"（呼应 Express L8）；
- 底层 `tls` 模块本身可裸用在 TCP socket 上做加密私有协议（回扣 **node-net-dns**）；
- 密码学原语（`crypto` 的哈希/HMAC/AEAD/签名）与 TLS 用的同一套库，深入见 **node-config**（勿自研加密、勿硬编码密钥）与 Express L6。

下一关进入 **node-child-process**：让 Node 启动外部命令与其它进程。
