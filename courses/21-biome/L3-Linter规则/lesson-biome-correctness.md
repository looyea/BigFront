# correctness：会直接报错的那些

## 一、correctness 组的性质

correctness 是 Biome 里**成本最低、收益最高**的一组——它报的几乎都是「大概率是 bug」的问题：未使用变量、用了未声明的变量、给 const 重新赋值、缺 return、可疑的比较等。这组建议**整组保持 error**，别轻易关。

## 二、几条必识规则

- `noUnusedVariables` / `noUnusedFunctionParameters`：写了没用的，往往是重构残留。
- `noUndeclaredVariables`：用了没声明的（近似「拼错的全局」），能在 lint 阶段抓到运行才炸的错。
- `noConstAssign`：给 const 赋值，纯 bug。
- `useAwaited` / `noFloatingPromises`：异步悬空——`void promise`、`.then` 没 catch、忘了 await，是生产事故高发点。

## 三、异步悬空：noFloatingPromises

这是 Biome 相对 ESLint 的一大「现代红利」。它强制你处理每个 Promise：要么 await、要么 .catch、要么显式 `void` 标注「我知道我不管它」。裸调一个返回 Promise 的函数不处理，被它抓个正着——这类静默失败的 bug，靠 code review 很难每次都拦住。

## 四、和 tsc 的重叠与互补

correctness 与 tsc 有交集（都抓未使用、未声明），但不是一回事：**tsc 管类型正确性，Biome correctness 管「运行时大概率错 + 跨文件不需要类型信息就能判」的写法**。而且 Biome 快，能在保存/提交的瞬间就报，不必等全量 tsc。两者互补：类型错归 tsc，风格与浅层错误归 Biome，都要。

## 五、precision / 数学位等边角

`noPrecisionTypeLoss` 等规则会抓「返回值精度丢失」这类易忽略问题。correctness 组的哲学是「宁可多提醒一个真 bug，也不制造风格噪音」，所以它的误报率相对 style 组低得多——这也是为什么它适合整组常开。

## 小结
correctness 报「大概率是 bug」的写法（未用/未声明/const 重赋/可疑比较），建议整组常开；noFloatingPromises/useAwaited 管异步悬空 Promise 是 Biome 的现代红利；它与 tsc 互补——类型归 tsc、浅层运行时错误+快反馈归 Biome；整组误报率低故适合常开。

## 部署预告
在 src 里故意制造：一个未使用变量、一个漏 await 的 Promise 调用、一个对 const 的赋值，跑 `biome check` 看 correctness 如何各报一条；给漏 await 的那处分别用 `await` / `.catch()` / `void` 三种方式消警，体会 noFloatingPromises 的三条出路。
