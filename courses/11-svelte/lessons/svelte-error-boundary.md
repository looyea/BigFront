# `<svelte:boundary>` 错误边界：让崩溃只塌一角

> 目标：掌握 Svelte 5.3+ 新增的 `<svelte:boundary>` 特殊元素——failed snippet 与 reset 的兜底 UI 协议、pending snippet 白捡的 loading 态、onerror 的上报与向上传播规则；最关键的考点是**它能捕获什么、不能捕获什么**，以及与 React Error Boundary / Vue onErrorCaptured 的谱系对照（呼应 svelte-special-elements、React 错误边界话题、07/08 包的错误处理章）。

---

## 一、它解决的原生痛点

没有 boundary 的世界里，一个组件渲染期抛错 = 整个 effect 图中断 = **白屏**（或 SSR 500）。传统解法是"在 App 顶层 try-catch 包裹挂载"——粒度是全有或全无。boundary 把兜底范围做成**声明式的模板位置**：圈住哪，崩溃就只塌哪一角；圈内组件的渲染/effect 错误被接住，圈外世界照常运行。

## 二、基本形态：failed snippet + reset

```svelte
<svelte:boundary>
  <FlakyWidget />

  {#snippet failed(error, reset)}
    <div class="error-card">
      <p>这块坏了：{error.message}</p>
      <button onclick={reset}>重试</button>
    </div>
  {/snippet}
</svelte:boundary>
```

协议三要点：
- **错误一旦处理，boundary 原有内容整体卸载**（不是"隐藏"——组件树销毁，effect 全部清理）；
- `reset()` **重建** boundary 内容：组件从头挂载，`$state` 回到初始值——所以"重试"对偶发故障（网络抖一下）有效，对确定性 bug 无效（会再塌一次，UX 上要有次数上限）；
- failed snippet 也可作为 prop 显式传入：`<svelte:boundary {failed}>`（snippet 体系的常规操作，呼应 svelte-snippet-children）。

## 三、pending snippet：await 的白捡 loading

boundary 的另一半职责是**异步占位**：

```svelte
<svelte:boundary>
  <p>{await delayed('hello!')}</p>

  {#snippet pending()}
    <p>loading...</p>
  {/snippet}
</svelte:boundary>
```

规则要背准：pending 只在**边界创建时、内部 await 首次解析期间**显示；后续的异步更新不重播 pending——那种场景的正确工具是 `$effect.pending()`（反应式判断"现在有没有在等"，配合局部转圈）。playground 默认把应用包在空 pending 的 boundary 里，所以新手在那儿写顶层 `await` 不报错，挪回本地工程没包 boundary 就翻车——这是个高频"见鬼"现场。

## 四、onerror：上报、双-handler 与传播协议

```svelte
<svelte:boundary onerror={(e) => report(e)}>
  <Widget />
</svelte:boundary>
```

- `onerror(error, reset)` 与 failed 各自**可以单独存在**：只要上报不要 UI → 只给 onerror；两者都给 → 先 onerror 后渲染 failed；
- **传播规则**：onerror 内部再抛（或故意 `throw error`）→ 交给**父级 boundary**；到顶仍无人接 → 全局未处理错误。这就是"分级错误处理"的语言原生形态：局部 UI 兜底 + 上层统一上报（对照 09-express 的中间件错误栈是同构思想）；
- onerror 里把 error/reset 存进外层 `$state`，可以在 boundary **外面**渲染兜底 UI 与重试按钮（failed snippet 灵活性不够时的逃生舱）。

## 五、捕获范围：面试与实战的第一考点

boundary 接的是**渲染过程与 effect 执行中**的同步抛出。官方口径划得很清：

| 场景 | 谁负责 |
|---|---|
| 组件渲染/effect 里抛错 | ✅ boundary |
| 事件处理器（onclick 等）里抛错 | ❌ 自己 try-catch（或全局 error 监听） |
| `setTimeout`/异步回调/悬空 Promise | ❌ 同上（unhandledrejection） |
| SSR 渲染期抛错 | ⚠️ 默认整个 render 失败；`render(..., { transformError })` 可让 failed snippet 在服务器出安全摘要、客户端水合复现（5.51+，Kit 则由框架经 handleError 代管——细节以官方文档为准） |

一句话记忆：**boundary 管"渲染事务"，不管"你的代码里的普通异常"**——后者永远是 JS 语言层的 try-catch 与进程级监听器的活。React 用户注意：这条边界与 React 错误边界几乎同款（React 也不接事件处理器与 SSR 错误），迁移心智可直接复用（呼应 react-error-boundary 生态话题）。

## 六、谱系对照：三家怎么接错误

| | 组件级兜底 UI | 上报钩子 | 声明形态 |
|---|---|---|---|
| React | Error Boundary（**只能 class**，或 react-error-boundary 包） | componentDidCatch | 无内置元素 |
| Vue 3 | `onErrorCaptured`（setup 内，返回 false 拦截传播） | app.config.errorHandler（全局） | 无内置元素 |
| Svelte 5 | `<svelte:boundary failed>` | onerror（每层） | **模板元素一等公民** |

Svelte 的差异化：把"错误边界"从组件模式（class 遗产）升格为**模板语言构造**——与 Suspense/pending 合并进同一个元素（React 里是 ErrorBoundary + Suspense 两个原语、Vue 里靠组合式钩子拼）。叙事呼应本包反复的母题：编译器派把运行时框架的"组件 API 面"压缩进语法面（对照 dynamic component 送走 svelte:component 是同一种洁癖）。

## 七、自检清单

- [ ] 写得出 failed(error, reset) 双参语义与"处理错误时原内容被整体卸载"的行为。
- [ ] pending 的显示时机（首次 await）与后续异步的正确工具（$effect.pending）。
- [ ] onerror 与 failed 的组合规则、rethrow 向父传播协议。
- [ ] 背出捕获范围四行表（渲染/effect ✅；事件/异步/裸 Promise ❌；SSR transformError ⚠️）。
- [ ] 一句话讲给 React/Vue 同事：三家的错误边界各长什么样、差在哪。

---

🚀 **下一关**：`svelte-effects-advanced`——boundary 的 pending/$effect.pending 已经预告了 Effect 家族的隐藏房间：`$effect.pre/$effect.root/$effect.tracking`、untrack、tick/flushSync、$state.snapshot，以及命运多舛的 `$memo`。
