# react-custom-hooks 面试题精选

> 共 15 题，覆盖 A 自定义 Hook 本质 / B Rules of Hooks / C 返回值与组合 / D 与 Vue composable·SSR 对照四类。

---

## 一、自定义 Hook 的本质（A 类）

### 1. 什么是自定义 Hook？它和普通工具函数的区别在哪？

**答**：自定义 Hook 是**名字以 `use` 开头、内部可以调用其它 Hook** 的函数，用来把一段"有状态逻辑"（订阅 state + 副作用 + 派生值）抽出来复用。和普通工具函数的根本区别：工具函数是纯计算、不碰 React 的渲染生命周期；而自定义 Hook 内部依赖 `useState`/`useEffect` 等，必须**在组件渲染或另一个 Hook 调用期间**执行，它的状态是挂在调用它的组件实例上的。`use` 前缀不是语法强制，而是让 ESLint `rules-of-hooks` 和阅读者都能识别"这个函数里在用 Hook，不能随便调"。

**来源**：React 官方文档 — Built-in Hooks、Always use Hooks at the top level of your React function、Dan Abramov — Introducing Hooks

### 2. 自定义 Hook 会创建新的状态吗？多个组件调用同一个 Hook 会共享状态吗？

**答**：不会共享。每次在**某个组件**里调用一个自定义 Hook，得到的都是**该组件独立的一份状态**——Hook 只是把对 `useState`/`useEffect` 的调用"内联"进那个组件，本质上和你在组件里手写这些 Hook 等价。两个组件调用 `useCounter()` 各自维护各自的计数。想让逻辑跨组件共享单例，不能靠"再多调一次 Hook"，得借助 Context 或外部 store（`useSyncExternalStore`）。

**来源**：React 官方文档 — Hooks Rules、Built-in Hooks

---

## 二、Rules of Hooks（B 类）

### 3. Rules of Hooks 的两条铁律是什么？为什么必须遵守？

**答**：① **只在顶层调用**——不要在 `if`/`for`/`try`/嵌套函数/条件 return 里调用 Hook；② **只在 React 函数里调用**——组件函数或自定义 Hook 内，不要在普通 JS 函数、类组件方法里调用。原因：React 为每个组件维护一条按**调用顺序**排列的状态链表，第 N 个 `useState` 对应第 N 槽。一旦某次渲染少调或多调了一个 Hook（因为被条件包裹），顺序错位，状态就张冠李戴。正确做法是**把条件写进 Hook 内部**（如 `useState(cond ? a : b)`），而不是把整个 Hook 包进条件里。ESLint 插件 `eslint-plugin-react-hooks` 能在编译期抓这类违规。

**来源**：React 官方文档 — Rules of Hooks、eslint-plugin-react-hooks

### 4. 如果确实想"有条件地"用一个 Hook，怎么办？

**答**：不要 `if (x) { useState() }`，而是让 Hook **无条件被调用**，把判断挪进去：例如把要开关的逻辑封装成自定义 Hook，内部始终调用底层 Hook，只在返回时用条件决定暴露什么；或者用 `enabled` 参数（如 `useQuery(key, fn, { enabled })`）由 Hook 内部消化开关。核心是"调用次数和顺序在每次渲染里恒定"。

**来源**：React 官方文档 — Conditional automatically、Escape Hatches from Rules of Hooks

### 5. 为什么自定义 Hook 也必须以 use 开头？不遵守会怎样？

**答**：这是**约定 + 静态检查的锚点**。ESLint 的 `rules-of-hooks` 正是靠函数名以 `use` 开头来判定"这是一个 Hook 函数，允许它内部调用 Hook"，并据此递归检查其调用是否合法。若命名不规范（比如叫 `getCounter()` 却在里面调 `useState`），Lint 会报错、调用方也无法识别它受 Rules 约束，容易在条件/循环里误用。名字本身不影响运行时，但影响工具链与可读性。

**来源**：React 官方文档 — Custom Hooks、eslint-plugin-react-hooks

---

## 三、返回值设计与组合（C 类）

### 6. 自定义 Hook 返回值用「对象」「元组」「单值」各有什么取舍？

**答**：
- **单值**（`const w = useWindowWidth()`）：最简单，适合只产出一个值；
- **元组**（`const [n, setN] = useX()`）：仿 `useState`，位置解构、简洁，但字段一多就难记顺序；
- **对象**（`const { on, toggle } = useToggle()`）：命名清晰、后续增删字段不破坏调用方解构，是多数业务 Hook 的首选。

经验：只有一个值用单值，模仿内置 Hook 语义用元组，可能扩展出多个状态/动作就用对象。

**来源**：React 官方文档 — Custom Hooks、Dan Abramov — Introducing Hooks

### 7. Hook 内部返回的函数/对象要注意什么性能问题？

**答**：函数每次渲染都是新引用，如果直接把它传给 `React.memo` 子组件或放进依赖数组，会导致 memo 失效/依赖频繁变化。所以内部用 `useCallback` 稳定函数、用 `useMemo` 稳定对象，再返回出去（呼应 react-memo-hooks）。`dispatch` 类函数天然引用稳定。返回值的稳定性是"自定义 Hook 能否被优雅消费"的关键。

**来源**：React 官方文档 — useCallback、useMemo、When to memoize

### 8. 什么是「组合 Hook」？为什么说它取代了 mixin 和高阶组件？

**答**：组合 Hook 指一个自定义 Hook 内部调用别的自定义 Hook，层层拼装（如 `useCounter` 内部用 `useLocalStorage`）。相比 mixin：mixin 有命名冲突、来源不透明（不知道某方法从哪来）的问题，而 Hook 是显式调用、局部作用域、无冲突。相比 HOC：HOC 会包裹组件形成嵌套的"组件地狱"、需约定 props 名透传，而 Hook 直接在组件函数里调用、逻辑扁平可读。所以"复用有状态逻辑"官方首推自定义 Hook。

**来源**：React 官方文档 — Composing Hooks、Dan Abramov — Higher-Order Components vs Recomposition

---

## 四、与 Vue composable / SSR 对照（D 类）

### 9. React 自定义 Hook 与 Vue 3 composable 理念和差异分别是什么？

**答**：理念几乎一致——都是把"有状态逻辑"从视图抽成可组合的函数。差异在更新与状态归属：
- **触发更新**：React Hook 返回**新值**，靠组件重渲染；Vue composable 返回 `ref`，改 `.value` 靠响应式依赖追踪更新；
- **状态归属**：React 每次在某组件调用 = 该组件一份独立状态；Vue 若把 `ref` 提到**模块作用域**，则天然成为跨组件**共享单例**；
- **约束**：React 必须守 Rules of Hooks（顺序即身份）；Vue 在 `setup` 里同步调用即可，相对宽松。

要在 React 做"共享单例"，得靠 Context/store，而不是简单地把状态提到模块顶层（会串）。

**来源**：Vue 官方文档 — Composables vs Hooks、React 官方文档 — Hooks Rules

### 10. 自定义 Hook 里访问 `window`/`localStorage` 为什么在 SSR 下会炸？怎么写才安全？

**答**：服务端渲染阶段没有浏览器全局（`window is not defined`），若在 Hook 顶层同步读 `window`/`localStorage`，SSR 直接抛错、并造成水合不一致。安全写法：① 放进 `useEffect`（只在客户端跑）；② 用 `typeof window !== 'undefined'` 守卫；③ 初值用惰性函数并给服务端一个合理的 `getServerSnapshot`（呼应 react-advanced-hooks、vue-ssr-nuxt）。

**来源**：React 官方文档 — Hooks、Next.js — Avoid Hydration Mismatch、MDN — Window

### 11. 为什么不能在自定义 Hook 里用模块级可变变量存"当前用户"这类状态？

**答**：模块级变量在整个进程/ bundle 里只有一份。客户端还好，但 SSR 是多请求共享同一模块作用域，会把不同用户的数据串到一起（数据越权），且它不受 React 渲染调度、改了也不会触发重渲染。有状态就该放 `useState`/`useReducer`/store，并保证每请求隔离（呼应 vue-pinia-advanced 的每请求新实例）。

**来源**：React 官方文档 — Rules of Hooks、Next.js — Server Components、Vue 官方文档 — SSR 状态隔离

### 12. 面试里如何回答"你会把什么逻辑抽成自定义 Hook"？

**答**：给出判断标准而非死记：① 一段逻辑在**多个组件**里重复（订阅事件、请求数据、读写本地存储、表单校验）；② 组件函数体过长、混杂了"订阅外部值/派生计算"，想让视图层更纯；③ 需要封装对某个第三方库/Hook 的复用。反例：只是纯函数计算就不必做成 Hook（普通 util 即可，避免占用 Hook 槽位、避免受 Rules 约束）。答题时点出"以 use 开头、内部遵守 Rules、返回稳定值、注意 SSR 守卫、跨组件共享靠 Context/store"能体现体系化理解。

**来源**：React 官方文档 — Escape Hatches、Thinking in React、Dan Abramov — A Complete Guide to useEffect

---

## 补充（新专题 13-15）

### 13.  eslint-plugin-react-hooks 靠「use 前缀」这条命名约定在编译/静态期替我们挡住了哪些 bug？

两条规则：rules-of-hooks（Hook 只能在组件或自定义 Hook 顶层调用，不能在条件/循环/嵌套函数/早返回之后调用）与 exhaustive-deps（effect/useCallback/useMemo 依赖完整性）。之所以能静态检查，全因「use 前缀」让 linter 认出「这是个 Hook、内部会动状态槽位」。挡住的高频 bug：① if 里调用 useState 破坏顺序→状态错位/Invalid hook call；② 依赖漏写→读到 stale 值；③ 在早返回后写 Hook→某次渲染少跑几个 Hook 崩。理解「命名约定不是风格洁癖而是 lint 与 React 运行时的接口契约」，就理解了为何自定义 Hook 必须 use 开头。

**来源**：eslint-plugin-react-hooks 文档（rules-of-hooks / exhaustive-deps 动机）；React 官方对 lint 的推荐。

### 14.  想做「多个组件真正共享同一份状态」的自定义 Hook，模块级可变变量、Context、外部 store 三条路各自的坑？

① 模块级可变变量：`let currentUser; export function useUser(){ ... }` 简单，但破坏 React 数据流——一个模块变量被多实例共享，SSR 会跨请求串数据（服务端模块在请求间复用），且改它不会触发重渲染，要靠额外 forceUpdate，且并发/StrictMode 下不可靠。② Context 承载共享：走正规 Provider，SSR 安全，但「value 引用变即全体广播」的粗粒度（见 Context 关），高频更新会痛。③ 外部 store + useSyncExternalStore：订阅式、可按字段选择、并发安全（防 tearing），是 Zustand/Redux 的路子。结论：共享状态绝不裸用模块变量，Context 起步、量大上外部 store。

**来源**：「Why you should not put state in a module-level variable」社区剖析；useSyncExternalStore 与 SSR 单例污染说明。

### 15.  React 自定义 Hook 与 Vue 3 composable 都叫「逻辑复用」，执行模型上有什么根本差异？

相同点：都以 use/驼峰约定命名、都封装「响应式/状态 + 副作用」、都靠调用而非继承/mixin 复用。根本差异在执行时机与上下文：① React Hook 在「每次渲染」都会重新执行整个组件函数（含所有 Hook 调用），靠「调用顺序」把每次的 useState 对齐到上次的槽位——所以必须顶层、无条件；② Vue composable 在 setup 里通常「只执行一次」，内部用 ref/reactive 建立响应式后由渲染 effect 精确追踪，没有「顺序=槽位」的约束，可以在条件块、循环、任意函数里调用（只要在其作用域内）。由此派生：React 需要 useCallback/useMemo 手动稳定引用，Vue 的 computed 天然惰性缓存；React 有 stale closure，Vue 读 .value 永远最新。理解这条就能解释两框架各自的「为什么这样设计」。

**来源**：Vue 3 Composition API「composables」文档与 React Hooks 规则对照；两者执行模型差异社区综述。
