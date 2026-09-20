# 渲染模型与协调 diff

> 目标：把"改了 state 之后 React 到底做了什么"讲透。本课：渲染(render)与提交(commit)两阶段、**reconciliation 协调算法**与虚拟 DOM、React 的 diff 三大假设（同层比较 / 类型即身份 / key 标识列表）、什么触发重渲染、以及"重渲染 ≠ 重 DOM 操作"。这是理解 key、memo、为什么别用 index 的底层依据（呼应 react-component、react-jsx、react-lists-keys、vue-reactivity-theory 的按需更新对照）。

---

## 一、一次更新的两阶段：render 与 commit

```
setState → 【Render 阶段】从该组件起重新执行函数、构建新 Element 树、与旧的 diff，算出"变更清单"
        → 【Commit 阶段】把变更一次性应用到真实 DOM（同步、不可中断地改 DOM/refs）
```
- **Render 阶段**：纯计算，React 可**中断/重启**（并发特性，React 18，呼应 react-advanced-hooks）；
- **Commit 阶段**：真正改 DOM，`useEffect`/`useLayoutEffect` 在此后跑（呼应 react-useeffect）。
"每次渲染"通常指 render 阶段重新执行组件函数（呼应 react-component 第四节）。

---

## 二、虚拟 DOM 与 reconciliation

组件返回的 Element 树（普通对象）是"虚拟 DOM"。状态变化后 React 拿到**新树**，与上次的树做 **reconciliation（协调）**，算出最小变更再提交。它不是"每次都全量重建 DOM"，而是尽量**复用**现有节点。代价是每次 render 要重跑组件函数、造新 Element 对象——这正是 memo/useMemo 要省的部分（呼应 react-memo-hooks）。

---

## 三、React diff 的三大假设（O(n) 的由来）

全量树 diff 是 O(n³)，React 用三条启发式降到 **O(n)**：

1. **只同层比较，不跨层移动**：节点换到别的父下 = 销毁重建（跨层移动很少见，不值得优化）；
2. **类型即身份**：`<div>` vs `<Comp>`、或组件函数换了 → 视为不同，**销毁旧子树、重建**（连带其 state）；同类型则更新 props 复用；
3. **列表用 key 标识**：同类型的兄弟列表，React 默认按**索引位置**比较——这就是必须给 `key` 的原因。

**对照 Vue**：Vue 靠编译期 patchFlag 精确定位动态点、且有**双端/最长递增子序列**的 key diff（呼应 vue-conditional-list、vue-reactivity-theory）；React 更依赖运行时全 diff + 你的 key/memo 提示。殊途同归，但"你写的 key/memo 对 React 权重更高"。

---

## 四、什么时候会重渲染

组件会重新执行（render）当：① 自身 state 变；② **父组件重渲染**（默认子也跟着重 render，即使 props 没变）；③ context 值变（用到的子，呼应 react-context）；④ 强制 `forceUpdate`。

- 重渲染 = 重跑函数、重算 Element，但**未必产生 DOM 变更**（diff 后一样就跳过 commit）；
- 想**阻止**子无谓重渲染：`React.memo`（浅比较 props）+ 稳定引用（useMemo/useCallback）（呼应 react-performance）。

---

## 五、key 如何决定复用（承上启下）

有 key：`[A,B,C]` 变 `[A,X,B,C]`，React 认出 A/B/C key 不变 → 只新建 X、移动位置。
无 key / 用 index：插入后 index 全变 → React 以为每项都"变了内容" → 大量错误复用（受控输入串值、动画错乱）甚至整列重渲染。所以**唯一稳定 id 当 key**（详见 react-lists-keys、呼应 vue-conditional-list 别用 index）。

---

## 六、常见误区

- ❌ "setState 一定重渲染" —— 值未变（`Object.is` 相等）React 可能**提前退出**不重渲染；
- ❌ "重渲染一定卡" —— 多数时候重跑函数很便宜，贵的是无谓 DOM 操作/子树重渲染，靠 Profiler 定位；
- ❌ "state 更新立刻能读到新值" —— state 异步、本帧内 `n` 仍是旧值（呼应 react-usestate、闭包陈旧值）；
- ⚠️ 批量更新：React 18 起**所有**场景（含 Promise/定时器）自动批处理，一次微任务只渲一次（呼应 node-event-loop 微任务）。

---

## 七、自检清单

- [ ] render 阶段和 commit 阶段各做什么？哪个可被中断？
- [ ] React diff 的三大假设是什么？为什么是 O(n)？
- [ ] 父重渲染，子一定重渲染吗？怎么阻止？
- [ ] "重渲染"和"改 DOM"是一回事吗？
- [ ] 为什么 index 当 key 在插入/删除时会引发状态错位？

---

## 🚀 部署预告

- L1 到此收官：JSX(写) → 组件(结构) → 渲染模型(运行机制)三块地基打牢；
- "state 更新异步、值读到旧快照" 将在 **react-usestate（L2）** 深入；"effect 在 commit 后跑" 将在 **react-useeffect** 展开；
- `key`/diff 的实战细节与列表最佳实践落在 **react-lists-keys（L5）**；`memo`/性能在 **react-performance（L7）**（呼应 vue-performance、vue-reactivity-theory 按需更新的对照）。

进入 **L2**：核心 Hooks —— 从 `useState` 与"不可变更新"开始。
