# 乐观更新与错误回滚

## 什么是乐观更新

用户点击"点赞"→ UI **立即**显示已赞 → 后台发 POST 请求 → 如果失败 → 回滚为未赞 + toast 提示。

核心三步：**快照 → 改状态 → 发请求 → 失败恢复快照**。

## Pinia 中实现乐观更新

```ts
export const usePostStore = defineStore('post', () => {
  const posts = ref<Post[]>([]);

  async function toggleLike(postId: string) {
    const idx = posts.value.findIndex(p => p.id === postId);
    if (idx === -1) return;

    // 1. 快照
    const snapshot = JSON.parse(JSON.stringify(posts.value[idx]));

    // 2. 乐观改
    posts.value[idx].liked = !posts.value[idx].liked;
    posts.value[idx].likeCount += posts.value[idx].liked ? 1 : -1;

    try {
      // 3. 发请求
      await api.post(`/posts/${postId}/like`, { liked: posts.value[idx].liked });
    } catch (e) {
      // 4. 回滚
      posts.value[idx] = snapshot;
      throw e; // 让上层 toast
    }
  }

  return { posts, toggleLike };
});
```

## 全局错误处理：插件模式

逐个 action 写 try/catch 太冗余。用 **Pinia 插件** 统一捕获：

```ts
// plugins/errorHandler.ts
import type { PiniaPluginContext } from 'pinia';

export function errorPlugin({ onAction }: PiniaPluginContext) {
  onAction({
    onError(error, name, args) {
      // 全局 toast
      toast.error(`操作 "${name}" 失败: ${error.message}`);
    },
  });
}

// main.ts
const pinia = createPinia();
pinia.use(errorPlugin);
```

action 里直接 `throw e`——不需要自己写 toast。

## 重试策略：指数退避

```ts
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

// action 里用
async function saveDraft(content: string) {
  await withRetry(() => api.put('/draft', { content }));
}
```

重试期间**保持乐观 UI**——用户看到"保存中"而非回滚闪烁。只有最终失败才回滚。

## 离线队列思路

断网时操作不能丢。简单实现：

```ts
const queue = ref<PendingOp[]>([]);

async function enqueueOrSend(op: PendingOp) {
  // 乐观改 state...
  try {
    await api.send(op);
  } catch {
    queue.value.push(op); // 入队
  }
}

// 网络恢复后批量提交
window.addEventListener('online', async () => {
  while (queue.value.length) {
    const op = queue.value[0];
    try { await api.send(op); queue.value.shift(); }
    catch { break; } // 仍离线
  }
});
```

## $subscribe 做自动持久化（避免丢失乐观态）

乐观更新后如果用户刷新页面，需要持久化最新 state：

```ts
store.$subscribe((_, state) => {
  localStorage.setItem(store.$id, JSON.stringify(state));
}, { detached: true });
```

配合 L1 的 `$subscribe` 知识，保证"乐观改完立刻存盘"。

## 乐观更新的陷阱

1. **非幂等操作不适合**：转账、删除账户——失败后回滚不能"撤销已扣的钱"。
2. **竞态**：快速连点两次 like → 第二次基于乐观态而非服务端真实态 → 计数偏移。用 `pending` 标志禁止重复提交或合并请求。
3. **UX 一致性**：回滚后 UI 突然"弹回"会让用户困惑——配合 toast 说明原因。

## 部署预告

本地 jsonplaceholder 模拟 API，手动断网 DevTools → Network → Offline 测乐观+回滚。
