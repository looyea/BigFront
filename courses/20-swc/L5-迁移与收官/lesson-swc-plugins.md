# 插件系统：JS 与 Wasm 两条路

## 一、先问一句：你真的需要插件吗

SWC 把最常用的转换**内置**了——React 自动 runtime、TS 擦除、styled-components、styled-jsx、装饰器、import 转换等，都在 `jsc.transform` / `jsc.experimental` 里有开关。**能用内置开关解决的，绝不要写插件。** 这是本关第一原则，也是省掉一堆版本兼容麻烦的关键。

## 二、JS 插件（实验、进程内）

早期 SWC 提供过 JS 侧插件接口（在 Node 进程内操作 AST），门槛低但慢（要跨 Rust/JS 边界序列化 AST）、且官方定位实验性。新项目的生产插件路线**不推荐**它——留着了解历史即可。

## 三、Wasm 插件（Rust 生产路线）

真正的生产插件是 **Rust 编译成 Wasm**，在 SWC 原生进程里直接操作 AST、无边界序列化开销：

```jsonc
"jsc": { "experimental": { "plugins": [
  ["@my-org/swc-plugin-foo", { "option": 1 }]
]}}
```

配套生态是 SWC 的 AST crate 与 `ast_tools`/`StructVisitor` 派生。写 Wasm 插件=用 Rust 遍历/改写 AST，能力强但门槛是「会 Rust + 懂 SWC AST 版本」。

## 四、插件与 core 的版本耦合

Wasm 插件历史上和 `@swc/core` 版本强耦合——SWC AST 结构会变，插件按某版 AST 编译，换 core 可能崩。**v1.15 之后引入了更稳定的插件 ABI（`plugin_transform_v2`）**，兼容面改善，但「插件必须和所用 swc 版本对得上」这条心智仍要记：这也是官方 `selecting-swc-core` 文档专门强调「同一项目里各方要用同一版本 @swc/core」的原因。

## 五、内置 transform 盘点（先看有没有再想写）

- `jsc.transform.react.runtime`（automatic/classic）、`importSource`；
- styled-components / styled-jsx / emotion / jest 内联 CSS 等**已内置**于 transform 选项；
- 装饰器（L3）、class 语义、顶层 await（target 决定）；
- React Compiler（SWC 有对应集成，见 configuration/react-compiler）。

盘点下来你会发现：绝大多数「以前要 Babel 插件」的场景，SWC 已内置。剩下的长尾才值得上 Wasm 插件或混合管线。

## 小结
先判断「需不需要插件」——内置开关能解决就别写；JS 插件实验性、不推荐生产；生产走 Rust→Wasm 插件（懂 Rust+AST、注意 v1.15 起 ABI 稳定）；插件与 core 版本强耦合，同项目要统一 @swc/core 版本；react/styled/emotion/decorator 等多已内置。

## 部署预告
列出你项目现有 `babel.config` 里的每一个插件，逐个在 SWC 的 `jsc.transform`/`jsc.experimental` 文档里找有没有对等内置开关，做成一张「Babel 插件 → SWC 内置项 / 需 Wasm 插件 / 无对等」三分类表——这就是下一关迁移的输入。
