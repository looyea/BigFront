# Suspense 与流式渲染

> 目标：边界画好后，"慢"的问题浮出水面——本课把 React 18 的 **Streaming SSR + Suspense** 与 Next 的 **loading.tsx** 打通：HTML 分块先吐、慢件占位后补，用户不再对着白屏等最慢的那个接口。这是 L3 收官，也是"秒开体验"从概念变现实的机制层。呼应 **react-advanced-hooks**（Suspense 旧章）、**next-render-modes**（SSR 的 TTFB 痛点）、**mp-performance**（骨架屏）。

---

## 一、没有流式的世界：一个慢查询拖死整页

```tsx
// app/dash/page.tsx
export default async function Dash() {
  const fast = await getSummary();      // 50ms
  const slow = await getReport();       // 3000ms ← 全页为它陪葬
  return <><Summary data={fast} /><Report data={slow} /></>;
}
```

传统 SSR 必须等**所有** await 完成才能吐出第一个字节，TTFB = 最慢数据源（next-render-modes 第一节的木桶效应）。流式渲染改写规则：**HTML 是一条可以随时追加的流**——壳与快件先到，慢件位置先放占位符，就绪后以 `<template>`+内联脚本追加补齐。浏览器像收快递一样逐段渲染。

---

## 二、Suspense：给慢件一个"申报边界"

```tsx
import { Suspense } from 'react';
import ReportPanel from './report-panel';   // 'use client' 或 Server 皆可

export default async function Dash() {
  const fast = await getSummary();
  return (
    <>
      <Summary data={fast} />
      <Suspense fallback={<ReportSkeleton />}>   {/* ← 申报：这里可能慢 */}
        <ReportPanel />                           {/* ReportPanel 内部 await getReport() */}
      </Suspense>
    </>
  );
}
```

要点三条：
1. **await 必须发生在 Suspense 边界之下**——边界之上的 await 仍然阻塞整页（父等完才轮到子挂起），想流式就要"先渲染结构、把取数留在子组件内"；
2. 一个页面可有**多个独立边界**：评价区慢不连坐推荐区（各自 fallback、各自 error 边界，L7 对接）；
3. fallback 显示规则：React 会**缓冲**等待——若慢件在 shell 刷出前就绪，用户可能完全看不到 fallback（防闪烁设计，与 06-mp 的 loading 延迟显示同款心智，呼应 mp-interaction）。

---

## 三、loading.tsx：路由级的"自动 Suspense"

```text
app/dashboard/
├── layout.tsx
├── loading.tsx     # 自动 = <Suspense fallback> 包住该段以下的一切
└── page.tsx
```

```tsx
// app/dashboard/loading.tsx
export default function Loading() {
  return <DashSkeleton />;   // 骨架屏，别放 spinner 了事
}
```

与手写 Suspense 的分工：**loading.tsx 管页面级粗粒度**（整段未就绪时的路由骨架），**页内 Suspense 管细粒度**（哪个面板慢占哪个位）。两者都到齐时，页内边界优先；loading.tsx 还兼任"导航即时反馈"——点击 Link 到动态页瞬间先见骨架，体感零延迟（呼应 next-routing 第一节段文件全家桶、mp-render 的占位思想）。

---

## 四、Payload 视角：流里流的不止 HTML

RSC 导航（Link 预取命中失败时）走的是 **RSC Payload 流**：序列化树里挂起节点先写 `$?` 占位、就绪后补 `$L` 指令替换——浏览器按指令把现成的 DOM/ fiber 缝合。理解这一层，你就懂了：

- **流式是 Payload 与 HTML 共享的机制**，服务端组件与客户端岛都受益；
- 慢接口的错误发生在**边界之下**时，由该边界的 error.tsx 局部接管，整页不白屏（L7 会补"错误会向上冒泡到最近边界"这条）；
- bot/禁用 JS 的访客拿到的是**完整最终 HTML**（流结束后所有块都在），SEO 无损——流式不是客户端戏法（呼应 next-link-router 渐进增强）。

---

## 五、骨架屏的工程学

```tsx
// 好骨架的三个标准：尺寸一致、形状可辨、无跳动
function ReportSkeleton() {
  return (
    <div className="report-skeleton animate-pulse" style={{ height: 420 }}>
      {/* 与 ReportPanel 同高同栅格 */}
    </div>
  );
}
```

- **尺寸一致防 CLS**：骨架与真实内容等高，布局零偏移（LCP/CLS 指标直达，呼应 react-performance 指标篇、next-fonts-images 的"预留尺寸"同理）；
- 骨架本身必须**极便宜**：内联样式/CSS 动画，不引组件库——它在 HTML shell 里，每个首访者都要下载它；
- 多级骨架（页面壳 → 面板 → 卡片）与多级 Suspense 一一对应，形成"剥洋葱"式渐进呈现。

---

## 六、自检清单

- [ ] 为什么父组件顶层的 await 会让 Suspense 失效？
- [ ] 同页三个慢面板，几个 Suspense 边界合适？为什么？
- [ ] loading.tsx 与手写 Suspense 的分工？谁先展示？
- [ ] 流式渲染对爬虫和禁 JS 用户有影响吗？
- [ ] 骨架屏三条标准各防什么事故？

---

## 🚀 部署预告

- L3 收官：位置（RSC）+ 结构（边界）+ 时间（流式）三要素集齐。进入 **L4** 数据与缓存——**next-fetch-cache** 讲 Next 对 fetch 的扩展与三层缓存金字塔，把"快"从渲染技巧升级为存储架构；
- 本课"边界之下的错误局部接管"留了半句，L7 next-error-loading 补全整条冒泡链。
