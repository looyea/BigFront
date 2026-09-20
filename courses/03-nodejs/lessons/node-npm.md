# Node L2 · package.json 与 npm 工作流

> 🎯 目标：看懂 package.json，会装依赖、写 scripts、区分 dependencies 与 devDependencies

## 一、package.json 三大块

- `dependencies`：运行时依赖（如 express）
- `devDependencies`：开发期工具（如 vite、eslint）
- `scripts`：`npm run xxx` 执行的命令

## 二、依赖与 lockfile

`package-lock.json` 锁定精确版本，保证团队/CI 安装结果一致，**要提交到 Git**。

```bash
npm install express        # 装运行时依赖
npm install -D vite          # 装开发依赖
npm run dev                # 跑 scripts.dev
```

## 三、语义化版本

`^1.2.3` 允许 1.x 的向后兼容更新，`~1.2.3` 只允许补丁位变化，写死 `1.2.3` 则严格固定。

## 四、ESM vs CommonJS

本项目 `"type": "module"` 用 `import`；老项目常见 `require`。混用是新手高频报错来源。
---

> 🚧 这是大前端学院的**骨架关卡**。课文已给出核心概念与最小示例；
> 你可以在 `courses/03-nodejs/lessons/node-npm.md` 里继续扩写，
> 并按同样路径新增/编辑小测(`quizzes/node-npm.json`)与作业(`homework/L2.md`)，
> 平台会自动读取，改动随 Git 提交同步到你的 GitHub。
