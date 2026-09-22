# solid-lifecycle 面试题精选

> 共 12 题。A 类=原理机制；B 类=实战排坑；C 类=横向对比；D 类=场景设计。来源为一线面试与社区答疑的高频主题转述。

### 1. (A) Solid 组件只执行一次，那 React 式的 mount/update/unmount 生命周期还剩什么？
**来源**：细粒度下生命周期重定义题的转述。

没有"update 钩子"这回事——随数据变化重算是响应式订阅(memo/effect)自己在做，不经过组件重渲。剩下真正的生命周期只有两件：**挂载后跑一次的初始化**（onMount）和**作用域销毁时的回收**（onCleanup）。理解这点才算真正上手 Solid 心智。

### 2. (A) onMount 什么时候跑、跑几次？SSR 期间会执行吗？
**来源**：onMount 时机题的转述。

初始渲染/DOM 挂载之后跑、只跑一次，适合放"需要真实 DOM 才能做"的初始化。SSR 期间**不执行**——服务端没有 window/document/DOM，所以依赖浏览器的逻辑必须待在 onMount 里而不是组件顶层。

### 3. (B) 组件顶层直接 `new Chart(refEl)` 或读 `localStorage`，SSR 会怎样？正确放法？
**来源**：SSR 崩溃排坑题的转述。

顶层在渲染阶段执行，SSR 时 `document`/`window`/`localStorage` 不存在 → ReferenceError 直接崩、构建/流式渲染报错。正确：把这些放进 `onMount(()=>{...})`（只在客户端、挂载后跑），或做客户端守卫。与 SvelteKit 的水合纪律同源。

### 4. (A) onCleanup 依据什么触发？为什么强调"ownership 树而非 DOM 移除"？
**来源**：cleanup 触发机制题的转述。

onCleanup 注册到**当前响应式作用域**，在该作用域被 **dispose 或 refresh** 时触发。强调 ownership 树是因为：即便 DOM 被复用/移动，只要建立它的 Owner 作用域还在就不算销毁；反之作用域被释放就一定清理。回收是按响应式树而非 DOM 生命周期来定的。

### 5. (B) 一个 createEffect 里 setInterval 但没写 onCleanup，会怎样？为什么？
**来源**：effect 与 cleanup 配对题的转述。

effect 每次因依赖变化重跑前，Solid 会先调用上一次注册的 cleanup——你若没注册，上一个 interval 不会被清，于是每次重跑叠加一个、路由切走后仍在跑，形成内存泄漏/定时器叠加。这正是 onCleanup 存在的意义：把"每次建立"和"每次拆除"配平。

### 6. (C) 和 React useEffect 的清理函数相比，Solid 的 onCleanup 心智差异是什么？
**来源**：跨框架副作用清理对比题的转述。

React 把 mount/update/cleanup 塞进同一个 `useEffect(..., [deps])`，靠依赖数组控制重跑，忘了写 cleanup 或依赖漏项就泄漏/闭包过期。Solid 把"建立"和"清理"分开：effect 体里建、`onCleanup` 显式登记拆，且**不依赖数组、按实际读到的依赖自动追踪**，作用域释放即触发。少了依赖数组这一类高频错误（呼应 react-vs-solid 迁移）。

### 7. (A) createRoot 干嘛用？它把什么交给你、你要负责什么？
**来源**：createRoot 与手动内存管理题的转述。

建立一个**不随父级 Owner 自动释放**的非追踪根作用域，用于跨组件生命周期、或在会被重算的作用域内起一段"不该被本次重算销毁"的长期订阅。它把 `dispose` 函数作为参数交给你——你要**显式调用 dispose()** 负责回收，否则就是你亲手造了个永不释放的泄漏。

### 8. (B) 警告 "computations created outside a createRoot or render will never be disposed" 的根因与修法？
**来源**：孤儿计算内存泄漏题的转述。

根因：你在**没有 Owner 兜底**的地方（模块顶层、全局、纯回调里脱离渲染/root）创建了 signal/effect/memo，它们不属于任何会被 dispose 的作用域，于是永远挂在响应式图里→泄漏。修法：把它们移进组件（自带 Owner）、或包进 `createRoot` 并在合适时机 `dispose()`。

### 9. (A) 一个组件被路由销毁时，Solid 是怎么"批量回收"它的订阅的？
**来源**：Owner 树 dispose 机制题的转述。

组件执行期创建的响应式节点都挂在它的 Owner 之下。销毁时 Solid 沿 Owner 树递归 dispose 这一整片：解除所有依赖订阅、触发所有 onCleanup。你**不需要手动 unsubscribe 每个 effect**——这正是"不重渲却没有泄漏"的底座：回收按树成批完成。

### 10. (C) createEffect、createRenderEffect、onMount 的时机分别是什么？怎么挑？
**来源**：副作用时机对照题的转述。

createRenderEffect 在 DOM 更新阶段内跑（和其他 DOM 改动同批）；createEffect 在初始渲染之后 / 依赖变化后常规更新后跑，是日常副作用默认；onMount 只在挂载后跑一次、SSR 不跑。挑法：派生用 memo、常规副作用用 effect、要和 DOM 更新原子同批才用 RenderEffect、一次性挂载初始化用 onMount。

### 11. (D) 场景：一个组件订阅 WebSocket、又依赖一个会变的 topic signal，切换 topic 要退订旧的订新的、卸载要彻底关连接。怎么组织？
**来源**：订阅生命周期设计题的转述。

`createEffect(()=>{ const t=topic(); const ws=open(t); onCleanup(()=>ws.close()); })`。effect 体随 topic 变化重跑：先跑上一次的 onCleanup 关掉旧连接、再开新的；组件（Owner）销毁时最后那次 onCleanup 也会触发、彻底关闭。无需手动追踪"当前连的是哪个 topic"，交给响应式重跑 + cleanup 配对。

### 12. (D) 设计题：需要在组件树之外、App 启动时建一个"全站存活、永不回收"的响应式状态，正确姿势是什么？
**来源**：全局响应式作用域设计题的转述。

用 `createRoot(()=>{ ...创建 signal/store/effect... })` 在应用入口显式开一个根，并把返回的 dispose 长期持有（一般永不 dispose）。这样它不隶属任何组件 Owner、随 App 全程存活；直接裸放模块顶层会踩"outside createRoot/render never disposed"警告。需要关闭全站逻辑时再手动调用那个 dispose。

🚀 实操请去做 L2 作业：复现定时器泄漏、SSR 顶层崩、孤儿计算警告、WebSocket 退订重订四条线。
