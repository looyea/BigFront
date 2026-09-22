# 参数 Matcher：给路由加类型守门员

> 目标：掌握 src/params matcher 的完整契约——match 函数签名、命名挂载语法、双端执行时机、失配后的排序兜底链，以及它如何顺手解决 rest 参数匹配空的老大难。

## 一、为什么需要 Matcher

`src/routes/fruits/[page]` 匹配 `/fruits/apple`，但也匹配 `/fruits/rocketship`——火箭不是水果，这个 URL 不该进这扇门。裸 `[param]` 只做"占一个段"的结构匹配，不做任何值校验；校验逻辑本该写进 load 里逐个 if，而 matcher 把这道校验**上提到路由匹配层**：传入参数字符串、返回 boolean，`false` 直接宣告"此路由不适用"。

## 二、完整链路：文件 + 挂载语法

matcher 放 `src/params/`，**文件名即 matcher 名**：

```ts
// src/params/fruit.ts
import type { ParamMatcher } from '@sveltejs/kit';

export const match = ((param: string): param is 'apple' | 'orange' => {
  return param === 'apple' || param === 'orange';
}) satisfies ParamMatcher;
```

挂载时在参数名后接 `=名称`，目录改名即可生效：

```
src/routes/fruits/[page=fruit]/+page.svelte
```

三个类型与工程细节：
- `ParamMatcher` 契约就是 `(param: string) => boolean`，官方示例用 `satisfies` 而非 `: ParamMatcher` 标注——保留 `param is 'apple' | 'orange'` 这类字面量收窄信息；
- `src/params` 目录里**每个模块都对应一个 matcher**，唯一例外是 `*.test.js` / `*.spec.js`——官方明确留了同址单测通道，matcher 的测试就放它自己旁边；
- 可选参数同样能挂：`[[page=fruit]]`；排序时带 matcher 的参数优先级高于裸参数（上一关规则 2）。

## 三、失配之后发生什么

`/fruits/rocketship` 撞上 `[page=fruit]` 返回 false 时，**不是立刻 404**——SvelteKit 会按排序规则继续尝试其他能匹配的路由（比如你同时有 `fruits/[page]` 裸参数版或 `[...catchall]` 兜底版），全部失败才最终返回 404。这条"排序兜底链"是 matcher 安全网：激进地加 matcher 不会把流量堵死，只会把它导向更泛化的路由。

由此推出一个组合技：`/shop/[...path]` catch-all 挂 `[...path=slug]` matcher，或者让泛化路由排在兜底链后做"半路接盘"——404 与否完全由你设计的路由集合决定。

## 四、双端执行与副作用红线

官方一句话铁律：**Matchers run both on the server and in the browser**——服务端首次请求解析路由跑一遍，客户端导航（点链接换页）再跑一遍。推论：
- matcher 必须**纯函数**：读全局状态、发请求、依赖只在某端存在的环境变量都可能造成"服务端进了的路由、客户端判 404"的分裂行为；
- 别依赖 session/数据库做路由裁决——matcher 只有参数字符串这一个输入，能做的只有格式与白名单判断。"这个 id 在库里存不存在"不归 matcher 管，归 load 管（查库后 `throw error(404)`），两层分工别混。

## 五、实战模板：uuid 与 rest 校验

```ts
// src/params/uuid.ts —— 只放行合法 UUID 段
import type { ParamMatcher } from '@sveltejs/kit';
export const match = ((param: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(param)
) satisfies ParamMatcher;
```

路由 `/orders/[id=uuid]` 从此把 `/orders/latest`、`/orders/1` 全部挡去别的候选路由。rest 参数"匹配空"的坑（上一关第三节）官方推荐的修法也正是 matcher——给 `[...rest]` 挂一个 `param.length > 0` 级别的 matcher，或至少在 load 里校验。matcher 是路由层的正则军刀，短、快、纯、双端安全，四条都占。

## 六、命名与工程约定

matcher 名会写进目录名并永久出现在 URL 语义讨论里，命名两条经验：
- **用领域语义不用实现细节**：`[page=fruit]`、`[id=uuid]` 好过 `[page=whiteList]`、`[id=regex]`——后者把实现漏进了契约，改天白名单换成数据库存在性检查时目录名反而说谎；
- **全项目复用优先新建**：文件名即全局注册表，`numeric` 写一次，`[id=numeric]`、`[page=numeric]`、`[...path=numeric]` 处处可用。新建前先 grep 一遍 params 目录，避免 `posInteger` / `positive-integer` / `posint` 三个同义 matcher 并存。

还有一个容易忽略的连锁收益：matcher 收窄后，同层其他路由的候选压力变小——`[b]` 抢走 `/foo-def` 的风险，在 `[c=slug]` 存在时会被排序规则 ② 自动拉开。换句话说，matcher 不只是守门员，也是排序棋盘上的棋子——它改变的是整条兜底链的形状，加与删都要回到第三节那条链上重新推一遍。

## 七、自检清单
- [ ] 写出 matcher 文件的存放目录、导出形态与挂载语法（含 satisfies ParamMatcher 的理由）
- [ ] matcher 失配后的完整行为：按排序尝试其他路由、全败才 404
- [ ] "双端执行"对 matcher 实现施加了哪两条纪律（纯函数/无环境依赖）
- [ ] matcher 与 load 校验的分工边界：格式白名单归谁、查库存在性归谁
- [ ] src/params 目录里哪些文件不会被当成 matcher；命名两原则与复用前必做的动作

🚀 **下一关**：kit-navigation-preload——hover/tap/eager/viewport 四档预取开关、saveData 尊重策略与 preloadData/preloadCode 编程式入口。
