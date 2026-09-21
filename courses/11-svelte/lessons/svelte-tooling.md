# 工程与工具链：从 sv create 到 svelte.config.js

> 目标：把 Svelte 工程的每个配置文件"为什么存在"讲透——`sv` 命令行、`@sveltejs/vite-plugin-svelte`、`svelte.config.js` 的编译选项（含 runes/legacy 混跑开关）、eslint/prettier 插件生态、编辑器与 CI 接线。与 10-vite 包深度呼应（呼应 svelte-overview、10-vite）。

---

## 一、CLI：`sv` 是唯一的官方命令行

Svelte 工程体系重组后（`create-svelte`/`svelte-migrate` 等并入单一 CLI），核心命令：

```bash
npx sv create my-app      # 脚手架：选/不选 TS、SvelteKit、linter/formatter、测试
npx sv add tailwind       #  integrations：给已有项目接库（tailwind/mdx/vitest/Playwright…）
npx sv check              # 类型与模板诊断（内部即 svelte-check）
```

- 老教程里的 `npx degit sveltejs/template`、`create-svelte` 已退役——**见到就是过时信号**（内容生产反复强调的"版本嗅觉"，呼应 README 技术事实守则）。
- 编译/打包没有"vite build --watch"以外的官方特化命令：Svelte CLI 只管**创建、集成、检查、迁移**（`sv migrate` 收编了旧版 codemod，L10 迁移课再用）。

## 二、vite-plugin-svelte：两个工程的接头

```js
// vite.config.js
import { sveltekit } from '@sveltejs/kit/vite';   // 纯 Svelte 则: import { svelte } from '@sveltejs/vite-plugin-svelte'
export default { plugins: [sveltekit()] };
```

职责链：Vite 管模块图/Dev Server/HMR 协议，**plugin-svelte 把 `.svelte` 接进管线**——调用编译器、拆 `<script>/<style>` 给 preprocessor、HMR 时保留组件状态（runes 组件热更新不重置 `$state` 是其拿手活，呼应 svelte-global-state 的 HMR 话题）。定制点：

- `compilerOptions.dev`、`hydration` 等由插件转发给编译器；
- `onwarn` 过滤警告——CI 把 warning 当 error 时按需豁免；
- `inspector`：编辑器点开模板节点直达源码位置。
- `vite-plugin-svelte` 与 `svelte-preprocess`（已并入插件的 `vitePreprocess()`）——TS/SCSS 预处理一行接入，L7 首关 tsconfig 一节就是靠它。

## 三、svelte.config.js：编译器的事、打包器不管的事都在这里

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default {
  preprocess: vitePreprocess(),
  kit: { /* 仅 SvelteKit 读:adapter、alias、prerender… */ },
  compilerOptions: {
    runes: true,               // 全项目强制 runes 模式
    customElement: false,      // L10 Web Components 开关
  },
  extensions: ['.svelte'],
};
```

关键认知：**`compilerOptions.runes` 是 4→5 混跑的唯一旋钮**——

| 档位 | 效果 | 适用 |
|---|---|---|
| 不设（默认） | 按文件探测：出现 runes 走 5，否则 legacy | 迁移期大仓库存量代码 |
| `runes: true` | 全部件必须 runes，用旧 API 直接编译报错 | 新项目（推荐钉死） |
| `runes: false` | 强制 legacy | 临时救火，别长住 |

单文件级还可用 `<svelte:options runes={true} />` 逐组件钉模式（渐进迁移细节到 L10）。这解释了一个常见恐慌："我的 store/on:click 还能跑吗"——默认探测档下都能；钉死 `runes: true` 后要一次性清账。

## 四、Lint 与格式化

- **prettier-plugin-svelte**：格式化 `.svelte`（脚本+模板+样式三段各有各的缩进纪律）；与 `prettier-plugin-tailwindcss` 有共存顺序文档，装两个时以 svelte 插件为基。
- **eslint-plugin-svelte**：`eslint-plugin-svelte` flat config 的 `recommended` 里一半规则是**模板可用性/无障碍**（alt、label）与**响应式反模式**（如在 `$derived` 里写 state——L1 的纪律由机器执法，呼应 svelte-reactive-runes）。
- Svelte 5 专项规则点名"store 塞 $state"、`$: ` 残留等迁移期反模式（L4 雷区题的执法版；具体规则名随插件版本演进取官方文档为准）。
- CI 三件套顺序固化：`eslint . → prettier --check → sv check`，全绿才进 build（呼应 node-testing 的 CI 话题、02-typescript 的 tsc --noEmit 位）。

## 五、编辑器与其他工具

- VS Code **Svelte for VS Code** 扩展=语言服务（L7 首关的 svelte2tsx 引擎）+ 格式化内嵌；`editor.defaultFormatter` 显式指给 svelte 扩展可免 prettier 双打架。
- **svelte.dev/playground**：分享最小复现的通用货币——issue、提问、面试白板都认它（性能关第 9 题也让你读产物）。
- `npx svelte-migrate`（已并入 `sv migrate`）：routes→路由重组等官方 codemod 集合。
- 浏览器 devtools 无官方专员工具？——Svelte 的哲学是把可观测性放在**编译产物可读 + $inspect**（L6），而非外置检查器；对照 Vue devtools/React DevTools 是运行时框架的必然配套，编译器派少这一环是 trade-off 不是缺失。

## 六、自检清单

- [ ] 说得出 sv create/add/check/migrate 四命令分工与 degit 教程的过时判据。
- [ ] 能画 vite ↔ plugin-svelte ↔ compiler ↔ preprocessor 的职责链。
- [ ] `runes: true/探测/false` 三档行为与选型说得清。
- [ ] eslint/prettier/CI 三件套顺序与"svelte 规则执法 L1 纪律"的对应关系。
- [ ] 知道 Svelte 没有运行时 devtools 的原因与替代手段。

---

🚀 **下一关（L8 开篇）**：`svelte-compiler-architecture`——读一遍编译产物：模板如何变成 create/update 函数、DOM 靶向更新代码长什么样、产物里到底还剩多少"框架"。
