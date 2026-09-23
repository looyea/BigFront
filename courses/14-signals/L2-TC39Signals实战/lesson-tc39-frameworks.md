# tc39-frameworks：提案在各框架的近况——Angular / Preact / Vue / Svelte

> 目标：厘清容易被吹混的事实——谁对齐了语义、谁自成一派、谁只是长得像；建立『同一条 signal 宪法、四种地方自治』的认知框架（呼应 solid-overview、react-render-model、svelte-reactive-runes）

## 一、先立一张"事实防忽悠表"

面试和架构评审里关于 Signals 的鬼话密度极高，先把四家的真实状态钉死：

| 框架 | 现状 | 与 TC39 提案的关系 | 一句话纠偏 |
| --- | --- | --- | --- |
| Angular | Signals 已稳定可用（signal/computed/effect API），作为新默认心智推进 | **语义高度对齐，实现是自己写的** | "Angular 采用了提案代码"❌；"Angular 是提案阵营深度参与者"✓ |
| Preact | @preact/signals 独立库，.value 形态 | **同形派**，与提案互相影响（作者深度参与提案生态） | 它的绑定层对 Preact 是官方级集成，React 用户则需 signals-react 适配器 |
| Svelte 5 | runes（$state/$derived/$effect）全面落地 | **编译器变体**：语义同源，语法由编译器翻译成对底层 signal 的调用 | "runes 就是提案 API"❌，"runes 编译后跑的是 Svelte 自己的 signal 运行时"✓ |
| Vue 3 | ref/computed/watchEffect 早已成熟 | **自成体系**：早于提案成型，未跟进改名或对齐 | "Vue 支持 TC39 Signals"❌；"Vue 响应式与 signal 概念同构"✓ |
| Solid | createSignal 等原语（13 包主角） | **近亲兼血统**：提案部分作者出身 Solid 阵营 | "Solid 用了提案 polyfill"❌，语义同源、实现独立 |

判别模板：问任何"X 框架支持 Signals 吗"，拆成三层——**语义支持？**（惰性+自动追踪+glitch-free，大多✓）；**API 形状一致？**（各家拼法不同，大多✗）；**共享同一份代码/互操作协议？**（几乎全✗，interop 层在萌芽）。

## 二、Angular：最认真的"提案 implementations 派"

Angular 17 引入 signals、19 之后把它推成默认心智（signals-first）。API 形状：

```ts
import { signal, computed, effect } from '@angular/core';

const count = signal(0);
count.set(5);            // 方法式写
count.update((c) => c + 1);
const double = computed(() => count() * 2);   // 读是函数调用
```

三个要点：

1. **读写形态**：`count()` 读、`count.set/update` 写——和 Solid 的函数式读撞脸，但 Angular 的 signal 是类实例不是 getter 函数；
2. **与变更检测的婚姻**：Angular 传统靠 zone.js 脏检查全树扫描；signal 写入会**精确定向**通知标记脏的组件（zoneless 迁移的发动机就靠这个）——这是四家里"signal 改变框架渲染模型"最深的案例（呼应 react-render-model 的对比素材）；
3. **与提案的互动**：Angular 团队是 signal 阵营的重磅玩家，其 signal API 设计深度参与了提案生态的语义拉锯——"对齐语义、自持实现、反向输出"的典型。

## 三、Preact：@preact/signals，同形派的日常

```jsx
import { signal, computed, effect } from '@preact/signals';

const count = signal(0);
count.value++;                       // .value 读写
const double = computed(() => count.value * 2);

function P() { return <p>{double}</p>; }  // 组件里直接放 signal，绑定层自动解包+订阅
```

要点：`@preact/signals-core` 是**框架无关**的纯 signal 实现（约 4KB），浏览器、Node、React（经 @preact/signals-react）都能用；它对提案的贡献是证明了"同形 API 可以脱离任何框架活着"。风险面：signals-react 因绕过 React 渲染模型（在编译器配合下直接改 DOM 文本节点）曾与 React 团队公开争论——**绑定层怎么"骗过"宿主框架的 diff，是 signal 落地 React 世界最大的工程争议**（呼应 13 包 solid-signals 的细粒度更新）。

## 四、Svelte 5 runes：编译器代打

```svelte
<script>
  let count = $state(0);           // 看起来是普通变量
  let double = $derived(count * 2);
  $effect(() => document.title = String(count));
</script>
<button onclick={() => count++}>{count}</button>
```

真相：`$state` 经编译器变成对 Svelte 内部 signal 运行时的调用，`count++` 被编译成写 signal 的赋值语句。**语义是 signals 的，语法是编译器的**——所以 Svelte 不需要 `.value`、不需要 getter 括号。与提案关系：Svelte 团队参与提案讨论但保持编译器路线，"runes 即提案 API"是把两层说混了。

## 五、Vue：先来的那个不需要追认

Vue 3（2020）的 `ref`/`computed`/`watchEffect` 与提案三件套概念一一对应，但 Vue 的响应式是 Proxy 依赖收集体系（ reactive 对象、effect scope、nextTick 批调度），成型早、生态大，没有任何改名对齐的动机。尤雨溪在 signal 论战里的历史立场（13 包 solid-overview 提过）：概念上"signals 早就存在，Vue 就是其中之一"。对学习者反而是好消息：**会 Vue 响应式 ≈ 已掌握 signal 语义的 70%**。

## 六、互操作（interop）的现实与前景

提案的野心终章是让不同实现互相连通：`@reactively/mobx`、`@flowstat/signal`、signal-cookbook 生态里的适配器已在把 MobX/Solid/Preact signals 接进彼此。**今天的现实**：跨库共享一个 signal 实例仍需人工桥（一个库的 computed 包另一库的 signal）；**明天的前景**：若提案走到 Stage 2+，Symbol 协议统一后，"React 组件订阅 Angular signal"可能从杂技变成一行 `from()`。学习姿势：把语义学透，API 皮肤一周一换也不慌。

> 🚀 部署预告：本课四家代码全部可在线跑——Angular runkit、Preact+signals-core 的 CodePen、Svelte 5 playground、Vue 官方 tutorial。选型会前先让干系人各写同一个计数器 + 派生温度的小样，比读十篇对比文章都管用。
