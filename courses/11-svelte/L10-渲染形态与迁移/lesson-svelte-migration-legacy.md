# Svelte 4 → 5 迁移实战：一代语法的安全拆除工程

> 目标：把前两册的"新旧对照"收拢成可执行的迁移方案——legacy 模式混跑的真实边界、`compileOptions.runes` 三档旋钮的逐文件用法、那张**必须亲手抄一遍的语法映射表**（`$$slots`/`on:click`/`createEventDispatcher`/`$:` → runes 家族）、官方 codemod 的能力半径，以及团队级推广的节奏设计（呼应 svelte-overview 第三节"两副面孔"、svelte-tooling 第三节编译器档位。）

---

## 一、混跑的地基：模式是"按文件"钉的，不是按项目

Svelte 5 运行时**原生支持 legacy 语法**——升级依赖不等于改语法。编译器对每个 `.svelte` 文件独立判定世界观：

| 档位 | 来源 | 行为 |
|---|---|---|
| `'auto'`（默认） | 逐文件探测 | 文件里出现任何 rune → runes 模式；否则 legacy 模式 |
| `true` | `compileOptions.runes: true` 全局钉死 | 所有文件 runes 模式，legacy 语法编译报错 |
| `false` | 全局或单文件 `<svelte:options runes={false} />` | 强制 legacy——迁移期的"豁免章" |

两条铁律：**单个文件内不允许新旧语法混用**（runes 模式的文件写 `on:click` 直接编译错误——L9 那道 svelte:window 题的事故原型）；**跨文件随意混**（runes 组件可以 import legacy 组件，props/事件在边界自动桥接）。所以"迁移"的本质是：让文件一个一个从旧世界观搬到新世界观，期间两种文件同仓共存——这是官方设计好的路径，不是权宜之计。

## 二、映射表：六组语法各就各位

迁移工作量 90% 集中在下表六组替换（左 legacy → 右 runes）：

| legacy | runes | 迁移注意点 |
|---|---|---|
| `export let count = 0` | `let { count = 0 } = $props()` | 可变 prop 要 `$bindable()` 且宿主 `bind:`——v4 的"prop 默认本地可改"在 runes 世界不存在 |
| `$: double = a * 2` | `let double = $derived(a * 2)` | `$:` 兼职两职（派生+副作用）必须人工拆开判型——codemod 判不准的地方 |
| `$: console.log(count)` | `$effect(() => console.log(count))` | effect 里回写响应式状态 = `effect_update_depth_exceeded`（L9 的环，迁移期高频复发） |
| `on:click={fn}` | `onclick={fn}` | 冒泡/捕获修饰符没了：`on:click|stopPropagation` → 函数体第一行 `event.stopPropagation()` |
| `createEventDispatcher` + `dispatch('change', d)` | 回调 prop：`let { onchange } = $props()`，调用 `onchange?.(d)` | 事件对象没了（没有 CustomEvent/detail）；宿主 `on:change` → `onchange` |
| `$$slots.footer` + `<slot name="footer">` | `let { footer } = $props()` + `{@render footer?.()}` | 宿主 `slot="footer"` 属性 v5 仍可用（snippet prop 糖）；`let:` slot 数据 → render prop：`<C>{(item) => ...}</C>` |

零头清单顺手收：`$$props/$$restProps` → `$props()` 解构 + rest 模式 `let { class: _, ...rest } = $props()`；`bind:this={array}`（v4 收集实例）→ 没了，回调 ref 模式；`<svelte:component this={X}>`/`<svelte:self>` → `<X/>` 直接渲染（L9 动态组件关已展开）；`beforeUpdate/afterUpdate` → 无对应物，用 `$effect`/`tick()` 重设计；style 指令 `class:active` → `class={active ? 'active' : ''}`（runes 模式编译器会警告）。**stores 不用迁**——`$store` 自动订阅在 runes 模式照常工作，这是官方给的缓冲带（迁完语法再考虑 L4 的 runes 化）。

## 三、codemod 的能力半径：`npx sv migrate svelte-5` 做什么、不做什么

官方迁移指南给的第一步就是它。做完的事：bump `package.json` 核心依赖到 v5；跑一组 v5 codemod 把**机械可判**的语法转换掉（`on:` → `onx`、`$:` 纯派生行 → `$derived`、slot → snippet 等）；改不动的留 `// @migration-error` 一类标注等你手工处理。

判据记住这条线：**"一行代码内可局部判定的替换"在半径内，"需要理解组件契约的改写"在半径外**。典型半径外：`$:` 双语义行（派生还是副作用？要读上下文）、`createEventDispatcher` 的完整事件协议改造（波及所有调用方）、accessor `export function` → `$derived` getter、测试里的 `component.$on()` 调用。所以 codemod 的正确姿势是"**加速器而不是自动驾驶**"：跑完必过 git diff 人工审 + `sv check` + 全量测试，三者缺一就是埋雷。

## 四、团队节奏：五步把 300 个组件搬过去

1. **地基**：全仓升 v5 运行时 + `svelte-check`/eslint 升级到识别 runes 的版本——此刻零语法变更，legacy 全绿跑，先把"升级"与"迁移"两个风险解耦；
2. **增量止血**：团队约定**新建文件一律 runes**（配 AI 模板/snippet）——存量不动，新法先落地，防止迁移期旧代码继续膨胀；
3. **批量搬运**：按"叶子组件→容器组件"拓扑序分批（叶子无子组件依赖，改坏了波及面最小），每批 codemod + 人审 + 合入——每批 PR 控制在可 review 的体量；
4. **钉子收口**：存量清零后 `compileOptions.runes: true` 全局钉死——此后任何人写回 legacy 语法在编译期就拦，防"迁了又漏回"；
5. **豁免清算**：残留的 `<svelte:options runes={false} />` 逐个立 issue 排期——豁免章是负债，全局钉死后每一枚都是明牌。

排期心法一句话：**迁移周期的敌人不是难度，是"半成品状态"的时长**——runes 档位钉得越早，双世界观维护期越短；前三步全绿就该有收口的日期承诺。

## 五、自检清单

- [ ] 说清 `runes: 'auto'` 的逐文件探测规则与"单文件禁混用、跨文件随意混"两条铁律。
- [ ] 默写映射表六组主干，各带一个迁移注意点。
- [ ] `npx sv migrate svelte-5` 的能力半径判据一句话（局部可判 vs 需理解契约）。
- [ ] stores 为什么可以不迁？缓冲带的代价是什么（双响应式体系并存到哪天算头）？
- [ ] 五步节奏里"解耦升级与迁移"和"钉子收口"各自防什么事故？

---

🚀 **下一站（本包收官）**：`12-sveltekit`——纯 Svelte 十层到顶，Kit 的地基你已经踩实：+page/+layout 文件族、load 数据协议、表单 action、服务端钩子，逐一把 L8 引桥关画的地图走成路。
