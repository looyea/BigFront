# L3 作业：Mock 与隔离

## 一、知识回顾
1. 函数 mock：vi.fn（toHaveBeenCalledWith/Times、mockReturnValue/ResolvedValue/Implementation(Once)）；vi.spyOn 监听既有方法 + mockRestore；clear/reset/restore 区别；纯逻辑不该 mock。
2. 模块 mock：vi.mock 自动提升、工厂、importOriginal 部分 mock、vi.hoisted 解引用提升；__mocks__ 目录；stubEnv 环境变量；网络交给 MSW；ESM 差异。
3. 钩子隔离：beforeAll/afterAll/beforeEach/afterEach、栈式逆序；describe 作用域；默认 isolate:true、fileParallelism；setupFiles vs globalSetup；ctx。

## 二、代码实操
1. 给接收回调的函数（`fetchUser(id, onOk)`）用 vi.fn 测交互：断言成功路径被以预期参数调用；用 mockRejectedValueOnce 测错误分支。
2. 对 import 了 `./api` 和 `./logger` 的模块，用 vi.mock 工厂替换 api、importOriginal 保留 logger；再故意在工厂引用文件变量触发报错，改 vi.hoisted 修复。
3. 建含嵌套 describe 的测试，外层内层各放 beforeEach/afterEach（打点），运行观察完整执行与清理顺序；用 setupFiles 注入一个全局 beforeEach。

## 三、思考题
1. 为什么 resetAllMocks:true 有时会把你设的 mock 实现一起抹掉？该改用什么？
2. 关掉 isolate 能提速，代价是什么？什么情况下才敢关？

## 四、延伸阅读
- vitest.dev guide/mocking/functions、guide/mocking/modules、guide/learn/setup-teardown、config/isolate、config/setupfiles

## 五、自查清单
- [ ] 会区分该用 vi.fn / vi.spyOn / vi.mock
- [ ] 理解 vi.mock 提升与 vi.hoisted 的关系
- [ ] 说得出四钩子执行/清理顺序与作用域
- [ ] 明确「纯逻辑别 mock、mock 为隔离不想真跑的边界」
