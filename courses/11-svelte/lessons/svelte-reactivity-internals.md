# 响应式内核：信号、依赖图与调度

> 目标：打开 Svelte 5 的黑盒——`$state`/`$derived`/`$effect` 在编译后到底是什么；信号图的惰性求值、版本失效与微任务批处理如何运转；`untrack`/`$inspect` 两把调试钥匙；以及由原理直接推出的"失效坑清单"。学完这关，前 5 阶段的所有"规矩"都能被解释（呼应 svelte-reactive-runes、svelte-global-state、vue-reactivity-theory）。

---

## 一、编译后没有组件函数，只有一张信号图

Vue 的响应式建立在 **Proxy 依赖收集 + 渲染函数重跑**；React 建立在**事件触发重渲染 + diff**。Svelte 5 是第三条路：编译器把模板里**每个会变的表达式**编译成一个微型 effect，把 `$state` 编译成 source 信号——组件"函数体"只在初始化跑一次，之后运行的是这张图（呼应 svelte-overview 第二节、react-render-model）。

```svelte
<script>
  let count = $state(0);
  let double = $derived(count * 2);
</script>
<p>{double}</p>
<button onclick={() => count++}>+1</button>
```

编译后可视化为三层图：

```
count(source) ──► double(derived) ──► <p> 文本 effect
   ▲
   └─ onclick 里 count++ (write → 版本号+1)
```

`count++` 做的事：把 count 的**版本（version）自增**并向下标脏；`<p>` 的 effect 被排进队列；微任务时刻 flush——`double` 被**惰性拉取**重算（此时才读最新 count），文本节点更新。没有 VDOM、没有组件重渲染、没有 diff。

---

## 二、三条核心机制

1. **Push-Pull 混合**：写时沿图向下**推**"脏标记"（O(边数)、不计算），读时**拉**最新值（只算此刻真需要的 derived）。所以 `$derived` 惰性：模板没读它，就永不重算（呼应 svelte-reactive-runes 第二节）。
2. **微任务批处理**：同一tick里连点十次 +1，effect 只 flush 一次；`await` 之后/事件回调里的多次写也会被合并。要看**同步**最新 DOM，用 `import { flushSync } from 'svelte'`（少数场景：量 DOM 前）。
3. **相等性 = ===**：`obj.x = obj.x`（同引用）不会触发下游。改 `$state` 对象**必须换引用**（`list = [...list]`）或改到被代理的属性上；这就是 `untrack` 之外另一个"不响应"元凶（呼应 svelte-reactive-runes 深/浅层）。

---

## 三、untrack：显式断开依赖

effect 里读了什么就依赖什么，有时多余（只想"被 A 触发、顺带读 B"）：

```js
import { untrack } from 'svelte';

$effect(() => {
  a;                                   // 依赖 a
  untrack(() => console.log(b));       // 读 b 但不因 b 重跑
});
```

典型用途：effect 里调用**props 传入的回调**（回调对象每次父渲染换新引用，不 untrack 就会风暴重跑）；上报/日志。**副作用依赖越少越好**是通则（呼应 react-useeffect 依赖数组哲学）。

---

## 四、$inspect：runes 时代的 console.log

```js
$inspect(count);                       // count 变就打印
$inspect(count).with((c) => ({ c }));  // 自定义呈现(对象/分组)
$inspect.trace(() => { /* 谁改了谁 */ }); // 5.x:追溯一次写入惊动了哪些 effect
```

- 只在**开发模式**生效，生产自动剔除——放心留在代码里调试。
- 排查"为什么不更新"：在可疑表达式处 `$inspect(x)`，没打印=上游没变/依赖没建；打印了 UI 没变=模板读的不是同一个量。
- 对照：Vue 的 `watchEffect+console`、React 的"在组件体打 log"（Svelte 组件体只跑一次，打 log 看不到更新，必须 $inspect）。

---

## 五、由原理推出的失效坑清单

| 现象 | 原理 | 解法 |
|---|---|---|
| 改了对象属性不更新 | 引用未变,=== 短路 | 换引用或 `obj.field=` 直改被代理字段 |
| class 实例方法改 `this.x` 不响应 | 公开字段被代理可响应,但**构造时拷进闭包/私有 #field** 的不是信号 | 让实例只存数据,状态用 runes 包 |
| `$derived` 里 await/异步 | derived 必须同步纯函数 | 异步放 `$effect`,结果写 `$state` |
| 循环依赖报错 (cycle) | 图上 A→B→A | 用 `$derived.by` 显式断环或改结构 |
| effect 停不下来(自触发) | effect 写了自己读的 state | 写之前判等;或拆分状态 |
| 数组 push 不更新 | `$state.raw`/普通数组无代理 | `list = [...list, x]` 或用深 `$state` |

---

## 六、和三框架内核对照（面试压轴题）

| 维度 | Svelte 5 | Vue 3 | React 19 |
|---|---|---|---|
| 更新单元 | 信号→DOM 微 effect | 渲染函数(组件粒度) | 组件函数重跑 |
| 依赖收集 | 编译期定型+运行期读追踪 | Proxy getter 收集 | 无(AST 编译近似) |
| 派生 | $derived 惰性拉 | computed 惰性+缓存 | useMemo 手动缓存 |
| 批处理 | 微任务 flush | nextTick | 自动 batching |
| diff | 无 VDOM | 有(编译器优化 patch flag) | 全树 reconcile |
| 心智负担 | 依赖图画在哪要心里有数 | ref 解包心智 | 引用相等/依赖数组 |

一句话：**Svelte 把其他框架运行时做的事搬进了编译器**——代价是"编译期魔法"必须学它的黑话（runes），收益是运行时几乎为零。

---

## 七、自检清单

- [ ] 能画出 source→derived→effect 三层图并解释 push-pull。
- [ ] 知道 === 短路是头号"不响应"元凶,换引用是标准解。
- [ ] 会 untrack 断依赖、会 $inspect/.with/.trace 排查。
- [ ] 说得出 flushSync 的存在与适用场景。
- [ ] 能背出失效坑清单并给每条指到原理。

---

🚀 **下一关**：`svelte-lifecycle`——把"组件的一生"对齐到 Svelte 5：onMount 还留着、onDestroy 被 $effect 清理取代、tick 与 flushSync 的时机地图。
