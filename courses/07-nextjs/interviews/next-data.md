# 面试题 · Next 数据获取与渲染策略

1. **SSR / SSG / ISR / CSR 的区别与选择？**
   - SSG：构建时生成 → 极快、可缓存；内容变更需重建或用 ISR。
   - SSR：每次请求服务端渲染 → 首屏 SEO 好、时效高；服务器成本高。
   - ISR：SSG + 定时增量重生 → 静态价格 + 定期更新，电商/资讯首选。
   - CSR：客户端渲染 → SEO 差、首屏慢；交互型 SPA。

2. **App Router 里 fetch 缓存默认策略？**
   Next 13 起 fetch 默认 **不缓存**（React 要求）；写 `{ cache: 'force-static' }` 或 `{ next: { revalidate: 60 } }` 恢复。

3. **revalidatePath 与 revalidateTag？**
   Server Action 后按路径或按标签手动失效缓存。tag 更灵活（一处更新影响多页）。

4. **Server Action 是什么？和 API Route 的区别？**
   Server Action 是加了 `'use server'` 的异步函数，可以直接从表单或客户端调用；本质是 POST 回服务端执行。API Route 是显式 REST 端点。两者互补。

5. **Streaming SSR 与 Suspense？**
   把慢组件包在 Suspense，服务端先把外壳流式发出，慢部分完成后**追加到 HTML 流**（React 18 renderToPipeableStream）。首屏 TTFB 显著下降。

6. **next/image 有哪些优化？**
   自动响应式 srcset、WebP/AVIF 转码、懒加载、防盗、内置 CDN loader。

7. **SEO 元数据怎么写？**
   `export const metadata = { title, description, openGraph }`；动态 `generateMetadata()`。不再需要手写 `<Head>`。

8. **Next 应用部署你会选哪里？考虑什么？**
   Vercel 官方最丝滑；Netlify/Cloudflare 也支持 Edge；自建 Node 用 `next start`；静态导出 `output:'export'` 可以丢到任意对象存储 + CDN。考虑：是否用 ISR、Image Optimization 后端、Region 就近。
