# 面试题 · Promise 与 async/await

1. **Promise 的三种状态、能否回退？**
   pending / fulfilled / rejected；状态一旦改变**不可再变**。then/catch/finally 只在合法跃迁时触发。

2. **then 链中 return 值和抛异常分别走哪条路？**
   return 值 → 下一个 then；throw → 下一个 catch（若无 catch，会一直向后穿透到未处理的 rejection）。

3. **async 函数的返回值一定是 Promise 吗？**
   是。即使 return 一个普通值，也会被隐式 `Promise.resolve` 包装。

4. **await 后面跟非 Promise 会怎样？**
   会被 Promise.resolve 包装再 await。所以 `await 42` 相当于 `await Promise.resolve(42)`，仍然产生一次微任务。

5. **Promise.all / allSettled / race / any 区别？**
   - all：全成功才成功；一个失败立即失败。
   - allSettled：一定完成，返回每一项状态。
   - race：第一个 settled 的（无论成败）。
   - any：第一个 fulfilled 的；全失败才 AggregateError。

6. **说说事件循环（Event Loop）。微任务和宏任务的先后顺序？**
   一个宏任务 → 清空所有微任务（含 promise.then、queueMicrotask、MutationObserver）→ 渲染 → 下一个宏任务（setTimeout、I/O、postMessage）。
   经典题：
   ```js
   console.log(1);
   setTimeout(() => console.log(2));
   Promise.resolve().then(() => console.log(3));
   console.log(4);
   // 1 4 3 2
   ```

7. **如何中断一个 Promise？**
   Promise 本身没有取消 API。用 AbortController 传给 fetch；或用超时竞速（Promise.race + reject）；或用生成器/AbortSignal 组合。

8. **手写一个 Promise.all**（现场高频）
   ```js
   function all(promises) {
     return new Promise((resolve, reject) => {
       const out = []; let done = 0, hasErr = false;
       if (!promises.length) return resolve(out);
       promises.forEach((p, i) =>
         Promise.resolve(p).then(v => { if (hasErr) return; out[i] = v; if (++done === promises.length) resolve(out); },
                                      e => { hasErr = true; reject(e); })
       );
     });
   }
   ```
