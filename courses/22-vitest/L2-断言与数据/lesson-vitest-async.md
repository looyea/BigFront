# 异步与定时器测试

## 一、直接 await

异步用例就是 `async` 回调里 `await` 再断言：`const r = await fetchIt(); expect(r).toBe(x)`。关键是**别忘了 await**——不 await 则断言在 Promise 落定前就跑完、用例假绿。Promise 断言也可 `await expect(p).resolves.toBe(x)` / `.rejects.toThrow()`。

## 二、假定时器：让 setTimeout/轮询秒测

测防抖、轮询、延时动画不能真等。开 `vi.useFakeTimers()` 接管 setTimeout/setInterval，用 `vi.advanceTimersByTime(1500)`/`vi.runAllTimers()` 手动推进虚拟时钟，断言「到时后该发生的发生了」。**用完必须** `vi.useRealTimers()`（放 afterEach）回退真实时钟，否则污染其它用例。

## 三、冻结时间：vi.setSystemTime

测「基于当前日期」的逻辑（过期判断、格式化）用 `vi.setSystemTime(new Date('2026-01-01'))` 把 `Date.now()/new Date()` 冻结到固定点，结果可复现。测完 `vi.useRealTimers()` 一并复位。

## 四、轮询 / 防抖怎么测

防抖：推进定时器 `vi.advanceTimersByTime(waitMs)` 后断言只触发了一次。轮询/等待异步 DOM（如 RTL）优先用 `await vi.waitFor(() => { expect(...).toBeVisible() })`——它轮询直到断言通过或超时，比手搓定时器更稳。

## 五、超时

`testTimeout`（单用例上限）、`hookTimeout`（钩子上限）在 config 或 `it('...', { timeout: 5000 }, fn)` 设。异步没在超时内落定即失败。别把超时当「慢测试的遮羞布」——一个用例动辄几秒通常是没 await 或该用假定时器。

## 小结
异步先 await 再断言、Promise 用 resolves/rejects（忘 await 会假绿）；测延时用 vi.useFakeTimers + advanceTimersByTime/runAllTimers、务必 afterEach useRealTimers；vi.setSystemTime 冻结时间测日期逻辑；防抖靠推进定时器、等待异步 DOM 用 vi.waitFor；testTimeout/hookTimeout 控上限、慢测先查没 await 而非调大超时。

## 部署预告
给一个 `setTimeout(1000)` 后回调的函数写测试：`vi.useFakeTimers()` → 调函数 → `vi.advanceTimersByTime(1000)` → 断言回调被调用、且推进前未调用；再写一个「今天是否过期」的函数用 `vi.setSystemTime` 冻结到某天测边界。记得 afterEach 恢复真实定时器。
