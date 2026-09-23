# 样式方案与 Tailwind

> 目标：样式在 App Router 里的规则**比想象中平静**——没有 RSC 革命，只有几条边界细则：全局 CSS 在哪 import、Module CSS 谁能动、Tailwind 怎么成默认答案、以及"服务端渲染的壳 + 客户端主题"这对老矛盾的新写法。呼应 **vite L2**（CSS 管线通用知识）、**vue-class-style-transition**（动态 class 之争）、**next-server-client**（边界）。

---

## 一、两条 import 规则，一条作用域警告

```tsx
// app/globals.css —— 全局样式
import './globals.css';          // 惯例：根 layout import
// 但 RSC 时代规则变了：任何 服务端/客户端 组件文件都能 import 全局 CSS，
// Next 会把它们提取合并进首屏文档（不再要求"只能 _app"）。

// 模块 CSS：只有客户端组件能 import *.module.css
// components/badge.tsx
'use client';
import styles from './badge.module.css';
export default function Badge() { return <span className={styles.root}>…</span>; }
```

- **全局 CSS 无级联作用域**：多个组件各 import 一个全局文件，**最终顺序不保证稳定**——"后写覆盖"的特权战争是样式错乱的万源，方案是**只用全局 CSS 定义 tokens/重置/动画关键帧**，布局细节一律 module/utility（同 vue 时代 scoped 存在的理由，呼应 vue-class-style-transition）；
- Module 不能进服务端组件——这是当年社区最大的吐槽之一（理由：CSS Module 的运行时对象被当作客户端能力）；折中方案见第三节 utility 流。

---

## 二、styled-jsx 的葬礼与遗产

Pages Router 时代 `import Styles from 'styled-jsx'` 的组件级 CSS 在 App Router **不再支持**（服务端组件无法携带运行时插桩）。盘点三大流派结局：

| 流派 | 07 包现状 |
|---|---|
| styled-jsx / styled-components | 需要 'use client'+转译插件勉强活，新项目不建议 |
| CSS Modules + PostCSS | 服务端组件被禁，纯客户端组件 OK |
| Tailwind / utility + CSS 变量 | create-next-app 钦定默认，服务端组件零阻力 |

第三行的"零阻力"是关键：class 字符串就是普通字符串，天然可序列化跨边界——**样式方案的选择在 RSC 时代变成了边界兼容性问题**（呼应 next-boundaries 的 props 契约视角）。

---

## 三、Tailwind 工程姿势

```bash
npx create-next-app@latest --tailwind     # 自动：tailwind v4 + postcss 预设 + globals.css 一行 @import "tailwindcss"
```

```tsx
// 组合范式：clsx 判真假 + 冲突消解
import { cn } from '@/lib/utils';          // shadcn 约定：twMerge(clsx(...))

function Btn({ variant = 'primary', className }: BtnProps) {
  return <button className={cn('px-4 py-2 rounded-lg font-medium',
    variant === 'primary' ? 'bg-black text-white' : 'border',
    className)} />;                         // ← 调用方可覆盖，冲突由 merge 裁决
}
```

四条工程经验：
1. **`cn`（tailwind-merge）是必需品**——否则 `className="bg-white"` 传进来会和你组件内部的 `bg-black` 打架，谁赢看属性顺序，不看意图（同 mp-wxss 的样式隔离议题：可预测性优先于灵活）；
2. 动态主题走 **CSS 变量 token**：`bg-[hsl(var(--primary))]`，主题切换改 `<html>` 上的变量，零重编译——暗色模式 `dark:` 变体是同一招的媒体/类名前缀版；
3. 服务端组件+tailwind 的体积账：purge 按**全项目 class 扫描**，写 `class={cond ? 'a' : 'b'}` 字面量才安全，**拼接式 class（`text-${size}`）会被清掉**——上线后"只有本地生效"的样式事故源头（对照 vite 的 tree-shaking 扫描心智，呼应 vite-build）；
4. 与组件库共舞（shadcn 系=源码复制进仓）：样式最终权在你手里，用自由度换维护税（react-architecture 的依赖评估框架直接套用）。

---

## 四、服务端主题：把暗色决策提到渲染前

纯客户端 `useState + class 切换` 的老方案在 SSR 站点会**闪白**（水合后才知主题）。Next 的正解按代价递增三档：

1. **cookie/Action 定主题**：切换时写 cookie（`document.cookie` 或 Action），根 layout 读 cookie → `<html className={theme}>` ——SSR HTML 即带正确主题，零闪烁（本课推荐）；
2. **内联脚本抢先**：`<script dangerouslySetInnerHTML>` 在首帧前读 localStorage 改 class——水合一致性要小心（脚本改过的 class 别进 React 管辖属性，呼应 next-render-modes 水合对账）；
3. 纯客户端状态库（next-themes）：本质是方案 1/2 的封装，接受 `suppressHydrationWarning` 豁免（这不是解决是消音，知情使用）。

---

## 五、自检清单

- [ ] 全局 CSS 能在任意组件 import 后，靠什么防止级联战争？
- [ ] CSS Module 在哪类组件里不可用？替代路线两条？
- [ ] 为什么 utility-first 在 RSC 时代"天然正确"？
- [ ] 拼接 class 为什么会被 Tailwind 清掉？
- [ ] 无闪烁暗色模式的 cookie 方案里，切换 Action 要顺手做什么（提示：不止写 cookie）？

---

## 🚀 部署预告

- L6 第二关 **next-metadata**：给"被搜索引擎与社交卡片看见的站点"写代码——metadata 静态导出与 generateMetadata 动态生成、以及分享图当组件渲染的 opengraph/image 魔法；
- Tailwind v4 的 @theme 令牌体系与本包 CSS 变量的关系，若你追新，记一笔到 next-architect 的演进清单。
