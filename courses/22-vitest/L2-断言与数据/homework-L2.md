# L2 作业：断言与数据

## 一、知识回顾
1. 断言：toBe(引用/原始值)/toEqual(深比较)/toStrictEqual(更严)；toMatch/toContain/toBeCloseTo；.not；Promise 用 resolves/rejects（勿忘 await）；jest-dom 扩展语义化 matcher。
2. 异步：async 用例先 await 再断言；vi.useFakeTimers + advanceTimersByTime/runAllTimers、vi.setSystemTime 冻结时间、务必 useRealTimers；vi.waitFor 等异步 DOM；testTimeout/hookTimeout。
3. 参数化与快照：it.each/describe.each 表驱动；toMatchSnapshot/inline/file；快照头号风险是无脑 -u，CI 禁更新；关键值用 matcher 不用快照。

## 二、代码实操
1. 给一个返回数组、会抛错、算浮点的工具函数，分别用 toEqual/toThrow/toBeCloseTo 断言；再装 `@testing-library/jest-dom/vitest` 用 toBeInTheDocument 断言注入的 HTML。
2. 给一个 `setTimeout(1000)` 后回调的函数写假定时器测试：useFakeTimers → 推进 1000 → 断言回调被调用、推进前未调用；afterEach 恢复真实时钟。
3. 把一段多输入同逻辑的测试改写成 it.each 表格；对一个稳定对象用 toMatchSnapshot 生成 .snap，故意改字段看它红并读 diff 再决定要不要 -u。

## 三、思考题
1. 异步 matcher 忘了 await 为什么会「假绿」？如何用它避免？
2. 什么输出适合快照、什么必须用显式 matcher？给出你的判断标准。

## 四、延伸阅读
- vitest.dev api/expect、guide/mocking/timers、guide/mocking/dates、guide/learn/snapshots、guide/recipes/wait-for

## 五、自查清单
- [ ] 分得清 toBe/toEqual/toStrictEqual
- [ ] 会用假定时器测延时逻辑并记得恢复真实时钟
- [ ] 能用 it.each 消除复制粘贴
- [ ] 理解「快照红了先读 diff、CI 不给更新」的纪律
