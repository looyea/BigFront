# 面试题 · 小程序 API 与登录 / 支付

1. **小程序登录流程完整说一遍。**
   `wx.login()` → 拿 code → 发给自己服务器 → 服务器用 code + appid + secret 换 `openid` 与 `session_key` → 服务器生成自定义登录态 token 下发 → 小程序 `wx.setStorage` 存 token → 后续请求带 token。

2. **为什么不能把 session_key 下发到前端？**
   泄露 session_key 意味着攻击者可解密用户所有数据（加密数据都以 session_key 为密钥）。必须只存服务端。

3. **`wx.request` 的坑？**
   - 只能请求 **HTTPS**，域名要在 mp 后台白名单。
   - 有并发上限（10）与超时默认 60s。
   - 建议封装一层带拦截器/token 自动附加的 request。

4. **`wx.setStorageSync` 与 Web 的 localStorage 差别？**
   单 key ≤ 1MB、总量 ≤ 10MB；同步 API 有性能成本，量大要异步。有加密版本 `wx.setStorage` 的 encrypted 选项。

5. **支付流程？**
   服务器下单 → 微信统一下单接口 → 得到 prepay_id → 服务端签名（paySign）→ 下发参数 → `wx.requestPayment` → 用户输入密码 → 支付成功回调（异步通知）+ 前端 success 回调。**永远以后端收到的支付通知为准**，前端 success 只是提示。

6. **如何做到「未登录也能浏览，敏感操作触发登录」？**
   路由拦截 / 按钮点击前判断 `getToken()`；未登录弹 `wx.showModal` → 走登录流程；登录完成回调原操作。

7. **分包预下载（preloadRule）作用？**
   在`app.json` 里配：进入某主包页面时预下载指定分包，减少用户点击后等待。

8. **canvas 在新版小程序里怎么用？**
   使用 **同层渲染 canvas 2D**（`type="2d"`）；旧的 wx.createCanvasContext 已不推荐。2D 走 Web 标准的 CanvasRenderingContext2D。
