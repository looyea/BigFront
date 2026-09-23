# node-buffer 面试题精选

> 共 15 题，覆盖 **Buffer 本质 / 分配与安全 / 编码转换 / 字节与字符 / 字节序与协议 / 零拷贝与内存池 / 实战** 七类。

---

## 一、Buffer 本质

### 1. 为什么 JS 需要 Buffer？它和 `Uint8Array` 什么关系？

JS 原生只有 `Array<number>`——元素松散装箱，操作裸字节既慢又别扭。而 I/O、网络、文件、加密面对的都是**原始字节**。`Buffer` 是 Node 提供的**定长、连续、每格 0–255** 的内存块。它是 `Uint8Array` 的**子类**（TypedArray 家族），因此能无缝传给接受 TypedArray 的 API（`crypto`、`fs.write`、`postMessage`）；额外多了编码互转（`toString('base64')`）与二进制读写（`readUInt32BE`）等便捷方法（呼应 node-buffer 第一节、ES TypedArray）。

**来源**：Node.js — "Buffer / Class: Buffer extends Uint8Array"; MDN — "Typed arrays"

---

## 二、分配与安全

### 2. `Buffer.alloc` 与 `Buffer.allocUnsafe` 区别？为什么后者被称为安全隐患？

`alloc(size)` 返回**清零**的内存——每个字节确定是 0。`allocUnsafe(size)` 从内部内存池取一段**不初始化**的内存，省掉清零所以更快，但里面可能是**上一次分配遗留的字节**。如果你把未完全覆盖的 `allocUnsafe` Buffer 内容发送出去（HTTP 响应、socket 写出），就可能**泄漏他人的密码/令牌/明文残片**（信息泄露漏洞，呼应 Express L6 安全）。规则：默认用 `alloc`；只有在"紧接着 `write`/`copy` 覆盖全部字节"的性能热路径才用 `allocUnsafe`。旧的 `new Buffer()` 因行为不定已被废弃。

**来源**：Node.js — "Buffer.alloc vs allocUnsafe / security"; 社区 — "allocUnsafe information disclosure"

---

## 三、编码转换

### 3. 说说 utf8 / latin1 / hex / base64 各自的用途与"膨胀比"。

- **utf8**：文本默认，变长（ASCII 1 字节、多数汉字 3 字节、emoji 4 字节）。
- **latin1（=`binary`）**：单字节直通，字节值↔U+0000–U+00FF 一一对应——处理"其实不是文本的原始字节"时用它**不丢数据**（可无损往返）。
- **hex**：每字节 2 个十六进制字符，**膨胀 2×**，用于可读调试/短令牌。
- **base64**：每 3 字节→4 字符，**膨胀约 4/3（1.33×）**，把任意字节塞进只能承载 ASCII 的通道（JSON、邮件、URL、data URI）。
选型：文本用 utf8，二进制过文本通道用 base64，要人读/日志用 hex，"当纯字节容器且要无损"用 latin1（呼应 node-buffer 第三节）。

**来源**：Node.js — "Buffer encodings"; MDN — "Base64 / atob btoa"

### 4. 一段 utf8 字节被错误地按 `ucs2`/`utf16le` 解码，会怎样？如何"发现"编码用错了？

会得到**乱码**（把每两个 utf8 字节当成一个 UTF-16 码元，汉字被拆错），且可能长度对不上、出现大量不可打印字符。发现手段：① 与已知内容比对（本应是"中文"却成"锟斤拷"类经典乱码，多半是 utf8↔gbk 混用）；② 检查 `Buffer.equals` 往返是否无损；③ 看 BOM/字节特征。根治：明确数据来源编码，别默认。`toString` 传对 encoding 是唯一防线。

**来源**：Node.js — "Buffer.toString encoding"; 社区 — "mojibake 锟斤拷 utf8 gbk"

---

## 四、字节与字符

### 5. `Buffer.byteLength(str, 'utf8')` 和 `str.length` 有何不同？给一个会踩坑的例子。

`str.length` 是 **UTF-16 码元数**（JS 字符串内部按 UTF-16 存），`Buffer.byteLength` 是指定编码下的**字节数**。例：`"中".length` → 1，但 `Buffer.byteLength("中","utf8")` → 3；一个 emoji `😀.length` → 2（代理对）、utf8 字节 → 4。踩坑：**HTTP `Content-Length` 必须按字节数（utf8）设**，用 `str.length` 会把含非 ASCII 的响应体长度设小，客户端截断/挂起（呼应 node-http、Express）。用 `Buffer.byteLength(body,'utf8')` 才对。

**来源**：Node.js — "Buffer.byteLength"; MDN — "string length vs UTF-16 code units"

### 6. 为什么把一个 Buffer 从固定字节数处 `slice` 后各自 `toString('utf8')` 可能乱码？`StringDecoder` 怎么救？

因为 utf8 是多字节变长编码，某个汉字跨 3 字节，若切点正好落在这 3 字节中间，前一块结尾是"半个字符"、后一块开头是"残缺续字节"，各自独立解码都得到 U+FFFD（呼应 node-buffer 第四节）。`StringDecoder`（或 `TextDecoder` 配 `{stream:true}`）在解码一块时，把**末尾不完整的字节序列暂存**，与下一块拼接后再解，从而输出正确字符。凡"分块传输 + 文本"就要用它，别对每块裸 `toString`。

**来源**：Node.js — "string_decoder.StringDecoder"; WHATWG — "TextDecoder stream"

---

## 五、字节序与协议

### 7. big-endian 与 little-endian 是什么？为什么解析二进制协议时必须统一？

指多字节整数的**字节排列顺序**：BE 把最高有效字节放低地址（"网络字节序"，多数协议/文件格式头用），LE 把最低有效字节放低地址（x86 内存原生）。`0x00000100`（=256）按 BE 存是 `00 00 01 00`，若你用 `readUInt32LE` 去读这段，会得到 `0x00010000`=65536——**完全错乱**。Buffer 提供 `*BE`/`*LE` 两套读写，务必按协议规定的端序选（PNG 用 BE、Windows BMP 用 LE 等）。读错端序通常不报错、只是数值离谱，非常隐蔽（呼应 node-buffer 第五节）。

**来源**：Node.js — "readUInt32BE / endianness"; Wikipedia — "Endian"

### 8. TCP 是字节流、没有消息边界，怎么传"多条消息"？举例分帧策略。

TCP 会把多条小消息**粘在一起**、或把一条大消息**拆断**送达（sticky/拆包），因为它是无边界字节流（呼应 node-net-dns、node-streams）。解决=自定义**分帧（framing）**，常见三种：① **长度前缀**（先 N 字节写后续消息长度，读到长度再精确取正文，最常用，见 node-buffer 第六节）；② **分隔符**（每条以 `\n` 或特殊哨兵结尾，如 HTTP 头用 CRLFCRLF、NDJSON 用换行）；③ **固定长度**（每条定长，简单但浪费）。收端要维护一个"缓冲区"，攒够一帧才解析、剩下留着（`buffer` 累加 + 循环切分）。

**来源**：Node.js — "TCP is a byte stream / framing"; 社区 — "length-prefix protocol node socket"

---

## 六、零拷贝与内存池

### 9. `buf.slice()`（现 `subarray`）是拷贝吗？共享内存会带来什么 bug？

不是拷贝——`subarray` 返回**共享同一段底层内存的视图**（零拷贝，快、省内存）。`Buffer.from(existingBuffer)`、`buffer.buffer`(ArrayBuffer) 同样共享。风险：你在"视图"上 `write`，会**改到原 Buffer 对应字节**，反之亦然——两个看似独立的变量互相污染，产生极难定位的数据错乱。要真正独立就用 `buf.copy(target,...)` 或 `Buffer.from(buf)` 再…（注意 `Buffer.from(buffer)` 仍共享！取独立副本要 `Uint8Array.prototype.slice` 或 `Buffer.from(buf)`→ 再 `.copy` 到 alloc 的新 buf）。理解共享/拷贝边界是写二进制解析器的基本功（呼应 node-buffer 第六节）。

**来源**：Node.js — "buf.subarray (view, no copy) / buf.copy"; MDN — "TypedArray.subarray vs slice"

### 10. 什么是 Buffer 的"内存池（pooling）"？它和 `allocUnsafe`、`worker_threads` transfer 有什么纠葛？

`allocUnsafe`（及内部 `allocUnsafeSlow` 之外）小 Buffer 从一块 **8KB 的共享 ArrayBuffer 池**里切分，避免频繁向 OS malloc 和 GC 压力——这是"小对象分配快"的原因，也是"未清零可能读到邻居残留"的来源（第 2 题）。跨 `worker_threads` 用 `postMessage` **transfer**（转移 ArrayBuffer 所有权、零拷贝）时，**被池化的 ArrayBuffer 不能被 transfer**（因为它还被池里其它 Buffer 共用），Node 会退回拷贝或报逻辑问题。对确定要 transfer 的大 Buffer，可用 `Buffer.allocUnsafeSlow`（绕开池）或 `markAsUntransferable` 表达意图（呼应 node-workers、node-buffer 第七节）。

**来源**：Node.js — "Buffer pool / allocUnsafeSlow"; Node.js — "postMessage transfer list"

---

## 七、实战

### 11. 你要把上传的图片落盘并生成缩略图，内存里应该持有 Buffer 还是字符串？为什么？

**必须是 Buffer（字节）**，全程别经过"字符串编码"。图片是二进制，从请求体拿到的是 Buffer（或流式分块 Buffer，呼应 node-streams、Express L3 上传），写盘 `fs.writeFile(path, buffer)`、传给图像库也都吃 Buffer。一旦 `toString('utf8')` 就损坏（第 三节）。大图还应**流式**处理避免整块驻留内存（呼应 node-fs 第七节）。base64 只是"传输编码"，收到后应立刻 `Buffer.from(b64,'base64')` 还原成字节再落盘，别把 base64 字符串当存储格式（膨胀 1.33× 且非原始）。

**来源**：Node.js — "Buffer / handling binary data"; 社区 — "store image buffer not base64"

### 12. `Buffer`、`Uint8Array`、`ArrayBuffer`、`DataView` 四者关系？

自底向上：**`ArrayBuffer`** = 一段裸二进制缓冲（不能直接读写元素）。**`Uint8Array`**（及各 TypedArray）= 在 ArrayBuffer 上按某种"视图/步长"解释字节的窗口；`DataView` = 同一 ArrayBuffer 上、可**手动指定端序**读写多种数值类型的通用视图。**`Buffer`** = Node 对 `Uint8Array` 的扩展子类（自带池化分配、编码转换、`readUInt32BE` 便捷方法）。一句话：`ArrayBuffer` 是内存，`Uint8Array`/`DataView`/`Buffer` 都是"解读它的视图"，`Buffer` 是 Node 里最顺手的那个（呼应 node-buffer 第一节、ES TypedArray）。

**来源**：MDN — "ArrayBuffer / TypedArray / DataView"; Node.js — "Buffer extends Uint8Array"

---

## 补充（新专题 13-15）

### 13. Buffer 的 8KB 内存池机制：为什么存在、什么时候反而坑？

动机：每个小 Buffer 都 malloc 一块 ArrayBuffer 的开销巨大（分配+GC），libuv 式池——小请求（<4KB 即 HALF_SIZE）共享一个 8KB 池切 offset，分配=池内挪指针。坑：① buf.buffer 指向整池（本关题），把 .buffer 传给 worker/网络=多送别人数据；② 池切片让「小 Buffer 钉住 8KB」——百万个 10B Buffer 实际占 8GB 级内存，堆里 ArrayBuffer 看不出来（heapUsed 统计盲区，external 才见）；③ 判池：buf.parent instanceof ArrayBuffer && length!==byteLength？Node 提供 kNoZeroFill/allocUnsafe 走非池。对策：要独占内存 allocUnsafeSlow 或非池路径；传给 worker 用 subarray 拷贝或 structuredClone 时传视图而非 buffer（现代引擎支持传视图）。本关 pooling 题的「为什么默认开、何时关」层。

**来源**：Node 官方《Buffer: pooling 与 allocUnsafeSlow》文档；libuv 内存池与 external memory 统计说明。

### 14. TCP 上实现「多条消息」的分帧，给出设计与防御清单。

两条基本路线（本关题干考过概念）：分隔符帧（换行/魔数——文本协议如 HTTP 头、Redis RESP 用）与长度前缀帧（4 字节 BE 头——二进制主流，本关 BE/LE 题呼应）。设计要点：① 读满才切：累积缓冲（Buffer.concat 慢，预分配环/数组+偏移），半包续读；② **头部防御**：前缀声明长度设上限（如 1MB），超限即断连——「先读 4 字节信 4GB」=内存 DoS；分隔符帧防无分隔垃圾（找分隔的 O(nm) 与无限增长缓冲，超时+上限）；③ 字符编码统一 UTF-8，JSON 帧配 byteLength 前缀（本关 byteLength 题）；④ 粘包只在「帧」层解决，别指望 socket 边界；⑤ 优雅：断开时残留半帧要么丢要么报错，别静默当完整帧。工程：成熟协议/帧库优先（length-prefixed-codec、bobuf），自研就上帧格式测试（半包/多帧同 chunk/超限）。

**来源**：Redis RESP 协议规范；Node 官方 net 文档流式示例与《Designing Data-Intensive 网络分帧》章节。

### 15. 把上传的图片转 base64 塞 JSON，体积与编码上你要提醒什么？还有别的传输选择吗？

体积：base64 每 3 字节→4 字符，**膨胀约 33%**；4MB 图→5.3MB 文本，还要 UTF-8「每 ASCII 字符 1 字节」才成立（正确：base64 输出是 ASCII，但 Buffer.toString('base64') 后当 string 参与 JSON 的字节数=字符数）。编码：分块流式图不能整 Buffer.toString（本关多字节切断题在 base64 上同样——base64 分块要 3 字节对齐或换原生 base64 流转换器）；Data URL 记得 data:image/png;base64, 前缀与 MIME 嗅探风险。替代：① multipart/form-data 或裸二进制 body（Content-Type: image/png + fetch res.arrayBuffer()）体积零膨胀；② 二进制走 WebSocket Blob/ArrayBuffer 帧；③ 需要 JSON 内嵌再考虑 base64，或 msgpack/cbor 带二进制类型。结论：base64 是「表现层妥协」不是传输方案——能传字节就别转文本（本关图片进 JSON 题的成本账）。

**来源**：RFC 4648 base64 定义（3:4 膨胀比）；MDN fetch 二进制 body/arrayBuffer 指南。
