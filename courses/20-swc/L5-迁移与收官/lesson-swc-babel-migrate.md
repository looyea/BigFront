# 从 Babel 迁移：预设对照表

## 一、三大预设的直译

| Babel | SWC 对应 |
|---|---|
| `@babel/preset-env`（targets） | `env.targets`（browserslist）或 `jsc.target` |
| `@babel/preset-env`（corejs polyfill） | `env.coreJs` + `env.mode` |
| `@babel/preset-react`（runtime:automatic） | `jsc.transform.react.runtime = "automatic"` |
| `@babel/preset-react`（pragma） | `jsc.transform.react.pragma` / classic runtime |
| `@babel/preset-typescript` | `jsc.parser.syntax = "typescript"`（自动擦类型） |

preset 的「组合」在 SWC 里变成「几组正交开关」——parser 决定怎么读、transform 决定 JSX/装饰器怎么变、env/target 决定降到哪、module 决定产物格式。心智从「装插件」转成「配开关」。

## 二、@babel/plugin-* 怎么办：三层处理

1. **有内置对等**：react、typescript、装饰器、styled/emotion、jest 相关——直接用 jsc 开关。
2. **有社区 Wasm 插件**：查 SWC 插件仓库，找到就换。
3. **纯 Babel-only、无对等**：这是迁移真正的长尾。三条出路——① 换等价写法去掉该转换；② 保留一条**混合管线**（SWC 做主转译、对少数文件留 Babel）；③ 写自定义 Wasm 插件（成本最高）。

## 三、迁移验收：diff 产物 + 跑测试，双保险

「配置翻译完」不等于「迁移成功」。两步验收缺一不可：

- **产物 diff**：挑典型模块，Babel 与 SWC 各编一遍并排读，重点看 helper、模块互操作、装饰器展开（呼应 L3 正确性关）。
- **测试**：跑**完整**测试套件，且最好针对**编译产物**而非仅源码——因为行为差异只体现在产物上。全绿 + diff 无意外，才算迁完。

## 四、渐进迁移：monorepo 友好

不必一把梭。SWC 支持就近 `.swcrc`，你可以：新包先上 SWC、老包暂留 Babel；或应用先切、库因 interop 敏感最后切。**先迁「转译是瓶颈、且 Babel 插件需求少」的模块**，收益最大风险最小；把「重度依赖冷门 babel 插件」的留到最后。

## 五、别忘了 tsc

从 Babel 迁到 SWC，**类型检查这一路不能丢**。Babel（经 preset-typescript）本来也不查类型，SWC 同样只擦——所以迁移前后 `tsc --noEmit` 都得在。别把「甩掉 Babel」误解成「甩掉类型检查」。

## 小结
preset-env→env.targets、preset-react→jsc.transform.react、preset-typescript→parser.ts，心智从「装插件」转「配开关」；plugin 按「内置/社区插件/无对等」三层处理长尾；验收=产物 diff+针对产物跑全测试双保险；monorepo 可渐进迁移、先易后难；类型检查始终归 tsc。

## 部署预告
挑一个中等复杂度、用了 preset-env+preset-react+preset-typescript 的 Babel 项目，写一份等价 `.swcrc`，先只迁一个子模块：两边各编一遍 diff 产物、跑全量测试；把踩到的「无对等 babel 插件」记录下来，评估走「等价改写 / 混合管线 / Wasm 插件」哪条路。
