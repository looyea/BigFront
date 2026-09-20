# 组件边界与数据流模式

> 目标：RSC 的概念一句话能背，**边界的工程模式**才是分水岭。本课四件套：① `children` 穿透术（服务端壳包客户端芯）；② 跨边界数据流（props 序列化规则）；③ Context 的正确生存方式；④ 三方库不兼容 RSC 的三板斧。呼应 **react-composition**（children 组合）、**react-context**（Provider 树）、**next-server-client**（边界铁律）。

---

## 一、children 穿透：最重要的一个模式

铁律是"客户端组件不能 import 服务端组件"，但有个优雅的侧门——**JSX 作为 props**：

```tsx
// components/modal.tsx —— 'use client'，纯交互壳
'use client';
export default function Modal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (/* 开关逻辑、动画，children 原样渲染 */ <dialog open={open}>{children}</dialog>);
}

// app/page.tsx —— 服务端页面
import Modal from '@/components/modal';
import ExpensiveTable from './expensive-table';   // 服务端组件！

export default async function Page() {
  const rows = await getRows();          // 服务端取数
  return <Modal><ExpensiveTable rows={rows} /></Modal>;   // ← 关键
}
```

`<ExpensiveTable/>` 这个元素在**父级（服务端）就已渲染完成**，传给 Modal 的只是渲染结果（序列化的 payload 片段）——Modal 虽是客户端组件，它的 children 里却可以坐着一整棵服务端树。

推论：**布局类、壳类组件（Modal/Tooltip/Tabs/Provider）标 'use client' 时，永远把内容留作 children，不要 import 进实现**。这是 react-composition "组合优于继承"在服务端时代的翻版，也是官方文档单独开一章强调的模式（呼应 next-perf：壳组件因此可以全站复用零成本）。

---

## 二、跨边界数据流：props 的序列化契约

| 方向 | 能传 | 不能传 |
|---|---|---|
| Server → Client | 可序列化值：string/number/数组/扁平对象/Promise（19 起可直接传，客户端 await）/JSX 元素 | 函数（Server Action 除外）、class 实例、Buffer、Date（会成字符串）、Symbol |
| Client → Server | Action 参数、表单 FormData、路由请求头 | 直接把"服务端才有的东西"传回来 |
| Server → Server | 一切（同一进程，无序列化） | — |

实践含义：**服务端边界处就是"海关"**。取到的 ORM 实体先 `.toPlain()`/解构瘦身再过海关——顺带治好 06-mp 里 setData 传整个大对象的同款病（序列化成本意识，呼应 mp-setdata 五步旅程）：

```tsx
const user = await db.user.find();     // 20 字段的完整实体
<ClientWidget user={{ id: user.id, name: user.name }} />   // 只带过海关需要的
```

---

## 三、Context：没死，搬家了

客户端组件之间的 Context **照常使用**——Provider 放在客户端岛根部：

```tsx
// providers/theme.tsx
'use client';
const ThemeCtx = createContext<Theme>(defaultTheme);
export const ThemeProvider = ({ children }) => { ...useState...; return <ThemeCtx.Provider>{children}</ThemeCtx.Provider>; };
export const useTheme = () => useContext(ThemeCtx);

// app/layout.tsx（服务端根布局）
import { ThemeProvider } from '@/providers/theme';
export default function RootLayout({ children }) {
  return <html><body><ThemeProvider>{children}</ThemeProvider></body></html>;  // Provider 是客户端岛，children 穿透！
}
```

但"服务端组件消费 Context"（读请求作用域的 theme/locale）需要新工具：**`context()` API（实验）/ AsyncLocalStorage / 直接参数透传**。当前务实排序：① 请求态数据（session/locale）——服务端组件用 `cookies()/headers()` 现取，别造 Context；② 客户端交互态——经典 Context 活在岛内；③ 全站配置——构建期 env 或根 layout props 下发。全局结论：**Context 从"全局总线"退居"岛屿内总线"**（呼应 react-context 的"Context 是逃生舱"再进一步）。

---

## 四、三方库不兼容 RSC 的三板斧

chakra-ui v2、老版 react-window 等一 import 就报 `window is not defined` 或 hooks 错位：

1. **包一层客户端出口**：`ui/chakra.tsx` 里 `'use client'` + re-export，业务只 import 这个出口——库的客户端属性被**边界化**而非全站点染；
2. **next/dynamic ssr:false 兜不住**——注意它只能在客户端组件里用（L7 讲 why），别当万金油；
3. **等官方/换库/自研薄壳**：长期依赖前看该库的 RSC 适配 roadmap，决策参照 react-architecture 的依赖评估清单。

反面模式警告：给每个页面顶部无脑加 `'use client'` "一次解决"——整个页面退化为老式 SPA 渲染，RSC 红利清零且无人察觉（bundle 分析一测便知，呼应 next-perf）。

---

## 五、边界设计的决策流（贴墙版）

```text
写一个组件前问四件事：
1. 它需要事件/state/ref 吗？           → 不需要：保持 Server（默认白捡性能）
2. 需要，但只是叶子小块？               → 标 'use client'，边界下推
3. 它是壳（内容不定）？                 → 'use client' + children 穿透，禁 import 服务端件
4. 它要读请求态（cookie/session）？     → 服务端现取传 props；岛内要，就 Provider/参数注入
```

这条流程走完，一个页面的树自然长成"服务端的躯干 + 客户端的四肢"——即官方所谓 **RSC 的心形线（heart line）**：边界不是裂缝，是器官交界（呼应 react-architecture 的边界划分总纲）。

---

## 六、自检清单

- [ ] 为什么客户端壳组件要收 children 而不是 import 内容件？
- [ ] Server→Client 能传 Promise 吗？函数呢？各举一个例外/正例。
- [ ] 根 layout（服务端）怎么挂 ThemeProvider（客户端）而不违反铁律？
- [ ] 三方库报 window is not defined，第一反应改哪里？
- [ ] 全站顶部 'use client' 为什么是反面模式？用什么工具戳穿它？

---

## 🚀 部署预告

- 边界画好后的最后一块拼图：**慢服务端组件怎么办**——下一关 **next-context-streaming** 讲 Suspense/loading.tsx 如何把"等最慢的"变成"先到先渲染"；
- 本课第四节的 `next/dynamic ssr:false` 使用限制，L7 错误边界课会给出完整解释，先留个钩子。
