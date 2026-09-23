# 底层网络：net、dgram 与 dns

> 目标：下到 TCP/UDP 这一层，亲手摸"字节流"，为 HTTP 打地基。HTTP 只是**跑在 TCP 上的一个文本协议**——理解了 `net`  socket 的"连接 / 字节流 / 无消息边界"，才明白为什么需要分帧（呼应 node-buffer 第六节）、为什么 HTTP 有 header/body 与 keep-alive。掌握 `net`（TCP server/client）、`socket`（它是 Duplex 流）、`dgram`（UDP）、`dns`（域名解析），并看清 libuv 如何把这些 I/O 交给内核异步处理（呼应 node-event-loop）。

---

## 一、TCP 是"字节流"，不是"消息列表"

`net` 模块提供 TCP（也支持 Unix socket）。一个关键心智模型：**TCP 连接是一条双向字节流**，你 `write` 的字节和对端 `read` 的字节，只保证**顺序**，**不保证边界**——发三次 `write` 可能一次到达（粘包），一条大消息也可能被拆成多次（拆包）。这正是 node-buffer 第六节"长度前缀分帧"要解决的问题，也是所有应用层协议（HTTP、Redis、WebSocket）存在的根本原因：**它们负责在字节流上定义消息边界**。

---

## 二、TCP 服务器：`net.createServer`

```js
import net from "node:net";

const server = net.createServer((socket) => {
  console.log("客户端连接", socket.remoteAddress, socket.remotePort);
  socket.write("欢迎\r\n");                 // 向这条流写字节
  socket.on("data", (chunk) => {            // 收到字节（Buffer 块！不是"一条消息"）
    console.log("收到", chunk);
    socket.write("echo>" + chunk);
  });
  socket.on("error", (e) => console.error(e));   // ★ socket 会 emit error（呼应 node-events 第三节）
  socket.on("close", () => console.log("断开"));
});

server.listen(4000, "127.0.0.1", () => console.log("TCP 服务已监听"));
server.on("error", (e) => console.error("监听失败", e));   // 端口占用等
```

**`socket` 本身是一个 Duplex Stream**（呼应 node-streams）——能 `write`/`end`、能 `on('data')`、有背压。`server` 是 EventEmitter，`'connection'`（构造回调里也等价）与 `'error'` 都挂在它上面。`socket.setTimeout(ms)` + `'timeout'` 事件用于空闲超时（注意 timeout **不会自动断连**，你要自己 `socket.destroy()`）。

---

## 三、TCP 客户端：`net.connect`

```js
import net from "node:net";
import { once } from "node:events";

const client = net.connect(4000, "127.0.0.1");
await once(client, "connect");          // 等连上（呼应 node-events interview 第 9 题 events.once）
client.write("ping\r\n");
for await (const chunk of client) console.log("<", chunk.toString()); // 流可 async 迭代
client.end();
```

`connect` 是异步的：不要连上之前 `write`（放进缓冲会等连上再发，但更稳妥是等 `'connect'`/`'ready'`）。`net.isIP/isIPv4/isIPv6` 可校验地址字面量。

---

## 四、UDP：`dgram`——无连接、有边界、不可靠

UDP 与 TCP 相反：**面向报文**（一次 `send` = 一个数据报，接收方一次 `message` 收到，**天然有边界**、无粘包），**无连接**（不用握手）、**不保证到达/顺序**、头部开销小、延迟低。适合：DNS 查询、音视频实时、`发现/广播`、计数遥测等"丢几个包无所谓、但要快"的场景。

```js
import dgram from "node:dgram";
const sock = dgram.createSocket("udp4");
sock.on("message", (msg, rinfo) => {          // msg 是一个完整数据报（Buffer）
  console.log("收到", msg.toString(), "来自", rinfo.address, rinfo.port);
  sock.send(Buffer.from("pong"), rinfo.port, rinfo.address);   // 回发
});
sock.bind(5000, "127.0.0.1");
// 发送：
sock.send(Buffer.from("hello"), 5000, "127.0.0.1", (err) => {});
```

要点：单包建议 ≤ MTU（约 1472 字节净负载），超过会 IP 分片、丢一个分片整包作废；`connect` 一个 UDP socket 后可用 `send` 只发往固定对端并收到错误反馈。

---

## 五、DNS：把域名变 IP

`dns` 模块做域名解析。**`dns.lookup`** 走**操作系统**解析器（受 `/etc/hosts`、`nsswitch`、系统缓存影响，且会占 libuv 线程池，呼应 node-event-loop "dns 走线程池"）；**`dns.resolve`** 系列**直接向 DNS 服务器发查询**（绕过系统 hosts，A/AAAA/MX/TXT/SOA… 各类型）。

```js
import dns from "node:dns/promises";
await dns.lookup("nodejs.org");            // { address, family } —— 走 OS，含 hosts
await dns.resolve4("nodejs.org");          // ['104.16.x.x', ...] —— 直查 DNS，不读 hosts
await dns.resolveMx("example.com");        // 邮件服务器记录
await dns.reverse("8.8.8.8");              // 反解析
```

`lookup` vs `resolve` 的差别是高频面试点：一个"问操作系统"、一个"问 DNS 协议服务器"；`lookup` 有系统缓存与 hosts 语义但走线程池，`resolve` 结果更"权威 DNS"、纯异步不占池。`dns.setServers`、`--dns-result-order` 可控制行为。

---

## 六、这些 I/O 在事件循环里怎么走

TCP/UDP 的网络 I/O **不占 libuv 线程池**——由内核的异步机制（epoll/kqueue/IOCP）+ 事件循环的 **poll 阶段**驱动，就绪了才回调（呼应 node-event-loop 第二节："网络 I/O 走内核异步、不占池"）；而 `dns.lookup` 因为要调用阻塞的 OS 函数，反而**占用线程池**。理解了这点，就懂为什么"几万个并发长连接"Node 扛得住（不是每个连接一个线程），而大量 `dns.lookup` 会挤爆默认 4 个线程的池。

---

## 七、从裸 socket 到"协议"：写个最小行协议

把本关知识收口：在 TCP 字节流上，用 `\n` 分隔定义"一条消息"（最简单分帧），并逐帧处理——这就是 Redis/HTTP 请求行的雏形：

```js
server.on("connection", (socket) => {
  let buf = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {     // 攒缓冲、按分隔符切出完整行
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      handle(line, socket);                     // 处理"一条逻辑消息"
    }
  });
});
```

这解释了 HTTP 为什么能建立在 TCP 之上：`http` 模块就是**替你把这条字节流按"请求行/头/体"分好帧**（下一关）。

---

## 八、自检清单

- [ ] 为什么说 TCP 是"字节流无边界"？会带来哪两种典型问题？
- [ ] `socket` 属于哪种流？它的 `error`/`timeout` 事件要注意什么？
- [ ] TCP 与 UDP 在"连接/可靠性/边界/开销/适用场景"上如何对比？
- [ ] `dns.lookup` 和 `dns.resolve` 有什么区别？谁读 hosts？谁占线程池？
- [ ] 网络 I/O 与 `dns.lookup` 在事件循环里路径为何不同？
- [ ] 在字节流上实现"消息"边界，有哪两种基本策略？（分隔符 / 长度前缀）

---

## 🚀 部署预告

- 本关"字节流 + 分帧"直接引出下一关 **node-http**：`http` 模块把 TCP 字节流按"请求行/头部/CRLF/正文"解析成 `req`/`res`（呼应 node-buffer 第六节、node-stream-pipeline）；
- socket 的超时/半关闭、连接数与 keep-alive，是 **node-deploy-perf**（`server.keepAliveTimeout`、慢请求防护）的重点；
- UDP 广播/mDNS、raw 场景偶尔用于服务发现（呼应 node-cli 工具）；
- TLS 是在 TCP 与 HTTP 之间**再插一层加密流**（Duplex 套 Duplex），下一关 **node-https-tls** 展开。

下一关进入 **node-http**：用裸 `http` 模块亲手写服务器——理解 Express 之下到底发生了什么。
