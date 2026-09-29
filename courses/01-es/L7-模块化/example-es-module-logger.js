// 示例：命名导出 + 默认导出（供 example-es-module-main.js 导入）
// 目的：演示一个模块同时提供具名成员（level/log）与一个默认主角
// 命名导出
export const level = "INFO";
export function log(msg) {
  return `[${level}] ${msg}`;
}
// 默认导出（一个模块一个主角）
export default { log };
