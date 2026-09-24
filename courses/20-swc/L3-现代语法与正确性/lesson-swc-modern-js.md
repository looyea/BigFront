# 装饰器与现代语法

## 一、装饰器有两个不兼容的世界

SWC 里装饰器是**最容易配错**的一块，因为存在两套语义：

- **Legacy（2017-08 提案）**：Angular、NestJS、老 TS `experimentalDecorators` 用的就是它。
- **TC39 Stage 3（标准装饰器）**：TS 5.0+ 默认方向、无 `experimentalDecorators`。

```jsonc
"jsc": { "parser": { "syntax": "typescript",
  "decorators": true          // 开装饰器解析（TS）
}, "transform": { "legacyDecorator": true, "decoratorMetadata": true } }
```

`legacyDecorator` + `decoratorMetadata` 这对组合，正是 NestJS/Angular 项目从 tsc 迁 SWC 时必须显式打开的开关（呼应 15-angular）。忘开 `decoratorMetadata`，依赖 `design:type` 元数据的 DI 会在运行时静默失效。

## 二、别把两套混着开

标准装饰器靠 `parser.decoratorsBeforeExport` 等细项配合，且**不要**同时 `legacyDecorator: true`。你的 TS `tsconfig` 里 `experimentalDecorators` 的取值，应当与 SWC 的 `legacyDecorator` 保持一致——否则 tsc 报错而 SWC 照编，或反之。类型与产物两头对不齐是最坑的。

## 三、class fields / 私有字段 / 顶层 await

这些是「目标矩阵」问题而非开关问题：

- 公开/私有 class 字段（`#x`）：target 够新原样保留，够旧则搬进构造函数或用 WeakMap。
- 顶层 await：需 ESM + target es2017+，CJS 产物无此语义，降不到支持目标会报错。
- import attributes（`with { type: 'json' }`）：跟随较新提案，低 target 会转成兼容形式或报错，查 supported-browsers 确认边界。

## 四、env.coreJs：polyfill 的边界

`env: { "coreJs": 3, "mode": "usage" }` 让 SWC 按用到的 API 注入 core-js 引用片段。三个认知：

1. 它是**按需 import 垫片**，不是把整包 core-js 塞进产物；
2. `mode: usage` 按代码用到的特性注入，`entry` 需在入口手动引 core-js 全量；
3. 它补不上的东西（如某些运行时全局、需要 polyfill 无法伪造的行为）仍要另想办法。

## 小结
装饰器分 legacy（Nest/Angular，须 legacyDecorator+decoratorMetadata）与 TC39 标准两套，别混开且要与 tsconfig 对齐；class fields/顶层 await/import attributes 是 target 矩阵问题；env.coreJs 按需注入垫片而非全量。

## 部署预告
拿一个 NestJS 风格（带 `@Injectable()` + constructor 参数）的 TS 文件，配 `decorators:true + legacyDecorator:true + decoratorMetadata:true` 编译，打开产物确认有没有生成 `Reflect.metadata("design:paramtypes", ...)`；再去掉 `decoratorMetadata` 编一次对比，观察元数据消失。
