# 断言工具箱与扩展

## 一、三兄弟：toBe / toEqual / toStrictEqual

```ts
expect({ a: 1 }).toEqual({ a: 1 });       // 内容深比较 ✔
expect(obj).toBe(obj);                    // 同一引用 ✔
expect(instance).toStrictEqual(other);    // 还要求同一 class/undefined 属性一致
```

`toBe` 引用/原始值、`toEqual` 内容深比较、`toStrictEqual` 更严（区分类实例、`{a:undefined}` 与 `{a:1}` 等）。日常 toBe + toEqual 打天下，要精确用 toStrictEqual。

## 二、常用值断言

数字 `toBeGreaterThan/toBeLessThan/toBeCloseTo`；字符串/正则 `toMatch('foo')`/`toMatch(/\d+/)`；数组/集合 `toContain`、`toContainMatching`（子串/元素）。取反一律加 `.not`。这些组合已能表达绝大多数断言意图。

## 三、异常与 Promise 断言

同步抛错 `expect(fn).toThrow(匹配)`；Promise 用 `await expect(p).resolves.toBe(x)` / `expect(p).rejects.toThrow()`。异步 matcher 忘了 await 会让断言「假绿」，这是新手头号坑（详见异步关）。

## 四、扩展匹配器：jest-dom

测 DOM/组件时装 `@testing-library/jest-dom`（在 setupFiles 里 `import '@testing-library/jest-dom/vitest'`），获得 `toBeInTheDocument`、`toHaveValue`、`toBeVisible`、`toHaveClass` 等语义化断言，比手写 `expect(el.classList.contains(...))` 可读得多。这类「扩展」是 Vitest 兼容生态的体现。

## 五、别背清单，按需查

Vitest 还有 `expect.hasAssertions()`（本用例必须有断言）、`expect.assertions(n)`、自定义 matcher（extend）等。**正确姿势**：核心几个用熟，遇到「这个怎么断言」直接开 `vitest.dev/api/expect` 搜——本包的覆盖边界就是「主干用熟 + 细节会查」，不是全表默写。

## 小结
toBe 引用/原始值、toEqual 内容深比较、toStrictEqual 更严（class/undefined）；数字/字符串/集合用 ToBeCloseTo/toMatch/toContain 等、取反加 .not；Promise 用 resolves/rejects（勿忘 await）；DOM 装 @testing-library/jest-dom/vitest 得 toBeInTheDocument 等语义化 matcher；别背清单、按需查 api/expect。

## 部署预告
写一段 setupFiles 引入 `@testing-library/jest-dom/vitest`，对 `document.body.innerHTML` 注入一段 HTML 后用 `expect(screen/query).toBeInTheDocument()`、`toHaveValue()` 断言；再对比 `toEqual` 与 `toStrictEqual` 在 `{a: undefined, b: 2}` 上的不同表现。
