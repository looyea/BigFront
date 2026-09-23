# 手搓 SSR 与水合：render() 是发动机，Kit 是整车

> 目标：把 L8 引桥关欠下的账还清——不靠框架，用纯 Svelte 的 `render()` / `hydrate()` 从零搭一条 SSR 管线：服务端渲染 API 全签名、首屏数据注入与序列化纪律、水合不匹配的两副面孔，以及最常被追问的那句话："这些 Kit 都替你做了，那你为什么要学手搓？"（呼应 svelte-compiler-architecture 的 generate: server、svelte-sveltekit-bridge、07-nextjs/08-nuxt 的 SSR 章节。）

---

## 一、发动机：`render()` 到底给了你什么

```js
// server.js（Node 侧，与业务组件同仓）
import { render } from 'svelte/server';
import App from './App.svelte';

const { head, body } = await render(App, {
  props: { url: req.url, user: session.user },
  context: new Map([[sessionKey, session]]),  // setContext 的服务端入口
  idPrefix: 'app',                             // 组件内部 id 前缀（多实例防碰撞）
  csp: { nonce: res.locals.cspNonce }          // 给内联 style/script 发通行证
});
```

四个签名级事实，面试默写级：

1. **`render` 从 `'svelte/server'` 导入**（Svelte 4 时代它混在 `'svelte'` 里，v5 物理隔离——客户端 bundle 不可能意外打包服务端渲染器）；且**只在服务端 + 组件以 server 编译目标构建时存在**（L8 的 generate 三档位在此闭环）。
2. 返回 `RenderOutput = SyncRenderOutput & PromiseLike<SyncRenderOutput>`——**同步可用、可 await 的两态对象**：组件树里没有顶层 `await` 时直接解构 `body/head`；有异步组件就得 `await`（v5 的异步渲染让"SSR 流式/挂起"第一次成为一等公民）。
3. 字段是 `head` + `body`（`html` 是 `body` 的废弃别名，老教程里见到别慌）：`head` 收集所有 `<svelte:head>` 声明的 `<title>/<meta>` 字符串，**安置进 HTML 是你的责任**，不是它的。
4. options 里还有 `transformError`——和 `mount`/`hydrate` 同款（5.51+），SSR 期间抛错前统一加工错误对象。

服务端拿到 `body/head` 后塞进 HTML 模板：

```js
const html = `<!DOCTYPE html>
<html lang="zh">
<head>${head}</head>
<body>
  <div id="app">${body}</div>
  <script>window.__DATA__ = ${JSON.stringify(data).replace(/</g, '\\u003c')}<\/script>
  <script type="module" src="/build/client.js"></script>
</body>
</html>`;
```

这就是全部"框架"了——路由自己匹配、CSS 提取自己编排（server 编译目标的 `css` 输出）、404/重定向自己处理。**Kit 的 +page.svelte 全家桶 = 把这段样板工程化**，发动机一模一样。

## 二、客户端接棒：`hydrate()` 而非 `mount()`

```js
// client.js
import { hydrate } from 'svelte';
import App from './App.svelte';

const app = hydrate(App, {
  target: document.getElementById('app'),
  props: window.__DATA__   // 反序列化服务端注入的数据
});
```

`hydrate` 与 `mount` 同一族 API、唯一区别是**契约**：mount 对空容器"从无到有"；hydrate 面对已有 DOM，**只认领不重建**——事件、双向绑定、effect 全部挂到现成节点上，一个 `<div>` 都不重新创建。这就是 SSR 的钱花得值的地方：首屏 HTML 由服务端渲染（秒开、SEO），交互升级由客户端补（rehydration），中间**省掉一次完整渲染**的闪动与开销。

认领靠什么锚点？Svelte 5 的 SSR 输出里埋着**注释节点**（标记 if 块分支、each 块边界、文本片段切分点），hydrate 顺着锚点把模板和 DOM 一一对位。所以手搓 SSR 时**不要对 body 输出做任何"顺手美化"**——压缩合并空白、注入额外节点，都可能吃掉锚点。

## 三、数据注入的三条纪律

`window.__DATA__` 那行 `.replace(/</g, '\\u003c')` 不是强迫症，是**安全边界**：

1. **`<` 必须转义**——数据里混进 `</script>` 就能提前闭合标签，直接 XSS 注入点；
2. **JSON 装不下的东西别硬塞**——Date/Map/Set/大整数/循环引用，`JSON.stringify` 要么报错要么静默失真（Date 变字符串再变不回来）；Kit 用 devalue 序列化（保住这些类型+循环引用），手搓场景要么自己换协议要么数据层先归一化；
3. **注入即公开**——写进 HTML 的数据对查看源代码的任何人可见，session token 类敏感字段注入前必须裁剪，"服务端拿到"和"该给浏览器"是两个权限等级。

对应水合侧的隐含契约：**hydrate 的 props 必须和 render 时等价**。服务端 `{ user: {name:'A'} }`、客户端反序列化出语义不同的对象（比如 Date 变字符串），首次渲染输出不一致——直接滑进下一节。

## 四、水合不匹配：dev 一个炸雷，prod 一副冷脸

客户端首次渲染结果和 SSR HTML 对不上（hydration mismatch）：

- **开发环境**：抛错并高亮对不上的节点——这是你唯一能抓住它的时机；
- **生产环境**：Svelte 5 不会中断页面，**就地打补丁**（错位的节点重建、多余文本清除）——用户可能看到"闪一下""按钮错位""图片换了一张"，没人知道是水合干的。

高频病因清单（每条都对应真实事故）：

| 病因 | 例子 |
|---|---|
| 服务端/客户端渲染出不同分支 | `new Date()`、`Math.random()`、UA 判断直接写在模板表达式里 |
| 只有浏览器才有的依赖 | import 了操作 `window` 的库，模块顶层就执行（SSR 端 import 即炸或渲染出空） |
| 改写了 SSR HTML | CDN 的 HTML 优化插件吃掉注释锚点、手动 innerHTML 二次加工 |
| 数据序列化失真 | 上节的 Date/undefined 问题导致首帧 props 不等 |

防线下注：环境差异逻辑一律推到 `onMount`/`browser` 之后（SSR 期根本不跑）；数据在序列化协议上较真而不是在渲染层打补丁；上线前用 dev 模式对着生产 HTML 跑一次水合（错误暴露最充分）。

**它和 boundary 的分工**（L9 的地图补完）：boundary 接的是"渲染中抛出的错误"；水合不匹配是"渲染结果不一致"，不是异常流，boundary 管不到——两套心智模型别串线。

## 五、什么时候真的该手搓（判据收束）

- ✅ 老服务端（Express/Koa/JSP/PHP）里长出一个交互页，路由/鉴权/模板引擎都是现成的——只借 `render()` 当渲染发动机，不动存量架构；
- ✅ 极端性能审计：要逐字节控制 HTML、锚点、序列化协议，框架的中间层全是你要拆的；
- ✅ 学习/面试：说不清 hydrate 原理的人，在 Kit 里遇到 hydration 报错只能碰运气——L8 引桥题"render() 是发动机 Kit 是整车"的兑现；
- ❌ 新建全栈应用：路由、数据加载、流式、预取、代码分割的编排全是自己写——那是 Kit 五年工程化的答案（呼应 svelte-sveltekit-bridge 代价清单同款句式，方向反过来）。

## 六、自检清单

- [ ] 默写 `render()` 的导入路径、四个 options、返回对象的两个字段与"两态"含义。
- [ ] `hydrate` 与 `mount` 的契约差异一句话说清；锚点（注释节点）解释了为什么不能"美化" body。
- [ ] 数据注入三纪律：转义 `<` / 序列化能力边界 / 注入即公开。
- [ ] 水合不匹配的 dev/prod 两副面孔 + 病因表四条至少复述三条。
- [ ] 给出手搓 SSR 与上 Kit 的判据各两条。

---

🚀 **下一关**：`svelte-migration-legacy`——本包收官：Svelte 4 → 5 的迁移工程学，legacy 混跑策略、`$$slots`/`on:click`/`createEventDispatcher` 到 runes 的映射表、codemod 与团队推广节奏。
