# L5 · Promise 与 async/await

> 🎯 目标：把"回调地狱"改写为线性的 `async/await`，理解 Promise 三种状态，正确处理异步错误。**这是全课程最重要的一关**——前端 90% 的 bug 出在异步。

## 一、为什么需要 Promise

JS 是**单线程**的，网络请求、定时器、文件读取都是异步。早期用回调：

```js
getUser(id, (err, user) => {
  getOrders(user, (err, orders) => {
    getDetail(orders[0], (err, detail) => { /* 层层缩进 = 回调地狱 */ });
  });
});
```

## 二、Promise 是什么

Promise 是一个"未来才会有结果的对象"，有三种状态：**pending（进行中）→ fulfilled（成功）/ rejected（失败）**，一旦改变不可逆。

```js
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve('数据'), 1000); // 成功
  // 或 reject(new Error('失败'));
});

p.then(res => console.log(res))
  .catch(err => console.error(err))
  .finally(() => console.log('结束'));
```

## 三、async/await：把异步写成同步的样子

`async` 函数总返回 Promise；`await` 暂停执行直到 Promise 有结果（不阻塞主线程）。

```js
async function load(id) {
  try {
    const user = await getUser(id);
    const orders = await getOrders(user);
    return orders;
  } catch (err) {          // try/catch 统一捕获任何一步的失败
    console.error('加载失败', err);
  }
}
```

## 四、并发：all / allSettled / race

串行 `await` 会一个个等；互不依赖的任务应**并发**：

```js
// 同时发三个请求，全部成功才算成功
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);

// 允许部分失败：每个都返回 {status, value/reason}
const results = await Promise.allSettled([p1, p2, p3]);

// 谁先出结果要谁（含失败）
const fastest = await Promise.race([p1, timeout(3000)]);
```

> ⚠️ 常见错误：在循环里 `list.forEach(async x => await f(x))` —— `forEach` 不等待 async 回调！要用 `for...of` 或 `await Promise.all(list.map(x => f(x)))`。

## 五、心智模型

1. `await` 只能出现在 `async` 函数里（或模块顶层，见 L6 顶层 await）。
2. 忘了 `await` → 你拿到的是 Promise 对象而非结果，这是新手第一大坑。
3. 一个 `async` 函数抛错 = 它返回的 Promise 被 reject，务必 `try/catch` 或在调用处 `.catch`。

## 六、动手示例

- `es-async/01-promise.js` —— 回调 → Promise → async/await 三段改造
- `es-async/02-all.js` —— 串行 vs 并发的耗时对比

```bash
node courses/01-es/examples/es-async/02-all.js
```

完成「本关小测」+ `homework/L5.md` 后，最后一关 L6 见！
