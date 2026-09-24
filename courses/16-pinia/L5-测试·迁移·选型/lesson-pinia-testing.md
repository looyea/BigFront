# 单元测试：store 脱离组件测

## 核心思路：store 是纯逻辑对象

Pinia store 不依赖 DOM——测试只需 `setActivePinia(createPinia())` 就能在 Node/Vitest 环境里操作。

```ts
// stores/counter.test.ts
import { setActivePinia, createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCounterStore } from './counter';

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('increments', () => {
    const c = useCounterStore();
    expect(c.count).toBe(0);
    c.increment();
    expect(c.count).toBe(1);
  });

  it('double getter works', () => {
    const c = useCounterStore();
    c.increment();
    expect(c.double).toBe(2);
  });
});
```

## 测 async action

```ts
it('fetchUser sets userInfo', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({ name: 'Tom' });
  const store = useUserStore();
  await store.fetchUser('1');
  expect(store.user).toEqual({ name: 'Tom' });
  expect(store.loading).toBe(false);
});

it('fetchUser handles error', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Network'));
  const store = useUserStore();
  await store.fetchUser('1').catch(() => {});
  expect(store.error).toBe('Network');
});
```

## 测插件效果

```ts
it('persist saves to localStorage', async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
  });
  const pinia = createPinia().use(persistPlugin);
  setActivePinia(pinia);
  const store = useCounterStore();
  store.increment();
  await nextTick(); // 等 $subscribe 异步
  expect(JSON.parse(storage.get('pinia_counter')!).count).toBe(1);
});
```

## 组件集成测试

```ts
// 组件测需要 mount + 注入 pinia
import { mount } from '@vue/test-utils';
import Counter from './Counter.vue';

const wrapper = mount(Counter, {
  global: { plugins: [createPinia()] },
});
await wrapper.find('button').trigger('click');
expect(wrapper.text()).toContain('1');
```

## $reset 在 Setup Store 里的替代

Setup Store 默认没有 `$reset()`——测试里用 `setActivePinia(createPinia())` 每个 it 前重建全新 pinia 实例。

## 部署预告

`npm create vue@latest` 勾选 Vitest，写一个 store 的单元测试跑通。
