# L7 课后作业：TypeScript、测试与工具链

> 本阶段关键词：svelte2tsx / Props 接口 / Snippet 类型 / Vitest 接线 / waitFor / 测试金字塔 / sv CLI / runes 编译档位。
> 判分口径：Bug 找错说清"报错在哪一层（类型层/运行时/配置层）"才给分；手写题以 `sv check` 零报错 + 测试全绿为准。

---

## 一、Bug 找错（10 小题，指出根因层级并修）

1. `.svelte` 里 `let n = $state(0); n = 'abc';` 类型报错，但有人用 `// @ts-ignore` 压掉了。为什么这行报错恰恰不该压，而该改代码？
2. `interface Props { onselect: (i: number) => void }`，调用端 `<List />` 不传 onselect，svelte-check 报"missing prop"。两种修法各自的语义后果？
3. 测试文件里 `render(List, { items })` 跑出 `items is not iterable`——Vitest 报错信息指向组件内部。测试调用错在哪？
4. `await fireEvent.input(input, { value: 'x' })` 后断言 `getByText('已输入: x')` 失败，但 `console.log(screen.getInnerHTML())` 里有。查询器哪里选错了？（提示：多个匹配节点）
5. 组件里 `onclick={(e) => e.target.value}` 在 `strict` 下报 `Property 'value' does not exist on type 'EventTarget'`。给出两种类型修法。
6. CI 绿、本地红：流水线上 `svelte-check` 通过但编辑器满屏红波浪线。最可能的两个环境差异？
7. `vite.config.js` 里写了 `resolve.alias['@']`，`.svelte` 组件里 `import '@/lib/x.svelte'` 运行时正常、`sv check` 报找不到模块。为什么两套工具"看见"的路径不同？
8. 测试里 `vi.useFakeTimers(); vi.advanceTimersByTime(1000); expect(...)` 偶发失败，改成 `await vi.advanceTimersByTimeAsync(1000)` 就稳。用微任务 flush 解释。
9. 升级 svelte 到 5 后构建报"compiler version mismatch"，`npm ls svelte` 输出三行不同版本。治理命令与根因各一条。
10. 同事在 `svelte.config.js` 写了 `compilerOptions: { runes: true }`，仓库里一个 Svelte 4 老组件立刻构建失败，报 `store is not defined`。配置没错、代码没动——解释因果，给迁移期正确档位。

## 二、手写题（5 题）

1. **类型化 Snippet 表格**：写 `<DataTable T>`（generics），props 含 `items: T[]`、`columns: { key: keyof T; cell?: Snippet<[T[keyof T]]> }[]`——若 `T[keyof T]` 联合卡住，用 `Cell = Snippet<[any]>` 降级并写注释说明取舍；补一个调用端用例证明列名写错会红。
2. **三件套接线**：给一个裸 vite+svelte 工程补齐 `vitest.config`（jsdom+setupFiles 注入 jest-dom）、eslint flat config（eslint-plugin-svelte）、prettier-plugin-svelte，提交三个配置文件并让 `sv check && npm test` 全绿。
3. **表单组件测试**：为 L5 作业的手写注册表单（含双层校验）写 6 条用例：合法/各字段非法/异步用户名占用（mock fetch + waitFor）/submit 后按钮禁用——全部用 role/label 语义查询，禁TestId。
4. **CI 剧本**：写 `.github/workflows/ci.yml`：checkout→setup-node(缓存 pnpm)→`sv check`→`vitest run --coverage`→`playwright test`（仅 main 与 PR），要求类型检查失败时不跑 e2e（用 job needs），覆盖率产物上传 artifact。
5. **可测性重构**：把 L6 的 VirtualList（挑战题）补上 `sv check` 零 any + 6 条测试（含"items 替换保留 scrollTop"回归用例）；若发现某行为在 jsdom 测不了，把断言移到 Playwright 并注释原因。

## 三、场景评审（1 题）

某团队 Svelte 工程的 PR 意见节选，逐条判断"该采纳/该拒绝/该讨论"并说理（≤250 字）：

> A："`test.ts` 里到处 `data-testid`，查 role 太啰嗦，测试跑得快就行。"
> B："svelte-check 太慢了，从 CI 删掉，本地谁爱跑谁跑。"
> C："runes: true 先别钉，等迁移完再说——虽然我们是全新项目。"
> D："把 @testing-library/svelte 换成 enzyme 风格快照测试，写起来省事。"
> E："prettier 和 eslint 规则冲突，把 husky 钩子关了，反正合并前 CI 会格式化。"

## 四、简答题（3 题）

1. 一句话说清 svelte2tsx / svelte-check / vue-tsc / tsc 四者关系，并解释为什么"纯 tsc 查不到 .svelte 模板类型错"。
2. 写出你项目的四层测试金字塔（纯函数/组件/集成/E2E），各给一个"只有这层才能抓到"的 bug 实例。
3. `vite.config.js` 与 `svelte.config.js` 的职责分界是什么？各举一个属于它的配置项与一个"放错家"的例子。

## 五、挑战题 🏆

给 **11-svelte 课程包本身**写一条可复用的"内容质检流水线"（正是本项目实践）：Vitest 用例集遍历 `courses/11-svelte`——① 每个 quiz JSON 可解析、7 题、answer ∈ [0,3]、分布不出现三连同值；② 每关课文/interviews 成对存在且面试题 `### ` 计数=12；③ 课文无 `undefined`/`TODO`/乱码字符（正则圈定）。全部通过后把 `npm test` 接进 pre-commit。**这就是本仓库校验脚本的正式化版本**——写出来，你就是给自己项目做过 SaaS 级内容 CI 的人。

---

交卷后自评三道小测各对 ≥5 题视为过关。

🚀 **下一站 L8**：`svelte-compiler-architecture`——亲手读一遍编译产物，看模板如何变成 create/update 函数，数一数产物里到底还剩多少"框架"。
