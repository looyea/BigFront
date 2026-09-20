// 运行：node courses/01-es/examples/es-module/main.js
import { log, level } from "./logger.js";        // 命名导入
import * as logger from "./logger.js";           // 命名空间导入

console.log(level);
console.log(log("hello ESM"));
console.log("命名空间方式 =>", logger.log("hi"));
