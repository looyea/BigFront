# mp-network 面试题精选

> 共 12 题，覆盖 A 域名与安全 / B API 语义 / C 封装与工程 / D 与 Web 请求层对照。

## 一、域名与安全（A 类）

### 1. 小程序请求服务器有哪些强制要求？为什么这样设计？
https 强制、域名后台白名单登记（需 ICP 备案、每月 5 次修改）、四通道各自配域名（request/socket/uploadFile/downloadFile）。目的：把"前端代码可访问任意服务器"收进平台审计，防钓鱼与数据外送——Web CORS 是"服务器授权浏览器"，小程序白名单是"平台授权小程序"，方向相反（呼应 node-https-tls、exp-security）。
**来源**：微信小程序官方文档《服务器域名配置》；《域名校验规则调整公告》

### 2. 开发/体验/正式环境的域名怎么管理？
白名单是**全局的**（不分环境）——三套环境域名都要提前加满（数量额度吃紧时可让多环境共用一个网关域名靠路径区分）；开发期工具勾选"不校验合法域名"，体验版真机可开"调试模式"临时放开，正式版无后门（呼应 mp-publish 发布流程）。
**来源**：微信小程序官方文档；真机调试模式说明

### 3. 证书"链不全"为什么在电脑浏览器正常、部分安卓小程序失败？
浏览器/系统各自维护根证书与中间证书缓存，能"补链"；小程序走微信自有网络栈，要求服务端**完整下发证书链**（含中间证书）。Let's Encrypt 场景高发。解法：部署时带上 fullchain（呼应 node-https-tls 的证书链话题、exp-deploy 的 Nginx TLS 配置）。
**来源**：微信开放社区 ssl hand shake error 案例精选；TLS 证书链通用知识

## 二、API 语义（B 类）

### 4. wx.request 的 success/fail/complete 与 axios 的 resolve/reject 语义差异？
success=网络层完成（含 4xx/5xx），fail=网络层失败；axios 按状态码决定 reject。封装 request.js 时必须手动"状态码→异常"归一，否则上层 await 永远 then（呼应 react-data-fetching 里 fetch 的同款教训）。
**来源**：微信小程序官方文档《request 返回值》；axios 文档对照

### 5. 取消请求有几种方式？页面卸载时要不要管在飞请求？
`task.abort()` 手动取消；页面级要管：回包后 setData 打到已销毁页面会告警（组件实例同理，呼应 mp-component-lifecycle 面试第 4 题）。规范：onUnload 里 abort 本页发起的 tasks，或回包处判 `getCurrentPages()` 栈顶是否还是自己/用标志位。
**来源**：微信小程序官方文档《RequestTask.abort》；社区请求泄漏案例

### 6. 并发 10 个 request 会怎样？后台队列是谁实现的？
超额请求进入微信网络模块队列排队（不报错、表现为延迟）；另有整体 API 调用频率配额。高频轮询/瀑布流预取要做并发窗口控制（p-limit 思路）（呼应 node-stream-pipeline 背压同款心智）。
**来源**：微信小程序官方文档《网络 API 调用限制》

## 三、封装与工程（C 类）

### 7. 你的 request 封装有几层拦截器？各层职责？
请求层：BASE 拼接/token 注入/traceId 生成；响应层：状态码→业务异常映射/401 登出跳转/数据解包（body.data 直达）；体验层：loading 引用计数、错误统一 toast（可关）、重试策略（仅幂等 GET）；观测层：耗时上报/失败率埋点（呼应 mp-interaction 挑战题、exp-patterns 洋葱分层、react-data-fetching 的 QueryClient 配置项）。
**来源**：开放社区请求封装精选；axios/Taro-request 源码设计

### 8. token 过期"无感刷新"在小程序怎么做？
401 时：挂起当前请求→用 refresh_token 换新 token（单飞：并发 401 只刷一次，其余等同一个刷新 Promise）→成功则重放原请求、失败走登出。与 Web 端同一套 OAuth 思路；refresh_token 存 Storage（注意其敏感性，别存 globalData 明文到处飞）（呼应 exp-auth 双 token、mp-storage）。
**来源**：OAuth2 规范思想；小程序无感刷新社区方案精选

### 9. 上传大文件（录音/视频）注意什么？
uploadFile 单文件上限（默认 10MB 文档值、以最新官方为准）、filePath 来自 chooseMedia/RecorderManager 的临时路径（会过期，及时上传）；大文件分片：前端切片+服务端合并（exp-upload 的多路复用方案在小程序端对称实现，分片需 request+数组 buffer 或多次 uploadFile）；进度用 `task.onProgressUpdate`（呼应 node-streams）。
**来源**：微信小程序官方文档《uploadFile / 分片上传实践》；开放社区大文件案例

## 四、与 Web 请求层对照（D 类）

### 10. 小程序没有 CORS，那跨域防护靠什么？
白名单本身就是"平台级 CORS"；服务端无需配 CORS 头（小程序请求不带 Origin 语义、由微信代理转发，referer 固定为 `https://servicewechat.com/{appid}/{version}/page-frame.html`——后端可用它做**来源校验**防刷，但别依赖其存在）。Web 的 withCredentials/Cookie 那套在小程序基本失效：登录态一律走自定义 token（呼应 exp-auth 不用 cookie 的论证、node-http referer 利用）。
**来源**：微信官方社区《关于 referer 与 servicewechat》说明帖；MDN CORS 对照

### 11. fetch/axios/uni.request/Taro.request 与 wx.request 的关系？
wx.request 是地基（回调式、无拦截器）；uni.request≈wx 原名透传+Promise 化；Taro.request 适配多端；axios 不能直接用（无 XHR 适配器，可配 adapter 魔改用——主流方案仍是自研或用 taro-axios）。抽象结论：**请求库的竞争力全在拦截器链与取消/重试语义**，传输层谁都能接（呼应 react-data-fetching 的"库换适配器不换"）。
**来源**：Taro/uni-app 官方文档请求章节；axios 适配器机制文档

### 12. 小程序能直接连公司内网数据库或第三方 HTTP API（无 https）吗？
不能——https+白名单双卡。第三方只有 https 域名的可登记直连；http 的必须自建网关反代（Nginx/云函数转发）；直连数据库更无从谈起（无 TCP，除非自建 socket 网关且有合规风险）。这催生了"小程序后端必上线上一个公网 https 网关"的架构常识（呼应 exp-deploy、node-net-dns 协议层次）。
**来源**：微信小程序官方文档《网络通信能力限制》；架构实践通识
