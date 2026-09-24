# 面试题：第一个单元测试（vitest-first-test）

### 1. (原理类) describe / it / expect 各自职责？
**来源**：https://vitest.dev/api/describe.html

describe 建逻辑分组（可嵌套、组织 Suite）、it(=test) 声明一条用例并跑其回调、expect().matcher 写断言判断实际值。三者构成 Vitest 最基本的测试语法骨架。

### 2. (对比类) toBe 和 toEqual 到底差在哪？
**来源**：https://vitest.dev/api/expect.html

toBe 用 Object.is 判「同一」——原始值相等、对象需同一引用。toEqual 递归比较对象/数组的「内容相等」，忽略引用。测返回对象/数组通常要 toEqual。

### 3. (实战类) 怎么断言函数抛错？
**来源**：https://vitest.dev/api/expect.html

expect(() => fn()).toThrow()，可再匹配消息/正则/Error 类：toThrow(/must be number/)。注意要传「会抛的函数」而非调用结果，否则抛错发生在传参阶段、断言接不住。

### 4. (实战类) 浮点数断言注意什么？
**来源**：https://vitest.dev/api/expect.html

别对浮点用 toBe（0.1+0.2!==0.3）。用 toBeCloseTo(expected, precision) 容差比较。这是所有 JS 测试通病，Vitest 提供 toBeCloseTo 专门处理。

### 5. (原理类) .not 取反怎么用？
**来源**：https://vitest.dev/api/expect.html

任意 matcher 前加 .not 断言相反：expect(x).not.toBe(y)、not.toThrow()。适合明确要验「不该等于/不该抛」的场景，比手写 if 更清晰。

### 6. (实战类) 记不住几十个 matcher 怎么办？
**来源**：https://vitest.dev/api/expect.html

别背。核心 toBe/toEqual/toThrow/toBeCloseTo/toMatch 覆盖多数，其余遇到再查官方 api/expect 文档——这正是本包反复强调的「主干自驱、细节按需查」。

### 7. (对比类) 显式 import 和 globals 模式怎么选？
**来源**：https://vitest.dev/config/globals.html

显式 import 更清晰、类型友好、不污染全局；globals 少写 import、贴 Jest 习惯但需 tsconfig types。新项目倾向显式，迁移团队可能保留 globals，二选一统一即可。

### 8. (实战类) 测试文件放哪最合适？
**来源**：https://vitest.dev/guide/features.html

要么集中 __tests__/、要么与被测文件同目录 co-located（sum.ts / sum.test.ts）。co-located import 路径短、易同步维护；集中则源码目录干净。团队统一一种。

### 9. (原理类) watch 模式改代码为什么只红几个用例？
**来源**：https://vitest.dev/guide/features.html

Vitest 依 Vite 模块图算出受影响文件，只重跑依赖了被改模块的测试。这就是它作为「即时测试伴侣」体验好的核心机制。

### 10. (实战类) 一个用例里该放多少断言？
**来源**：https://vitest.dev/api/expect.html

聚焦「一个行为」。多条相关断言放一条 it 可以（测同一行为的不同侧面），但别把不相关的事塞一起——失败时难定位。宁可多条小而专的 it。

### 11. (对比类) run 和 watch 的输出/退出码差异？
**来源**：https://vitest.dev/guide/cli.html

watch 驻留、持续输出红绿、不退出，适合开发；run 跑一次、结束、用退出码表成败，适合 CI。同一套用例，两种消费方式。

### 12. (坑类) expect 写了但断言没生效（异步）？
**来源**：https://vitest.dev/api/expect.html

异步里没 await/没用 rejects/resolves，断言可能在 Promise 落定前就跑完。异步断言要么 await、要么 expect(promise).resolves/.rejects。这条在 L2 异步关细讲。

### 13. (实战类) 怎么给一条用例临时只跑它？
**来源**：https://vitest.dev/api/test.html

用 it.only('...', fn) 只跑该条、或 describe.only 跑一组，排查时聚焦。提交前记得清掉 only，否则 CI 只跑了子集却以为全绿。

### 14. (原理类) 测试名写得好不好重要吗？
**来源**：https://vitest.dev/api/describe.html

重要。describe+it 拼出的完整名是失败日志的第一行，用「被测对象 + 条件 + 期望」的行为式命名（如 sum/当传负数时正确相减），比 test1/test2 价值高得多。

### 15. (对比类) it 和 test 有区别吗？
**来源**：https://vitest.dev/api/test.html

没有，test 是 it 的别名，二者等价可互换。选一个团队统一即可，功能与行为完全相同。
