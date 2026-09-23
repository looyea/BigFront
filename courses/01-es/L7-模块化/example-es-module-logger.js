// 命名导出
export const level = "INFO";
export function log(msg) {
  return `[${level}] ${msg}`;
}
// 默认导出（一个模块一个主角）
export default { log };
