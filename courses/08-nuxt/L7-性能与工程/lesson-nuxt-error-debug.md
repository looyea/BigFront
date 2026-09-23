# 错误处理与调试：稳定的另一面是"出错时怎么办"

## 1. 一个统一的错误契约：createError

Nuxt/Nitro 全栈用同一个 `createError` 表达"这是一次可识别的失败"：

```ts
// server/api/articles/[id].get.ts
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const a = await db.article(id);
  if (!a) throw createError({ statusCode: 404, statusMessage: '文章不存在' });
  return a;
});
```

`createError({ statusCode, statusMessage, message, data, fatal, error })` 的关键字段：

- **statusCode**：HTTP 语义（400/401/403/404/409/422/500…），前端据此分支（呼应 nuxt-middleware-auth 的 401/403）；
- **statusMessage**：给用户看的短语（会成为 error.vue 的标题，安全，可外露）；
- **message**：给开发者看的详情（**生产环境不会下发给浏览器**，见第 5 节）；
- **data**：结构化附加信息（如表单逐字段校验错误，呼应 exp-validation）；
- **fatal: true**：告诉客户端"别硬撑，直接上错误页"（见第 3 节）。

一个契约贯通服务端与客户端，是 Nuxt 相对裸 Express 最大的省心点（09-express 里我们要自己统一错误中间件）。

## 2. 客户端怎么读错误：useError / showError / clearError

```vue
<script setup>
const { data, error, refresh } = await useFetch('/api/articles/1');
if (error.value) {
  // error.value 是被序列化的 CreateError：有 statusCode/statusMessage/data
  const code = error.value.statusCode;   // 404 → 显示"未找到"，401 → 跳登录
}
</script>
```

三个 API 的分工：

- `useFetch`/`useAsyncData` 返回的 **`error` ref**：局部错误，适合"这个请求失败了就在原地提示/重试 `refresh()`"；
- **`showError(err)`**：手动把错误提升到全局错误态（比如在事件处理里捕获到严重问题）；
- **`useError()`**：读取全局错误态（响应式），**`clearError({ redirect })`** 清除并可跳转。

原则：**可恢复的错误就地处理（toast/重试），不可恢复的才升级到全局错误页**。什么都 `showError` 会让用户动不动白屏。

## 3. error.vue：应用级兜底页（不是普通页面）

`app/error.vue` 是 Nuxt 的特殊文件：当出现 **fatal 错误**（SSR 渲染抛错、或 `createError({fatal:true})`、或未被捕获的运行时错误）时渲染它，接收 `error` prop：

```vue
<!-- app/error.vue -->
<script setup>
const props = defineProps({ error: Object });
const is404 = computed(() => props.error?.statusCode === 404);
function goHome() { clearError({ redirect: '/' }); }
</script>
<template>
  <main class="err">
    <h1>{{ props.error?.statusCode || 500 }}</h1>
    <p>{{ is404 ? '页面不存在' : '出了点问题，请稍后再试' }}</p>
    <button @click="goHome">回首页</button>
  </main>
</template>
```

注意三个认知点：

1. error.vue **在 app.vue 之外独立渲染**（它是一棵新的最小应用），所以它不能依赖你的全局布局/store/注入——要自包含；
2. 它按 `statusCode` 分支即可，**不要展示 `error.message`/`stack`**（第 5 节）；
3. 普通组件内的局部错误不要走到这里——那是 `onErrorCaptured` 或就地 error ref 的职责。

组件树内的"局部错误边界"用 Vue 的 `onErrorCaptured`（呼应 vue-lifecycle、next-boundaries 的 Error Boundary 对照）：捕获子树抛出的错误、渲染兜底 UI、`return false` 阻止继续上抛。

## 4. 生命周期与钩子里的错误去哪了

把 nuxt-lifecycle 接上：

| 出错位置 | 表现 | 正确处理 |
|---|---|---|
| server handler 抛错 | 客户端 `useFetch` 的 error / HTTP 状态码 | 就地提示或跳登录 |
| SSR 阶段组件 setup 抛错 | 服务端渲染中断 → 渲染 error.vue（HTTP 非 200） | error.vue 兜底 |
| 客户端导航中抛错 | 若 fatal → error.vue；否则未捕获 | `app:error` 钩子 / 全局 `showError` |
| 水合期 warn（非致命） | 控制台警告，不白屏 | 修 mismatch（呼应 nuxt-hydration） |
| Vue 组件运行时抛错 | 子树崩溃 | `onErrorCaptured` 边界 |

Nuxt 还提供 `vue:error`、`app:error`、`app:error:cleared` 运行时钩子（呼应 nuxt-lifecycle 的 useRuntimeHook），用于**统一上报**（把错误发给 Sentry/自建收集端点，复用 nuxt-modules 的埋点端点思路）。

## 5. 安全红线：生产环境绝不能泄露堆栈

h3/Nitro 默认做了对的事：**生产环境下，非 `createError` 的未知异常只回 `{ statusCode: 500, statusMessage: 'Internal Server Error' }`，真实的 `message`/`stack` 留在服务端日志**；而 `createError` 的 `message` 若来自服务端内部，同样会被 `cause` 包裹、不外露。要自查的泄露途径：

- 千万别 `return { error: err.stack }` 或把内部异常 message 直接透传（呼应 exp-security 的错误信息泄露）；
- 别在生产开详细错误页（`nitro` 的 dev 才有错误叠层）；
- 前端 error.vue 只展示 statusCode + 通用文案；
- SQL/密钥/内部路径常藏在 message 里——泄露即攻击面。

**开发者需要的细节去哪看**：服务端日志 + APM（Nitro 侧 `console.error` / 自定义 error 中间件收集），不是给浏览器看。

## 6. SSR 调试工具箱

裸浏览器 devtools 只能看到水合后的客户端，SSR 阶段要另找抓手：

1. **看服务端日志**：`nuxt dev` 终端会打印 SSR 抛错与 `server/**` 的 `console`；用 `useLogger('tag')` 打结构化日志；
2. **Node 断点**：`NUXT_DEBUG=1` 或 `node --inspect` 跑构建产物 / dev server，Chrome DevTools  attach 断服务端代码；
3. **看 payload 事实**：`view-source:` 与 `window.__NUXT__`，确认服务端到底取到了什么（大量"数据没了"的问题一眼看穿，呼应 nuxt-hydration）；
4. **区分两侧**：`import.meta.server/client` 里分别 `console`，判断"是没跑还是跑了没结果"（呼应 nuxt-hydration 两侧执行）；
5. **关 SSR 缩小范围**：临时 `routeRules: { '/x': { ssr: false } }` 看是否 SSR 专属问题；
6. **类型即文档**：`nuxt prepare` 后类型报错常提前暴露"字段不存在/取错端点"（呼应 nuxt-modules 第 7 节）。

## 7. 自检清单

- [ ] 所有可预期失败都用 `createError({statusCode,...})` 表达，而非 `throw new Error('xxx')`？
- [ ] error.vue 是否自包含（不依赖全局 store/布局）且按 statusCode 分支？
- [ ] 生产是否确认 500 响应体不含 message/stack/内部信息？
- [ ] 局部可恢复错误就地处理，没有滥用 showError 把小错升级成白屏？
- [ ] 有没有统一 `app:error`/`vue:error` 上报到 APM？
- [ ] SSR 抛错会让该请求返回非 200——是否影响 SEO（受保护页应非 200，公开页应降级不 500）？
- [ ] 401/403 是否被前端正确识别为"跳登录/无权"，而不是渲染成 500？

## 8. 🚀 部署预告

错误能被识别、兜底、不外泄了，还要能"被证明修好了"。下一关 **nuxt-testing**：`@nuxt/test-utils` 跑组件与端到端、Vitest 测 server route、如何在测试里模拟 SSR 与 cookie——把本关这些行为固化成回归（呼应 node-testing、vue-testing、next-testing）。
