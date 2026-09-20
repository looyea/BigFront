# Buffer 与字符编码：二进制数据的真相

> 目标：理解 JS 在 Node 里如何触碰"字节"。字符串是"文本"，而网络包、文件、图片、加密数据都是**原始字节**——`Buffer` 就是 Node 用来操作这块内存的类。讲清 Buffer 与 TypedArray 的关系、`alloc` vs `allocUnsafe` 的坑、hex/base64/utf8 编码互转、"为什么按字节切分会乱码"（StringDecoder），以及用 Buffer 手工拼/解一个二进制协议。呼应 node-fs（读回的是 Buffer）、node-streams（流搬运的就是 Buffer 块）、node-net-dns（socket 收发字节）。

---

## 一、Buffer 是什么：一段裸内存

JS 本身没有"字节数组"，只有数字数组（松散、装箱开销大）。Node 提供 `Buffer`——**一段固定的原始内存**，每个元素是 0–255 的一个字节：

```js
const b = Buffer.from("hi", "utf8");   // <Buffer 68 69>   'h'=0x68 'i'=0x69
b.length;                               // 2（字节数，不是字符数！）
Buffer.from("中", "utf8");              // <Buffer e4 b8 ad>  ← 一个汉字 3 字节
```

`Buffer` 是 `Uint8Array` 的子类（TypedArray 家族，呼应 ES 的 TypedArray 概念），所以能直接喂给 `crypto`、`fs`、网络 API。区别：Buffer 额外提供编码转换、二进制读写（`readUInt32BE` 等）这些"字节工具方法"。

---

## 二、创建：`from` / `alloc` / `allocUnsafe`

```js
Buffer.from("abc");            // 从字符串（默认 utf8）
Buffer.from([0x89, 0x50, 0x4e]); // 从字节数组
Buffer.from(hexStr, "hex");    // 从十六进制串解码
Buffer.alloc(10);              // 10 字节，全部清零（安全，默认推荐）
Buffer.allocUnsafe(10);        // 10 字节，不清零！复用池中残留数据
```

**`allocUnsafe` 的坑**：它从一个内部池取内存、**不初始化**，快，但可能读到**上一次使用遗留的字节**——如果这些数据被回显给外部（如响应体），就是**信息泄漏**（可能含密码、token 残片）。除非你确定会立刻用 `write`/`copy` 覆盖全部字节，否则用 `alloc`。这是面试与安全审计的经典点（呼应 Express L6 安全）。

```js
const u = Buffer.allocUnsafe(4);
console.log(u);   // 可能是 <Buffer 5b 48 01 c2 ...>  残留垃圾，不是 <Buffer 00 00 00 00>
```

---

## 三、编码：utf8 / latin1 / hex / base64 / utf16

`.toString(encoding)` 把字节**解码**成字符串；`Buffer.from(str, encoding)` 把字符串**编码**成字节。常见编码：

| 编码 | 用途 | 特点 |
| --- | --- | --- |
| `utf8` | 文本默认 | 变长（ASCII 1 字节、汉字常见 3 字节） |
| `latin1`(=`binary`) | 单字节直通 | 每字节↔0–255 一字符，处理"其实不是文本的字节"时不丢数据 |
| `hex` | 可读的二进制 | 每字节 2 个十六进制字符 |
| `base64` | 文本通道传二进制 | JSON/邮件/URL 里塞图片、token |
| `ucs2`/`utf16le` | 双字节 | Windows 宽字符、BOM |

```js
const b = Buffer.from("hi", "utf8");
b.toString("hex");     // '6869'
b.toString("base64");  // 'aGk='
Buffer.from("aGk=", "base64").toString("utf8");   // 'hi'  ← 往返
```

**乱码的本质**：用错编码去 `toString`。把一批其实是 GBK 的字节按 `utf8` 解，非法序列变 U+FFFD（``）；把二进制图片按 `utf8` 读再写回会**损坏文件**（呼应 node-fs 第二节：二进制别指定编码）。

---

## 四、`length` 是字节数，不是字符数——切片乱码的根源

```js
const s = "h中a";
const b = Buffer.from(s, "utf8");
b.length;                 // 5：h(1) + 中(3) + a(1)
[...s].length;            // 3：字符数（用扩展运算符按码点数）
```

如果你按**字节**把 Buffer 从中间切开（比如分块传输每 2 字节切一刀），很可能把"中"的 3 字节切成 `1+2`，两块各自按 utf8 解码都出现残缺 → 乱码（`<Buffer e4>` 单独解是 U+FFFD）。这正是**流分块读多字节文本会跨界乱码**的原因（呼应 node-streams）。解法：用 **`StringDecoder`**——它会**暂存跨块的残缺字节**，等下一块补齐再输出完整字符：

```js
import { StringDecoder } from "node:string_decoder";
const d = new StringDecoder("utf8");
d.write(Buffer.from([0xe4]));            // '' （半个汉字，先攒着）
d.write(Buffer.from([0xb8, 0xad]));      // '中'（补齐才吐出）
```

`TextDecoder`（Web/ES 标准，配 `{stream:true}`）有同样的"流式解码"能力。

---

## 五、读写多字节整数与字节序（endianness）

二进制协议里"一个 4 字节长度头"怎么解？用 Buffer 的定位读方法，**注意大小端**：

```js
const pkt = Buffer.from([0x00, 0x00, 0x01, 0x00]); // 表示整数 256（大端 BE）
pkt.readUInt32BE(0);   // 256
pkt.readUInt32LE(0);   // 16777216  ← 小端读就反了

// 写入
const out = Buffer.alloc(4);
out.writeUInt32BE(256, 0);   // <Buffer 00 00 01 00>
```

BE（big-endian，网络序）多用于协议/文件头，LE 常见于 x86 内存。**读错字节序 = 数值完全错乱**，是解析 PNG/IP/自定义协议最常见的 bug。还有 `readInt8/16/32`（有符号）、`readFloatBE`、`readBigInt64BE`（>32 位）。

---

## 六、实战：手工拼一个"长度前缀"帧

网络是**字节流**，没有"消息边界"（TCP 会把多条粘在一起、或把一条拆断，呼应 node-net-dns、node-streams）。自定义协议常用**长度前缀分帧**：先 4 字节写长度，再写正文。

```js
// 编码一帧
function encodeFrame(str) {
  const body = Buffer.from(str, "utf8");
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length, 0);      // 前 4 字节 = 正文长度
  return Buffer.concat([head, body]);      // <Buffer 00 00 00 05 68 65 6c 6c 6f>
}
// 解码：先读 4 字节长度 n，再取后 n 字节
function decodeFrame(buf) {
  const n = buf.readUInt32BE(0);
  return buf.subarray(4, 4 + n).toString("utf8");   // subarray 不拷贝、共享内存
}
```

关键方法：`Buffer.concat([..])` 合并、`buf.subarray(a,b)`（零拷贝切片，`slice` 的现代化名）、`buf.copy(target, targetOff, srcOff, srcEnd)`。注意 `subarray`/`Buffer.from(existingBuffer)` 与原 Buffer **共享同一块内存**，改一个动全部——要么 `copy` 出独立副本，要么心里有数（这是难查 bug 的温床）。

---

## 七、Buffer 与池化、`markAsUntransferable`

`allocUnsafe` 走的是一个 8KB 的**共享内存池**（减少频繁 malloc/GC）。副作用：多个小 Buffer 可能指向池中相邻/残留区域（第 二节的泄漏面）。当你把 Buffer 通过 `worker_threads`/`postMessage` **转移所有权**（transfer，避免拷贝，呼应 node-workers）时，池化的 Buffer 不能被安全 transfer——需 `require('node:buffer').markAsUntransferable` 或对池内存特殊处理。知道有这层池化，就能理解"为什么有时 Buffer 之间会互相影响"。

---

## 八、自检清单

- [ ] Buffer 和 `Uint8Array` 什么关系？为什么需要它？
- [ ] `alloc` 和 `allocUnsafe` 差别？后者为何有信息泄漏风险？
- [ ] `b.length` 数的是字节还是字符？"中"占几字节？
- [ ] 为什么按字节切 utf8 文本会乱码？`StringDecoder`/`TextDecoder` 怎么解决？
- [ ] `readUInt32BE` vs `LE` 读错会怎样？网络序一般是哪个？
- [ ] `subarray` / `Buffer.from(buf)` 是拷贝还是共享内存？

---

## 🚀 部署预告

- 本关"流分块会切断多字节字符"的悬念，由 **node-streams**（`highWaterMark` 分块、`StringDecoder`/`objectMode`）与 **node-stream-pipeline** 正面解决（呼应第四节）；
- socket 收发、TCP 粘包拆包在 **node-net-dns** 里正式登场，第 六节的长度前缀帧就是它的解药；
- 读文件拿到的 Buffer 回扣 **node-fs 第二节**，`base64` 常用于把二进制塞进 JSON/HTTP（呼应 node-http、Express L3 上传）；
- Buffer transfer 与内存池，在 **node-workers**（`postMessage`）与 **node-deploy-perf**（内存剖析）里再会。

下一关进入 **node-streams**：用流以恒定内存处理任意大小的数据。
