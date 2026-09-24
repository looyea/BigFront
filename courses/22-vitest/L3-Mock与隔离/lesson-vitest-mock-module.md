# 模块 mock：vi.mock 与依赖替换

## 一、vi.mock 与它的自动提升

```ts
vi.mock('./api', () => ({ getUser: vi.fn() }));
import { getUser } from './api';
```

`vi.mock` 会被 **hoist（提升到文件顶部、先于 import 执行）**——所以你写在 import 之后的 `vi.mock` 其实先生效。这是 ESM 测试里最常见的困惑源头：记住「mock 声明在语义上永远在最前面」。

## 二、工厂函数与部分 mock

第二参工厂返回替换后的模块形状。**只改几个导出、其余保留真实**，用 `importOriginal`：

```ts
vi.mock('./utils', async (orig) => {
  const real = await orig<typeof import('./utils')>();
  return { ...real, expensive: vi.fn() };
});
```

不传工厂则是**自动 mock**（Vitest 猜测形状、函数都变空 vi.fn），一般不推荐——显式工厂更可控。

## 三、vi.hoisted：给提升的 mock 喂外部变量

工厂被提升到 import 前，**不能引用文件里后声明的变量**。用 `vi.hoisted` 把需要共享的东西也提到最前：

```ts
const { mockFn } = vi.hoisted(() => ({ mockFn: vi.fn() }));
vi.mock('./dep', () => ({ dep: mockFn }));
```

## 四、mock 配置、环境、网络

- **环境变量**：`vi.stubEnv('NODE_ENV', 'test')`（或 mock 掉导出 config 的模块），测完 `unstubEnvs`。
- **网络层**：别用 vi.mock 去 mock axios/fetch 的每个方法——那是 **MSW** 的活（L4 网络关讲），在请求边界拦截更真实。
- **`__mocks__` 目录**：放在被测模块旁，Vitest 可自动用（第三方库尤其方便），但仍建议 `vi.mock` 显式声明。

## 五、ESM vs CommonJS 的差异

Vitest 原生 ESM：mock 的是**模块导出绑定**，默认导出要写成工厂里的 `default`；相对路径必须**可被解析**。别把 jest 里 `jest.mock` 的旧习惯（如随意 mock 未安装模块）平移过来，路径写错 vi.mock 直接报错而非静默。

## 小结
vi.mock 自动提升（先于 import 生效）；工厂替换模块形状、importOriginal 做部分 mock、vi.hoisted 解决工厂引用外部变量；不传工厂=自动 mock 不推荐；环境变量用 vi.stubEnv、网络交给 MSW；__mocks__ 目录约定；ESM 下 mock 导出绑定、路径须可解析、默认导出写 default。

## 部署预告
给一个 import 了 `./logger` 和 `./api` 的模块写测试：用 `vi.mock('./api', ...)` 工厂替换 api、保留 logger 真实（`importOriginal`）；再故意在工厂里引用一个文件变量触发 undefined 报错，改用 `vi.hoisted` 修复，亲手体会提升带来的顺序坑。
