# 第一个单元测试：describe/it/expect

## 一、三件套

```ts
import { describe, it, expect } from 'vitest';

describe('sum', () => {
  it('相加两个正数', () => {
    expect(1 + 2).toBe(3);
  });
});
```

`describe` 分组、`it`（等价 `test`）是一条用例、`expect(x).matcher` 是断言。就这三个概念，能覆盖日常 80% 的测试书写。

## 二、核心 matcher 够用就好

起步记住四五个：`toBe`（原始值/引用相等）、`toEqual`（深比较对象/数组）、`toThrow`（抛错）、`toBeCloseTo`（浮点）、`.not` 取反。别一上来背全表——**遇到不会断言的，去 vitest.dev/api/expect 查**，这是本包反复强调的姿势。

## 三、全局 API vs 显式 import

配了 `globals: true` 可直接用 `describe/it/expect` 免 import；否则从 `'vitest'` 显式导入。显式 import 更清晰、不污染类型空间，团队两种都有；一旦用 globals 记得配 tsconfig types（见上关）。

## 四、文件命名与放置

约定 `*.test.ts` / `*.spec.ts`，放在 `__tests__/` 或与被测文件同目录（co-located）。同目录便于就近维护、import 相对路径短；`__tests__` 集中则源码目录更干净。选一种团队统一即可。

## 五、watch vs run 的心智

开发期开 `vitest`（watch）：它只重跑**受改动影响**的用例，秒级红绿反馈，是你写代码时的「测试伴侣」。CI/提交前用 `vitest run`：跑一次、给退出码。把 watch 当默认开发循环的一部分，是 Vitest 相对慢工具的体验跃迁。

## 小结
describe 分组 + it/test 用例 + expect().matcher 断言三件套够用；核心 toBe/toEqual/toThrow/toBeCloseTo/.not，其余按需查 api/expect；globals 免 import 但需 tsconfig types、否则显式 import；文件 *.test.ts 集中或 co-located 择一统一；开发用 watch 即时重跑相关用例、CI 用 run 给退出码。

## 部署预告
给一个真实的工具函数（含数组返回、抛错分支、浮点计算）写 describe+it 覆盖三类场景，分别用 toBe/toEqual/toThrow/toBeCloseTo 断言；开着 watch 模式，故意把实现改错一条，看 Vitest 如何只把相关用例标红。
