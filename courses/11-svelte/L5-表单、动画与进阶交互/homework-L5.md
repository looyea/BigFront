# L5 作业：表单、动效与 Actions

> 范围：svelte-forms / svelte-transitions-animations / svelte-actions。五段式。

## 一、读代码找 Bug（每题 10 分）

1. ```svelte
   <input type="checkbox" bind:value={agreed} />
   ```
   `agreed` 永远是字符串数组/怪值。怎么修？

2. ```svelte
   <input type="checkbox" name="c" bind:value={picked} value="A" />
   <input type="checkbox" name="c" bind:value={picked} value="B" />
   ```
   想让 picked 收集 ['A','B'] 多选。改哪个绑定指令？

3. ```svelte
   <form onsubmit={submit}>     <!-- submit 内有 fetch,但页面整体刷新了 -->
   ```
   漏了什么？给出两种修法（含修饰符写法）。

4. ```svelte
   {#if open}
     <div transition:fade>…</div>
   {/if}
   <style>
     .box { display: none; }   /* 以为 display 切换也能触发 transition */
   </style>
   ```
   用 CSS `display:none` 切换的元素上 transition: 不播放。为什么？怎么改（两条路线）？

5. ```svelte
   {#each items as item}
     <li animate:flip>{{ duration: 200 }}</li>
   {/each}
   ```
   排序动画混乱且控制台警告。两处问题（提示：keyed 与属性写法）。

6. ```js
   export function autoplay(node) {
     const obs = new IntersectionObserver(...);
     obs.observe(node);
     // 没有返回任何东西
   }
   ```
   组件反复开关后内存暴涨、旧 observer 还在跑。缺了什么？

7. ```svelte
   <Comp use:tooltip="{{ text: '帮助' }}"/>
   ```
   编译报错。action 的使用边界是什么？两种改法。

8. ```js
   export function highlight(node, color) {
     let cur = color;
     node.style.outline = `2px solid ${cur}`;
     return {
       update(newColor) { /* 忘了重新设置样式 */ },
     };
   }
   ```
   父组件换 color 后高亮不变。update 里该写什么？

9. ```svelte
   <input type="number" bind:value={age} />
   <p {age}>{age > 18 ? '成年' : '未成年'}</p>
   ```
   清空输入框后判断逻辑错乱且 `{age}` 写法怪异。指出两处问题。

10. ```svelte
    <div transition:slide>
      {#if expanded}<p>新插入的子段落</p>{/if}
    </div>
    ```
    外部同学反馈：每次往里 push 新内容,老容器又整体重播一遍进场。加什么修饰符？

## 二、手写编程题（共 5 题）

1. 注册表单：用户名/邮箱/密码/确认密码/同意条款。要求 `bind:group`/`bind:checked` 各出现一次、`errors` 状态 + blur 校验、提交按钮 disabled 联动 `$derived(valid)`。
2. 写 `TagInput.svelte`：`bind:value`（字符串数组，$bindable）+ 输入回车添加 + Backspace 空输入删尾 + 每个 tag 可点删；删除用 `out:scale` 动画。
3. 给 2 的列表加 `animate:flip`：新增 tag 时其余 tag 平滑让位；再验证去掉 keyed 后现象，写一句注释解释。
4. 写 `use:autosize(node)` action：textarea 高度随内容增长（`scrollHeight`），参数 `{ min, max }` 且 update 响应变化。
5. 写 `use:confirmAction`：给删除按钮加"二次确认"（首次点击变"确认?"，3 秒未再点复原）——定时器 + destroy 清理 + update 接收新文案。

## 三、场景设计题（1 题）

评审并重构这个搜索页：
> 每个输入字符都 `fetch`（无防抖无竞态取消，旧请求后到会覆盖新结果）；结果列表非 keyed each + transition:fade；折叠面板用 v-show 思路 display:none 想触发 transition:slide；tooltip 在 12 个组件里复制粘贴 mouseenter 逻辑；表单 30 个字段全部 bind:value 导致输入卡顿传闻（未验证）。
请逐条给出修复方案（含：竞态用 AbortController、防抖放 $derived/effect 哪层、何时该抽 action、30 字段是否真需要转非受控的判据）。

## 四、简答题（每题 3 分×3）

1. 受控 vs 非受控两条提交路线，各自代价是什么？
2. transition 的 tick 与 css 何时必须选 tick？举两个场景。
3. action 的 update 钩子为什么不自动生效？这带来什么义务？

## 五、挑战题（🏆 附加 20 分）

实现 `use:dragSort(node, { items })`：给 keyed `<ul>` 加指针拖拽排序——拖动时元素 `position: fixed` 跟手、其余项用 FLIP 思路让位（可复用 animate:flip 或手写让位过渡）、drop 后回写数组。写出你如何处理"拖拽中禁止 transition 干扰"与滚动容器边缘自动滚屏。
