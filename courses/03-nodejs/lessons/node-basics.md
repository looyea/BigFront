# Node L1 · 第一个 Node 程序

> 🎯 目标：会用 fs、path，理解 Node 是 JS 的运行时且单线程事件循环

## 一、Node 是什么

Node.js 让 JavaScript 脱离浏览器，在服务器上运行。它基于 Chrome V8 引擎，采用**单线程 + 事件循环 + 非阻塞 I/O** 模型，天然适合高并发的 I/O 密集型任务。

## 二、常用内置模块

- `fs` / `fs.promises`：读写文件
- `path`：安全拼接路径
- `http`：起一个 Web 服务器
- `os`、`process`：环境与进程信息

```js
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const txt = await readFile(path.resolve('a.txt'), 'utf8');
console.log(txt.length);
```

> 学习本项目后端 `server/index.js` 就是活教材：它用 Express + fs 扫描课程包并提供 API。

## 三、事件循环（心智模型）

同步代码先跑完 → 微任务(Promise) 队列 → 宏任务(定时器/IO) 队列。理解了它，你就懂了为什么 `console.log` 总在 `setTimeout` 之后。
---

> 🚧 这是大前端学院的**骨架关卡**。课文已给出核心概念与最小示例；
> 你可以在 `courses/03-nodejs/lessons/node-basics.md` 里继续扩写，
> 并按同样路径新增/编辑小测(`quizzes/node-basics.json`)与作业(`homework/L1.md`)，
> 平台会自动读取，改动随 Git 提交同步到你的 GitHub。
