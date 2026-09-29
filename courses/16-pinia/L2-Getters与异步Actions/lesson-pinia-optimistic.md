# 乐观更新与错误回滚

## 什么是乐观更新

用户点击"点赞"→ UI **立即**显示已赞 → 后台发 POST 请求 → 如果失败 → 回滚为未赞 + toast 提示。

核心三步：**快照 → 改状态 → 发请求 → 失败恢复快照**。

## Pinia 中实现乐观更新

```ts
// 目的：乐观更新四步——快照→乐观改→发请求→失败回滚快照
export const usePostStore = defineStore('post', () => {
  const posts = ref<Post[]>([]);

  async function toggleLike(postId: string) {
    const idx = posts.value.findIndex(p => p.id === postId);
    if (idx === -1) return;

    // 1. 快照：深拷贝当前项，供失败时回滚
    const snapshot = JSON.parse(JSON.stringify(posts.value[idx]));

    // 2. 乐观改：先本地翻转 liked 并同步计数，UI 立即反馈
    posts.value[idx].liked = !posts.value[idx].liked;
    posts.value[idx].likeCount += posts.value[idx].liked ? 1 : -1;

    try {
      // 3. 发请求：把乐观后的目标态同步到后端
      await api.post(`/posts/${postId}/like`, { liked: posts.value[idx].liked });
    } catch (e) {
      // 4. 回滚：请求失败恢复快照
      posts.value[idx] = snapshot;
      throw e; // 重新抛出让上层 toast（由 $onAction 插件统一接管）
    }
  }

  return { posts, toggleLike };
});
// ✅ 点赞瞬间上屏无等待；后端挂了也能回滚到操作前的 liked/likeCount
// ❌ 用浅拷贝 {...posts.value[idx]} 做快照→嵌套字段共享引用，回滚不干净（需深拷贝）
```

## 全局错误处理：插件模式

逐个 action 写 try/catch 太冗余。用 **Pinia 插件** 统一捕获：

```ts
// 目的：插件用 onAction 的 onError 钩子统一捕获——action 里只管 throw，不手写 toast
// plugins/errorHandler.ts
import type { PiniaPluginContext } from 'pinia';

export function errorPlugin({ onAction }: PiniaPluginContext) {
  onAction({
    onError(error, name, args) {        // 任意 action 抛错都流到这里
      // 全局 toast
      toast.error(`操作 "${name}" 失败: ${error.message}`);
    },
  });
}

// main.ts
const pinia = createPinia();
pinia.use(errorPlugin);                 // 注册插件，对所有 store 生效
// ✅ action 里直接 throw e→由插件集中弹 toast，业务代码无 catch 噪声
// ❌ 插件忘了 pinia.use(errorPlugin)→onError 永不注册，错误静默无提示
```

action 里直接 `throw e`——不需要自己写 toast。

## 重试策略：指数退避

```ts
// 目的：指数退避重试——瞬时失败递增等待后再试，最终失败才抛
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();                     // 成功立即返回，跳出循环
    } catch (e) {
      if (i === maxRetries - 1) throw e;     // 最后一次仍失败→抛出
      const delay = Math.pow(2, i) * 1000;   // 1s, 2s, 4s 退避
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

// action 里用
async function saveDraft(content: string) {
  await withRetry(() => api.put('/draft', { content }));   // 重试期间保持乐观 UI
}
// ✅ 网络抖动类瞬时错自动重试，用户只见“保存中”不回滚闪烁
// ❌ 对 4xx（参数错/无权限）也重试→反复提交注定失败的请求，应只重试 5xx/网络错
```

重试期间**保持乐观 UI**——用户看到"保存中"而非回滚闪烁。只有最终失败才回滚。

## 离线队列思路

断网时操作不能丢。简单实现：

```ts
// 目的：离线队列——发送失败则入队，网络恢复 (online 事件) 后按顺批量重发
const queue = ref<PendingOp[]>([]);

async function enqueueOrSend(op: PendingOp) {
  // 乐观改 state...
  try {
    await api.send(op);           // 在线：直接发送
  } catch {
    queue.value.push(op);         // 失败：入队待重试，操作不丢
  }
}

// 网络恢复后批量提交
window.addEventListener('online', async () => {
  while (queue.value.length) {
    const op = queue.value[0];
    try { await api.send(op); queue.value.shift(); }   // 成功才出队
    catch { break; }                                     // 仍离线→停下等下次 online
  }
});
// ✅ shift 仅在被确认后调，失败保留队首、下次接着发
// ❌ 发送前就 shift 出队→一旦失败该 op 已从队列消失，永久丢数据
```

## $subscribe 做自动持久化（避免丢失乐观态）

乐观更新后如果用户刷新页面，需要持久化最新 state：

```ts
// 目的：$subscribe 自动持久化——每次 store 变更立即写盘，乐观态也不丢
store.$subscribe((_, state) => {
  localStorage.setItem(store.$id, JSON.stringify(state));   // 任意变更后序列化存盘
}, { detached: true });   // detached→不随当前组件销毁，全局持续监听
// ✅ 乐观改完立即存盘，用户刷新页面不丢最新 state
// ❌ 不加 detached→订阅绑定组件 scope，组件卸载后不再存盘
```

配合 L1 的 `$subscribe` 知识，保证"乐观改完立刻存盘"。

## 乐观更新的陷阱

1. **非幂等操作不适合**：转账、删除账户——失败后回滚不能"撤销已扣的钱"。
2. **竞态**：快速连点两次 like → 第二次基于乐观态而非服务端真实态 → 计数偏移。用 `pending` 标志禁止重复提交或合并请求。
3. **UX 一致性**：回滚后 UI 突然"弹回"会让用户困惑——配合 toast 说明原因。

## 部署预告

本地 jsonplaceholder 模拟 API，手动断网 DevTools → Network → Offline 测乐观+回滚。
