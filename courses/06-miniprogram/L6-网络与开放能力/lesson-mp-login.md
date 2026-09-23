# 登录与授权

> 目标：小程序登录是**三方舞蹈**——小程序端、你的后端、微信服务器。核心链路只有一条：`wx.login` 拿临时 **code** → 后端拿 code+AppSecret 调 **code2session** 换 **openid/session_key** → 后端签发**自己的登录态**发给前端。记住一句话：**openid 和 session_key 永远不该出现在小程序端**（呼应 **exp-auth** 的 JWT 设计、**mp-network** 的 token 注入、**node-config** 的密钥管理）。

---

## 一、为什么登录长这样？

微信不提供"给你用户账号"，只提供"**这个微信账号在你这个小程序里的唯一指纹（openid）**"：

- **openid**：同一用户在你的小程序 A 里是 `o123`，在小程序 B 里是另一个值——**按 appid 隔离**；
- **unionid**：同一开放平台账号下多个小程序/公众号/App 归一的 ID（需绑定微信开放平台）——跨应用识别同一人靠它；
- **session_key**：微信发给**服务器**的会话密钥（解密用户数据用它），**绝不下发前端**、也不能给用户看。

所以登录的目的只有一个：**把你的用户表主键（uid）和 openid 绑起来，之后都用自己的登录态**。

---

## 二、标准链路（时序背下来）

```text
小程序端                     你的后端(Express)              微信服务器
1. wx.login() ──code────→
                           2. GET /sns/jscode2session
                              ?appid&secret&js_code=code
                              ────────────────────────→
                           3. ←─ openid, session_key, unionid?
                           4. upsert 用户表(openid→uid)
                              签发 JWT(含uid) / 生成 session
5. ←──────── 自定义 token ─┘
6. wx.setStorageSync('token')，此后请求头带 Bearer（mp-network 拦截器）
```

```js
// 小程序端
wx.login({
  success({ code }) {           // 临时凭证，5 分钟有效、只能用一次
    api.auth.login({ code }).then(({ token }) => {
      wx.setStorageSync('token', token);
      getApp().globalData.token = token;
    });
  },
});
```

```js
// Express 端（09 包技能全用上，呼应 exp-auth）
// 注意：AppSecret 只存服务端环境变量/配置中心（node-config），泄了=可伪造任意用户
const r = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${APPID}`
  + `&secret=${SECRET}&js_code=${code}&grant_type=authorization_code`);
const { openid, session_key, unionid } = await r.json();
// 错误码 40029(无效code)/45011(频率限制) 要处理；-1 系统繁忙可重试一次
const user = await Users.upsertByOpenid(openid, unionid);
res.json({ token: signJwt({ uid: user.id }) });
```

**高频追问：拿到 code 能不能直接换 openid 在前端做？** 技术上 wx.request 就能调那个接口，但只要域名进白名单谁都摸得到——**AppSecret 会泄、session_key 会泄**，官方文档明确禁止。"code 放前端换、token 回前端存"的每个环节都对应一条泄露面分析，这就是 exp-security 的边界思维。

---

## 三、头像昵称与手机号：三种"授权"别混

| 东西 | 获取方式 | 要用户同意吗 | 备注 |
|---|---|---|---|
| openid/unionid | 后端 code2session | 不需要 | 静默，登录标识 |
| 头像昵称 | **用户填写组件/chooseAvatar 能力**（`<input type="nickname">`、`<button open-type="chooseAvatar">`） | 用户主动填/选 | `getUserProfile` 已回收停用——别在代码里留死接口 |
| 手机号 | `<button open-type="getPhoneNumber" @getphonenumber>` 回传 **code/encryptedData+iv** | 弹官方授权框 | 后端换：新版 `phoneNumber.code` 调 `business.getuserphonenumber`；旧版 session_key 解密（历史包袱）；**非个人主体且认证满足条件才开通** |

演变要讲清（面试官爱听）：早期 `getUserInfo` 一点就拿 → 2021 收进 `getUserProfile`（点击触发）→ 2022 后连它也要"用户主动填写"——**头像昵称现在是"表单值"不是"授权结果"**，兜底文案/默认头像必须自己准备（呼应 mp-interaction 交互设计）。

---

## 四、隐私合规：2023 之后的硬前置

- `app.json` 配 **`__usePrivacyCheck__: true`**（新增强制趋势）+ 后台配置《隐私保护指引》并审核通过，否则 `wx.requirePrivacyAuthorize`/隐私弹窗不走、**涉及隐私的 API（位置/相册/手机号…）直接 fail**；
- 弹窗时机：**用户触发相关功能时**再弹（诱导式提前同意被打击），拒绝后要能"无隐私功能可用"地降级；
- 收集什么在指引里声明什么（超范围收集=驳回+通报），与后端日志脱敏一脉相承（呼应 exp-security）。

---

## 五、登录态的存储与失效

- token 存 `wx.setStorageSync`（同步、持久、重启可用；容量与敏感见 mp-storage），globalData 只做内存镜像；
- 失效链：拦截器 401 → 清 token → 跳登录页（带 redirect 参数，登录后 redirectTo 回原页——mp-route 的 redirect 主场景）；
- 冷启动策略：App.onLaunch 不强制登录，**懒登录**（进"我的/下单"等触点再触发）——转化率的工程细节（呼应 mp-lifecycle onLaunch 用途）；
- "退出登录"：清本地 token + 通知后端拉黑（JWT 无状态也要有登出语义，呼应 exp-auth 讨论）。

---

## 六、自检清单

- [ ] 画出登录五步时序，标出 code/session_key/openid 各自的位置。
- [ ] openid 与 unionid 的适用场景差异？
- [ ] 手机号授权的两种载荷（新版 code / 旧版加密数据）？门槛？
- [ ] getUserProfile 还能用吗？头像昵称现在怎么拿？
- [ ] 隐私协议没配好，最先出现什么症状？

---

## 🚀 部署预告

- 登录闭环 = 前端一次 code + 后端一次 code2session + 自己的 token 体系——微信只做"身份背书"，不做"会话托管"；
- 下一关 **mp-openapi**：支付（下单→requestPayment→回调对账）、分享、扫码/定位、订阅消息——"能力越大、审核越严"的开放接口全家桶（呼应 exp-rest 的状态机设计与 mp-publish 审核）。
