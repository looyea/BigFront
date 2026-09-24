# 打包器与框架里的 SWC

## 一、webpack：swc-loader 换掉 babel-loader

```js
// webpack.config.js
module.exports = { module: { rules: [{
  test: /\.(t|j)sx?$/, exclude: /node_modules/,
  use: { loader: 'swc-loader', options: { jsc: { parser: { syntax: 'typescript', tsx: true },
    transform: { react: { runtime: 'automatic' } } } } }
}]}};
```

配置对象形状就是 `.swcrc`。收益：大仓冷启动转译时间从分钟级到秒级。Rspack 用户更省事——它**内置** `builtin:swc-loader`，无需装包。

## 二、Rspack：以 SWC 为 transform 内核

Rspack 是 webpack 兼容的 Rust 打包器，JS 转译层直接就是 SWC。所以「学 SWC 配置」和「配 Rspack」高度重叠——会写 swc 的 `jsc`/`module`/`minify`，就会配 Rspack 的 `module.rules`（builtin:swc-loader）与 `optimization.minimizer`（SWC minifier）。

## 三、Next.js：默认已启用

Next v12+ **默认用 SWC** 做编译与 minify，你不需要任何配置——写 `next.config.js` 里的实验开关或 babel 插件反而可能把它旁路。规则：

- 项目里有 `.babelrc`/`babel.config.js` → Next 回退 Babel（SWC 让位）；
- 需要 styled-components/styled-jsx 等 → 用 `next.config` 的 SWC 插件开关，而不是加 Babel 插件（呼应 07-nextjs）。

## 四、Vite / Rollup 里轮不到它

Vite 的 dev 用 esbuild 转译、build 用 Rollup（可 esbuild minify），默认链路里没有 SWC 的位置。别为了「用 SWC」在 Vite 里硬塞 loader——各工具有各自的默认最优解。SWC 的主场是 webpack/Rspack 生态、Next、以及纯 CLI/自建构建。

## 五、选打包器＝选转译层

一张归属表帮你定位：

| 你的栈 | JS 转译层 | 要不要自己配 SWC |
|---|---|---|
| Next.js | SWC（内置） | 基本不用，除非插件 |
| Rspack | SWC（内置） | 写规则即可 |
| webpack | 默认 babel，可选 swc-loader | 想要快就配 |
| Vite | esbuild + Rollup | 一般不涉及 |

## 小结
webpack 用 swc-loader、Rspack 内置 swc-loader、Next 默认 SWC（有 babel 配置则让位）、Vite/Rollup 用 esbuild；学 SWC 配置与配 Rspack 高度重叠；选打包器在很大程度上就是选转译层。

## 部署预告
挑你能跑的一个：给一个 webpack 项目把 babel-loader 换成 swc-loader（保持功能不变，记录构建耗时前后差）；或打开 Next 项目跑 `next build`，在产物里找到 SWC 注入的 jsx-runtime import 证明它在工作。
