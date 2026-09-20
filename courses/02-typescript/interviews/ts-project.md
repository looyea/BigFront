# 面试题 · tsconfig 与工程化

1. **`strict: true` 到底开了哪些子开关？**
   noImplicitAny、strictNullChecks、strictFunctionTypes、strictBindCallApply、strictPropertyInitialization、noImplicitThis、alwaysStrict、useUnknownInCatchVariables。生产项目必须全开。

2. **`target`、`lib`、`module`、`moduleResolution` 各管什么？**
   - target：输出的 JS 语法版本。
   - lib：可用的**内置类型**（DOM、ES2022 等）。
   - module：模块系统语法（commonjs / esnext / nodenext / preserve）。
   - moduleResolution：如何**解析** import 路径（node / bundler / nodenext）。
   ```
   Node ESM 项目常见组合：module: 'nodenext', moduleResolution: 'nodenext'。
   ```

3. **declaration 和 sourceMap 什么时候必须开？**
   发布 npm 库时 declaration 必开（.d.ts 让用户享受类型）；sourceMap 建议开，方便调试回源码。

4. **什么是 incremental build 和 tsbuildinfo？**
   只有改动过的文件被重编译；.tsbuildinfo 记录上次编译图，加速冷启。开启方式 `incremental: true` 或用 composite project references。

5. **path alias（`@/`）怎么配？**
   ```json
   { "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
   ```
   注意：**运行时**也需要 alias（Vite/Webpack/ts-node-paths），TS 编译期只影响类型解析。

6. **tsc、ts-node、tsx、swc、esbuild 的差别？**
   - tsc：官方，慢，最严格。
   - ts-node：Node 里直接跑 TS，慢。
   - tsx：基于 esbuild，快，开发首选。
   - swc / esbuild：只做类型擦除，不做类型检查；速度极快，CI 里通常再单独跑 `tsc --noEmit` 做检查。

7. **类型体操：实现 `DeepPartial<T>`。**
   ```ts
   type DeepPartial<T> = T extends object
     ? { [P in keyof T]?: DeepPartial<T[P]> }
     : T;
   ```
   处理数组/Date/Function 时需要更细的条件。

8. **npm 包发布时 types 字段、"exports" 字段的 .types 顺序？**
   ```json
   "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }
   ```
   types 必须放在**最前面**，否则解析顺序会走错。
