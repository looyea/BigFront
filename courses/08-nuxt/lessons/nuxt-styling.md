# 样式体系：全局 CSS、原子化引擎与同构样式的坑

## 1. 三条样式入口，职责完全不同

```
① nuxt.config.ts 的 css: []          → 全站/多方复用的基础样式（reset、主题变量、UI 库）
② <style scoped> / <style module>    → 组件私有样式，随组件分包（默认行为！见第 5 节）
③ 运行时注入（useHead 的 style、内联）→ 极少数：用户自定义主题、构建期未知的内容样式
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  css: [
    '~/assets/css/reset.css',
    '~/assets/css/tokens.css',
    { src: '~/assets/scss/main.scss', prepend: true },   // 需要注入在 others 之前时用对象写法
    '@some-ui/lib/styles.css',                            // 第三方库样式
  ],
});
```

顺序规则（记这三条够用）：**模块注册的样式先于用户 css 数组，用户数组按声明顺序，`prepend: true` 提到最前**。真正会咬人的是第三方 UI 库与自己的 reset/token 谁在前——用 `prepend`/`order` 显式控制，而不是靠"看起来对了"。

SCSS/Less 不是内置的：需要 `i --save-dev sass`（10-vite 讲过原因，Vite 把预处理器当可选依赖）。路径别名 `~/`、`@/` 在 `@import` 里可用，但**预处理器里的 `~` 老写法已废**，写 `@use '~/assets/scss/vars' as *;`。

## 2. 原子化引擎接入：两条路线要分清

**路线 A：Tailwind v3 + 官方模块**

```bash
npx nuxt module add tailwindcss     # 自动注入 css、配置 content、加 postcss
```

模块存在的理由就是"把 Nuxt 特有的东西喂给 Tailwind"：自动扫描 `pages/components/composables` 与 **Vue 模板里的动态类名**、支持 layers 里的模板、生成 `.nuxt/tailwind/*` 并处理 SSR 下的样式注入。手接 postcss 也能跑，但你会重复造模块已经解决的轮子（呼应 nuxt-modules 第 1 节的"能力分发"逻辑）。

**路线 B：Tailwind v4（CSS-first）或 UnoCSS**

```ts
// v4 不需要 nuxt 模块，走 Vite 插件（因为它是 CSS 层的编译，属于 10-vite 说的"文件怎么编译"）
vite: { plugins: [tailwindcss()] },
css: ['~/assets/css/main.css'],      // main.css 里 @import "tailwindcss";
```

```ts
// UnoCSS 官方是 Vite 插件，但 Nuxt 有包一层：
modules: ['@unocss/nuxt'],
css: ['uno.css'],   // 或使用模块自动注入
```

选型口诀：**要现成组件生态（shadcn-vue 类）选 Tailwind；要极致体积与自定义规则、且团队能接受自研 shortcuts 选 UnoCSS**。两者的 SSR 注意点是同一个：产物是"按用到的类生成的单个 CSS"，天然可长缓存，但必须确保扫描覆盖所有生成类名的位置（动态拼接 `text-${color}-500` 是最经典的丢样式成因，与 04-vue 的 class 绑定规则叠加后更难查，呼应 vue-class-style-transition）。

## 3. `.client` / `.server` 后缀：CSS 也有"只在一侧"

```ts
css: [
  '~/assets/css/print.css',            // 两侧都进（默认）
  '~/assets/css/editor.client.css',    // 只进客户端包
  '~/assets/css/ssr-only.server.css',  // 只进服务端渲染的样式
]
```

用途比听起来窄但很实在：富文本编辑器/地图/第三方组件的样式在服务端渲染时用不上（组件本身被 `<ClientOnly>` 包着，呼应 nuxt-hydration），把它们挪到 `.client.css` 能直接减小首屏 CSS 体积。反过来，只想在 SSR HTML 里出现的骨架样式可放 server 侧。**判断依据永远是"这段样式服务于哪一侧产出的 DOM"**。

同理组件也有后缀：`components/Foo.client.vue` 只在客户端渲染（服务端渲染注释占位），这是"避免 window 访问炸 SSR"最优雅的手段，比在 setup 里写 `if (import.meta.client)` 更省心（呼应 nuxt-auto-imports 的同名覆盖坑：`Foo.vue` 与 `Foo.client.vue` 同时存在时，Nuxt 会按后缀挑选，自己写 `.client` 却以为在用通用版本是常见误会）。

## 4. 暗色主题与"无闪烁"的样式路径

水合闪烁在样式上有两种典型表现，解法不同：

```
表现 A：先亮色后暗色（主题类名在 onMounted 才打）
解法：主题存 cookie → SSR 读 cookie 直接在 <html> 上写 class/data-theme（nuxt-cookie-session 第 9 题）
      再加 app.head.script 内联同步脚本兜住客户端首帧

表现 B：Tailwind 的 @apply 与 CSS 变量未加载导致首帧无样式（FOUC）
解法：全站基础样式走 css 数组（不进异步 chunk）；关键 CSS 内联（第 5 节的 inlineStyles）
```

**不要**用 `useState` 存主题再靠它切 class——刷新即丢（呼应 nuxt-state 第 3 节的判定口诀）。也不要指望 `<ClientOnly>` 包住 `<style>`：head 与样式由 unhead/Vite 管理，不走组件渲染树（nuxt-seo-meta 第 6 节第 5 条）。

## 5. 样式的分包与首屏成本（这是 Nuxt 特色，Next 没有）

Nuxt 默认 `features.inlineStyles: true`（SSR/预渲染时把组件样式**内联进 HTML** 并移除随 JS 加载的 style 导入）。为什么？因为懒加载路由的 chunk 在客户端是"JS 到齐才渲染"，如果样式在 JS 里，会出现"结构出现但无样式"的闪烁（FOUC）。内联换来首屏正确，代价是：

- HTML 变大（组件样式多时明显）→ 与 payload 瘦身同一场战役（nuxt-perf 会算总账）；
- 相同样式在多个页面重复内联 → 缓存不复用。

可调：`inlineStyles: { allowAsync: false }`（严格内联，包括异步组件）、或对特定大组件用 `.client` 后缀把样式赶出 SSR。**结论：SSG/prerender 页面收益最大；重交互页可关掉内联换小 HTML。**

## 6. 高频坑清单

1. **全局样式写进组件 `<style>`（不加 scoped）**：该组件被懒加载时样式才注入，切走又不回收 → 全站样式忽生忽灭。全局一律走 `css` 数组。
2. **`<style scoped>` 与 `:deep()`**：跨组件改子组件样式必须 `:deep()`，否则选择器带 scope 属性打不中（呼应 vue-sfc-compiler-macros 的编译期属性注入）。
3. **动态类名不被扫描**：Tailwind 丢样式第一位原因；改成完整类名映射表（`{ danger: 'text-red-500' }`）。
4. **CSS 里引用字体/图片路径**：Vite 会做 URL 改写，但 `url()` 指向 `public/` 时不要加 `@/`，指向 `assets/` 时才需要别名（10-vite 的 public 与 assets 之分）。
5. **UI 库 CSS 与 reset 顺序错**：优先级看似失灵，实为加载顺序。用 `prepend` 或对象写法的 `order`。
6. **hydration mismatch 来自样式**：`<div :class="isMobile ? 'a' : 'b'">` 里 isMobile 用 `window` 判定 → 两侧 class 不一致（呼应 nuxt-hydration 三来源）。
7. **CSS Modules 的 `styles` 在 SSR 里为 undefined**：写成 `useCssModule` 或在 script 里 `import cls from './x.module.css'` 均可，但混用两种模板语法会导致服务端少类名。

## 7. 自检清单

- [ ] 全站样式是否只在 `css` 数组声明，组件里只有 scoped/module？
- [ ] 第三方库样式与自己的 token 顺序是否显式控制？
- [ ] Tailwind 扫描是否覆盖所有动态类名位置（有无可拼接写法）？
- [ ] 只有客户端才渲染的组件样式，是否拆到 `.client.css`？
- [ ] 暗色主题首帧是否无闪烁（view-source 检查 `<html>` 上的主题属性）？
- [ ] `features.inlineStyles` 的选择是否基于实测 HTML 体积而非默认值？
- [ ] 预处理器依赖（sass）是否在 devDependencies 且 CI 安装？
- [ ] 字体/图片的 url 是否走对目录（public vs assets）？

## 8. 🚀 部署预告

样式与元信息都到位，进入 L7 工程化第一关 **nuxt-perf**：把 route rules 的缓存、payload 与 HTML 体积、代码分包、Core Web Vitals 四件事连成一条可度量的优化链路——从此"感觉变快了"要变成"数字变了多少"。
