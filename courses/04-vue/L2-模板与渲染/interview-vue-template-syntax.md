# vue-template-syntax 面试题精选

> 共 15 题，覆盖 插值与表达式 / 绑定与指令 / 事件修饰符 / 安全(XSS) / 编译原理 五类。

---

## 一、插值与表达式

### 1. `{{ msg }}` 和 `v-html="msg"` 有什么区别？哪个更安全？

`{{ }}` 输出**转义后的文本**，`msg` 里的 `<script>` 只会显示成字符串；`v-html` **原样注入 HTML**，会解析并执行脚本。绝大多数场景用 `{{ }}`，只有渲染**已清洗的可信富文本**才用 `v-html`（呼应 vue-template-syntax 第一、五节）。

**来源**：Vue.js — "Text / v-html Interpolation"、OWASP — "XSS Prevention Cheat Sheet"

### 2. 为什么模板里不建议写复杂表达式，推荐放进 computed？

模板表达式应是"傻瓜式"的取值/简单三元。复杂逻辑塞进模板会**难读、难测、无法复用**，且每次渲染都重算。挪到 `computed` 可获得**缓存 + 单测 + 语义命名**（呼应 vue-reactivity 第四节、vue-watch interview 第 2 题）。

**来源**：Vue Style Guide — "Simplicity of template expressions"

### 3. `{{ }}` 里能写 `if/else`、`for`、赋值语句吗？

不能，插值只接受**单个表达式**。分支用三元，循环改用 `v-for`，赋值/多语句只能出现在 `v-on` 内联（如 `@click="count++"`）或方法里（呼应 vue-template-syntax 第一节）。

**来源**：Vue.js — "Template Syntax / JavaScript Expressions"

---

## 二、绑定与指令

### 4. `:`、`@`、`#[arg]` 分别是什么的缩写/语法？

`:` = `v-bind:`（属性绑定），`@` = `v-on:`（事件绑定），`#` = `v-slot:`（插槽）。方括号 `:[name]`/`@[name]` 是**动态参数**，运行时决定绑定到哪个属性/事件（呼应 vue-template-syntax 第三、四节）。

**来源**：Vue.js — "Shorthands / Dynamic Argument"

### 5. `<div :disabled="false">` 和 `<div :title="null">` 渲染结果？`:class` 有什么特殊？

对**布尔/普通属性**，`false`/`null`/`undefined` 会让该 attribute **被移除**；`:class=""` 却保留空 class（class/style 有专门的对象/数组合并语法，不走"假值移除"）（呼应 vue-template-syntax 第二、三关 class 绑定）。

**来源**：Vue.js — "v-bind / Attribute Behavior"

---

## 三、事件与修饰符

### 6. 解释 `.stop`、`.prevent`、`.capture`、`.self`、`.once`、`.passive`。

`stop`=阻止冒泡；`prevent`=阻止默认行为；`capture`=捕获阶段触发；`self`=仅事件目标是本元素才触发（忽略冒泡来的子元素）；`once`=只触发一次；`passive`=声明永不 preventDefault 以提升滚动性能。可串联，**顺序有意义**（呼应 vue-template-syntax 第四节）。

**来源**：Vue.js — "Event Modifiers / .passive"、MDN — "addEventListener options"

### 7. `@keyup.enter` 是怎么工作的？还有哪些按键修饰符？

Vue 把按键名映射到 `KeyboardEvent.key`，`.enter`/`.esc`/`.tab`/`.up` 等直接在事件上过滤；还有 `.ctrl`/`.shift`/`.exact` 修饰组合键。比手写 `if (e.key === 'Enter')` 更声明式（呼应 vue-template-syntax 第四节）。

**来源**：Vue.js — "Key Modifiers / System Modifiers / .exact"

---

## 四、安全（XSS）

### 8. `v-html` 渲染用户评论，可能出什么问题？怎么防？

用户评论含 `<img onerror=...>` 或 `<script>` 会执行 → **存储型 XSS**，可窃取 cookie/token、伪造操作。防护：默认转义（用 `{{ }}`）；必须渲染富文本时用 **DOMPurify 等在入库/出库时清洗**，并配 CSP。别在前端"裸插"不可信 HTML（呼应 vue-template-syntax 第五节、exp-security）。

**来源**：OWASP — "XSS (Cross-Site Scripting)"、Vue.js — "v-html 安全警告"

### 9. 有人说"Vue 已经帮我转义了所以没有 XSS"，对吗？

不完全对。`{{ }}`/属性插值确实自动转义，但 `v-html`、`javascript:` 协议链接、把用户数据拼进 URL/属性、第三方 `innerHTML` 插件仍是入口。安全是**纵深防御**，不能只靠框架默认（呼应 exp-security、node-config 脱敏）。

**来源**：OWASP — "XSS Prevention Cheat Sheet"

---

## 五、编译与指令杂项

### 10. Vue 模板最终被编译成什么？"数据变了界面就更新"在编译层怎么发生？

模板被 `@vue/compiler-dom` 编译成 **render 函数**，返回 VNode。render 函数在组件的 **render effect** 里执行，读取 `_ctx.xxx` 时触发**依赖收集**；响应式数据 `set` 时 `trigger` 让这个 effect 重新 run，产生新 VNode 再 diff/patch（呼应 vue-reactivity-theory 第二、七节）。

**来源**：Vue.js — "Deep Dive: Component Rendering"、"Compiler Overview"

### 11. `v-cloak`、`v-pre`、`v-once` 各自用途？

`v-cloak` 保留到编译完成，配合 CSS 隐藏未编译的 `{{}}`（无构建直挂场景）；`v-pre` 跳过该子树编译（含字面花括号时用、加速）；`v-once` 渲染一次后缓存、跳过后续更新（呼应 vue-template-syntax 第六节）。

**来源**：Vue.js — "v-pre / v-once / v-cloak"

### 12. `v-memo` 和 `v-once` 都能"少更新"，区别是什么？

`v-once` 是**永久静态**（一次都不再更新）；`v-memo` 是**依赖驱动缓存**——给一个依赖数组，依赖不变则复用上次渲染的子树，变了才重渲染，适合大列表里"多数项没变、少数变了"。两者都是性能手段（呼应 vue-template-syntax 第六节、vue-performance）。

**来源**：Vue.js — "v-memo"、社区 — "Vue 3.2 v-memo for large lists"

---

## 补充（新专题 13-15）

### 13. {{ }} 插值的完整求值链：从模板文本到 DOM 文本节点，中间经过哪些编译优化？

编译期：插值 表达式 被 解析 成 渲染 函数 的 `toDisplayString(...)` 调用；静态 内容（含 纯 静态 插值 段）被 提升/缓存（hoist 与 3.5 的 模板 内 表达式 缓存——同 一 表达式 多 处 出现 只 算 一次）。运行期：patch 阶段 对 文本 节点 用 `node.textContent !== value` 判定 再 写（避免 无效 赋值 触发 重排）。语义 细节：插值 走 **文本 插入**（`{{ html }}` 不会 解析 标签，防 XSS），`v-html` 才 是 innerHTML（信任 边界：只 放 消毒 后 内容，本 关 v-html 题）；`{{ }}` 内 是 **单 表达式**（无 语句、无 多行，但 可 三目/方法 链）；对象 会被 toDisplayString 特殊 格式化（JSON.stringify 2 空格）——「为什么 模板 打 对象 自带 缩进」的 答案。性能 追问 点：为什么 `{{ fn() }}` 每次 渲染 都 执行（无 缓存 意识 的 派生 计算 该 换 computed，本关 题 首 尾 呼应）。

**来源**：Vue 编译器源码 transformInterpolation/toDisplayString；3.5 模板表达式缓存 release notes。

### 14. 指令 vs 组件的边界：v-lazy/v-permission 这类自研指令什么时候应该改成组件或组合式函数？

指令 的 合法 领地：**只 碰 DOM、不 碰 状态**（focus/滚动 定位/权限 时 移除 元素/懒加载 挂 观察 器）——它 不 进 组件 树、没有 响应式 状态、没有 slots/props 校验，一旦 你 想 给 指令 传 回调、维护 内部 状态、或 在 卸载 时 做 复杂 清理，指令 就 在 写「隐藏 组件」。迁移 信号：① 需要 参数 对象 出现 嵌套 回调 → 组合式 函数 + 模板 ref（useLazyLoad(el) 显式 控制 生命 周期）；② 需要 渲染 自己 的 UI（骨架 屏/遮罩）→ 组件；③ 需要 被 测试（指令 几乎 无法 单测，只能 通过 宿主 组件）——组合式 函数 可 直接 单测。权限 案例：`v-permission="'edit'"` 移除 节点 是 体验 优化，**不是 安全**（源码 可 改）；安全 永远 在 接口 与 渲染 数据 层（本包 路由 守卫 题 的 镜像：前端 一切 拦截 都是 君子 协议）。

**来源**：Vue 自定义指令文档「指令应尽可能少用，优先组件/组合式」警告段；社区 v-permission 安全边界讨论。

### 15. 模板编译器怎么把静态内容"变便宜"？静态提升、hoist、cache 三种优化各针对什么？

静态 提升（hoist）：编译 时 把 纯 静态 节点/属性 提出 渲染 函数，只 创建 一次 vnode（运行时 复用 同一 对象——渲染 函数 再 执行 也 不 重建），针对「大量 不 变 结构」的 页面。PatchFlag：动态 部分 打标（TEXT/CLASS/PROPS…），diff 时 只 比 对 标记 项 跳过 其余，针对「结构 大 局部 动」。全 缓存（3.5 cache）：模板 内 表达式 的 结果 按 依赖 版本 缓存，「同 一 项 表达式 每 次 渲染 都 执行」被 治 愈（如 :class 对象 字面量、多 次 出现 的 a+b）。三者 共同 的 前提：编译器 **看得 懂 模板**（静态 可 分析 性）——所以 :is 动态、v-bind 对象 展开、v-html 这些「编译 期 不可 知」的 写法 会 降级 成 全 动态 路径（性能 断点，也是 本关 v-once/v-memo 题 的 存在 理由：手动 划 静态 边界）。

**来源**：Vue 编译器文档《静态 AST 节点提升》《patchFlags》；Vue 3.5 「模板 表达式缓存」release notes。
