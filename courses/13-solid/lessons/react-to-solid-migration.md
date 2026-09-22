# React → Solid 迁移方法论：把肌肉记忆逐条翻译

> 目标：给一个熟 React 的团队一份**可执行的迁移地图**——每种 React 习惯在 Solid 里的对应写法、哪些是"直译"、哪些是"必须转念"、哪些"根本不该带过来"，并给出改造顺序与常见返工点。全课 React 对比的总收尾。

## 一、先换的那颗脑子：从"重渲染"到"订阅"

React 的心智是"状态变→组件函数重跑→返回新 JSX→diff"。Solid 是"组件只跑一次建立 DOM，状态变→只有订阅了它的角落更新"。由此推出迁移第一铁律：**在 React 里为'避免重渲染'所做的一切优化（React.memo、useMemo 挡渲染、useCallback 稳引用），迁到 Solid 基本都要删掉**——那不是"翻译"，是"卸载"。真正要留的是"用 createMemo 缓存昂贵计算"，但那是性能、不是防重渲染。

## 二、状态与派生：useState / 派生的翻译

| React | Solid | 注意 |
| --- | --- | --- |
| `const [n,setN]=useState(0)` | `const [n,setN]=createSignal(0)` | 读要 `n()`、写 `setN` 同名 |
| `setN(n+1)`（依赖旧值） | `setN(n=>n+1)` | Solid 传函数才拿旧值，别写 `setN(n()+1)` 之外还漏调用 |
| `const full=first+' '+last`（每次渲染重算） | `const full=createMemo(()=>first()+' '+last())` | 派生用 memo，**不是**普通变量也不是 effect |
| `useEffect(()=>setFull(...),[a,b])` 同步派生 | 直接 `createMemo` | React 里这本身是反模式，Solid 更别带过来（L6：别在 effect set 信号） |

## 三、副作用：useEffect → createEffect 的三处不同

1. **无依赖数组**：Solid 自动追踪"回调里实际读了哪些信号"，`useEffect(fn,[a])` 那种手写依赖集消失（要显式指定用 `on(a,fn)`）。
2. **时序**：`createEffect` 跑在**渲染提交之后**、批处理；`useEffect` 也提交后跑，但"每次依赖变都重跑整组件里的 effect"的心智要换成"effect 是被它读到的信号驱动、独立小节点"。
3. **清理与挂载**：`useEffect` 的返回函数 cleanup + "空依赖只跑一次" → Solid 拆成 `onMount`（挂载后一次）+ `onCleanup`（卸载释放）。`useEffect(()=>{const t=setInterval(...);return()=>clearInterval(t)},[])` 直译就是 `onMount` 里建、`onCleanup` 里清。
4. **异步体**：`useEffect` 里塞 async 是老大难；Solid 里 effect 内 `await` 之后的信号读取**不再被追踪**（同步登记本质），要么用 `on`，要么把异步交给 resource/query。

## 四、props 与引用稳定性：最大的行为差

React 每次渲染给你新 props 对象，大家习惯 `const {a,b}=props` 解构。**Solid 的 props 是稳定 Proxy、每个属性是 getter——绝不能解构、不能提前求值，只能 `props.x` 惰性读**（否则丢响应式，官方 playground 会直接警告）。这条是 React 老手写 Solid 第一大返工点，也是 L3/L5/L6 反复敲的"三条铁律"。同理 `children` 也是 getter，别提前调用。

## 五、条件与列表：从 JS 表达式到控制流组件

| React | Solid | 为什么换 |
| --- | --- | --- |
| `{cond && <X/>}` | `<Show when={cond}><X/></Show>` | `&&` 是一次性求值、不响应；Show 的 when 每轮重读 |
| `list.map(x=><Li key={x.id}/>)` | `<For each={list()}>{x=><Li/>}</For>` | `.map` 非响应式、重建整段；For keyed 复用 DOM 增量更新（L6） |
| 按位置渲染 `map((x,i)=>)` | `<Index each={list()}>{(x,i)=>}` | x 是 accessor、i 静态，语义正好相反，别搞混 |

## 六、其余直译表

- **Context**：`createContext/useContext` 几乎同名同用法，但**没有内置默认值兜底**——没 Provider 时 `useContext` 返回 undefined、类型带 `|undefined`，要给个 `useXxx` 抛错守卫（L4/L6）。
- **ref**：`useRef` → 直接 `let el` + JSX `ref={el}`（Solid 的 ref 是"元素引用/回调"，多数情况不需要包一层）；imperative 用 `use:` 指令。
- **样式/事件**：`className`→`class`、`for`→`htmlFor`；`onClick` 语义近似但 Solid **事件委托**（on* 委托到文档根、`on:click` 才是原生）且**handler 里的信号非响应式、要动态用信号绑定**（L4）。
- **异步数据**：`fetch+useEffect+useState` 三件套 → `createResource`（配 Suspense）；上 Start 后进一步换成 `query + createAsync + route.preload`（L5/L7）。
- **表单/变更**：`onSubmit+手动 refetch` → `<form action={serverAction}>` 吃 single-flight（L8）。

## 七、改造顺序（给团队的可执行路线）

1. **先立骨架**：组件=函数、`createSignal` 替换 `useState`、删掉所有 `React.memo/useMemo(防渲染)/useCallback`；
2. **补响应式纪律**：全量搜"解构 props / 提前 `foo()` / `&&`/`.map` in JSX"逐条换成惰性读 + 控制流组件（最高频返工，单独排一轮 review）；
3. **副作用归位**：`useEffect` 拆 `onMount`/`onCleanup`/`createEffect`，派生从 effect 挪到 `createMemo`，异步从 effect 挪到 resource；
4. **数据/服务端**：接口层上 `createResource`，全栈需求上 Start 的 query/action/"use server"；
5. **收尾自检**：跑 Solid 编译器 lint（解构、提前求值、异步 effect 都会告警），再补测试（testing-library，L8）。

## 八、自检清单

- [ ] 能说清"哪些 React 优化到 Solid 要删而不是翻译"
- [ ] useState/派生/effect 三大高频点能默写对照表（含 `setN(n=>n+1)`、memo 非 effect）
- [ ] 坚定 props 不解构不提前求值，并知道这是第一大返工点
- [ ] 会把 `&&`/`.map`/位置式 map 分别换成 Show/For/Index
- [ ] 能给出团队五步改造顺序，并安排"解构/提前求值"专项 review

🚀 **下一站**：毕业项目（solid-capstone）——把九关所有能力拼成一个完整的 SolidStart 应用。
