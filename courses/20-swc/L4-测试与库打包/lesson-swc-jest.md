# swc-jest：给 Jest 换引擎

## 一、五分钟把 babel-jest 换掉

`@swc/jest` 是一个符合 Jest transformer 接口的薄封装，把转译交给 SWC：

```js
// jest.config.js
module.exports = {
  transform: { '^.+.(t|j)sx?$': ['@swc/jest', {
    jsc: { parser: { syntax: 'typescript', tsx: true },
      transform: { react: { runtime: 'automatic' } } } }] },
};
```

配置对象形状还是 `.swcrc` 那套。收益：TS/JSX 大仓的 Jest 冷启动与单文件转译时间显著下降，甩开 babel-jest 的配置地狱。

## 二、和 22-vitest 的分工

别混淆两条路：**Vitest 用 esbuild 转译、跑在 Vite 管线上**（见 22-vitest）；`@swc/jest` 是给 **Jest** 换转译内核。选型直觉——项目已在 Vite 生态、想要统一 dev/test 管线→Vitest；项目是 Jest 存量、只想把 babel 提速→@swc/jest。两者可以并存于不同子项目，但不必同一测试跑两套。

## 三、装饰器与元数据在测试里

NestJS 测试常栽在装饰器：`@swc/jest` 里要同样开 `legacyDecorator`+`decoratorMetadata`，否则 DI 容器在测试里拿不到元数据、provider 解析失败。这与 L3 的结论一致——测试转译配置要和构建端**对齐**，别出现「编译过、测试里崩」。

## 四、覆盖率 provider

Jest 覆盖率可选 babel-plugin-istanbul 或 v8。走 @swc/jest 时，转译不再经 Babel，istanbul 注入那条链要重新验证；更省心的是 `coverageProvider: 'v8'`，直接采原生 V8 覆盖率、和转译器解耦。

## 五、常见报错速查

- `Cannot use import statement outside a module`：该文件没进 transform 或 ESM/CJS 格式不匹配，补 `module.type`。
- snapshot 序列化差异：转译后对象结构/顺序变化导致，重录 snapshot 前先在未换引擎时留基线。
- 装饰器 undefined：见第三节，补元数据开关。

## 小结
@swc/jest 用 Jest transform 接口把转译交给 SWC、配置即 .swcrc；与 Vitest（esbuild+Vite）是两条路、按生态选；测试端装饰器/元数据开关要与构建端对齐；覆盖率优先 v8 provider 与转译器解耦；import/报错先看格式与 transform 命中。

## 部署预告
给一个现有 Jest+babel-jest 的 TS 项目换 @swc/jest：改 transform 配置、跑 `jest --coverage --coverageProvider=v8`，记录冷启动耗时前后差；故意注释掉 decoratorMetadata 看一个 Nest 测试是否失败，验证「配置要对齐」的结论。
