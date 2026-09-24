# 参数化与快照测试

## 一、each：表格驱动

同一段逻辑多组输入，用 `describe.each` / `it.each` 表驱动，别复制粘贴：

```ts
it.each([
  [1, 2, 3],
  [2, 3, 5],
])('%d + %d = %d', (a, b, exp) => {
  expect(a + b).toBe(exp);
});
```

数组或对象表格皆可，标题里 `%s/%d/$a` 插值。参数化让「边界值全覆盖」变成加一行表格的事。

## 二、快照是什么

`expect(value).toMatchSnapshot()` 把值的序列化结果存进 `__snapshots__/*.snap` 文件；下次运行比对，输出变了就失败提醒你「要么预期、要么回归」。`toMatchInlineSnapshot()` 直接内联在代码里，改时更新到源码。适合序列化稳定、手写断言啰嗦的输出（对象结构、组件渲染 HTML）。

## 三、快照的滥用警告

快照**最大的敌人是无脑更新**（`-u`）。若你每次红了都 `-u` 一把梭，等于「把回归也记成新基线」——那测试就没在测任何东西。纪律：快照红了先**读懂 diff**、确认是「我有意改的」才更新；CI 上不给更新权限（run 不带 -u），让基线变动必须显式发生在本地并被 review。

## 四、文件快照与组合

`toMatchFileSnapshot`（withFileSnapshots）把快照存到你指定的普通文件（如生成的 schema/文档），便于人肉 review。参数化 + 快照可组合：对每组输入各出一个快照。用 `expect.addSnapshotSerializer` 定制序列化（谨慎、易埋坑）。

## 五、什么时候别用快照

输出是**关键业务断言**（金额、状态转移）时，用显式 matcher 而非快照——快照对「一整个对象长啥样」敏感，但对「这个字段是否=预期」不精确。快照适合「防意外结构变化」，不适合「断言具体值」。

## 小结
it.each/describe.each 表格驱动覆盖多输入、标题插值；toMatchSnapshot 存 .snap 比对结构变化、inline 内联源码；快照头号风险是无脑 -u，红先看 diff、CI 禁更新；toMatchFileSnapshot 存普通文件便于 review、可定制序列化；关键业务值用显式 matcher 而非快照——快照防结构、不断具体值。

## 部署预告
把一个「多组输入同一逻辑」的测试改写成 it.each 表格；再对一个稳定序列化对象用 toMatchSnapshot 生成 .snap，然后故意改动该字段跑一次看它如何红并提示 diff，体会「先读 diff 再决定要不要 -u」。
