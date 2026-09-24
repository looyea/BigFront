# 面试题：压缩与产物（swc-minify）

### 1. (原理类) SWC minify 为什么和转译同一趟更快？
**来源**：https://swc.rs/docs/configuration/minification

转译已建好 AST，压缩复用同一解析结果做常量折叠/死代码删除/改名，省掉「压缩器重新解析一遍 JS」的成本。terser 路线要先 bundle 再 parse。

### 2. (实战类) 开压缩的几种写法？
**来源**：https://swc.rs/docs/configuration/minification

配置 jsc.minify=true 或顶层 minify；对象形态细配 compress/mangle/format；CLI -C minify=true；Next/Rspack 里默认已开。同一开关多入口，按场景选。

### 3. (原理类) compress / mangle / format 各管什么？
**来源**：https://swc.rs/docs/configuration/minification

compress=优化逻辑（删死码、折叠常量、drop_console）；mangle=缩短标识符（可 reserved 豁免）；format=最终输出排版（注释、换行）。三者独立开关。

### 4. (坑类) 压缩后某些反射代码坏了？
**来源**：https://swc.rs/docs/configuration/minification

多半踩了 SWC 的压缩假设（如不依赖 toString、无 TDZ、顶层读取无副作用）或 mangle 改了被字符串引用的名。用 mangle.reserved/keep_classnames 豁免，或对该文件关压缩。

### 5. (对比类) SWC minify 和 terser 体积谁小？
**来源**：https://swc.rs/docs/configuration/minification

总体接近，terser 在极少数重度依赖其 pass 的代码上可能多压一点点，但慢得多。常规业务代码体积差异个位数百分比，速度差异却是数量级。

### 6. (实战类) 怎么公平地比较两个 minifier？
**来源**：https://swc.rs/docs/benchmarks

同一份 bundle 分别走两条链路，量 gzip（甚至 brotli）后的字节数，并各跑数次取中位耗时。别拿不同输入或单次噪声下结论。

### 7. (原理类) drop_console 为什么属于 compress 而非 format？
**来源**：https://swc.rs/docs/configuration/minification

删 console 是「判断该语句无副作用后可移除」的死代码优化，属 compress 的语义分析；format 只做输出字符层面的排版，不改语义。

### 8. (坑类) keep_classnames 什么时候必须开？
**来源**：https://swc.rs/docs/configuration/minification

当你靠 class.name / 构造函数名做注册、序列化、错误上报分类时。mangle 默认会缩类名，依赖名字的程序就崩。生产用 Sentry 按类名聚合的尤其注意。

### 9. (实战类) CSS 能一起用 SWC 压吗？
**来源**：https://swc.rs/docs/configuration/minification

别指望。JS minify 很成熟，CSS 压缩长期非 SWC 主场，交给 lightningcss/cssnano。HTML 有独立 @swc/html。别把 JS 的能力边界外推到 CSS。

### 10. (原理类) passes 参数干嘛？
**来源**：https://swc.rs/docs/configuration/minification

compress.passes 控制优化跑几轮，多轮能挖出更多可折叠/可删的（第一轮的产物给第二轮当输入）。默认较低，追极致体积可加大，换更多编译时间。

### 11. (坑类) 压缩会改变代码行为吗？
**来源**：https://swc.rs/docs/configuration/minification

正确配置下不应。但 SWC 为速度做了假设，违反假设的极端代码（重元编程、依赖 toString、getter 副作用）会变。故大项目要在压缩产物上跑一遍测试，而非只测未压缩。

### 12. (实战类) 纯函数标记 pure 有用吗？
**来源**：https://swc.rs/docs/configuration/minification

有。给无副作用的调用打 /*#__PURE__*/，压缩器才能安全删除未使用的返回值调用（尤其 tree-shaking 友好）。这是与打包器协作的体积优化点。

### 13. (对比类) 为什么 minify 也要「够快的默认」而非最狠？
**来源**：https://swc.rs/docs/configuration/minification

压缩是构建关键路径一环，和转译同趟才划算。SWC 选「足够好的压缩 + 极快的速度」，把极限体积留给可选多 pass 或 terser。工程取舍：多数场景构建时间远比 0.5% 体积重要。

### 14. (实战类) minify 后 sourcemap 还能用吗？
**来源**：https://swc.rs/docs/configuration/minification

能。minify 与转译同趟时会维护映射，最终产出的 .map 能把压缩后的位置映回源码；但压缩删掉的死代码不会有对应项。线上错栈靠这份 map 还原，故生产包应配 sourceMaps 并上传 map（不上到公网）。

### 15. (坑类) 开 mangle 后第三方全局变量被改坏？
**来源**：https://swc.rs/docs/configuration/minification

若代码靠字符串引用全局/属性名，mangle 会改坏。用 mangle.reserved 豁免关键名，或对依赖的库代码不参与 mangle（只压自己源码）。拿不准时先关 mangle 验证行为止确再逐步开。
