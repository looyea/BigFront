# 自定义指令与 Teleport

> 目标：补齐 Vue 组合式 API 时代仍不可替代的两块拼板——自定义指令（`v-focus`/`v-permission` 这类"只管 DOM 不管状态"的复用）与 `<Teleport>`（把节点渲染到组件树之外的 DOM 位置）。并给出"何时指令、何时组件、何时组合式函数"的三分决策表（呼应 vue-composables、vue-refs-expose、svelte-actions 同题对比）。

---

## 一、指令的真相：编译后的补丁函数

`v-if`/`v-model` 不是引擎魔法——编译后分别是条件块补丁与 `onUpdate:modelValue` props 组合。自定义指令就是**给元素挂生命周期补丁**：

```js
// main.js 全局注册（或组件内 vFocus 局部：指令也遵循"驼峰即 v-CamelCase"解析）
app.directive('focus', {
  mounted(el) { el.focus() },
})
```

```vue
<input v-focus />                       <!-- 打开页面即聚焦，零 ref 零 onMounted -->
```

**钩子全家福**（组合式风格下都是对象方法）：

| 钩子 | 时机 | 典型用途 |
|---|---|---|
| `created` | 元素挂属性后、DOM 挂载前 | 少用（DOM 还不在） |
| `beforeMount` | 插入父节点前 | 预置样式 |
| `mounted` | 插入后 | **focus/measure/init 第三方** |
| `beforeUpdate` | 组件更新前 | 存旧值 |
| `updated` | 组件更新后 | 响应参数变化的重活 |
| `unmounted` | 移除时 | **清理观察器/监听/实例** |

指令钩子签名 `(el, binding, vnode)`：`binding.value/.arg/.modifiers` 分别对应 `v-permission:admin="{ code:'x' }" `.disable` 三件套。

## 二、带参数与响应式的指令：update 别忘

```js
app.directive('tooltip', {
  mounted(el, binding) {
    el._tip = createTooltip(el, binding.value)   // 实例挂元素上（弱引用更佳）
  },
  updated(el, binding) {                          // ← 忘了这条=参数变了没反应的 bug 之母
    el._tip?.update(binding.value)
  },
  unmounted(el) { el._tip?.destroy(); delete el._tip },
})
```

```vue
<span v-tooltip="{ text: row.help, placement: 'top' }">{{ row.name }}</span>
```

对照记忆：这就是 **Svelte 的 action `{ node, parameter } => { update, destroy }`** 契约（呼应 svelte-actions）——两家解决同一问题：**"行为跟着元素走，参数变化要能重播"**。React 没有指令位，等价物是自定义 hook + ref 回调，代码更啰嗦但显式。

## 三、何时指令、何时组件、何时 composable（三分表）

| 需求 | 选择 | 为什么 |
|---|---|---|
| 纯 DOM 行为、无自身渲染（focus/拖拽/水印） | **指令** | 不进虚拟 DOM，零组件开销 |
| 有结构、有状态、有交互 UI（弹窗/日历） | **组件** | 需要模板与 props/slot |
| 复用逻辑但不碰特定 DOM（防抖/请求） | **composable** | 纯逻辑组合（vue-composables） |
| 权限类"移除元素"（无权限即不渲染） | 组件/路由守卫为主，指令仅锦上添花 | 指令只删得了 DOM，删不了数据与接口——**前端隐藏≠安全**（呼应 09-express 鉴权） |

反模式点名：给指令里塞业务状态、跨组件通信（那是 pinia/provide 的事）、在 `updated` 里做昂贵初始化（该 mounted + 变化判断）。

## 四、Teleport：组件树与 DOM 树分家

模态框的老大难：父级有 `overflow:hidden`/`transform`/`z-index` 堆叠上下文，弹窗被"关"在容器里。**`<Teleport to="body">`** 让组件**逻辑上还在树里（props/events/inject 全正常），DOM 上搬到目标选择器**：

```vue
<Teleport to="body" :disabled="isMobile">
  <div class="modal-backdrop" @click.self="$emit('close')">
    <slot />
  </div>
</Teleport>
```

- `:disabled` 热开关：小屏内联渲染、大屏 teleport——一个 prop 切换宿主；
- 多弹窗叠放：`<Teleport to="#modals">` 指定专用容器，或用动态 `to` 防互相覆盖；
- **SSR 注意**：Nuxt/SvelteKit 服务端渲染 Teleport 内容需目标锚点存在于首屏 HTML，否则水合找不到家（呼应 vue-ssr-nuxt、08-nuxt hydration）；
- 对照：React 的 `createPortal`、Svelte 无原生等价物（惯用 CSS `position:fixed` + 顶层挂载约定）——Teleport 是 Vue 把"门户"做成了**声明式内置组件**。

## 五、指令 × Teleport 的联合场景

- 指令做**全站水印**：`v-watermark="'张三'"` 在 mounted 里创建 canvas 水印节点并 `MutationObserver` 防删（unmounted 必须断观察器，这是面试清理纪律题）；
- Toast 系统：组件库把通知队列组件 `<Teleport to="body">` 挂全局，调用侧只 `useToast().show('已保存')`——**指令管单元素行为，Teleport 管全局浮层出口**，两招合体覆盖 90% "命令式 DOM 需求"；
- v-click-outside（下拉关闭）：mounted 里 `document.addEventListener('click', …)`、unmounted 移除——一个 12 行的指令胜过每个下拉组件复制粘贴（呼应 vue-lifecycle 的清理话题）。

## 六、自检清单

- [ ] 能默写指令六钩子表与 `(el, binding)` 签名，说出 updated 漏写的后果。
- [ ] 三分决策表能脱口而出并各举一例。
- [ ] 说清 Teleport 后组件的 props/events/inject 为何仍然畅通。
- [ ] 知道 `:disabled` 双形态与 SSR 锚点要求。
- [ ] 讲得清"权限指令只藏 UI 不保安全"的原因。

---

## 🚀 部署预告

- 指令的 mounted/updated/unmounted 三件套与 **svelte-actions** 的 `{ update, destroy }` 契约、React 无指令模型的 hook+ref 路线，是面试"三框架 DOM 复用对比"的标准答案三角；
- v-click-outside 的监听清理纪律回扣 **vue-lifecycle** 的 onUnmounted 与 **vue-composables** 的 effectScope；
- Teleport 弹窗的无障碍焦点陷阱（focus trap）在组件库封装时是硬需求——预告 **vue-use-i18n** 关里 VueUse 的 `useFocusManager`；
- 指令权限方案的"前端只是遮眼法"将在 **09-express** 鉴权课看到另一半真相。

下一关进入 **L4 vue-provide-inject**：当 props 一层层"钻取"太累时，用依赖注入跨层传递响应式状态与函数。
