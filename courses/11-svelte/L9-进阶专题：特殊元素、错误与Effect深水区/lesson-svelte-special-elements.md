# 特殊元素与动态组件：模板层的"官方外挂"

> 目标：把 `<svelte:*>` 一族特殊元素系统性过一遍——window/document/body 的全局事件与绑定、`<svelte:element>` 动态元素、Svelte 5 里"动态组件终于不用特殊标签"的变化，以及 `<svelte:head>/<svelte:fragment>` 的复习与断代（呼应 svelte-template、svelte-events 的全局事件伏笔；<svelte:boundary> 单独开下一关）。

---

## 一、三兄弟：`<svelte:window>` / `<svelte:document>` / `<svelte:body>`

组件要监听"自己 DOM 之外"的事件，Svelte 4 时代的写法是 `on:keydown` 挂在特殊元素上；**Svelte 5 统一成小写 `on{event}` 属性**（与 L2 事件课的元素写法合流）：

```svelte
<!-- 目的：监听组件 DOM 之外的全局事件—Svelte 5 统一用小写 on{event} 属性 -->
<svelte:window onkeydown={handleKeydown} onresize={debounce(measure, 200)} />   {/* ✅ 挂 window：全局快捷键/响应式测量 */}
<svelte:document onvisibilitychange={pauseVideoWhenHidden} />   {/* ✅ 挂 document：页签隐藏时暂停播放 */}
<svelte:body onclick={closePopupIfOutside} />   {/* ✅ 挂 body：点击外部关弹层（随组件卸载自动清理，无需手动解绑） */}
```

三兄弟的分工按**事件目标**划：

| 元素 | 典型事件 | 典型需求 |
|---|---|---|
| `<svelte:window>` | keydown / resize / scroll / online | 全局快捷键、响应式测量、离线提示 |
| `<svelte:document>` | visibilitychange / pointerdown / fullscreenchange | 页签隐藏暂停播放、全屏状态 |
| `<svelte:body>` | mouseenter / mouseleave / click | body 级 hover 检测（mouseenter 不冒泡，挂 window 收不到）、**点击外部关弹层** |

"点击外部关闭"的标准拼图：`<svelte:body onclick={close}>` + 弹层根节点事件里 `event.stopPropagation()`——不用 `document.addEventListener` 手搓、也不用操心解绑（特殊元素随组件卸载自动清理，L6 生命周期纪律的免费版）。

**断代提示**：老教程的 `bind:online`、`on:keydown` 冒号语法在 runes 模式要么换写法要么进 legacy（映射表 L10 收口）；`<svelte:window>` 的可绑定清单随版本有增删（如 `bind:fullscreen/bind:viewport*` 族的新旧变化），**列全表请当场查官方文档**，本讲只钉高频三件：`bind:scrollY`（滚动进度）、`bind:innerWidth`（断点）、`bind:focus`（页签失焦暂停）。

```svelte
<!-- 目的：bind 全局量到本地信号—比 addEventListener+手动解绑+state 同步三件套短一个量级 -->
<svelte:window bind:scrollY={y} bind:innerWidth={w} />   {/* ✅ y/w 自动随滚动/缩放更新 */}
{#if y > 100}<ProgressBar top={y} />{/if}   {/* ✅ y 是响应式信号，驱动进度条显隐 */}
{@const isDesktop = w >= 1024}   {/* ✅ 块内局部常量，按宽度断点分叉布局 */}
<!-- ❌ 绑定即 $state 双向：写 scrollY 就是 window.scrollTo，别把它当只读派生去算，会互踩 -->
```

绑定即 `$state` 双向（写 `scrollY` 就是 `window.scrollTo`），比 `addEventListener + 手动解绑 + state 同步` 三件套短一个数量级——这就是"声明式挂全局"的存在意义。

## 二、动态元素：`<svelte:element this=...>`

标题层级不写死、按数据出标签——Vue 的 `<component :is>`、React 的 `const Tag = ...; <Tag/>` 在 Svelte 里的对应物：

```svelte
<script>
  // 目的：标题层级不写死—按数据出标签（this 接受合法标签名字符串）
  let { level = 2, content = '' } = $props();   // ✅ level 可变，h1~h6 都出得来
</script>

<svelte:element this={`h${level}`} class="title">   {/* ✅ level 变→换元素重建（身份切换语义，非就地改 tag） */}
  {content}
</svelte:element>
<!-- ❌ 拿它做"组件映射表"多态→错用工具，svelte:element 只管原生/自定义元素标签名，组件走下面的动态组件 -->
```

要点：`this` 接受**合法标签名字符串**（可响应式，变了就换元素重建——身份切换语义）；属性照常 spread `{{...restProps}}`；`this` 为 `null/undefined` 时渲染空。使用红线：多态的"组件映射表"别用 `svelte:element`（那是下面动态组件的活），它只管**原生/自定义元素标签名**。

## 三、动态组件：Svelte 5 把特殊标签送走了

Svelte 4：`<Thing />` 里 Thing 换了值也不会重渲染（编译期当静态），必须 `<svelte:component this={Thing} />`。Svelte 5 组件标签**本身响应式**：

```svelte
<script>
  // 目的：Svelte 5 组件标签本身响应式—Thing 换值自动换组件，不再需要 <svelte:component>
  import A from './A.svelte';
  import B from './B.svelte';
  let Thing = $state(A);   // ✅ 存的是组件引用，$state 让它可被换
</script>

<button onclick={() => (Thing = Thing === A ? B : A)}>换！</button>   {/* ✅ 点击切换 Thing 指向 */}

<Thing />                <!-- ✅ Thing 变了自动换组件，无需任何特殊语法 -->
<svelte:component this={Thing} />   <!-- ✅ 仍等价，存在意义是迁移期兼容（Svelte 4 必需） -->
<!-- ❌ 以为大写 <Thing/> 是静态标签、换值不重渲→那是 Svelte 4 的行为；5 里它已响应式 -->
```

小写点号语法补最后一块：**`<item.component {...item.props} />` 被当作组件**（Svelte 4 里这会创建名叫 `item.component` 的元素——行为换代，迁移注意）。于是"配置驱动 UI"的映射表写法变成：

```svelte
<!-- 目的：配置驱动 UI—小写点号 <item.component/> 被当作组件（Svelte 4 里会创建名叫 item.component 的元素） -->
{#each blocks as block (block.id)}
  <block.component {...block.props} />   {/* ✅ 按数据里的组件引用渲染，映射表喂进来即可 */}
{/each}
<!-- ❌ 在 Svelte 4 工程里写 <block.component/> → 它被当原生元素 <block.component> 标签，渲染不出组件 -->
```

对比记法：Vue `<component :is>` 保留特殊语法、React 靠大写变量天然动态，Svelte 5 向 React 的"表达式即组件"靠拢——**但保留了大写=组件/小写=元素的词法区分**（L2 模板规则的新用途）。

## 四、剩余成员清点：head / fragment / 与新一族

- **`<svelte:head>`**（L2 复习 + SSR 联动）：`<title>/<meta>` 声明在组件内，构建/SSR 时被收集进 HTML 头——L10 手搓 SSR 时 `render()` 返回的 `head` 字段装的就是它（呼应 svelte-compiler-architecture 第四节）；
- **`<svelte:fragment>`**：Snippet 时代给组件传"不被包裹元素"的内容块（L3 内容分发的补丁位：`{#snippet}` 直接命名，fragment 用于"我要占位但不想要 div"）；
- **`<svelte:boundary>`**：错误与 pending 边界，本阶段下一关专关；
- **`<svelte:options>`**：编译器指令（`runes`、`customElement`），工具链与 L10 各见过一半，迁移课合拢；
- 模板层新元素族（`setContext/render` 等）随 5.x 小版本持续演进——**面试被追全表时的正确话术：报出稳定核心 + 声明版本敏感**（README 技术事实守则）。

## 五、自检清单

- [ ] window/document/body 三兄弟各举一个"只有挂它才收得到"的事件（含 mouseenter 不冒泡那条）。
- [ ] 写出点击外部关弹层的两行拼图，说明为什么不用手搓 addEventListener。
- [ ] `<svelte:element this>` 的 `this` 传什么、变了什么语义、红线在哪。
- [ ] 说清 Svelte 4→5 动态组件的语法换代（含点号小写新规则）。
- [ ] `<svelte:head>` 的内容在 SSR 产物里去了哪。

---

🚀 **下一关**：`svelte-error-boundary`——特殊元素族里最年轻也最能打的 `<svelte:boundary>`：渲染炸了怎么只塌一角不塌全站，pending snippet 怎么白捡一个 loading 态。
