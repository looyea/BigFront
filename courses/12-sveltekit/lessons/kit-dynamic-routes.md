# 动态路由与路由匹配全解

> 目标：吃透 [param] 参数家族的完整语法与官方匹配排序规则，掌握 rest/optional 参数、路由组、编码参数与布局重置——L1 文件即路由的进阶版，路由的九成表达力都收在这一关。

## 一、参数家族全员名录

`src/routes` 下用方括号目录名声明动态段，官方语法共四档加两个变体：

| 语法 | 含义 | 例 |
|---|---|---|
| `[id]` | 必填参数段 | `/blog/[slug]` 匹配 `/blog/hello` |
| `[[optional]]` | 可选参数段 | `[[page]]` 同时匹配 `/shop` 与 `/shop/2` |
| `[...rest]` | 剩余参数段 | `[...path]` 吃掉后续所有段 |
| `[[...rest]]` | 可选+剩余 | 匹配零到多段 |
| `[x+nn]` | 十六进制转义段名 | `src/routes/[x+2e]well-known/` 表达 `.well-known` |
| `[u+nnnn]` | Unicode 转义段名 | `[u+d83e][u+dd2a]` 与 `🤪` 目录名等价 |

编码语法是真没人日常用的——文件系统或 URL 里的禁忌字符（`:` `#` `%` `[` `]` `( )`、Windows 下的 `\ / * ? " < > |`）用 `[x+nn]` 十六进制转义（如 `:` 是 `[x+3a]`），emoji 目录名可用 `[u+nnnn]`（nnnn 取 0000–10ffff，无需代理对）。记住一个实用例外：官方建议用 `[x+2e]well-known` 创建 `.well-known` 路由，因为 TypeScript 对前导点目录支持不佳。

## 二、官方匹配排序四条规则

同一层级存在多个候选路由时，**永远只命中排序后的第一个**（优先级与目录创建先后无关）：

1. **更具体的路由优先**：无参路由压过单参路由、单参压过双参——`/shop/checkout` 永远赢过 `/shop/[id]`；
2. **带 matcher 的参数赢裸参数**：`[id=uuid]` 优先于 `[id]`（matcher 详见 L2 次关）；
3. **`[[optional]]` 与 `[...rest]` 若不在路由末尾则被忽略**（排序时 `x/[[y]]/z` 等价于 `x/z`）；在末尾则垫底——"实在没人认领才归你"；
4. **前规则全平手时按字母序 tie-break**：`[slug]` 和 `[date]` 同构？字母序决定命运。

排 4 是隐蔽事故源：有人靠"先建的目录"期望优先级，实际是字母序说了算。同层两个参数段语义冲突时，**要么改段名让层级结构表达差异，要么加 matcher 让规则 2 分胜负**，别赌字母表。

## 三、rest 与 optional 的经典陷阱

**`[...rest]` 能匹配空**——`/foo/[...rest]` 连 `/foo` 本身都匹配（rest 为空字符串）。想让它强制至少一段？load 里自己校验：

```ts
export function load({ params }) {
  if (!params.rest) throw redirect(307, '/foo');
  return { segments: params.rest.split('/') };
}
```

**`[[optional]]` 不能接在 rest 参数之后**——`/[...rest]/[[maybe]]` 是非法结构，官方明话：那玩意永远匹配不到任何东西，rest 已经把尾巴全吃了。设计 URL 时别指望"剩余段之后还有个可选尾段"。

**嵌套 404 手法**：默认 `src/routes/+error.svelte` 一旦命中就全屏接管、保住所有布局的诉求做不到。官方给的解法是在需要"布局内 404"的子树里放一个 `[...path]` catch-all 路由，其 universal load 校验参数发现没匹配上真页面时 `throw error(404, 'Not found')`——错误落在该路由自己的层级里，祖先布局原样保留。

## 四、路由组：(group) 重组层级不改 URL

功能模块大了想按 `(auth)`、`(marketing)` 分组管理目录？**括号目录参与文件系统组织但完全不出现在 URL 里**：`src/routes/(app)/dashboard/+page.svelte` 的地址就是 `/dashboard`。

三个官方要点：
- **组内可以直接放 `+page`**：首页 `/` 要归入 `(app)` 或 `(marketing)` 时，把 `+page.svelte` 写进组目录即可；
- **共享布局天然成立**：`(shop)` 下所有页面吃同一份 `+layout.svelte`；把某个子树（如 `admin/`）留在组外，它就不继承任何组的布局（官方称 breaking out of layouts）；
- **官方泼冷水**：组用多了项目容易过深难读；单纯想复用 UI 组件时，直接组合组件（可复用的 load 函数或 Svelte 组件）比造"假布局层"的组更干净。组是给**路由行为分层**（独立 error boundary/layout）用的，不是给强迫症整理文件夹用的。

## 五、布局重置：+page@ 与 +layout@

`src/routes/a/b/+page@.svelte`：尾点表示"以**根布局**为父"——中间的 `a`、`a/b` 布局全部跳过；`+layout@a.svelte` 则是"以 `/a` 的布局为父"。

场景：设置向导子树 `/onboarding/steps/...` 层层有布局，但全屏预览页 `/onboarding/preview` 想要一张干净的画布——给它 `+page@`（重置到根）即可，不必给整棵树拆布局。这是 Next.js 客户端组件世界里没有的独门刀法。

## 六、自检清单
- [ ] 说出四档参数语法与两个编码变体；[[optional]] 与 [...rest] 的组合禁区
- [ ] 背出匹配排序四规则：无参 > matcher > … > rest 垫底、字母序 tie-break
- [ ] 解释 [...path] 兜底路由实现"布局内 404"的手法与为什么需要它
- [ ] (group) 目录对 URL 的影响、以及官方对过度使用组的警告
- [ ] +page@. 与 +layout@a. 的尾点语义各是什么、什么场景该用

🚀 **下一关**：kit-route-matchers——`[id=uuid]` 的完整链路：match 函数契约、双端执行时机、matcher 与排序规则的联动兜底。
