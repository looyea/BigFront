# 网络请求与封装

> 目标：`wx.request` 是小程序连接自己服务器的唯一正门（除此之外只剩 WebSocket 与云开发）。它比 fetch 多了三道微信特色枷锁：**域名白名单、https 强制、referer/超时/并发配额**。本课把它讲透，并按 09-express 学到的后端品味，封装一个带拦截器的 request 工具（呼应 **exp-rest**、**node-http**、**react-data-fetching**、**mp-interaction** 封装）。

---

## 一、铁律先行：三道微信枷锁

1. **域名白名单**：mp 后台"开发管理-服务器域名"里登记 request/uploadFile/downloadFile/socket 各自合法的域名，**每月只可修改 5 次**、必须 **https** 且证书有效、必须**已备案**——本地 `http://localhost:3001`（我们的 Express 后端！）只有开发者工具勾选"不校验合法域名"才能跑，**真机预览必须用登记过的域名**；
2. **单次数据上限**：request 响应、setData 链路整体都在 1MB 量级吃紧（呼应 mp-setdata 红线）；
3. **并发限制**：同时最多 10 个 wx.request（另有 API 全局并发配额），超限排队——并发预加载不要裸开 Promise.all 大数组（呼应 node-http 的连接治理思路）。

调试期经典报错三连：`url not in domain list`（白名单）、`request:fail ssl hand shake error`（证书链不全，Let's Encrypt 某些中间证书老安卓缺）、`timeout`（默认 60s，可在 app.json `networkTimeout` 全局调）。

---

## 二、wx.request 本体

```js
const task = wx.request({
  url: 'https://api.example.com/v1/goods?id=5',
  method: 'GET',                        // GET/POST/PUT/DELETE/... 对应 exp-rest 动词
  data: { page: 1 },
  header: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
  timeout: 10000,
  dataType: 'json',                     // 默认自动 JSON.parse；设 '其他' 拿原文
  success(res) {
    // res.data 响应体 | res.statusCode 状态码 | res.header
  },
  fail(err) { /* err.errMsg：'request:fail' 网络层错误，与业务码无关 */ },
  complete() { /* 成败都跑：hideLoading 放这（呼应 mp-interaction finally） */ },
});
task.abort();   // 取消在飞请求——竞态治理的原始武器（呼应 react-effect-patterns AbortController）
```

**success ≠ 成功**：只要网络层走通就进 success，**4xx/5xx 也在 success 里**（看 statusCode）；fail 只管"没摸到服务器"。这与 fetch 的语义一致、与 axios 不同（axios 按状态码 reject）——封装时必须补齐这层（呼应 react-data-fetching 的 fetch 教训）。

### 上传/下载是另外两个 API

```js
wx.uploadFile({
  url: 'https://api.example.com/v1/upload',
  filePath: tempFilePath,               // 来自 wx.chooseImage/chooseMedia（呼应 exp-upload 的 multipart）
  name: 'file',                         // 后端 multer 的字段名！Express 侧 req.files 对得上
  formData: { biz: 'avatar' },          // 附加字段
  header: { Authorization: `Bearer ${token}` },
});
wx.downloadFile({ url });               // 返回 tempFilePath，再 saveFile/操作
```

uploadFile 的 response 是**字符串**，记得自己 JSON.parse——它是"专门给 multipart 开的门"，不走 request 的 dataType（exp-upload 服务端收 file，两端接上）。

---

## 三、封装：一个带拦截器的 request.js

```js
// utils/request.js —— 对标 axios 实例/exp-server 中间件的分层品味
const BASE = 'https://api.example.com/v1';
let inflight = 0;

function interceptReq(cfg) {
  const token = wx.getStorageSync('token');
  if (token) cfg.header = { ...cfg.header, Authorization: `Bearer ${token}` };
  return cfg;
}
function interceptRes(res, cfg) {
  if (res.statusCode === 401) {              // 登录态失效：清 token→跳登录（呼应 exp-auth）
    wx.removeStorageSync('token');
    wx.navigateTo({ url: '/pages/login/login' });
    throw Object.assign(new Error('未登录'), { code: 401 });
  }
  if (res.statusCode >= 400) {               // 业务错误统一抛出（exp-validation 的错误码映射表在这落地）
    throw Object.assign(new Error(res.data?.message || `HTTP ${res.statusCode}`),
      { code: res.statusCode, data: res.data });
  }
  return res.data;
}

export function request(path, { method = 'GET', data, auth = true, loading = true } = {}) {
  if (loading) { /* 引用计数 showLoading（mp-interaction 挑战题同款） */ }
  return new Promise((resolve, reject) => {
    const cfg = interceptReq({ url: BASE + path, method, data, header: {} });
    wx.request({
      ...cfg,
      success: (res) => { try { resolve(interceptRes(res, cfg)); } catch (e) { reject(e); } },
      fail: (err) => reject(Object.assign(new Error('网络异常，请稍后重试'), { raw: err })),
      complete() { if (loading) /* hideLoading 计数-- */; },
    });
  });
}
export const api = {
  goods: { list: (p) => request('/goods', { data: p }), detail: (id) => request(`/goods/${id}`) },
  orders: { create: (d) => request('/orders', { method: 'POST', data: d }) },
};
```

分层点评：**URL 集中（BASE+api 命名空间）→ 认证注入 → 状态码归一 → 错误人话化 → loading 闭环**，五层职责与 Express 中间件链一一镜像——你在 09-express 写的每层，客户端都会遇到它的对称面（呼应 exp-patterns、react-data-fetching 的 service 层）。

---

## 四、竞态与重试

- **竞态**：搜索页两次请求先后发出、后发先至 → 旧结果覆盖新结果。武器：`task.abort()`（发新请求前取消旧的）或 **requestId 比对**（只应用最新 seq 的回包）——React Query 帮你自动做的事，这里手动做（呼应 react-effect-patterns 竞态节、mp-events 面试 12）；
- **重试**：幂等 GET 失败可指数退避重试 1~2 次；POST 下单**绝不自动重试**（服务端幂等键没做好就是重复订单——exp-rest 的幂等设计在此回收）；
- **弱网体验**：fail 时给"重试"按钮而不是 toast 完事；图片列表 onError 兜底占位。

---

## 五、WebSocket 一瞥

```js
const socket = wx.connectSocket({ url: 'wss://api.example.com/ws' });
socket.onMessage((msg) => { /* JSON.parse(msg.data) → 节流后 setData（呼应 mp-setdata 高频红线）*/ });
socket.onError / onClose; socket.send({ data }); socket.close();
```

直播弹幕、聊天、协同都用它；断线重连（指数退避+心跳）自己写或用库——node 侧 ws 服务端的对端就是它（呼应 node-net-dns/exp 实时话题）。

---

## 六、自检清单

- [ ] 域名白名单三道门槛（https/备案/月改 5 次）还记得吗？真机与工具差异？
- [ ] success 回调里拿到的 404 该怎么判？
- [ ] uploadFile 与 request 的三处差异？
- [ ] 401 在拦截器里应该做哪三件事？
- [ ] 竞态两武器、重试一原则是什么？

---

## 🚀 部署预告

- 请求层通了，你的 Express 后端（09 包）与小程序前端正式接吻；
- 下一关 **mp-login**：小程序最特殊的后端交互——`wx.login` 换 code、后端调微信接口换 openid/session_key、自定义登录态。把 exp-auth 的 JWT 心智接上微信的"code2session"流水线（呼应 exp-auth、node-config 的密钥管理）。
