# 云开发与状态管理

> 目标：不是每个团队都养得起后端。**微信云开发**把"服务器"变成 SDK：云函数代替 Express、云数据库代替 MySQL、云存储代替 OSS+CDN——按量计费、免域名备案（正好绕开 mp-network 的白名单枷锁）。本课给出能力地图、与自建 Express 的对照决策，顺带收束"小程序状态管理"的选型（呼应 **09-express** 全包、**node-deploy-perf**、**mp-communication** 第五节）。

---

## 一、四件套能力地图

```js
// 小程序端直接用（app.json 配 cloud:true + wx.cloud.init）
const call = await wx.cloud.callFunction({ name: 'createOrder', data: { goodsId, num } });
const res  = await wx.cloud.database().collection('goods')
  .where({ onSale: true }).orderBy('sales', 'desc').limit(20).get();
await wx.cloud.uploadFile({ cloudPath: `avatar/${openid}.png`, filePath: tmp });
```

| 件 | 对应自建 | 要点 |
|---|---|---|
| 云函数 | Express 路由/Controller | Node 运行时的短函数，事件触发；`cloud.getWXContext()` **免登录拿 OPENID** |
| 云数据库 | MySQL/Mongo | 文档型（类 Mongo），**小程序端可直连读写**（靠安全规则把关） |
| 云存储 | OSS+CDN | 临时链接机制；上传免域名白名单 |
| 云调用 | 调微信官方接口的"免密钥通道" | 订阅消息/内容安全/小程序码——**不用管 AppSecret 与 access_token** |

"免域名白名单+免 Secret 管理"是云开发对独立开发者最实在的两项红利（mp-network 枷锁与 mp-login 密钥焦虑的另一种解法）。

### 权限模型：安全规则（云开发的"中间件层"）

```json
// database 集合规则示意：仅本人可读写自己的订单
"read": "doc._openid == auth.openid",
"write": "doc._openid == auth.openid"
```

规则写错=数据库裸奔（真实事故常客）；复杂校验一律挪进云函数——"端可直连是便利，边界要设在函数与规则"（呼应 exp-validation：永远不信任客户端）。

---

## 二、云函数 vs Express：一张诚实对照

| 维度 | 云开发 | 自建 Express（09 包） |
|---|---|---|
| 起步速度 | 分钟级，无运维 | 服务器/域名/备案/HTTPS 一套（exp-deploy） |
| 计费 | 按调用/GB 秒，闲置≈0 | 包月固定成本 |
| 冷启动 | 容器拉起数百 ms~秒（高峰预留并发可治） | 常驻无冷启动 |
| 生态绑定 | 锁微信（腾讯云可扩） | 云中立、多端复用 |
| 复杂逻辑 | 函数粒度拼接、本地模拟调试弱 | 任意架构/中间件/事务 |
| 团队规模 | 1~3 人全栈最优解 | 有后端团队的标配 |

**迁移焦虑**提前说：数据导出（db export）、逻辑重写（云函数≈无状态 Controller，改路由成本可控）——云开发不是单行道，但**重度关系型事务/复杂鉴权体系**会最先撞墙（呼应 node-deploy-perf 的架构演进讨论）。

### 云函数开发流

```text
tcb CLI / 开发者工具"云函数"面板：
cloudfunctions/createOrder/index.js + package.json
→ 右键上传部署（CI 可用 @cloudbase/cli 脚本化）
→ 日志/监控在云开发控制台（错误率、耗时、并发）
```

写云函数的手感 = 写 Express 的 handler：入参校验→查改数据库→返回结构体；区别是没有 req/res 洋葱，只有 `event/context`（呼应 exp-rest 的 handler 心智、exp-server 的中间件在哪层补——云函数内自己套校验函数）。

---

## 三、小程序状态管理：给这个包一个收尾答案

把 mp-communication 第五节展开成一张终版选型表：

| 规模 | 方案 | 依据 |
|---|---|---|
| 单页内 | data + setData | 别引入任何抽象 |
| 父子 | properties/triggerEvent | mp-component-comm 宪法 |
| 页间少量 | url 参数/globalData/事件总线 | 生命周期清晰 |
| 多页共享响应态 | mobx-miniprogram（或自研 30 行 store） | "订阅→自动 setData"机械补响应式缺口（呼应 mp-component-lifecycle 面试 8）|
| 跨端框架项目 | 直接用 React Redux/Zustand、Vue Pinia | 框架内你是"Web 工程师"（呼应 react-state-mgmt、vue-pinia）|
| 服务端状态 | 缓存层统一管（SWR 思路+Storage） | 与客户端状态分离（react-data-fetching 的核心教义在小程序同样成立）|

一句话心法：**小程序原生没有响应式，"状态管理"在它这里=订阅机制+setData 调度器的封装**——所有库都在补这一块。

---

## 四、自检清单

- [ ] 云开发四件套各对应自建栈的什么？两大"免"红利是什么？
- [ ] 安全规则写错会发生什么？复杂校验放哪？
- [ ] 冷启动问题在云函数怎么表现、怎么治？
- [ ] 什么需求一出现就该劝退云开发？
- [ ] "服务端状态 vs 客户端状态"在小程序怎么落地？

---

## 🚀 部署预告

- 后端形态定了（自建/云），最后一块拼图是"把它送上线给用户"；
- L8 收官关 **mp-publish**：调试工具链（真机调试/vSCode 插件/自动化）、审核规范与驳回自救、体验版-提审-发布-灰度全流程——本包的终点站，也是"学习闭环"的交付站（呼应 exp-deploy、react-deploy）。
