# Next L2 · 数据获取与接口

> 🎯 目标：掌握服务端 fetch 取数、缓存策略与用 Route Handler 写接口

## 一、服务端取数

服务器组件里直接 `await fetch(url)`；Next 对 fetch 做了缓存/去重，可用 `cache`、`next: { revalidate }` 控制。

## 二、Route Handlers（写后端接口）

`app/api/xxx/route.ts` 导出 `GET/POST` 函数即为一个接口，可访问请求、返回 JSON——全栈一体。

## 三、与后端协作

本学习平台的 Express 后端相当于独立 API；在 Next 里你也可以用 Route Handler 承担同样角色。
---

> 🚧 骨架关卡：在 `courses/07-nextjs/lessons/next-data.md` 继续扩写，
> 小测放 `quizzes/next-data.json`，作业放 `homework/L2.md`，平台自动读取。
