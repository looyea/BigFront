# Next L1 · 文件路由与渲染模式

> 🎯 目标：理解 App Router 目录约定与 SSR/SSG/CSR 的取舍

## 一、约定式路由

`app/` 目录下：`page.tsx` 是页面、`layout.tsx` 是共享布局、`loading.tsx`/`error.tsx` 处理加载与错误，文件夹名 `[id]` 表示动态段。

```
app/
  layout.tsx
  page.tsx        // /
  blog/[slug]/page.tsx  // /blog/:slug
```

## 二、渲染模式

- **SSG**：构建期生成静态 HTML（博客/文档）
- **SSR**：请求期服务端渲染（个性化、时效强）
- **CSR**：纯客户端交互
- **ISR**：静态生成 + 定期再验证

## 三、服务器组件 vs 客户端组件

默认组件在服务器运行（可直接 await 取数、代码不进 bundle）；需要 state/事件/浏览器 API 时，文件顶部加 `"use client"`。

> Next 版本迭代快，具体 API 以 nextjs.org 官方文档为准。
---

> 🚧 骨架关卡：在 `courses/07-nextjs/lessons/next-routing.md` 继续扩写，
> 小测放 `quizzes/next-routing.json`，作业放 `homework/L1.md`，平台自动读取。
