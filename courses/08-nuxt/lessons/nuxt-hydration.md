# 水合与同构陷阱：payload、hydration 与 ClientOnly

SSR 的浪漫是"秒出 HTML"，残酷在于同一棵组件树要在浏览器**原样重演一次**——演得不一致，React 叫 Hydration 报错（呼应 next-render-modes 第 3 节三步对账），Vue 叫 hydration mismatch。Nuxt 的坑位与 Next 高度重合，但工具链不同：这关把"两态一致"变成可操作的工程。

## 1. Nuxt 的水合在做什么

服务端渲染出 HTML 字符串 + 内联 payload（`<script>window.__NUXT__=...</script>`）；客户端 Vue 以 **hydrate 模式**挂载：不创建新 DOM，而是把现有 DOM 认领为组件实例的输出，同时用 payload 复原 useFetch 数据与状态。不一致的三大来源：

1. **双端条件渲染**：`v-if="window.innerWidth>768"` —— 服务端没 window（真值 undefined→渲染移动端分支），水合后浏览器重跑 setup 得桌面分支 → DOM 对不上；
2. **时间/随机数参与渲染**：`new Date().toISOString()`、`Math.random()` 进模板——首帧两端必然不同；
3. **浏览器扩展与文档改写**：翻译插件、密码管理器改 DOM，Vue 认领失败。

症状分级：轻微不一致 Vue 会**整棵子树回退客户端重渲染**（日志一条 mismatch warn，用户看到闪一下）；结构错位严重时页面直接花。生产 `checkHydration: 'hygiene'`（Nuxt 4 的 diff 工具）能在 dev 期打出两端 HTML 的差异报告。

## 2. 编译期分流：import.meta.client / server

```ts
if (import.meta.client) { /* 只有这分支的代码进浏览器包，SSR 构建时被静态消除 */ }
const ua = import.meta.server ? useRequestHeaders()['user-agent'] : navigator.userAgent;
```

这是 Nuxt 的**编译期常量**（Vite define 注入，呼应 vite-build 的常量替换）：条件块整段被 tree-shake，不依赖运行时判断。与"运行时嗅探 typeof window"的区别：前者构建期定生死、代码不进另一端产物；后者两端都在、只是取值时机不同——同构代码风格首选 import.meta 族。

时机铁律：`setup` 双端都跑（服务端一次、水合一次）；`onMounted` 只客户端；要"客户端才有的值"进渲染，走 ref + onMounted 赋值（首帧两端都渲染占位，天然一致）。

## 3. ClientOnly 与 lazy 的正确姿势

```vue
<ClientOnly fallback="<RecorderPlaceholder />">
  <AudioRecorder />   <!-- 内部可放心用 MediaDevices/window -->
</ClientOnly>
```

ClientOnly=跳过服务端渲染 + 用 fallback 占位保 CLS（骨架屏三标准的框架内建版，呼应 next-context-streaming 第 4 节）。两个克制原则：① 别拿它当"mismatch 止痛药"——包起来的根因若是第 2 节的渲染期时间戳，说明数据模型错了，改模型比包壳健康；② LCP 元素禁入 ClientOnly（服务端没输出、白屏等 JS，LCP 直接劣化，呼应 next-perf 第 2 节 ssr:false 副作用同源）。

组件级还有 `<Component lazy>`（异步 chunk，不进首屏包）与 `.client.vue` 后缀文件约定（自动仅客户端注册）——三者选最准的那个。

## 4. payload 的暗面：体积、过期与双源

payload 是为水合服务的"服务端快照"，三个衍生问题：

1. **体积**：useFetch 不设 transform/pick 就把整个 API 响应塞进 HTML——列表接口 2MB payload 拖慢 TTFB 的隐形成本（nuxt-perf 专治）；
2. **过期水合**：SSR 时数据生成、用户 10 分钟后才点进来，水合后的页面显示的是 10 分钟前的"现值"——需要新鲜感的配 `refresh: true` 或 isr 短窗，别让 payload 撒谎；
3. **双源真相**：payload 复原 + 客户端又刷一次 = 闪变；Nuxt 的 useFetch 默认水合期不重发（正是设计目的），要"每次都刷"是 `getCachedData` 显式策略（nuxt-usefetch 第 4 节）。

对照 Next：payload ≈ RSC Payload + Router Cache 的合体简化版——都回答同一个问题"服务端知道的东西如何无缝交给浏览器"（呼应 next-fetch-cache 第 2 节）。

## 5. 排查工具箱

- dev 终端 `[nuxt] hydration mismatch` warn 的组件路径直接给出嫌疑人；
- `experimental.checkHydration` / Nuxt 4 hygiene 模式输出两端 HTML diff；
- DevTools payload 面板 vs Vue 组件树并排看（水合值与现值分叉）；
- 二分法定位：页面上半注释法仍然好用——mismatch 组件挪进 ClientOnly 若消失，确认是它渲染期依赖了端态。

## 6. 自检清单

- [ ] 三大 mismatch 来源各举一例；
- [ ] import.meta.client 与 typeof window 的产物差异说得清；
- [ ] "客户端值进渲染"的标准流程：ref + onMounted；
- [ ] ClientOnly 的两个克制原则与 LCP 禁令；
- [ ] payload 三暗面（体积/过期/双源）各有对策。

## 7. 小结

水合一致性的本质是"同一棵树的两次演出用同一份剧本"：剧本里不能写只有观众才懂的黑话（window/Date/random），端态差异用编译期分流或挂载后赋值表达，实在藏不了才请 ClientOnly 上台。这套心法 Next 学了七成、这关补齐三成——同构世界的通用物理定律。

🚀 部署预告：概念层到此收官（L1-L3）。下一关进入数据主战场 nuxt-usefetch：三件套如何取数、何时缓存、payload 从哪来——本关第 4 节的问题将逐个根治。
