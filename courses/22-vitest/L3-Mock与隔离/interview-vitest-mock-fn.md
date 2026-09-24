# 面试题：函数 Mock（vitest-mock-fn）

### 1. (原理类) vi.fn 和自己写个空函数有什么区别？
**来源**：https://vitest.dev/guide/mocking/functions.html

vi.fn 除可调用外还自带调用记录（mock.calls/results）与断言集成（toHaveBeenCalled 等），并能声明返回值/实现。裸空函数没有这些可观测能力，测「交互」时无从下手。

### 2. (实战类) mockReturnValue 和 mockImplementation 怎么选？
**来源**：https://vitest.dev/guide/mocking/functions.html

只固定返回同一值用 mockReturnValue 更简洁；要根据不同入参返回不同结果、或有副作用逻辑，用 mockImplementation 自定义行为。两者都有 Once 变体处理「仅下一次」。

### 3. (实战类) 怎么断言回调被以特定参数调用过？
**来源**：https://vitest.dev/api/expect.html

expect(cb).toHaveBeenCalledWith(a, b)；还有 toHaveBeenLastCalledWith、toHaveBeenCalledTimes(n)、nthCalledWith 定位第几次。直接读 cb.mock.calls 也能拿到原始入参数组。

### 4. (对比类) vi.fn 和 vi.spyOn 什么时候各用？
**来源**：https://vitest.dev/guide/mocking/functions.html

你「提供一个函数」（回调、可注入依赖）用 vi.fn 造替身；对象上「已存在的方法」想观察或临时改其行为用 vi.spyOn（默认真调、可 mock 后 mockRestore 还原）。

### 5. (原理类) 怎么 mock 一个返回 Promise 的依赖？
**来源**：https://vitest.dev/guide/mocking/functions.html

用 mockResolvedValue(v)/mockRejectedValue(err)，或 mockImplementation(async () => v)。测异步失败路径常用 mockRejectedValueOnce，避免手写返回 Promise 的实现。

### 6. (坑类) mockClear / mockReset / mockRestore 区别？
**来源**：https://vitest.dev/api/vi.html

clear 只清调用记录；reset 连自定义实现一起抹掉（回到空 vi.fn）；restore 仅对 spyOn，把被替换的原方法还原。忘记 restore 会让 spy 泄漏到后续用例。

### 7. (坑类) 把 resetAllMocks 设成 true 有什么隐患？
**来源**：https://vitest.dev/config/restoremocks.html

它会在每条用例后把 mock 的实现也重置，你在 beforeEach/模块级设的 mockReturnValue 可能下一条就没了，行为诡异。多数团队用 clearMocks（只清记录）更省心。

### 8. (实战类) 怎么验一个「不该被调用」的函数确实没跑？
**来源**：https://vitest.dev/api/expect.html

expect(spy).not.toHaveBeenCalled()。短路/缓存/守卫分支就该这么测——断言负向行为和断言正向同等重要。

### 9. (实战类) 怎么 mock 一个 class 的构造？
**来源**：https://vitest.dev/guide/mocking/classes.html

用 vi.fn 作为构造（new 时记录调用与实例），或 vi.spyOn 原型方法。Vitest 对 class 有专门 mock 语义，能保留原型链、spy 实例方法而不动真实构造逻辑。

### 10. (原理类) mock.calls 结构是怎样的？
**来源**：https://vitest.dev/api/mock.html

mock.calls 是「每次调用一组入参」的数组（calls[i] 是第 i 次的参数列表），mock.results 记每次的返回/抛出。断言 API 基本都基于这两个数组。

### 11. (实战类) 想给同一 mock 不同调用返回不同值？
**来源**：https://vitest.dev/guide/mocking/functions.html

链式 mockReturnValueOnce(a).mockReturnValueOnce(b).mockReturnValue(default)：前几次走 Once，用尽后走兜底。测重试、分页第一页等有节奏的行为很合适。

### 12. (对比类) 什么时候根本不该 mock？
**来源**：https://vitest.dev/guide/mocking/functions.html

被测对象是纯函数、无外部依赖时直接测输入输出——mock 它等于什么都没测、还把测试绑死在调用细节上。mock 只为隔离你这次不愿真跑的边界（网络/时间/随机/昂贵 IO）。

### 13. (坑类) spyOn 后忘记 restore 会怎样？
**来源**：https://vitest.dev/config/restoremocks.html

替换会持续到进程结束或别的用例覆写，造成跨用例污染、偶发难复现的红。规范：afterEach 统一 mockRestore，或 config restoreMocks:true（注意其对实现的重置副作用）。

### 14. (实战类) 怎么测「传进去的回调」被正确调用？
**来源**：https://vitest.dev/guide/mocking/functions.html

把 vi.fn() 当回调传入被测函数，调用被测函数后再断言 cb 的 calls。重点验证交互契约：调用次数、参数、是否在某分支才调——这正是 vi.fn 的主场。

### 15. (原理类) vi.fn 的实现里能访问 mock 自身吗？
**来源**：https://vitest.dev/api/mock.html

可以：vi.fn 的实现函数上挂有 mock 属性可自引用，配合 mockImplementation 能写「按历史调用推断返回值」的高级 fake。大多数场景用不到，别过度造轮子。
