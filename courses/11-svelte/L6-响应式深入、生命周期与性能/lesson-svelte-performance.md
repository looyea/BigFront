# 性能：编译器红利之后的功课

> 目标：Svelte 的"运行时几乎为零"是**架构**红利，不代表你的应用自动快。这关讲四类真实瓶颈——大列表、昂贵的 `$state`、effect/派生滥用、包体积——与它们的解法，最后给一套测量流程。对照 react-performance、vue-performance 的同类清单（呼应 svelte-reactivity-internals、10-vite）。

---

## 一、先立基准：Svelte 天生快在哪

- 更新是**靶向**的：`count++` 只碰那个文本节点，没有组件重渲染、没有 diff（呼应 svelte-reactivity-internals 第一节）。所以 React 清单里的 `memo/useMemo 防重渲染` 类问题在 Svelte **基本不存在**。
- 没有 VDOM 内存、没有 reconcile CPU；历次框架跑分中启动与更新开销常年领先（呼应 svelte-overview 第一节的基准对比）。
- **但**：首包体积、DOM 节点总量、每帧工作量、代理开销——这些跟框架无关，Svelte 应用照样翻车。别把"框架快"当"我的页面快"。

---

## 二、大列表：DOM 才是主角

1 万行表格的瓶颈是**1 万个真实 DOM 节点**，不是响应式：

```svelte
<!-- 反例:无 key 的 each,中间插删会让后续行就地错位复用,组件状态串位 -->
{#each rows as r} <Row {r} /> {/each}

<!-- 正例:keyed,变化只移动/替换真正变了的行 -->
{#each rows as r (r.id)} <Row {r} /> {/each}
```

- **keyed each 是性能问题首先是正确性问题**：无 key 时中间插删会导致组件状态串行、input 值错位（呼应 svelte-template keyed 节、react-lists-keys）。
- 仍卡就上**虚拟滚动**：只渲染视口 ±缓冲行的窗口计算（`startIndex = floor(scrollTop/rowH)`），Svelte 实现一个 `<VirtualList>` 只需 `$state(scrollTop)` + slice 派生——比 React 版还简单，因为没有 re-render 担忧。
- CSS 侧：`content-visibility: auto` + `contain-intrinsic-size` 让屏幕外区块跳过渲染工作，零 JS 成本。

---

## 三、昂贵的 $state：代理也有代价

`$state` 深代理意味着**每个被读到的属性访问都过一层 proxy 并登记依赖**。几 MB 的配置/数据集丢进 `$state`：初始化全包代理、读取全打点，纯亏。规则：

| 数据形态 | 选择 |
|---|---|
| 只读的大数据集(字典/坐标表) | `$state.raw` 或干脆普通常量 |
| 不可变风格更新(整个换) | `$state.raw` + 每次换新引用 |
| 高频写入的数值(拖拽/rAF) | `$state.raw` 或局部变量+手动信号,避开代理 |
| 表单/小对象 | 深 `$state` 默认即可 |

派生侧：`$derived` 惰性+缓存，模板多处读同一派生只算一次；但**函数调用形式** `{fmt(x)}` 每个使用点各自成 effect——多处用就改 `$derived` 共享（呼应 svelte-reactivity-internals 第二节）。

---

## 四、effect 与模式滥用

- `$effect` 当"监听器"用是给别的 state 镜像值 → 多一次延迟与环路风险。派生值一律 `$derived`，effect 只做**和外界同步**（localStorage、第三方库、网络）。这是 L1 就立的规矩，性能视角下依旧成立（呼应 svelte-reactive-runes 自检清单）。
- effect 依赖太宽：把不参与副作用的读取包进 `untrack`，减少重跑频率（呼应 svelte-reactivity-internals 第三节）。
- 每次 state 变都新建大对象传给子组件？Svelte 没有"props 引用变化触发重渲染"的问题（读的是信号本身），**不必**学 React 的 useMemo 包对象——过度缓存反而增加开销。
- 动画掉帧：优先 CSS transition/`animate:`（合成器线程），JS spring 回调里别做重活（呼应 svelte-transitions-animations）。

---

## 五、包体积与加载：框架省下的要在依赖挣回来

Svelte runtime ~KB 级，但 `node_modules` 里的图表/日期库不会自己变小：

- 路由级 **code splitting** 由打包器白送——动态 `import()` + `{#await}`（呼应 svelte-component-composition 懒加载节、10-vite 分包）。
- 编译器会 tree-shake 未用 runes/helpers，但样式里的 `:global` 大库 CSS 照收不误——按需引入。
- hydration/首屏：SSR 字符串渲染本身快，注意别在 `<script>` 同步体做重计算（它在服务端每次渲染都跑，呼应 svelte-lifecycle 第四节）。

---

## 六、测量流程（先诊断后开方）

1. **Performance 面板**录一屏交互：长任务看脚本段归属；Svelte 编译产物函数名可读（`create_fragment`、effect 编号），别被吓到。
2. `$inspect` / `$inspect.trace()` 验证"一次写入惊动了谁"——更新面比预期大 = 依赖图接错（呼应 svelte-reactivity-internals 第四节）。
3. **Elements 面板**数节点总量——超过几千就查虚拟滚动/content-visibility。
4. `rollup-plugin-visualizer`（vite 配置一行）看包体构成——呼应 10-vite 分析课。
5. Lighthouse 定基线，改动后回归。

> 顺序铁律：**量 → 改 → 再量**。"Svelte 所以快"不是优化结论，是免检幻觉。

---

## 七、自检清单

- [ ] 能列出 Svelte 免疫的 React 类问题(memo 防重渲染)与不免疫的四类瓶颈。
- [ ] keyed each / 虚拟滚动 / content-visibility 三层列表方案会用。
- [ ] 会按数据形态选 `$state.raw`,知道深代理的代价。
- [ ] 清楚 effect 只做外界同步、untrack 收窄依赖、不必 memo 包对象。
- [ ] 能复述五步测量流程并说出 `svelte-reactivity-internals` 与本关的呼应点。

---

🚀 **下一关（L7 开篇）**：`svelte-typescript`——`<script lang="ts">` 的完整姿势：props 接口与泛型组件、runes 的类型推导、svelte-check 工具链。
