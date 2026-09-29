# 单元测试：store 脱离组件测

## 核心思路：store 是纯逻辑对象

Pinia store 不依赖 DOM——测试只需 `setActivePinia(createPinia())` 就能在 Node/Vitest 环境里操作。

```ts
// 目的：store 纯逻辑单测——不起组件，setActivePinia 建一个活 pinia 就能测
// stores/counter.test.ts
import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCounterStore } from './counter';

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());   // 每个用例前重建全新 pinia，用例间隔离
  });

  it('increments', () => {
    const c = useCounterStore();          // 此时才能安全 useXxxStore
    expect(c.count).toBe(0);              // 初始值
    c.increment();                         // 直接调 action
    expect(c.count).toBe(1);              // 副作用立即可断言
  });

  it('double getter works', () => {
    const c = useCounterStore();
    c.increment();
    expect(c.double).toBe(2);             // computed getter 无需手动触发，读即重算
  });
});
// ✅ beforeEach 重建 pinia，store 不跨用例污染，count 永远从 0 起
// ❌ 不调 setActivePinia 就 useCounterStore()→报 No active pinia，测试直接失败
```

## 测 async action

```ts
// 目的：测 async action——mock API 层，分别断言成功写 state、失败进 error
it('fetchUser sets userInfo', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ name: 'Tom' });   // 喂一个成功响应
  const store = useUserStore();
  await store.fetchUser('1');                                  // await 等异步完成
  expect(store.user).toEqual({ name: 'Tom' });                 // 数据已写入 store
  expect(store.loading).toBe(false);                           // finally 里关了 loading
});

it('fetchUser handles error', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Network'));   // 喂一个失败
  const store = useUserStore();
  await store.fetchUser('1').catch(() => {});                   // 接住抛出防未处理 rejection
  expect(store.error).toBe('Network');                          // 错信已进 error 态
});
// ✅ mockResolvedValueOnce/mockRejectedValueOnce 分别驱动成功与失败分支，无需真后端
// ❌ 失败用例不接 .catch(() => {})→action 重新抛出的错变成未处理 rejection 让测试报红
```

## 测插件效果

```ts
// 目的：测插件效果——桩一个内存 localStorage，验证变更后确实被持久化
it('persist saves to localStorage', async () => {
  const storage = new Map<string, string>();               // 用 Map 假扮 localStorage
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  const pinia = createPinia().use(persistPlugin);           // 把待测插件装进 pinia
  setActivePinia(pinia);
  const store = useCounterStore();
  store.increment();
  await nextTick(); // 等 $subscribe 异步刷盘
  expect(JSON.parse(storage.get('pinia_counter')!).count).toBe(1);   // 存进去的 count 应为 1
});
// ✅ vi.stubGlobal 桩掉 localStorage，无需真浏览器也能验插件写盘
// ❌ 不等 nextTick 就断言→$subscribe 尚未执行写入，storage 还是空，断言失败
```

## 组件集成测试

```ts
// 目的：组件集成测试——mount 时通过 plugins 注入 pinia，再 trigger 断言渲染
// 组件测需要 mount + 注入 pinia
import { mount } from '@vue/test-utils';
import Counter from './Counter.vue';

const wrapper = mount(Counter, {
  global: { plugins: [createPinia()] },   // 注入一个 pinia，组件里 useXxxStore 才拿得到
});
await wrapper.find('button').trigger('click');   // 模拟点击→调 store action
expect(wrapper.text()).toContain('1');            // 渲染文本随 store 更新
// ✅ 组件依赖的 store 由 plugins 注入，点击后视图与 store 同步变化
// ❌ mount 不传 global.plugins 就渲染用 store 的组件→报 No active pinia，组件创建失败
```

## $reset 在 Setup Store 里的替代

Setup Store 默认没有 `$reset()`——测试里用 `setActivePinia(createPinia())` 每个 it 前重建全新 pinia 实例。

## 部署预告

`npm create vue@latest` 勾选 Vitest，写一个 store 的单元测试跑通。
