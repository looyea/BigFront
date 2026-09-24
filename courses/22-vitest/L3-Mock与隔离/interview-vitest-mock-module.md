# 面试题：模块 Mock（vitest-mock-module）

### 1. (原理类) 为什么 vi.mock 写在 import 之后也生效？
**来源**：https://vitest.dev/guide/mocking/modules.html

因为 vi.mock 会被编译期 hoist 到模块最顶部、早于 import 求值。Vitest 官方文档专门强调这点——它必须比被 mock 的 import 先注册，才能拦截到那次导入。

### 2. (实战类) 只想 mock 模块里的一两个导出怎么做？
**来源**：https://vitest.dev/guide/mocking/modules.html

工厂里用 importOriginal 拿真实模块再展开覆盖：return { ...(await importOriginal()), foo: vi.fn() }。这样未列出的导出保持真实实现，避免把整个模块掏空。

### 3. (坑类) vi.mock 工厂里引用外部变量报 undefined？
**来源**：https://vitest.dev/guide/mocking/modules.html

工厂被提升到 import 前执行，引用不到文件里后声明的变量。解法是 vi.hoisted(() => ...) 把要共享的对象也提到最前，工厂再引用它。这是模块 mock 最高频的坑。

### 4. (实战类) 怎么 mock 一个模块的默认导出？
**来源**：https://vitest.dev/guide/mocking/modules.html

工厂返回里显式提供 default 键：vi.mock("./cfg", () => ({ default: { flag: true } }))。ESM 下 default 是普通导出名，忘了写就会拿到 undefined，和命名导出要分别给。

### 5. (对比类) vi.mock 网络请求，还是上 MSW？
**来源**：https://vitest.dev/guide/mocking/requests.html

别 vi.mock axios/fetch 的每个方法——脆弱且被测代码得「知道」自己被 mock。网络层交给 MSW 在请求边界拦截，被测代码照常发真请求、行为更真实。vi.mock 留给纯本地模块替换。

### 6. (实战类) __mocks__ 目录是干嘛的？
**来源**：https://vitest.dev/guide/mocking/modules.html

放在被测模块（或 node_modules 第三方包）旁边的 __mocks__/ 里，Vitest 可自动采用作为该模块的 mock 实现，省去每次写工厂。第三方库自动 mock 尤其实用，但仍建议显式 vi.mock 表明意图。

### 7. (原理类) 不传工厂的 vi.mock("./x") 会怎样？
**来源**：https://vitest.dev/guide/mocking/modules.html

触发自动 mock：Vitest 尽量保留导出形状、把函数换成返回 undefined 的 vi.fn。它「猜」的行为不可控、可读性差，本包不推荐——显式工厂给什么就是什么，最稳。

### 8. (实战类) 怎么 mock 环境变量 / import.meta.env？
**来源**：https://vitest.dev/guide/mocking/globals.html

用 vi.stubEnv(name, value)（测完 unstubEnvs 或配 unstubEnvs:true 自动复位），或 vi.mock 掉那个读取并导出 config 的模块。stubEnv 更贴合「临时改变一个环境值」的语义。

### 9. (坑类) vi.mock 的相对路径写错会静默失败吗？
**来源**：https://vitest.dev/guide/mocking/modules.html

不会。Vitest 走真实模块解析，路径不可解析就报错——这其实比某些旧框架更严格。别指望 mock 一个不存在路径「顺便造出来」，对齐 import 的路径即可。

### 10. (对比类) ESM 下 mock 和 CommonJS 有什么要注意的？
**来源**：https://vitest.dev/guide/mocking/modules.html

Vitest 原生 ESM：mock 作用于模块导出绑定，默认导出要写成 default、循环依赖与顶层 await 求值时机更敏感。把 jest.mock 的 CJS 习惯（如随意 mock 内建、mock 时序想当然）平移过来常翻车。

### 11. (实战类) 怎么 mock Node 内置模块（如 fs）？
**来源**：https://vitest.dev/guide/mocking/file-system.html

vi.mock("node:fs", () => ({ readFileSync: vi.fn() })) 替换所需函数；测文件相关逻辑也可用 memfs 之类真内存文件系统。别整个 stub 掉不认识的 API，按需替换即可。

### 12. (原理类) 某用例想用回真实模块怎么办？
**来源**：https://vitest.dev/guide/mocking/modules.html

vi.unmock 或在需要处直接 await vi.importActual/importOriginal 拿真实现再手动用。若全局都想要真的，就干脆别 vi.mock。混用要注意提升顺序。

### 13. (坑类) mock 与文件隔离是什么关系？
**来源**：https://vitest.dev/config/isolate.html

默认 isolate:true，每个测试文件独立模块注册表，vi.mock 不会泄漏到别的文件。关掉隔离提速时，一个文件的 mock 可能影响同环境后续文件，需谨慎——这也是 mock 相关污染 often 的根因。

### 14. (实战类) 怎么测「模块加载时就跑」的副作用？
**来源**：https://vitest.dev/guide/mocking/modules.html

import 阶段执行的副作用要在 vi.mock 工厂里就把它依赖的东西备好（配合 vi.hoisted）；或用 vi.resetModules 后动态 import 触发重新求值。静态 import 只跑一次，重测需 resetModules。

### 15. (对比类) vi.mock 和 vi.spyOn 该怎么分工？
**来源**：https://vitest.dev/guide/mocking/modules.html

要替换「整个模块的导出形状」（尤其是被测方 import 进来的依赖）用 vi.mock；只想临时改「某对象某方法」的行为、默认真跑，用 vi.spyOn。前者管模块边界，后者管对象方法。
