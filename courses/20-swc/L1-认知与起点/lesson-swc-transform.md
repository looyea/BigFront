# 转译内核：TS/JSX 到目标产物

## 一、SWC 到底做几件事

一个源文件进 `swc`，走四步：**解析**（按 parser 类型建 AST）→ **校验/擦除类型**（TS 类型只删不查）→ **语法变换 transform**（JSX、class fields、装饰器、降级）→ **打印**成目标 JS + source map。

## 二、TS：擦除而非检查

SWC 的 TypeScript 处理是 `isolatedModules` 式的——它逐文件删类型，**不做跨文件类型检查**。类型错误 tsc 才会报，SWC 视若无睹。所以「SWC 编译通过」≠「类型正确」，CI 里 `tsc --noEmit`（或 vue-tsc）这步不能省。这条分工在 L4 的 tsdown/d.ts 关会再次强调。

## 三、JSX 两种 runtime

```jsonc
"jsc": { "transform": { "react": {
  "runtime": "automatic",      // React 17+：编译成 import {jsx} from 'react/jsx-runtime'
  "importSource": "preact"     // 换 JSX 工厂来源（preact/solid 等）
}}}
```

`automatic` 免写 `import React`；`classic` 仍编译成 `React.createElement`。现代项目默认 automatic。没有 React 也能编 JSX——把 importSource 指到你的框架即可。

## 四、source map

`"sourceMaps": true`（或 `"inline"`）产出映射；`inlineSourcesContent: true` 把源码内联进 map，便于发布时不带源文件也能调试。库作者尤其要盯 map 的正确性——转译后行号错位是最坑的线上体验。

## 五、看产物：三种 target 一张表

同一份 `async function` + 可选链 + class fields：

| target | async | ?. 可选链 | class field |
|---|---|---|---|
| esnext | 原样 | 原样 | 原样 |
| es2015 | regenerator 式生成器 | 三元判空 | 构造函数赋值 |
| es5 | 生成器 + helper | 更深判空 | `_defineProperty` helper |

降级越深、注入的 helper 越多——这也是为什么盲目把 target 定到 es5 会让包变大。

## 小结
SWC 转译 = 解析+类型擦除+语法变换+打印；TS 只擦不查（tsc 补检查）；JSX 认 automatic/classic 两 runtime 可换 importSource；sourceMaps 决定可调试性；target 越深产物越大。

## 部署预告
用 `npx swc` 对同一个同时含 async、可选链、class fields、TS 泛型的文件，分别 target esnext/es2015/es5 编三遍，把三份产物并排 diff，数一数每种降级各自注入了几个 helper 函数。
