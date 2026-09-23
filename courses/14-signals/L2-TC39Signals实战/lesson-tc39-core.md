# tc39-core：signal / computed / effect——提案核心三件套

> 目标：把 TC39 Signals 提案的 API 形态与执行语义一次说清，并把它和 Solid/Svelte/Vue 各家实现的关系钉死（呼应 solid-signals、svelte-reactive-runes、vue-computed-watch）

## 一、先把期望校准：提案标准化了什么

TC39 有一个信号（signal）提案 `proposal-signals`（仓库 signaljs/proposal-signals），当前处于 **Stage 1**。它标准化的不是"浏览器哪天内置一个全局 `signal()` 函数"，而是三件事：

1. **API 形态**：`signal()`、`computed()`、`effect()` / `effect_scope()` 这一组原语的调用形状；
2. **响应语义**：读到即订阅、写下即传播、computed 惰性且即时一致（glitch-free）；
3. **互操作契约**：不同库的 signal 实现之间可以互相读取、互相组合（通过 `Signal` 统一接口）。

也就是说：**提案先是一场"语义统一运动"，语言级内置是很遥远的第 0 步**。参照实现已经以 npm 包 `signal-polyfill` 存在——它就是"如果今天就要用提案形状的代码"的答案，全量约 8KB、零依赖。

## 二、三件套逐个过

### signal()：一个带通知功能的容器

```js
import { signal } from 'signal-polyfill';

const count = signal(0);
count.get;        // 读：0（注意 polyfill 用 .get 属性，提案讨论中也有 count() 调用形态）
count.set = 1;    // 写：1
```

signal 就是一个"当下值"容器：任何时刻它代表且只代表一个值，读它拿快照，写它触发通知。对比 `let count = 0` 的差别只有一件事——**别人能知道它变了**。（L1 sig-paradigms 里的"寄存器"比喻在这里落地：寄存器永远存着当前值，而不是回放历史。）

### computed()：惰性推导，无人读则不算

```js
import { signal, computed } from 'signal-polyfill';

const a = signal(1);
const b = signal(2);
const sum = computed(() => a.get + b.get);

sum.get;          // 第一次读：执行函数，得 3，并登记依赖 a、b
a.set = 10;       // 只把 sum 标脏，不执行任何函数
a.set = 11;       // 再标一次脏，仍然不执行
sum.get;          // 有人读了：重算一次，得 13
```

三个必须刻进肌肉记忆的点：

- **推标记、拉计算**：写操作只传播"脏"标记，真正的重算发生在下一次读（L1 已埋此概念，这里是提案级实现）；
- **依赖自动追踪**：`computed` 函数体里"读到了谁"就依赖谁，不需要手写依赖数组（对比 `useMemo` 手动 deps 的经典漏写事故）；
- **即时一致（glitch-free）**：同一次事件里连续写 a、b 三次，中间任何时刻去读 sum，要么拿到旧值要么拿到最终值，**绝不会读到"a 新 b 旧"的半更新瞬间**。

### effect()：把响应式世界接到命令式世界

```js
import { signal, computed, effect } from 'signal-polyfill';

const name = signal('world');
const greeting = computed(() => `hello ${name.get}`);

const stop = effect(() => {
  console.log(greeting.get);   // 立即执行一次打印 hello world，并订阅 greeting
});
name.set = 'signals';          // 自动打印 hello signals
stop();                        // 手动退订，之后不再打印
```

effect 是响应式系统与"会副作用的外部世界"（DOM、日志、网络）之间的唯一出口：**effect 里读到谁，就订阅谁；谁变了就重跑**。注意 effect 里的读取是真订阅，computed 里的读取是建依赖图——两者机制相同但下游行为不同（一个重算值，一个跑代码）。

## 三、和各家实现的对应关系

| 库 | 三件套形状 | 与提案的距离 |
| --- | --- | --- |
| SolidJS | `signal()` 返回 getter 函数、`createComputed`、`createEffect` | 语义几乎同源（提案部分作者来自 Solid 阵营），调用形态不同 |
| Preact | `@preact/signals`：`signal()` 的 `.value`、`computed`、`effect` | 同形派，最接近提案精神的 npm 实现 |
| Svelte 5 | `$state` / `$derived` / `$effect` runes | 语义对齐、语法走编译器（呼应 svelte-reactive-runes） |
| Vue 3 | `ref` / `computed` / `watchEffect` | 自成体系在先，概念同构、API 不同（呼应 vue-computed-watch） |
| signal-polyfill | `.get` 属性 / `computed` / `effect` | 提案的参照实现 |

一句话记法：**大家早已各写了各自的 signal，提案要做的是把"语义宪法"写成一份，让 ecosystem 停止各自解释**。这也是为什么面试被问"Signals 提案是不是还没落地"时，得分答法是"落地了 Stage 1 与互操作语义，语言内置无时间表，但 polyfill 今天可用"（L1 sig-landscape 钟摆规律的延续）。

## 四、动手锚点：60 秒玩具实现

提案语义的最小骨架其实只有这么多（L9 sig-internals 会完整写一遍，今天先感受）：

```js
function miniSignal(v) {
  const subs = new Set();
  return {
    get: () => { if (cur) subs.add(cur); return v; },
    set: (nv) => { v = nv; subs.forEach((f) => f()); },
  };
}
```

读到登记、写到广播——signal 的内核 60% 就是这个，剩下的 40%（惰性、脏标记、glitch-free）全是为了处理"computed 套 computed 的图"而生的调度层。

## 五、常见误区三连

1. **"用 @computed/@effect 装饰器那套"**——那是 MobX 的语言扩展路线，和提案形状是两回事（MobX 后来提供了 `@reactively/mobx` 互操作层向提案靠拢，L4 mobx-core 见）；
2. **"signal 会取代 Redux"**——提案管的是原语层，Redux/Zustand 管的 store 组织与中间件生态根本不在一层（L5、L6 sig-scenarios 会给出分层结论）；
3. **"effect 里 setState 随便写"**——effect 无约束循环写入会把依赖图变成死循环，这是所有 signal 实现共同的自伤姿势（tc39-control 给治理手段）。

> 🚀 部署预告：本课的 signal-polyfill 可以直接在任意构建工具链里 `npm i signal-polyfill` 跑通，无需等任何浏览器版本——把它放进 CodePen 或本地 Vite 沙盒（呼应 10-vite 包）做实验是零成本的。
