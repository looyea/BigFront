# L2 作业：库与工具集成

## 一、知识回顾
1. `transform/transformSync/transformFile` 三 API 与 `{ code, map }` 返回；opts 与 .swcrc 的优先级。
2. optionalDependencies 平台二进制与跨机器 lockfile 坑；@swc-node（运行期）vs @swc/core（构建期）。
3. webpack=swc-loader、Rspack 内置、Next 默认、Vite 用 esbuild 的转译层归属；minify 的 compress/mangle/format。

## 二、代码实操
1. 写 20 行 `build.mjs`：`transformSync` 遍历 `src` 的 `.ts` → 写 `dist` 的 `.js`，正确产出 `.map` 与 sourceMappingURL。
2. 给一个 webpack 项目把 babel-loader 换成 swc-loader，保持功能不变，记录构建耗时前后差。
3. 拿一份生产 bundle，分别 `swc -C minify=true` 与 terser 各压，量 gzip 字节+耗时；打开 `drop_console`、设 `mangle.reserved` 验证效果。

## 三、思考题
1. 为什么 API 调用默认不读 `.swcrc`？这体现了什么设计取舍？
2. 若 swc-loader 和打包器各开一次压缩会怎样？正确分工是什么？

## 四、延伸阅读
- SWC 官方：usage/core、usage/swc-loader、configuration/minification
- @swc-node 与 @swc/core 的分工说明（swc-node-vs-swc）

## 五、自查清单
- [ ] 会用 transform 系列 API 并自己落 source map
- [ ] 能诊断「本地好好的、CI 报找不到 @swc/core-linux-x64-gnu」
- [ ] 说得出四大栈各自的转译层
- [ ] 开过 minify 并做过体积/耗时的实测对比
