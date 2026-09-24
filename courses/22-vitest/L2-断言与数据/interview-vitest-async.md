# 面试题：异步与定时器（vitest-async）

### 1. (实战类) 测 async 函数的标准写法？
**来源**：https://vitest.dev/guide/learn/async.html

it 的回调写 async，内部 await 被测函数再 expect。或 expect(promise).resolves.toBe(x)/.rejects.toThrow()——后者别忘了整体 await。核心：让断言发生在 Promise 落定之后。

### 2. (原理类) vi.useFakeTimers 到底接管了什么？
**来源**：https://vitest.dev/guide/mocking/timers.html

它替换全局 setTimeout/setInterval/Date/queueMicrotask 等（默认集）为可手动控制的虚拟实现，让你用 advanceTimersByTime/runAllTimers 瞬间「过完」时间，无需真等待。

### 3. (坑类) 忘了 vi.useRealTimers 会怎样？
**来源**：https://vitest.dev/guide/mocking/timers.html

假定时器泄漏到后续用例，别的依赖真实时间的测试行为怪异。规范：afterEach 里 vi.useRealTimers()（或用 config fakeTimers 统一），隔离好每次时钟状态。

### 4. (实战类) 怎么测「N 秒后才触发」的逻辑？
**来源**：https://vitest.dev/guide/mocking/timers.html

useFakeTimers → 调被测函数 → advanceTimersByTime(N)（或 runOnlyPendingTimers）→ 断言触发。也可断言推进前尚未触发，双向锁死行为。

### 5. (对比类) runAllTimers 和 advanceTimersByTime 区别？
**来源**：https://vitest.dev/guide/mocking/timers.html

前者把队列里所有（含连锁产生的）定时器一口气跑完，后者按给定毫秒推进、更可控，测「恰好 1000ms 触发、999ms 不触发」这类边界更精确。

### 6. (实战类) 测基于当前日期的函数怎么可复现？
**来源**：https://vitest.dev/guide/mocking/dates.html

vi.setSystemTime(new Date("2026-01-01")) 冻结 Date.now()/new Date() 到固定点，断言就确定。测完 useRealTimers 复位。避免测试随真实日历漂移。

### 7. (对比类) vi.waitFor 和假定时器怎么选？
**来源**：https://vitest.dev/guide/recipes/wait-for.html

等「异步 DOM 出现/条件成立」（如 RTL 渲染完）用 vi.waitFor（轮询真微任务/宏任务直到通过或超时）；测「延时到点该发生」这类离散定时用假定时器推进。前者稳、后者精确。

### 8. (原理类) testTimeout 设多大合适？
**来源**：https://vitest.dev/config/testtimeout.html

默认 5s 足够多数。若某用例逼近超时，先查是不是没 await 或该用假定时器，而不是调大——把超时当遮羞布会掩盖真问题。个别确需长的（如集成）单独设。

### 9. (实战类) 怎么测一个会轮询的函数？
**来源**：https://vitest.dev/guide/mocking/timers.html

用假定时器，advanceTimersByTime 若干轮，断言每次轮询调用了预期的接口/回调、以及达成条件后停止轮询。轮询是定时器测试的典型场景。

### 10. (坑类) await expect(p).rejects 报「received function」？
**来源**：https://vitest.dev/guide/learn/async.html

rejects 需要传 Promise 本身、且它期望被拒的是 Error。写成 expect(promise).rejects.toThrow(...)，别传会返回 Promise 的函数、也别指望它接非 Error 拒绝。

### 11. (原理类) microtask/macrotask 与假定时器的关系？
**来源**：https://vitest.dev/guide/mocking/timers.html

假定时器主要管 macrotask（setTimeout 类）；微任务（Promise.then）不受 advanceTimers 控制、需 await 让其 flush。测「await 后再推进定时器」组合常见。

### 12. (实战类) 异步防抖函数怎么测触发一次？
**来源**：https://vitest.dev/guide/mocking/timers.html

useFakeTimers → 连续调用 debounced() 多次 → advanceTimersByTime(wait) → 断言底层回调只被调用 1 次。不推进时断言未触发。

### 13. (对比类) config.fakeTimers 预设和手动 useFakeTimers？
**来源**：https://vitest.dev/config/faketimers.html

config 里设 fakeTimers.toFake + 每用例自动接管适合「全项目默认假时钟」；手动 use/Real 更局部、按需。团队按是否普遍需要时钟控制选。

### 14. (坑类) 用了 fake timers 后 waitFor 卡死/超时？
**来源**：https://vitest.dev/guide/recipes/wait-for.html

vi.waitFor 内部靠真实定时器轮询，若时钟被 fake 接管又不推进会等不到。对策：waitFor 前 useRealTimers，或用 vi.advanceTimersByTimeAsync 推进，避免真实等待被假时钟冻结。

### 15. (原理类) 异步钩子（beforeEach await）注意点？
**来源**：https://vitest.dev/config/hooktimeout.html

钩子里有异步初始化（建连接、seed 数据）要 await 并留意 hookTimeout。钩子没跑完就开始用例、或超时被掐，是集成测试常见乱源。
