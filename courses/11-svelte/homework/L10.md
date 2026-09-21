# L10 课后作业：Web Components、手搓 SSR 与迁移工程（包收官）

> 本阶段关键词：customElement 双形态 / .element 手动注册 / props 跨界三规则（显式解构·type·reflect·attribute）/ on 前缀禁区 / $host / extend+ElementInternals / Shadow 四规则 / render() 两态返回 / hydrate 认领契约 / \u003c 转义纪律 / 水合不匹配两副面孔 / runes 逐文件判档 / $: 判型决策树 / sv migrate 半径 / 五步推广节奏。
> 判分口径：跨界协议题必须写清"哪一侧负责什么"（宿主/组件/编译器三方归位）；迁移题必须点出"静默行为变更"才算抓到本质；SSR 题涉转义必提风险模型（防什么攻击）。

---

## 一、Bug 找错（10 小题，指出根因并修）

1. `<my-widget>` 在宿主页面里 `el.name = 'x'` 死活不更新视图，组件内 `{name}` 却正常。组件脚本里写的是 `let props = $props()`。根因与修法。
2. 宿主写 `<my-widget max-length="10">`，组件 `let { maxLength } = $props()` 永远收不到值。两个独立原因各修一处。
3. `<my-widget ondone={fn}>` 的 fn 从不执行，但控制台没有报错。解释属性被谁"偷走"了，给两种改法。
4. 有人在自定义元素的 `{#if false}` 里放 `<slot />` 想省性能，结果 slotted 内容的定时器照跑。为什么？设计层面怎么救？
5. 设计系统全局 CSS 里的 `.btn-primary` 对 `<ui-button>` 内部无效，`shadow` 默认开着。给两种解法并说明各自牺牲了什么。
6. 同事把 SSR 输出的 body 用 HTML 美化插件"格式化"后上线，客户端大面积报水合错误。锚点机制解释事故链。
7. `window.__DATA__` 注入未做转义，渗透测试报告了一个存储型 XSS。构造一个最小 payload 证明你懂攻击面，再给修码。
8. dev 一切正常，prod 首页"每次闪一下"。给出与水合相关的根因假设与三步排查路径（不许答"清缓存"）。
9. 半迁移仓库里，legacy 宿主 `<Old on:change={fn} />` 包着已迁 runes 的 `<New>`，fn 静默失效。桥接为什么救不了这条边？按什么原则重切迁移批次？
10. `$: total = items.reduce(...)` 被 codemod 机械转成了 `$effect`，页面显示空白。`$:` 判型错在哪，正确出口是哪个？

## 二、手写题（5 题）

1. **跨界三件套**：写一个 `<stat-card>` 自定义元素：`value`（Number 型、attribute 名 `card-value`、开 reflect）、`items`（Array 型）；内部"刷新"按钮经 `$host` 外发 `refresh` CustomEvent；宿主裸 HTML 里用 attribute 传值并 addEventListener 接事件（两段代码都写）。
2. **表单公民**：用 `extend` 给 `<my-field>` 加 `static formAssociated` 与 ElementInternals，实现 `internals.setFormValue` 参与提交；说明为什么校验方法要写在 extend 类而不是组件里。
3. **手搓 SSR 全管线**：Express + `render()`（server 编译目标）输出完整 HTML：head 安置、body 进容器、数据注入含 `\u003c` 转义；客户端 `hydrate` 接棒。README 里写清"如果组件树引入顶层 await，你的服务端代码要改哪一行"。
4. **水合防御工事**：给一个含 `new Date().toLocaleTimeString()` 的组件做安全改造（SSR/CSR 两态都正确、不触发不匹配），并写一条最小复现测试说明 dev 下不匹配如何暴露。
5. **迁移映射表默写+扩列**：抄录本课六组映射后，再补三组本包其他课出现过的对位（`<svelte:component>`、style 指令 `class:`、`bind:this` 数组），每组标"codemod 半径内/外"并给一句理由。

## 三、场景评审（1 题）

某组件库负责人宣布："所有组件立即 WC 化 + 全部 SSR 输出，一套代码通吃所有宿主。"技术方案节选，逐条"采纳/拒绝/讨论"并说理（≤250 字）：

> A："全部 WC 化——框架无关是组件库的未来。"
> B："WC 组件全部走 render() SSR，首屏不吃亏。"
> C："props 一律 reflect: true，调试时 DOM 里能直接看状态。"
> D："样式双保险：shadow 开着 + 设计 token 全走 CSS 变量注入。"
> E："自家后台也是消费者，直接用 <my-widget> 标签在 React 里渲染，省一层适配包。"

## 四、简答题（3 题）

1. 默写 props 跨界协议三规则（含显式解构前提），各配一个"症状→病因"式排障句。
2. `render()` 返回值的"两态"是什么？`head`/`body` 各自由谁负责安置？hydrate 与 mount 的契约差异一句话。
3. runes 三档旋钮（true/false/'auto'）分别在迁移五步节奏的哪个节点使用？"单文件禁混用、跨文件随意混"各举一例。

## 五、挑战题 🏆

**给 L6 挑战题 VirtualList 做"对外输出包"**：①产出一个 `<virtual-list>` 自定义元素出口（height/items 显式解构 + type 声明 + bind:scroll 类交互改事件协议），配"跨界限制清单"README（slot 急渲染/context 断链各对应你组件里的哪个原语）；②同一组件再产出一个手搓 SSR demo（render + hydrate，数据注入走本关转义纪律），演示"同一发动机两种整车"；③`sv check` 零报错、两出口各有测试、WC 与 SSR 两条 README 判据段互不复制粘贴（能各说各的为什么）。交卷时附 200 字"本包 30 关知识地图里，这个组件用到了哪几层"。

---

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站（新开包 12-sveltekit）**：L1 从 `sveltekit-overview` 起——L8 引桥关画的地图正式起程：路由文件族、load 数据协议、表单 action 与服务端钩子。11-svelte 三十关至此满配收官。
