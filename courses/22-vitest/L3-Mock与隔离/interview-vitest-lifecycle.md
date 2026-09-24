# 面试题：钩子与隔离（vitest-lifecycle）

### 1. (原理类) 四个钩子的完整执行顺序？
**来源**：https://vitest.dev/guide/learn/setup-teardown.html

单条用例：(外层 beforeAll→)外层 beforeEach→内层 beforeEach→it→内层 afterEach→外层 afterEach→(末条后 afterAll)。after* 相对注册逆序。理解顺序是排查污染问题的地基。

### 2. (实战类) beforeAll 和 beforeEach 怎么选？
**来源**：https://vitest.dev/guide/learn/setup-teardown.html

昂贵且无副作用共享的准备（建 DB 连接、起服务、解析大 fixture）放 beforeAll/afterAll；每条用例需要干净状态（重置 mock、清 DOM）放 beforeEach/afterEach。别把该每条重置的东西塞进 beforeAll。

### 3. (坑类) 钩子里有异步但没 await 会怎样？
**来源**：https://vitest.dev/config/hooktimeout.html

钩子会在 Promise 落定前就返回、用例在数据还没就绪时开跑，偶发失败。异步钩子必须 async + await，并注意别超过 hookTimeout。这是集成类测试最常见的乱源。

### 4. (原理类) Vitest 默认怎么做文件隔离？
**来源**：https://vitest.dev/guide/lifecycle.html

每个测试文件默认在独立的环境/worker 中执行（isolate:true），模块级单例、全局状态彼此不可见。安全但略慢；关隔离复用环境能提速，代价是可能互串。

### 5. (对比类) isolate:false 什么时候用、风险是什么？
**来源**：https://vitest.dev/config/isolate.html

当文件都是纯读、无共享可变状态，关隔离能省重建环境的开销、加快整体。风险是模块注册表共享——一个文件的 vi.mock、全局赋值会泄漏到同 worker 后续文件，产生顺序相关的偶发红。

### 6. (实战类) setupFiles 和 globalSetup 区别？
**来源**：https://vitest.dev/config/setupfiles.html

globalSetup 整个测试进程跑一次（起 mock server、准备一次性 fixtures，返回 teardown 收尾）；setupFiles 每个测试文件跑前注入（注册 jest-dom、初始化每文件 MSW）。作用域和次数完全不同。

### 7. (实战类) testContext（ctx）能做什么？
**来源**：https://vitest.dev/guide/test-context.html

钩子和用例收到同一 ctx 对象：可挂自定义数据、用 ctx.skip()/ctx.todo() 动态改变用例状态、读 meta。适合框架级标记与少量共享，别当全局状态袋滥用。

### 8. (坑类) 用例互相污染通常因为什么？
**来源**：https://vitest.dev/guide/recipes/db-transaction.html

共享可变状态（模块级变量、没在 afterEach 复原的全局、被 spy 却没 restore）+ 文件并行/不隔离。解法：每条自建或 afterEach 复原、事务回滚、必要时恢复 isolate。开 detectAsyncLeaks 揪漏网异步。

### 9. (实战类) on-test 级钩子（it.beforeEach）何时用？
**来源**：https://vitest.dev/api/test.html

当同一套件里个别用例有独特前置/后置，可挂 it.beforeEach/afterEach 或链式 .beforeEach，避免给全套件强加无关 setup。多数情况普通 beforeEach 就够，别过度分层。

### 10. (对比类) 为什么 after* 是逆序清理？
**来源**：https://vitest.dev/guide/learn/setup-teardown.html

栈式语义：后建立的资源应先释放（依赖先来的可能依赖后来的）。所以 beforeEach 正序、afterEach 逆序，保证释放顺序与建立顺序相反，避免拆早了还在被用。

### 11. (原理类) detectAsyncLeaks 解决什么？
**来源**：https://vitest.dev/config/detectasyncleaks.html

检测测试结束后仍在偷偷跑的真实定时器/IO（异步泄漏），让「本该结束却还有活」暴露出来而非静默影响后续。治本是在 teardown 关连接、清定时器，而不是关掉这个检测。

### 12. (实战类) 起的一个 mock 后端该在哪关？
**来源**：https://vitest.dev/guide/recipes/db-transaction.html

进程级共享的放 globalSetup（它 return 的函数里 server.close()）；每文件的放 setupFiles 里的 afterAll。别在 beforeEach 起、afterAll 关——次数对不上会漏关或重复起。

### 13. (坑类) 在 describe 回调里直接 await 会怎样？
**来源**：https://vitest.dev/guide/lifecycle.html

describe 回调在收集阶段执行、不是测试运行时，里面 await/副作用时机不对（此时 setup 还没跑）。异步准备应放 beforeAll，而非 describe 体。这是常见的「代码没按预期顺序跑」误区。

### 14. (实战类) 套件作用域内钩子会影响别的 describe 吗？
**来源**：https://vitest.dev/api/describe.html

不会。写在某 describe 内的 beforeEach/after 只作用于它包含的用例；要全文件生效就写在顶层。合理用作用域能把 setup 关在最小区间，减少无关用例的负担。

### 15. (对比类) 文件并行(fileParallelism) 和线程池关系？
**来源**：https://vitest.dev/config/fileparallelism.html

fileParallelism 控制是否同时跑多个测试文件（默认开、按 CPU）；关掉则串行、更省内存/更可预测但更慢。配合 pool/threads 决定用子进程还是工作线程，以及每文件是否隔离。
