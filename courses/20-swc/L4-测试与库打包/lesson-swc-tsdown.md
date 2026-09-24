# 库打包：转译用 SWC、类型用 tsc

## 一、库构建的两条正交轴

发一个 TS/组件库要同时解决：① **把源码变成 JS 产物**（转译+打包+压缩）；② **把类型变成 .d.ts**（类型检查与声明生成）。SWC 只吃下第①轴的转译部分——它**不产 d.ts**。所以「SWC 打包库」的真实形态永远是「SWC/untransform 出 JS + tsc/vue-tsc 出类型」的组合，别指望一个编译器全包。

## 二、和现代打包器的接合

Rolldown/Rspack/tsdown 这类新一代库打包工具，转译层可选 SWC 路线（或其等价的「去类型语法」处理）。你只需配三件事：

```js
// 心智示例（各工具字段名略有差异）
{ entry: 'src/index.ts',
  external: ['react', 'vue'],   // 把 peer/宿主依赖排除出包
  formats: ['es', 'cjs'],        // 双格式产出
  dts: true }                    // 另起 tsc 生成 .d.ts
```

`external` 决定什么留在包里——把框架/peerDep 排出去是库体积的第一原则。

## 三、ESM + CJS 双格式与 exports

现代库常同时发 ESM 与 CJS：产物出 `dist/index.mjs` + `dist/index.cjs`，在 package.json 用 `exports` 的 `import`/`require` 条件分别指过去（下关详展）。SWC 侧靠 `module.type` 分别输出 es6/commonjs 两套。

## 四、d.ts 生成的心智

- `tsc --emitDeclarationOnly` 出 .d.ts（慢，但要全量类型信息）。
- Vue 组件库用 `vue-tsc`（呼应 09-vue）。
- 前瞻：TS 的 `isolatedDeclarations` 旨在让 d.ts 能**逐文件、无全量类型检查**地生成，未来可与 SWC 这类逐文件转译器同速——但这是趋势不是现状，当下 d.ts 仍是库构建的时间大头。

## 五、验证产物别只「能 import」

打完包必须：`npm pack --dry-run` 看文件清单、用真实 Node ESM/CJS 各 require/import 一次确认 default 与具名都取得到、跑一遍针对 **产物**（非源码）的测试。源码测试过不代表打包产物对。

## 小结
库构建有「转译」与「类型」两条正交轴，SWC 只做转译不产 d.ts；接合新一代打包器靠 entry/external/formats/dts；ESM+CJS 双格式靠 module.type 与 exports；d.ts 现仍归 tsc/vue-tsc（isolatedDeclarations 是前瞻）；产物要用 pack dry-run + 真 require/import + 针对产物测试三验。

## 部署预告
用一个极小组件/工具库源码，跑通「SWC 出 ESM+CJS 双 JS + tsc 出 d.ts」的最小脚本：配 external 排除框架、exports 指向两套产物，最后 `npm pack --dry-run` 检查清单，并在干净目录用 node 分别 import/require 验证。
