# 开放接口：支付、分享、设备与消息

> 目标：小程序的"超能力"来自微信开放的 API 面——支付、分享、扫码、定位、订阅消息。每个能力都是**三方协议**（端 API + 后端接口 + 平台配置/资质），面试考察的恰恰是链路完整度与状态机意识（呼应 **exp-rest** 的状态设计、**mp-login** 的凭证链、**mp-publish** 的审核规则）。

---

## 一、微信支付：一条"必须有后端"的链路

支付不可能纯前端完成——**商户密钥永远不下发端**。链路（JSAPI/小程序支付）：

```text
① 端：下单 → 你的后端创建订单（状态=待支付）
② 后端：调微信支付 API（需商户号 mchid + APIv3 密钥/证书）统一下单，拿 prepay_id
③ 后端：用 prepay_id 组装并签名 paySign，返回端上
④ 端：wx.requestPayment({ timeStamp, nonceStr, package, signType:'RSA', paySign })
      → 微信收银台 → 用户输密 → 端上 success/fail 回调
⑤ 微信服务器 → 你的后端**异步回调**（验签！）→ 订单状态=已支付
⑥ 端：不要信 ④ 的 success 就发货——以 ⑤ 回调/主动查单为准再刷新 UI
```

四个必考点：

1. **端回调 ≠ 支付成功**：requestPayment 的 success 只代表"用户完成了付款动作"，掉单（回调未到）必须靠**异步通知+主动查单+对账**三重补（幂等！同一订单多次回调只处理一次——exp-rest 幂等设计的付费实战）；
2. **金额单位是分（整数）**：`total: 1990`——浮点从进链路那刻就该死掉（呼应 es-number 的 0.1+0.2）；
3. 退款/撤销同样是后端 API+回调，没有前端入口；
4. 资质：企业主体+微信支付商户号+类目匹配，个人主体小程序**不能**收款（虚拟支付另有更严禁令）。

---

## 二、分享：两条线，别忘了新页面

```js
// ① 转发给好友/群（右上角菜单或页面内 button open-type="share"）
Page({
  onShareAppMessage() {
    return { title: '限时五折', path: '/pages/goods/goods?id=42', imageUrl: '/img/share.png' };
    // 群场景可带 promise 选项做"分享后解锁"？——诱导分享违规，别打这主意（呼应 mp-interaction 面试10）
  },
  // ② 分享到朋友圈（基础库 2.17.3+，需页面允许）
  onShareTimeline() { return { title: '会场', query: 'id=42' }; },
});
```

- 分享的本质是**带参数打开指定页面**——被分享者冷启动直接落在 path 上：该页必须**自治**（自己拉数据，不能依赖"上一跳页面内存"，呼应 mp-communication 面试 12）；onLoad 的 query 要防御性校验（分享链接可被转发无数手）；
- 进入方式记录在 `App.onLaunch/onShow options.scene`（1007/1008 单聊群聊…）——运营归因的数据源（呼应 mp-lifecycle scene）；
- 卡片图 5:4；未配置 onShareAppMessage 的页面右上角转发是灰的。

---

## 三、设备与环境能力速览

| 能力 | API | 关键点 |
|---|---|---|
| 扫码 | `wx.scanCode` | 调起微信扫码界面，结果回端；相册识码也支持 |
| 定位 | `wx.getLocation` | **需后台申请开通+隐私协议声明**；GCJ-02 坐标系；小程序用高德/腾讯地图 SDK 走 key 管控 |
| 蓝牙 | `wx.openBluetoothAdapter` 系列 | 扫描→连接→服务/特征值读写；断连事件必监听；Android/iOS 差异大，真机测试无捷径 |
| 图片/视频 | `wx.chooseMedia`（chooseImage 旧） | 拿 tempFiles 本地临时路径→接 uploadFile（mp-network） |
| 剪贴板 | `wx.setClipboardData` | **读**剪贴板属隐私接口，需同意（10.28 后收紧） |
| 收银之外 | `wx.makePhoneCall`、`wx.openDocument` | 文件先 downloadFile 到临时路径再 open |

原则：**设备能力=权限+降级**。定位失败给手动选城市、蓝牙不可用给教程文案——"能力按需"既是体验也是审核（无场景调用敏感能力=驳回）。

---

## 四、订阅消息：一次性、长期、设备三类

小程序没有"推送自由"——**模板订阅消息**是唯一官方触达通道：

```js
// 端：在用户主动行为里申请（点击按钮时调，别在 onLoad 裸申请）
wx.requestSubscribeMessage({
  tmplIds: ['TEMPLATE_ID_xxx'],   // 后台"订阅消息"里挑模板，字段严格对位
  success(res) { /* 逐模板 accepted/rejected/ban 状态 */ },
});
```

```js
// 后端：用户同意后，凭 openid+模板id 调 subscribeMessage.send
// 一次性订阅=同意一次发一条（量=用户授权次数）；长期仅特定类目（政务/医疗）；设备订阅=硬件场景
```

三条军规：① 发送时机与模板语义一致（"发货通知"模板发促销=违规，扣分封能力）；② 数据结构 `data: { thing1: { value }, amount2: {...} }` 字段名类型严格（thing 限 20 字符等截断规则）；③ 授权是消耗品——在"支付成功页"顺手请求订阅比弹窗轰炸转化高（呼应 mp-interaction 强度选型）。

---

## 五、能力全景的代价表

| 能力 | 资质 | 配置 | 审核敏感度 |
|---|---|---|---|
| 支付 | 企业+商户号 | 后端证书/密钥 | 交易类目不符直接驳 |
| 分享 | 无 | 代码钩子 | 诱导分享驳回高发区 |
| 定位 | 个人可申 | app.json permission+用途说明+隐私协议 | 无场景调用必驳 |
| 订阅消息 | 无（类目限长期） | 后台选模板 | 内容滥用封接口 |
| 蓝牙/NFC | 无 | 声明 requiredPrivateInfos（部分） | 低 |

**声明文化**是小程序独一份：`app.json` 的 `permission`（用途文案给用户看）、`requiredBackgroundModes`、`requiredPrivateInfos`——代码没写声明，API 直接不可用；声明写得比实际用途宽，同样被打回（呼应 mp-directory 的 json 配置观、mp-publish）。

---

## 六、自检清单

- [ ] 支付六步里，哪一步才是"业务上的支付成功"？为什么？
- [ ] 分享出去的页面，对"页面自治"提出什么要求？
- [ ] getLocation 前三道门槛？
- [ ] 一次性订阅消息的"量"从哪来？什么时候申请转化最高？
- [ ] app.json 里 permission 和 requiredPrivateInfos 各管什么？

---

## 🚀 部署预告

- L6 收官：request 打天下、login 定身份、openapi 放大招——小程序从"能看"变成"能做生意"；
- 下一站 **L7 存储、分包与性能**：先从 **mp-storage** 讲本地数据——10MB 的 Storage 怎么用好过期与加密，与 globalData/后端三方博弈（呼应 vue-pinia 持久化、node-config 分层）。
