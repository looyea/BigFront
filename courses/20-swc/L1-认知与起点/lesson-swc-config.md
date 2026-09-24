# .swcrc 与 CLI 工作流

## 一、CLI 最小闭环

`@swc/cli` 提供 `swc` 命令：读入文件/目录，按配置转译，写到 outDir。

```bash
npm i -D @swc/core @swc/cli
npx swc src -d dist --delete-dir-on-start
npx swc src -d dist --watch        # 边改边编
npx swc src -d dist -C minify=true # 命令行临时覆盖配置
```

扩展名决定解析：`.ts`/`.tsx`/`.js`/`.jsx`/`.mjs` 各自走对应 parser，SWC 会按文件后缀自动选，通常无需手配。

## 二、.swcrc 的分区结构

放项目根，JSON（带注释需 `.swcrc` 支持或 `swcrc: true` 显式）。顶层三大区：

```jsonc
{
  "jsc": {                         // 编译核心：parser / transform / target
    "parser": { "syntax": "typescript", "tsx": true },
    "transform": { "react": { "runtime": "automatic" } },
    "target": "es2022"
  },
  "module": { "type": "es6" },     // 输出模块格式：es6/commonjs/umd
  "minify": false,                 // 或对象细配
  "env": { "targets": "> 0.25%, not dead" }  // browserslist 驱动降级
}
```

`jsc` 管「怎么解析、语法降到哪」，`module` 管「产物是 ESM 还是 CJS」，两者正交。

## 三、targets：两个入口别搞混

- `jsc.target`：直接写 es3/es5/es2015…esnext，**硬指定**降级目标。
- `env.targets`：写 browserslist 字符串（`> 0.25%, not dead`）或对象，SWC 自动算该降到哪，并可选注入 core-js polyfill。`env` 优先级高于 `jsc.target`。

现代项目主流是 `env.targets` 交给 browserslist，和 stylelint/autoprefixer 共享同一份目标声明。

## 四、改一行看产物：建立反馈回路

拿同一个 `class A { x = 1 }`，把 target 从 esnext 改到 es5 各编一次——你会亲眼看到 class fields 从「原样保留」变成「塞进构造函数」。这份「配置即产物」的直觉，是后所有排查关的地基。

## 小结
CLI 三步（装→swc src -d dist→看产物）跑通闭环；.swcrc 分 jsc/module/minify 三区；降级用 env.targets 交 browserslist；养成改配置立刻看产物的反馈习惯。

## 部署预告
给上一关的 `app.tsx` 建 `.swcrc`：分别设 `"target":"esnext"` 与 `"env":{"targets":"ie 11"}` 各编一次，diff 两个 dist，记录哪些语法被降级、自动 JSX runtime 有没有退化成 createElement。
