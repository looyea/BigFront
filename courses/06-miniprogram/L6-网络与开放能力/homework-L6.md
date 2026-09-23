# L6 课后作业 · 网络与开放能力

> 覆盖：wx.request 封装与拦截器、登录链路与授权、支付/分享/订阅消息。共 5 段 20 题。

---

## 第一段 · 读代码找 Bug / 找问题（10 小题）

**1.** 真机预览一切请求全挂，开发者工具正常。最可能漏了什么配置步骤（两字域名相关）？

**2.** 这段封装的 Promise 有什么问题？（从 success/fail 语义角度）
```js
export const request = (opt) => new Promise((res) => wx.request({ ...opt, success: res }));
```

**3.** 登录代码被安全同学打回，指出两处严重问题：
```js
// 小程序端
wx.request({
  url: `https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}&secret=${SECRET}&js_code=${code}`,
  success: (r) => wx.setStorageSync('myToken', r.data.session_key),
});
```

**4.** 为什么这个"下单支付"逻辑可能重复发货？
```js
wx.requestPayment({ ...payParams,
  success() { shipUserOrder(orderId); }   // 直接发货
});
```

**5.** 支付回调 handler 收到两次相同通知、发了两次货。缺了什么机制？用什么数据结构/约束实现（提示：订单状态机）？

**6.** 下单接口传 `total: 19.9` 被驳回，为什么？正确写法？

**7.** 页面在 onLoad 里 wx.getLocation，正式版大量用户"定位失败"但没弹授权框，多半漏了什么声明链？

**8.** 用户反馈：换个手机登录后聊天记录丢了，且"手机号换了个登录方式又成一个新账号"。从 uid/openid/unionid 体系找原因。

**9.** 搜索页竞态 bug 复现：快速输入 "手"→"手机"，结果列表显示"手"的结果。给出两种修复（分别用 abort 和 seq）。

**10.** 订阅消息接口返回 43101，前端却从未调过 requestSubscribeMessage。解释这条链缺了什么环节。

---

## 第二段 · 手写编程（5 小题）

**11.** 补全 mp-network 第三节的 request.js：实现 401 拦截三连（清 token→navigateTo 登录页带 `redirect=当前页路由+参数`→reject），并在登录页登录成功后用 redirectTo 完成"回原页"闭环。写出登录页关键代码。

**12.** 实现"无感刷新"最小版：token 过期返回 401 且有 refresh_token 时，单飞刷新（并发多个 401 共享同一个刷新 Promise）、刷新成功重放原请求、失败走登出。伪码+关键 20 行。

**13.** 手写支付后端两段的职责清单与关键代码骨架：① Express 统一下单接口（金额分、落库待支付、调微信、签名参数返端）；② 支付结果通知接口（验签、幂等更新状态、应答 SUCCESS）。标注哪些密钥只能待在哪儿。

**14.** 给商品详情页加分享：onShareAppMessage 携带商品 id 与来源参数；处理"被分享者未登录直接落到详情页可浏览、点购买才触发登录"的懒登录流程（写 onBuyTap 的判断链）。

**15.** 封装 `uploadWithProgress(filePath)`：wx.uploadFile + onProgressUpdate 回调驱动页面进度条（路径更新 setData），失败重试一次（仅幂等），成功后 JSON.parse 响应并校验业务码。

---

## 第三段 · 场景题（1 小题）

**16.** 你是某电商小程序前端负责人，接入微信支付前的 Review 清单请逐项给出"检查什么、不合格后果"：① HTTPS/备案/白名单；② 金额链路；③ 订单状态机与幂等；④ 掉单兜底（回调+查单+对账）；⑤ 密钥管理；⑥ 退款流程；⑦ 沙箱/灰度策略（小额自购）；⑧ 资损监控告警。共 8 条，每条 2-3 句。

---

## 第四段 · 简答题（3 小题）

**17.** 登录时序五步默写，标出 code、session_key、openid、token 各自出现与停留的位置。

**18.** 头像昵称、手机号、定位三种授权各自的触发方式与门槛差异？

**19.** wx.request / uploadFile / connectSocket 三通道域名配置是同一份白名单吗？各说一条 API 独有注意事项。

---

## 第五段 · 挑战题 🏆

**20.** 设计"订阅消息中心"模块：① 模板注册表（后台模板 id → 字段映射器 → 触发场景枚举），杜绝散落的裸 tmplIds；② `askSubscribe(tmplKey)` 必须在用户手势里调用、结果逐模板回传后端记账（订阅余额表）；③ 发送前查余额、无余额走降级（站内红点）；④ 编写发货通知示例：后端队列在"支付成功"事件后取用户余额>0 的模板发送并扣账。写出端+服两侧接口定义与关键流程，并论述这个设计与 09-express 里"事件→副作用"分层、以及 mp-communication 总线模式的同构性。
