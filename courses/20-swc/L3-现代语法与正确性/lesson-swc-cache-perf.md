# 缓存与增量构建

## 一、快不等于不用缓存

SWC 单文件转译极快，但在大仓里，「每个文件每次构建都重转」仍是浪费。转译结果对 (源码 + 配置) 是纯函数——满足缓存条件。webpack 5 的 **persistent cache**（`cache.type: 'filesystem'`）会让未变模块直接复用上次的 SWC 产物，增量重建从「重转全量」变成「只转改动的」。

## 二、swc-loader 与 webpack 缓存的配合

`swc-loader` 本身无状态，缓存交给 webpack 层：确保 `cache: { type:'filesystem', buildDependencies: { config: [__filename] } }`。把 `.swcrc` 加进 buildDependencies，配置一改缓存自动失效——否则你会遇到「改了 .swcrc 产物没变」的假象（其实是缓存吃了）。

## 三、CLI 的并发与 --sync

`@swc/cli` 默认多进程/并发转译；`--sync` 强制同步逐个编（排错时看清晰日志用）。超大目录首次冷编瓶颈常在 **I/O（读文件/写文件）** 而非 CPU——SWC 把 CPU 压得极低后，磁盘读写反成上限。认识这点，就不会对「已经用了 SWC 为什么还不够快」感到困惑。

## 四、什么时候 SWC 不是瓶颈

把构建拆开计时：解析转译 / 类型检查 / 打包 / 压缩 / 依赖安装 / I/O。常见真相是——**tsc 类型检查**或 **node_modules 安装/打包** 才是大头，SWC 转译只占小头。此时优化方向应是「类型检查旁路（isolatedDeclarations、增量、vue-tsc --noEmit 移出关键路径）」，而非再抠 SWC 配置。

## 五、三组对照实测

同输入分别测 esbuild / SWC / tsc 的纯转译耗时（`transpileOnly` 心智，不含类型检查）。典型结果：esbuild ≈ SWC（都是数量级快于 tsc），两者互有胜负取决于语法降级深度与文件规模。拿你自己的真实代码测，别引用别人的数字当结论。

## 小结
转译对(源码+配置)是纯函数、可缓存，靠 webpack persistent cache 做增量；.swcrc 要进 buildDependencies 防缓存吃配置改动；冷编瓶颈常在 I/O 而非 CPU；先拆解计时再优化——类型检查/依赖安装往往才是大头；三组对照用自己代码实测。

## 部署预告
给一个中型 webpack 项目开 `cache.type:'filesystem'`，测「冷启动」与「改一个文件后的增量重建」耗时各三次取中位；再手动改 `.swcrc` 的一个 target，验证缓存是否因 buildDependencies 正确而失效（产物应随之变化）。
