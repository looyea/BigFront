# Vite CSS 处理管线

> 目标：**掌握 Vite 对 CSS 的全套处理**——原生 CSS / CSS Modules / 预处理器(Sass/Less/Stylus) / PostCSS / Tailwind / CSS Modules 命名约定 / @import 内联 / 生产提取与代码分割。

---

## 一、内置支持的 CSS 能力

### 1.1 @import 内联

```css
/* index.css */
/* 目的：@import 内联—Vite 用 postcss-import 把子文件合并，避免浏览器串行拉 CSS */
@import './variables.css';   /* ✅ 构建时内联进同一文件，不发额外请求 */
@import './base.css';
/* ❌ 以为 @import 会保留成浏览器逐级加载→Vite 已内联；若放在非首行会被 CSS 规范忽略（@import 必须置顶）*/
```

Vite 自动内联所有 `@import`（用 postcss-import）→ 避免浏览器串行加载 CSS。开发时同样处理（CSS 文件通过 JS style inject 注入）。

### 1.2 url() 重写

```css
/* 目的：url() 重写—相对路径被 resolve 并转成 import，最终输出 hash 化路径 */
.bg { background: url('./images/hero.png'); }   /* ✅ 构建后→ url('/assets/hero.xxxx.png')，与 JS import 同等待遇 */
/* ❌ 写成 root 相对 url('/images/hero.png') 指向 public/，不走 hash、不经 pipeline */
```

Vite 解析 `url()` → 按相对路径 resolve → 转成 import → 最终输出 hash 化路径。和 JS import 享受同等待遇。

### 1.3 原生 CSS Nesting + :has()

Chrome 112+/Safari 16.5+ 原生支持——Vite 不转译（直接透传）。如果需要降级到更老浏览器 → 用 PostCSS 插件 `postcss-nesting`。

---

## 二、CSS Modules

### 2.1 基本用法

文件命名 `Component.module.css`：

```css
/* Button.module.css */
/* 目的：CSS Modules—文件名带 .module.，类名编译为唯一 hash，作局部作用域 */
.primary { color: white; background: blue; }   /* ✅ 编译后→ .Button_primary__x7f2 不与他页冲突 */
.large { font-size: 18px; }
/* ❌ 文件名漏写 .module.（如 Button.css）→ 不启用模块作用域，类名全局泄漏互相污染 */
```

```vue
<!-- Vue 3 -->
<!-- 目的：CSS Modules 在 Vue 中的用法—import 对象后绑到 :class -->
<script setup>
import styles from './Button.module.css';   // ✅ 拿到 { primary: 'Button_primary__...', ... } 映射
</script>
<template>
  <button :class="styles.primary">Click</button>   <!-- ✅ 用解析后的唯一类名 -->
</template>
```

```jsx
// React
// 目的：CSS Modules 在 React 中的用法—className 取映射后键
import styles from './Button.module.css';
<button className={styles.primary}>Click</button>   // ✅ 同样拿到唯一类名
// ❌ 模板里直写 className="primary"（原类名）→ 与 hash 后的真实类名对不上，样式不生效
```

### 2.2 命名约定

```ts
// 目的：CSS Modules 命名约定—把短横线类名自动映射为驼峰键
css: {
  modules: {
    localsConvention: 'camelCase',  // ✅ .my-class → 同时保留 styles['my-class'] 与 styles.myClass
  }
}
// ❌ 选了 camelCaseOnly 但仍用 styles['my-class'] 取→只剩驼峰键，原短横线键不存在→undefined
```

| 选项 | 效果 |
| --- | --- |
| `'camelCase'` | 保留原 + camelCase 双 key |
| `'camelCaseOnly'` | 只保留 camelCase |
| `'dashes'` | 只转 dash → camel |
| `'none'` | 原名 |

### 2.3 组合 `composes`

```css
/* 目的：composes—CSS Modules 的“继承”，一个类复用另一个类的样式而不重复写 */
.base { padding: 8px 16px; border-radius: 4px; }
.primary { composes: base; background: blue; }   /* ✅ primary 同时拥有 base 的 padding/圆角 + 自己的背景 */
/* ❌ composes 引的类必须存在于同一模块作用域（或 from './other.module.css'），引全局普通类无效 */
```

`composes` = CSS Modules 的"继承"——class 复用时不重复写。

---

## 三、预处理器

### 3.1 内置集成

```bash
# 目的：装预处理器—Vite 按扩展名自动调用对应编译器，零配置
npm i -D sass    # ✅ .scss / .sass
npm i -D less    # ✅ .less
npm i -D stylus  # ✅ .styl
# ❌ 不装依赖就 import './x.scss' → 报 Preprocessor dependency "sass" not found
```

零配置——`import './style.scss'` 直接可用。Vite 自动检测扩展名调用对应编译器。

### 3.2 全局变量注入

```ts
// 目的：全局变量注入—每个 SCSS 自动 prepend @use，免逐文件手写 import
css: {
  preprocessorOptions: {
    scss: {
      additionalData: `@use "@/styles/vars" as *;\n`,   // ✅ 所有 scss 开头自动注入，变量全局可用
    }
  }
}
// ❌ additionalData 里用旧版 @import 写 vars → sass 现代版弃用 @import 会告警；应用 @use；行末 \n 忘写会与首行粘连报错
```

每个 SCSS 文件自动 prepend `@use` → 不用每个文件手动 import。

### 3.3 modern-compiler API（sass 1.77+）

```ts
// 目的：sass 新 API—modern-compiler 更快且未来兼容（sass 1.77+）
css: {
  preprocessorOptions: {
    scss: {
      api: 'modern-compiler',  // ✅ 新 API（legacy 已弃用会输出 deprecation 警告）
    }
  }
}
```

---

## 四、PostCSS

### 4.1 配置文件

```js
// postcss.config.js（项目根，Vite 自动检测）
// 目的：PostCSS 插件链—预设降级+自动前缀+嵌套，按数组顺序依次处理 CSS
export default {
  plugins: {
    'postcss-preset-env': { stage: 1 },   // ✅ 按 caniuse 降级现代 CSS 并自加前缀
    autoprefixer: {},                      // ✅ 补 -webkit- 等厂商前缀
    'postcss-nested': {},                   // ✅ 支持 & 嵌套写法
  }
}
// ❌ 同时装了 postcss-preset-env 与 autoprefixer 且 preset-env 已含前缀→重复跑无大错但多余；若项目根无此文件则插件完全不生效
```

或 `css.postcss` 指定自定义路径。

### 4.2 Tailwind CSS

```bash
# 目的：安装并初始化 Tailwind（-p 同时生成 postcss.config）
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p    # ✅ 生成 tailwind.config.js + postcss.config.js
```

```css
/* src/style.css */
/* 目的：Tailwind 三个指令—分别注入基础样式/组件类/工具类 */
@tailwind base;        /* ✅ 重置+全局基础 */
@tailwind components;  /* ✅ 可复用组件类 */
@tailwind utilities;   /* ✅ 工具类（最终按使用情况只保留用到的，否则全量巨大） */
/* ❌ 忘了在主 CSS 里 import 本文件 → 所有 className 无样式，页面无样式裸奔 */
```

Vite + Tailwind = PostCSS pipeline（tailwind 是 postcss 插件）。

### 4.3 Vite 内置 autoprefixer

Vite 6 **不再内置** autoprefixer——需自行安装。或依赖 `browserslist` + `postcss-preset-env` 自动加前缀。

---

## 五、生产构建 CSS 处理

### 5.1 提取

`vite build` → 所有 CSS **从 JS 中提取**成独立 `.css` 文件 → `<link rel="stylesheet">`（减少 JS 体积 + 并行下载）。

```ts
// 目的：按 chunk 拆 CSS—异步 chunk 的样式单独成文件，随路由按需加载
build: { cssCodeSplit: true }  // ✅ 默认 true：每个异步 chunk 对应独立 CSS
// ❌ 设为 false → 所有 CSS 合并单文件，首屏就要下完全部站点样式，LCP 变差
```

### 5.2 Minify

生产 CSS 自动压缩（Lightning CSS 默认 / cssnano 可选）：去注释/空白/短写值。

### 5.3 内联

如果 CSS 很小 → `assetsInlineLimit` 以下 → 内联到 JS style inject。

---

## 六、开发 vs 生产 CSS 行为差异

| 维度 | Dev | Build |
| --- | --- | --- |
| 注入方式 | JS `<style>` 标签动态插入 | 提取到 `.css` 文件 |
| HMR | 替换 CSS 内容（style 标签 patch） | N/A |
| @import | 内联 | 内联 |
| 压缩 | 不压缩 | Lightning CSS minify |
| Source Map | 默认关闭（可 `css.devSourcemap: true`） | 跟 `build.sourcemap` |

---

## 七、CSS 全局样式和按需加载

```js
// 目的：全局样式 vs 路由级按需样式—入口 import 进主包，组件内 import 随 cssCodeSplit 按需加载
// 全局：main.js 里 import
import '@/styles/global.css';   // ✅ 全局基础样式，随入口加载

// 路由级：组件内 import → cssCodeSplit 后按需加载
// Cart.vue 里
import './cart-styles.css';  // ✅ 只有路由到 /cart 时才加载这个 CSS
// ❌ 把只在某页用的大样式表放 global 里 import → 首页白白多下无关 CSS
```

---

## 八、自检清单

- [ ] .module.css 和非 module.css 的区别？
- [ ] `additionalData` 解决什么痛点？
- [ ] cssCodeSplit false 的效果？
- [ ] CSS Modules 的 composes 是什么？
- [ ] dev 时 CSS 怎么注入 DOM？build 时呢？
- [ ] Lightning CSS 在 Vite 里做什么？

---

## 🚀 部署预告

- **Critical CSS**：构建时 `vite-plugin-critical` 提取首屏 CSS 内联到 HTML `<head>`；
- **Font preload**：`<link rel="preload" as="font" crossorigin>` 放 index.html；
- **CSS CDN**：`base` 对 CSS 文件同样生效 → 走 CDN 永久缓存。

下一关 `vite-env` 讲环境变量和模式。
