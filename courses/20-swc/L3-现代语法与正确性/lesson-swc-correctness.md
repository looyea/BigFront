# 正确性边界：loose 与 interop

## 一、SWC 的定位是「够快且基本够对」

SWC 不是 Babel 的字节级复刻。官方明确列了「与 Babel 的差异」：极端的循环依赖顺序、部分 decorators 细节、某些 helper 的注入方式会有区别。成熟心态是——**不假设两者产物逐字节相同**，只假设「语义等价的多数场景」相同。

## 二、ESM→CJS 的 interop 是最爱翻车处

`module.type = "commonjs"` 时，default 导入导出怎么映射是历史难点：

- 导出的 `__esModule` marker 决定 Babel/Node 消费方怎么解析 default；
- 你 `import def from 'cjs-pkg'` 时，def 到底拿 `module.exports` 还是 `module.exports.default` 取决于 interop helper；
- SWC 有 `module.strict`、`importInterop` 等开关处理这些边角。

规则：**尽量让产物模块格式与运行时一致**（Node ESM 就 output es6 + package type:module，别混）。

## 三、loose 模式：更快更小但语义更松

`jsc.loose: true`（及各 transform 的 loose）会：把 class 展开成更朴素的原型写法、简化 `_extends`/`createClass` helper、放宽 some 语义。产物更小更可读，但破坏严格的 `instanceof`/`class` 语义细节。**库作者要慎开**（可能让下游期望落空），业务应用一般无感。

## 四、排查方法论：同入口两边各编一遍

当「用 Babel 好好的，换 SWC 行为变了」，别猜——做 controlled diff：

1. 固定一个最小复现入口；
2. Babel 编一份、SWC 编一份；
3. 并排读产物差异（重点看 helper、模块互操作、装饰器展开）；
4. 若确属 SWC 已知差异，查官方差异清单确认是预期，再决定绕法（关 loose / 调 interop / 保留个别 Babel 处理）。

## 小结
SWC 非 Babel 复刻、产物不逐字节相同；ESM/CJS interop（__esModule、default 映射、importInterop）是翻车高发；loose 换体积速度但语义松、库作者慎用；排查靠同入口两边各编一遍做 controlled diff。

## 部署预告
写一个既含 `export default` 又含循环 import 的小模块，分别用 Babel（preset-env+preset-typescript）和 SWC（module.type=commonjs）各编一遍，对比两份产物里 `__esModule` 与 default helper 的差异，并记录哪个在 Node 里 require 更顺。
