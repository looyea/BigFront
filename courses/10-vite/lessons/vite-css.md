# Vite CSS 处理管线

> 目标：**掌握 Vite 对 CSS 的全套处理**——原生 CSS / CSS Modules / 预处理器(Sass/Less/Stylus) / PostCSS / Tailwind / CSS Modules 命名约定 / @import 内联 / 生产提取与代码分割。

---

## 一、内置支持的 CSS 能力

### 1.1 @import 内联

```css
/* index.css */
@import './variables.css';
@import './base.css';
```

Vite 自动内联所有 `@import`（用 postcss-import）→ 避免浏览器串行加载 CSS。开发时同样处理（CSS 文件通过 JS style inject 注入）。

### 1.2 url() 重写

```css
.bg { background: url('./images/hero.png'); }
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
.primary { color: white; background: blue; }
.large { font-size: 18px; }
```

```vue
<!-- Vue 3 -->
<script setup>
import styles from './Button.module.css';
</script>
<template>
  <button :class="styles.primary">Click</button>
</template>
```

```jsx
// React
import styles from './Button.module.css';
<button className={styles.primary}>Click</button>
```

### 2.2 命名约定

```ts
css: {
  modules: {
    localsConvention: 'camelCase',  // .my-class → styles.myClass
  }
}
```

| 选项 | 效果 |
| --- | --- |
| `'camelCase'` | 保留原 + camelCase 双 key |
| `'camelCaseOnly'` | 只保留 camelCase |
| `'dashes'` | 只转 dash → camel |
| `'none'` | 原名 |

### 2.3 组合 `composes`

```css
.base { padding: 8px 16px; border-radius: 4px; }
.primary { composes: base; background: blue; }
```

`composes` = CSS Modules 的"继承"——class 复用时不重复写。

---

## 三、预处理器

### 3.1 内置集成

```bash
npm i -D sass    # .scss / .sass
npm i -D less    # .less
npm i -D stylus  # .styl
```

零配置——`import './style.scss'` 直接可用。Vite 自动检测扩展名调用对应编译器。

### 3.2 全局变量注入

```ts
css: {
  preprocessorOptions: {
    scss: {
      additionalData: `@use "@/styles/vars" as *;\n`,
    }
  }
}
```

每个 SCSS 文件自动 prepend `@use` → 不用每个文件手动 import。

### 3.3 modern-compiler API（sass 1.77+）

```ts
css: {
  preprocessorOptions: {
    scss: {
      api: 'modern-compiler',  // 新 API，更快 + 未来兼容
    }
  }
}
```

---

## 四、PostCSS

### 4.1 配置文件

```js
// postcss.config.js（项目根，Vite 自动检测）
export default {
  plugins: {
    'postcss-preset-env': { stage: 1 },
    autoprefixer: {},
    'postcss-nested': {},
  }
}
```

或 `css.postcss` 指定自定义路径。

### 4.2 Tailwind CSS

```bash
npm i -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```css
/* src/style.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Vite + Tailwind = PostCSS pipeline（tailwind 是 postcss 插件）。

### 4.3 Vite 内置 autoprefixer

Vite 6 **不再内置** autoprefixer——需自行安装。或依赖 `browserslist` + `postcss-preset-env` 自动加前缀。

---

## 五、生产构建 CSS 处理

### 5.1 提取

`vite build` → 所有 CSS **从 JS 中提取**成独立 `.css` 文件 → `<link rel="stylesheet">`（减少 JS 体积 + 并行下载）。

```ts
build: { cssCodeSplit: true }  // 默认 true：每个异步 chunk 对应独立 CSS
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
// 全局：main.js 里 import
import '@/styles/global.css';

// 路由级：组件内 import → cssCodeSplit 后按需加载
// Cart.vue 里
import './cart-styles.css';  // 只有路由到 /cart 时才加载这个 CSS
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
