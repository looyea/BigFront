# 表单：双向绑定与校验

> 目标：掌握 Svelte 5 表单全家桶——`bind:value` 系列（input/textarea/select/checkbox/radio/file、`bind:group`、类型转换）、受控与非受控两条提交路线（`FormData`）、原生约束校验与自定义校验的组合，以及和 Vue `v-model`、React 受控组件的正面对照。SvelteKit 的 form action 端点留给 12-sveltekit。（呼应 svelte-props 第四节 $bindable、vue 表单 v-model、react-forms）

---

## 一、bind:value：一句话双向绑定

```svelte
<script>
  // 目的：bind:value 一句话双向绑定—输入与变量自动同步，无需手写 oninput
  let username = $state('');
</script>
<input bind:value={username} placeholder="用户名" />   {/* ✅ 打字即时回写 username */}
<p>当前输入：{username || '（空）'}</p>   {/* ✅ 变量变又驱动视图，形成闭环 */}
```

`bind:value` 适用于 `<input>`（text/password/email/search…）、`<textarea>`、`<select>`（单选值/`multiple` 时绑数组）。修饰符类需求走**类型参数**而非指令后缀：

| 需求 | Vue | Svelte |
|---|---|---|
| 数字转换 | `v-model.number` | `<input type="number" bind:value={n}>`（n 声明为 number） |
| 失焦才同步 | `v-model.lazy` | 不绑变量、`onblur` 时手动同步;或 `bind:value={{ get, set }}` 自控读写 |
| 去首尾空格 | `v-model.trim` | 提交/派生时 `.trim()` |

```svelte
<script>
  // 目的：type=number 的 NaN 兜底—清空输入框时 value 是 NaN，需手动归 0
  let count = $state(0);
</script>
<input type="number" bind:value={count} />   {/* ✅ count 按数字绑定 */}
<!-- ✅ 兜底写法：bind:value={{ get: () => count, set: (v) => count = Number.isNaN(v) ? 0 : v }} -->
<!-- ❌ 不做兜底→用户清空输入框，count 变 NaN，后续参与运算一路 NaN 传染 -->
```

---

## 二、勾选与单选家族

```svelte
<script>
  // 目的：勾选/单选家族—bind:checked(布尔)、bind:group(数组/单选组)、bind:files(文件)
  let taste = $state('sweet');           // ✅ 单选组：共同绑一个变量
  let fruits = $state([]);               // ✅ 复选组：绑数组
  let agreed = $state(false);            // ✅ 单个复选框：布尔
  let touched = $state(false);
  let files = $state(null);
</script>
<input type="radio" name="taste" bind:group={taste} value="sweet" />
<input type="radio" name="taste" bind:group={taste} value="sour" />

<input type="checkbox" bind:group={fruits} value="apple" />
<input type="checkbox" bind:group={fruits} value="banana" />

<input type="checkbox" bind:checked={agreed} />          <!-- ⚠️ 不是 bind:value! -->
<label class:error={touched && !agreed}>需勾选同意</label>

<input type="file" bind:files={files} />                 <!-- ✅ FileList -->
<!-- ❌ 单个布尔复选框错用 bind:value={agreed}（而非 bind:checked）→ 勾选不会把 agreed 变 true -->
```

三个高频口误：单框布尔用 **`bind:checked`**；多框/多选用 **`bind:group`**（配 `value`）；`name` 在 group 模式下仍建议写（原生语义/无障碍）。

---

## 三、自定义输入组件：$bindable 闭环

封装 `<PriceInput bind:value>` 的钥匙就是 L1 学过的 `$bindable`（呼应 svelte-props 第四节）：

```svelte
<!-- PriceInput.svelte -->
<script>
  // 目的：自定义输入组件用 $bindable—一个声明即允许父用 bind:
  let { value = $bindable(0) } = $props();   // ✅ 标为可双向，父才能 bind:value
</script>
<div class="price">
  ￥<input type="number" bind:value />   {/* ✅ shorthand：bind:value 绑到同名 prop value */}
</div>
```

```svelte
<!-- 父 -->
<!-- 目的：父 bind:value 到子组件的 $bindable prop—输入变化回写 total -->
<PriceInput bind:value={total} />   {/* ✅ 无需手写回调，子组件改动直接同步 total */}
<p>总价 {total}</p>
```

对照：Vue 的 `modelValue` + `update:modelValue`、React 的 `value` + `onChange` 手工对——Svelte 一个 `$bindable` 声明即可用 `bind:`。

---

## 四、提交两条路：受控 vs FormData 非受控

**路 A · 受控**：每个字段都有 `$state`，提交时直接读变量。适合字段间联动、实时校验。

```svelte
<script>
  // 目的：受控提交—每字段都有 $state，提交直接读变量，适合字段联动/实时校验
  let email = $state('');
  let pwd = $state('');
  const valid = $derived(/@\S+/.test(email) && pwd.length >= 8);   // ✅ 派生实时算合法性
  async function onsubmit(e) {
    e.preventDefault();   // ✅ 阻止默认刷新（或改写 on:submit|preventDefault）
    if (!valid) return;   // ✅ 不合法直接不提交
    await api.signup({ email, pwd });
  }
</script>
<form onsubmit={onsubmit}>…</form>
```

**路 B · 非受控**：不绑变量，提交时一把抓——字段多、无联动时**零状态开销**：

```svelte
<script>
  // 目的：非受控提交—不绑变量，提交时用 FormData 一把抓，零状态开销
  function onsubmit(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);   // ✅ currentTarget 即 form 元素
    const obj = Object.fromEntries(data);     // ✅ 转普通对象 { username: '...', role: 'admin' }
  }
</script>
<form {onsubmit}>
  <input name="username" required />   {/* ✅ 靠 name 而非变量，交给原生校验 */}
  <select name="role"><option>admin</option><option>user</option></select>
</form>
<!-- ❌ 非受控忘了写 name → FormData 里无此字段键，obj 拿到 undefined -->
```

提交时最常用的是 `e.currentTarget`(即 form 元素);需要长期持有引用就 `bind:this={formEl}`(呼应 svelte-template 第六节)。生产项目里两者常混用：联动字段绑定、其余交给 FormData。

---

## 五、校验：原生 + 自定义双层

- **第一层 · HTML 约束校验**：`required`、`minlength`、`pattern`、`type="email"`——提交时 `form.checkValidity()`，报错 UI 用 `:invalid` 伪类；不想让浏览器抢提示就加 `novalidate`。
- **第二层 · 自定义**：`errors = $state({})`，在 `blur`/`input` 时机跑规则函数，`$derived` 汇总 `valid`；**别在提交时才首次校验**（体验差）。
- 无障碍三件套：错误文案 `aria-describedby` 关联输入、`aria-invalid={!!errors.email}`、提交后焦点跳到第一个错误字段。

```svelte
<!-- 目的：自定义校验＋无障碍—blur 时机跑规则，错误文案用 aria 关联输入 -->
<input name="email" bind:value={email} onblur={checkEmail}
       aria-invalid={!!errors.email} aria-describedby="email-err" />   {/* ✅ 标错字段供读屏器播报 */}
{#if errors.email}<span id="email-err">{errors.email}</span>{/if}   {/* ✅ id 与 describedby 对应 */}
<!-- ❌ 只用红框不配 aria-describedby/invalid → 读屏用户听不到错在哪，无障碍不过关 -->
```

---

## 六、和 Vue / React 表单的总对照

| 维度 | Svelte 5 | Vue 3 | React |
|---|---|---|---|
| 文本双向 | bind:value | v-model | value+onChange 手写 |
| 复选布尔 | bind:checked | v-model=true-value | checked+onChange |
| 单选/复选组 | bind:group | v-model（原生） | 手写同名 value |
| 组件双向 | $bindable prop | defineModel | props+回调 |
| 非受控 | FormData 直读 | ref+el.value | uncontrolled/ref |
| 阻止提交 | e.preventDefault() | @submit.prevent | e.preventDefault() |
| 生态方案 | SvelteKit form actions（12 包）| VeeValidate | RHF/Zod |

---

## 七、自检清单

- [ ] 分清 bind:value / bind:checked / bind:group / bind:files 四个场景。
- [ ] 会给自定义输入组件加 `$bindable` 让父 `bind:`。
- [ ] 能说出受控与非受控两条提交路线及各自适用场景。
- [ ] 会 novalidate + 自定义 errors 状态 + aria 三件套。
- [ ] 知道 `type=number` 的 NaN 兜底坑。

---

🚀 **下一关**：`svelte-transitions-animations`——`transition:fade`、`in:`/`out:`、crossfade/flip 与自定义过渡函数：进出场动画不装任何库。
