# node-net-dns 面试题精选

> 共 15 题，覆盖 **TCP 语义 / socket 与流 / 粘包分帧 / UDP / DNS 解析 / 事件循环路径 / 实战与调优** 七类。

---

## 一、TCP 语义

### 1. 说清楚"TCP 面向字节流、UDP 面向报文"。这带来哪些工程后果？

TCP 把数据当成**连续无结构的字节流**：发送端多次 `write` 的边界，接收端 `read` 时看不到——只会拿到"一串有序字节"。后果：**粘包/半包**（多条消息粘一起或一条被拆），必须应用层**分帧**。UDP 则**保留报文边界**：`sendmsg` 一个数据报，`recvmsg` 一次拿一个完整数据报，不会粘；但**不保证送达、不保证顺序、可能重复**。所以：要可靠有序流式 → TCP（+ 自己分帧）；要低延迟、可容忍丢包、天然按包 → UDP（呼应 node-net-dns 第一、四节）。

**来源**：Wikipedia/计算机网络 — "TCP byte stream vs UDP datagram"; Node.js — "net / dgram"

---

## 二、socket 与流

### 2. `net.Socket` 是什么类型的流？它的常见事件与你需要警惕的点？

`net.Socket` 是 **Duplex Stream**（可读可写、有背压，呼应 node-streams）。事件：`'data'`（收到字节 Buffer）、`'end'`（对端半关闭 FIN）、`'close'`（完全关闭）、`'error'`（网络错误，**必须监听否则崩进程**，呼应 node-events 第三节）、`'drain'`/`'timeout'`。警惕点：① `setTimeout` 只发 `'timeout'` 事件**不自动断连**，要自己 `destroy()`；② `'end'` 后可能还想写——TCP 支持半关闭，用 `socket.end()` 只关写端；③ `socket.destroy()` 立即强拆、可能丢缓冲数据。

**来源**：Node.js — "Class: net.Socket / events / setTimeout"

### 3. `socket.write()` 返回 false 你该怎么做？这和 HTTP 大响应有什么关系？

`write` 返回 `false` 表示内核/socket 发送缓冲已超 `highWaterMark`——对端读得慢（网络拥塞、客户端慢）。应**暂停生产数据、等 `'drain'` 事件再继续写**（背压，呼应 node-streams 第五节）。HTTP 大文件下载本质就是 `readStream.pipe(res)`，`res` 就是这个 socket 上的写端；用 `pipeline`/`pipe` 会自动遵守 `false`/`drain`，否则你会把整个响应堆进内存（呼应 node-stream-pipeline、node-http）。这也是"慢客户端拖垮服务器"（slowloris 变种）的防护点。

**来源**：Node.js — "socket.write return value / drain"; 社区 — "backpressure http download node"

---

## 三、粘包与分帧

### 4. 你在 TCP 上做自定义协议，接收端如何从字节流里正确切出"一条条消息"？给一个健壮实现要点。

维护一个**接收缓冲 `buf`**，每来一块就 `buf = Buffer.concat([buf, chunk])`，然后**循环尝试解析**：

- **长度前缀法**：若 `buf.length >= 头长`，读出头里的正文长度 `n`；若 `buf.length >= 头长+n`，切出一帧、`buf = 剩余`，继续；否则"数据还不够"，跳出等下一块（呼应 node-buffer 第六节）。
- **分隔符法**：在 `buf` 里找分隔符（如 `\n`），找到一个切一帧、继续找；找不到就把残段留着。

**关键**：① **切不出完整帧时绝不能丢已收字节**（留在 buf 里等下一块）；② 用 `subarray` 零拷贝但注意后续 `Buffer.concat` 会重排（避免共享污染，呼应 node-buffer 第九题）；③ 对"头本身被拆开"也要处理（攒够头长才能读长度）。

**来源**：Node.js — "TCP framing / length-prefix"; 社区 — "sticky half packet node solution"

### 5. HTTP 协议是怎么在 TCP 字节流上界定"一个请求/响应"的？（承上启下）

HTTP 用**混合分帧**：① 请求行 + 头部各以 CRLF 分隔、头部以**空行（CRLFCRLF）** 结束——这是"分隔符法"；② 正文长度由 `Content-Length`（**长度前缀法**）或 `Transfer-Encoding: chunked`（分块，每块带十六进制长度、以 0 长度块结尾）界定；③ 一个 TCP 连接上可**复用**多个请求（keep-alive），靠上述边界一个个解析。`http` 模块就是把这个解析器做好了给你（下一关 node-http 展开）。

**来源**：RFC 9112 — "HTTP/1.1 Message Syntax"; Node.js — "http module"

---

## 四、UDP

### 6. 哪些场景该选 UDP？用 UDP 时你要自己在应用层补什么？

选 UDP 的理由：**低延迟、无握手、无重传阻塞（head-of-line blocking）、按包边界、广播/多播**。典型：DNS、实时音视频（WebRTC）、游戏状态同步、服务发现/mDNS、指标遥测。代价是**不可靠**：丢包、乱序、重复都要自己在应用层处理——序号、确认/重传（如 QUIC/RUDP 就建立在 UDP 上做可靠传输）、去重、超时、分片控制（单包别超 MTU≈1472 净负载，否则 IP 分片、丢一片整包废，呼应 node-net-dns 第四节）。

**来源**：Node.js — "dgram"; Wikipedia — "QUIC over UDP"

---

## 五、DNS 解析

### 7. 面试高频：`dns.lookup` vs `dns.resolve` 的区别？为什么"改 hosts 文件后 resolve 不生效但 lookup 生效"？

`dns.lookup(hostname, cb)` 调用 **OS 的 getaddrinfo**：会读 `/etc/hosts`、走 nsswitch/系统缓存/DNS，结果受本地配置影响；因为调阻塞系统函数，它在 **libuv 线程池**里跑（呼应 node-event-loop）。`dns.resolve*`（`resolve4/6/Mx/Txt/Srv…`）**直接向配置的上游 DNS 服务器发 DNS 协议查询**：**不查 hosts**、不走系统缓存、不占线程池，更贴近"权威 DNS 视图"。所以"hosts 写了映射却 resolve 拿不到"是正常现象——它压根没看 hosts。需要"和浏览器/系统一致的解析"用 lookup，需要"纯 DNS 记录"用 resolve（呼应 node-net-dns 第五节）。

**来源**：Node.js — "dns.lookup vs dns.resolve"; 社区 — "why does dns.resolve ignore hosts file"

---

## 六、事件循环路径

### 8. 为什么"几万个并发 socket 连接"Node 能扛，而"大量 dns.lookup"会把线程池打满？

网络 socket 的收发由**内核异步机制**（Linux epoll / macOS kqueue / Windows IOCP）驱动，事件循环 **poll 阶段**监听这些 fd 的就绪事件，就绪才回调——**不占用 libuv 线程池、不是每连接一线程**（呼应 node-event-loop 第二节、C10K 的解法）。而 `dns.lookup` 底层 `getaddrinfo` 是**阻塞系统调用**，只能丢进**线程池**执行；线程池默认 `UV_THREADPOOL_SIZE=4`，大量并发 lookup 会排队、变慢。要缓解：调大 `UV_THREADPOOL_SIZE`（需在进程启动前设环境变量）、改用不占池的 `dns.resolve`、或做应用层 DNS 缓存（呼应 node-deploy-perf）。

**来源**：Node.js — "libuv threadpool / UV_THREADPOOL_SIZE"; 社区 — "C10K event loop vs threads"

---

## 七、实战与调优

### 9. `server.listen` 报 `EADDRINUSE` 和 `EACCES` 分别是什么原因？端口 <1024 要注意什么？

- `EADDRINUSE`：端口已被占用（另一进程或本进程重复 listen）——换端口或杀掉占用者。
- `EACCES`：权限不足——在类 Unix 上**绑定 <1024 的特权端口**（80/443）需要 root；现代做法是不用 root 起服务，而是**监听高位端口（如 3000）+ 反向代理（Nginx）或用 `authbind`/capability**（呼应 node-deploy-perf、Express L8）。
- 监听前应 `server.on('error', ...)` 捕获这些码给出友好提示；`listen` 后端口就绪用 `'listening'` 事件（或 `events.once(server,'listening')`，呼应 node-events 第 9 题）。

**来源**：Node.js — "server.listen errors / privileged ports"; 社区 — "EADDRINUSE EACCES port 80 node"

### 10. 生产上一个监听在 127.0.0.1 的服务外部连不上，`0.0.0.0` 和 `127.0.0.1` 有何区别？

`listen(port, host)` 的 host 决定**绑定哪个网卡**：`127.0.0.1` 只接受**本机回环**连接（外部机器连不上，常用于"只让本机反向代理访问"的安全实践）；`0.0.0.0`（或 `::`）表示**监听所有网卡**、外部可达。Docker/容器里若服务绑 `127.0.0.1`，宿主机映射端口也连不上——要绑 `0.0.0.0`。默认不传 host 时较新 Node 监听 `::`（IPv6 + IPv4 映射）。排查"连不上"先看 `lsof`/`netstat` 的 LISTEN 地址（呼应 node-deploy-perf、Docker）。

**来源**：Node.js — "server.listen(port[, host])"; 社区 — "127.0.0.1 vs 0.0.0.0 docker can't connect"

### 11. 如何给一个 TCP 服务加"空闲连接超时"防 slowloris，又不断掉正常的 keep-alive 空闲？

用 `socket.setTimeout(ms)` + 在 `'timeout'` 回调里 `socket.destroy()`（因为 timeout 不自动关，呼应第 2 题）。对 HTTP 而言 `http.Server` 提供 `server.headersTimeout`（收请求头的总时限）、`server.keepAliveTimeout`（keep-alive 空闲多久关）——把 `keepAliveTimeout` 设得**小于反向代理的上游空闲超时**，避免"代理以为连接还活着、Node 已关"造成的 502 竞态（呼应 Express L8、node-https-tls）。`requestTimeout`（Node 18+）限制整个请求接收时间。这些是"面向互联网"的必配安全基线。

**来源**：Node.js — "server.keepAliveTimeout / headersTimeout / requestTimeout"; OWASP — "slowloris mitigation"

### 12. 你会在什么情况下直接用 `net`/`dgram`，而不是上层 `http`/`fetch`？

直接下 `net`/`dgram` 的场景：① **自定义协议/私有 TCP 服务**（数据库代理、消息队列客户端、设备长连接、游戏服务器）——需要自己在字节流上分帧（第 4 题）；② **实现协议本身**（写一个 HTTP/SMTP/WebSocket 库、TLS 握手，呼应 node-https-tls 底层）；③ **UDP 专用**：DNS、组播/广播发现、实时媒体、遥测（第 6 题）；④ **Unix domain socket** 做本机 IPC（比 TCP 快、无需端口，配合 `child_process`，呼应 node-child-process）。日常"调 REST API/发网页请求"用 `http`/`fetch` 即可，别重造轮子——但要懂它们底下就是本关这些原语（呼应 node-http、09-express）。

**来源**：Node.js — "net / dgram use cases"; 社区 — "when to use raw TCP vs HTTP"

---

## 补充（新专题 13-15）

### 13. dgram socket 的 "connected"（connect()）与 "unconnected" 模式差别？何时必须连？

unconnected：send(msg, port, host) 每包独立路由、收所有对端来的包（服务器姿势）；connected：底层 UDP 绑定固定对端（Linux TCP_FASTOPEN 类比 connect 后只能收发该对端，且**ICMP 端口不可达会冒成 ECONNREFUSED error 事件**——unconnected 静默丢包，connected 能感知「没人监听」）。必须连的理由：① 客户端要错误反馈与单对端语义；② 性能（免每包路由查找）；③ 防 spoof 收包混扰。另注意 connected 后 send 再传地址会报错、MTU 与分片行为不变（应用层仍要限单包 <1472 或走 IP 分片赌运气——本关分帧题在 UDP 侧的镜像）。

**来源**：Node dgram 文档 socket.connect 段（connected datagram socket 与错误报告）；RFC 768 端口不可达行为。

### 14. dns.lookup 与 dns.resolve 除了线程池/事件循环之外，语义差异还有哪些坑？

数据源：lookup 走 OS getaddrinfo（吃 /etc/hosts、mDNS、NSS、VPN 分流、IPv6 优先与 Happy Eyeballs）；resolve 直接问配置的 DNS 服务器（**绕过 hosts 与本地解析器**——「hosts 里改了不生效」「容器内 resolve 与 lookup 结果不一致」的根源）。返回形状：resolve 永远是字符串数组、lookup 按 verbatim/顺序（系统可能重排）；SRV/CNAME 只有 resolve 系认。坑：① 连接池按 IP 建连时 resolve 的轮转结果让「每次连不同后端」（客户端负载均衡副作用）；② lookup 结果可能被 Node 内部缓存路径复用而 resolve 无缓存——压测「解析耗时差异」；③ 容器排障先确定「谁在解析」（nsswitch vs CoreDNS）。默认 net/http 全走 lookup——所以改 hosts 能挡域名、清 DNS 缓存无效。

**来源**：Node dns 文档 lookup/resolve 对比与 verbatim 选项说明；getaddrinfo(3) man 与 NSS 配置说明。

### 15. 用 net 写一个带鉴权的简单 TCP 服务，列出你会做的安全与健壮措施。

准入：listen 绑 127.0.0.1/内网口（本关 0.0.0.0 题实装）、首包鉴权（token/HMAC+时间戳防重放）超时即断；缓冲纪律：读侧「声明长度≤N」+ 帧计数上限（本关分帧 DoS 题）；生命周期：socket.setTimeout 空闲踢、server.maxConnections、连接级错误全捕获 destroy（漏 error=崩进程）；数据面：write 背压（drain 前不堆）、半关闭 end/destroy 分清；可观测：连接数/字节数/慢客户端（send buffer 增长）指标；协议防御：未知帧类型直接断（strict parsing）、禁止把对端数据当指令 eval；部署：进程内限流（每 IP 连接数）、外部 TLS 终结或 starttls；测试：慢速客户端（slowloris 式）与半帧注入用例——「自己实现协议」的代价是把 TCP 帮你挡过的攻击面全过一遍（本关何时该用 net 题的答：除非自定义协议/代理，否则 HTTP/gRPC/现成消息层优先）。

**来源**：Node net/dgram 文档安全注意事项；OWASP Socket 层 DoS（slowloris）防御指南。
