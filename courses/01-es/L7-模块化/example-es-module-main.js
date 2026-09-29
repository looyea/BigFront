// 示例：ESM 具名导入 / 命名空间导入 / 默认导入
// 目的：从同目录模块 example-es-module-logger.js 导入不同形式的导出
// 运行：node "courses/01-es/L7-模块化/example-es-module-main.js"
import { log, level } from "./example-es-module-logger.js";   // 命名导入（花括号，名字必须对得上）
import * as logger from "./example-es-module-logger.js";       // 命名空间导入（整个模块收成对象）
import defaultLogger from "./example-es-module-logger.js";      // 默认导入（无花括号，本地名随意）

console.log(level);                              // 'INFO'
console.log(log("hello ESM"));                   // '[INFO] hello ESM'
console.log("命名空间方式 =>", logger.log("hi"));  // '[INFO] hi'
console.log("默认导出 =>", defaultLogger.log("via default")); // '[INFO] via default'

// ❌ 错误用例 1：命名导入拼错名字 → 解析期 SyntaxError
// import { noSuchExport } from "./example-es-module-logger.js";
// 后果：SyntaxError: The requested module does not provide an export named 'noSuchExport'（不是运行时，而是加载时就报错）
// ❌ 错误用例 2：把默认导出当命名导出 import { default } 可，但写成 import { log } from 别模块的默认主角会落空
// ✅ 正确：默认导出用 import 本地名（无花括号）；具名导出才用花括号且名字必须一致
