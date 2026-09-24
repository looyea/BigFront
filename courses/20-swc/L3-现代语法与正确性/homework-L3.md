# L3 作业：现代语法与正确性

## 一、知识回顾
1. 装饰器两套（legacy vs TC39 标准）与 legacyDecorator+decoratorMetadata；class fields/顶层 await 的 target 矩阵；env.coreJs 边界。
2. SWC「够快且基本够对」的正确性观；ESM/CJS interop（__esModule、default 映射）；loose 的代价；controlled diff 排错法。
3. 转译是纯函数可缓存；.swcrc 要进 buildDependencies；冷编瓶颈常在 I/O；先拆阶段计时再优化。

## 二、代码实操
1. 拿一个带 `@Injectable()` 的 Nest 风格文件，配 `decorators+legacyDecorator+decoratorMetadata` 编译，产物里确认 `design:paramtypes` 元数据；关掉 metadata 再编一次对比。
2. 写一个含 `export default` + 循环 import 的模块，Babel 与 SWC(module.type=commonjs) 各编一遍，对比 `__esModule` 与 default helper。
3. 给中型 webpack 项目开 `cache.type:'filesystem'` 并把 .swcrc 纳入 buildDependencies，测「冷启动 vs 改一个文件后增量」耗时各三次取中位。

## 三、思考题
1. 为什么库作者应慎用 loose，而业务应用多半无感？
2. 「用了 SWC 还不够快」——给出三种比换编译器更可能的优化方向。

## 四、延伸阅读
- SWC 官方：configuration/compilation、configuration/supported-browsers、migrating-from-tsc
- swc-loader 与缓存失效相关文档

## 五、自查清单
- [ ] 能按 legacy/标准正确配装饰器并对齐 tsconfig
- [ ] 知道 interop/loose 的正确性边界并会做产物 diff
- [ ] 配置过 webpack 持久缓存并验证配置改动能失效
- [ ] 会拆解构建耗时定位真实瓶颈
