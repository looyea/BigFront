# 表单：双向绑定与校验

> 目标：掌握 Svelte 5 表单全家桶——`bind:value` 系列（input/textarea/select/checkbox/radio/file、`bind:group`、类型转换）、受控与非受控两条提交路线（`FormData`）、原生约束校验与自定义校验的组合，以及和 Vue `v-model`、React 受控组件的正面对照。SvelteKit 的 form action 端点留给 12-sveltekit。（呼应 svelte-props 第四节 $bindable、vue 表单 v-model、react-forms）

---

## 一、bind:value：一句话双向绑定

```svelte
<script>
  let username = $state('');
</script>
<input bind:value={username} placeholder="用户名" />
<p>当前输入：{username || '（空）'}</p>
```

`bind:value` 适用于 `<input>`（text/password/email/search…）、`<textarea>`、`<select>`（单选值/`multiple` 时绑数组）。修饰符类需求走**类型参数**而非指令后缀：

| 需求 | Vue | Svelte |
|---|---|---|
| 数字转换 | `v-model.number` | `<input type="number" bind:value={n}>`（n 声明为 number） |
| 失焦才同步 | `v-model.lazy` | 不绑变量、`onblur` 时手动同步;或 `bind:value={{ get, set }}` 自控读写 |
| 去首尾空格 | `v-model.trim` | 提交/派生时 `.trim()` |

```svelte
<script>
  let count = $state(0);
  let debounced = $derived.by(() => { /* 配合 $effect+setTimeout 做输入节流 */ });
</script>
<input type="number" bind:value={count} />
<!-- 数字输入框清空时 value 是 NaN,记得兜底：bind:value={{ get: () => count, set: (v) => count = Number.isNaN(v) ? 0 : v }} -->
```

---

## 二、勾选与单选家族

```svelte
<script>
  let taste = $state('sweet');           // 单选组：共同绑一个变量
  let fruits = $state([]);               // 复选组：绑数组
  let agreed = $state(false);            // 单个复选框：布尔
  let touched = $state(false);
  let files = $state(null);
</script>
<input type="radio" name="taste" bind:group={taste} value="sweet" />
<input type="radio" name="taste" bind:group={taste} value="sour" />

<input type="checkbox" bind:group={fruits} value="apple" />
<input type="checkbox" bind:group={fruits} value="banana" />

<input type="checkbox" bind:checked={agreed} />          <!-- 不是 bind:value! -->
<label class:error={touched && !agreed}>需勾选同意</label>

<input type="file" bind:files={files} />                 <!-- FileList -->
```

三个高频口误：单框布尔用 **`bind:checked`**；多框/多选用 **`bind:group`**（配 `value`）；`name` 在 group 模式下仍建议写（原生语义/无障碍）。

---

## 三、自定义输入组件：$bindable 闭环

封装 `<PriceInput bind:value>` 的钥匙就是 L1 学过的 `$bindable`（呼应 svelte-props 第四节）：

```svelte
<!-- PriceInput.svelte -->
<script>
  let { value = $bindable(0) } = $props();
</script>
<div class="price">
  ￥<input type="number" bind:value />
</div>
```

```svelte
<!-- 父 -->
<PriceInput bind:value={total} />
<p>总价 {total}</p>
```

对照：Vue 的 `modelValue` + `update:modelValue`、React 的 `value` + `onChange` 手工对——Svelte 一个 `$bindable` 声明即可用 `bind:`。

---

## 四、提交两条路：受控 vs FormData 非受控

**路 A · 受控**：每个字段都有 `$state`，提交时直接读变量。适合字段间联动、实时校验。

```svelte
<script>
  let email = $state('');
  let pwd = $state('');
  const valid = $derived(/@\S+/.test(email) && pwd.length >= 8);
  async function onsubmit(e) {
    e.preventDefault();   // 或改写 on:submit|preventDefault={fn}(见 svelte-events 修饰符)
    if (!valid) return;
    await api.signup({ email, pwd });
  }
</script>
<form onsubmit={onsubmit}>…</form>
```

**路 B · 非受控**：不绑变量，提交时一把抓——字段多、无联动时**零状态开销**：

```svelte
<script>
  function onsubmit(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const obj = Object.fromEntries(data);     // { username: '...', role: 'admin' }
  }
</script>
<form {onsubmit}>
  <input name="username" required />
  <select name="role"><option>admin</option><option>user</option></select>
</form>
```

提交时最常用的是 `e.currentTarget`(即 form 元素);需要长期持有引用就 `bind:this={formEl}`(呼应 svelte-template 第六节)。生产项目里两者常混用：联动字段绑定、其余交给 FormData。

---

## 五、校验：原生 + 自定义双层

- **第一层 · HTML 约束校验**：`required`、`minlength`、`pattern`、`type="email"`——提交时 `form.checkValidity()`，报错 UI 用 `:invalid` 伪类；不想让浏览器抢提示就加 `novalidate`。
- **第二层 · 自定义**：`errors = $state({})`，在 `blur`/`input` 时机跑规则函数，`$derived` 汇总 `valid`；**别在提交时才首次校验**（体验差）。
- 无障碍三件套：错误文案 `aria-describedby` 关联输入、`aria-invalid={!!errors.email}`、提交后焦点跳到第一个错误字段。

```svelte
<input name="email" bind:value={email} onblur={checkEmail}
       aria-invalid={!!errors.email} aria-describedby="email-err" />
{#if errors.email}<span id="email-err">{errors.email}</span>{/if}
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
