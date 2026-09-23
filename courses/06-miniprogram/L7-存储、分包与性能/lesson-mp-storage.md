# 数据缓存

> 目标：Storage 是小程序唯一的**持久化本地仓库**——同步/异步两套 API、单 key 1MB / 总 10MB 限额、按小程序隔离、清缓存即归零。本课给出一套"缓存三件套"设计（前缀命名空间 + 过期策略 + 容量治理），并划清它与 globalData/内存/后端库的边界（呼应 **vue-pinia 持久化**、**node-config 分层**、**mp-communication** 通道选型表）。

---

## 一、API 全景与限额

```js
// 异步（官方推荐——同步版会阻塞逻辑层线程）
wx.setStorage({ key: 'k', data: obj, success, fail, complete });
wx.getStorage({ key: 'k', success: (res) => res.data });
wx.removeStorage({ key }); wx.clearStorage();
wx.getStorageInfo({ success: ({ keys, currentSize, limitSize }) => {} }); // 体积统计(KB)

// 同步版：命名是"驼峰带 Sync"
wx.setStorageSync('k', obj);
const v = wx.getStorageSync('k');      // 不存在时返回 ''（空字符串，不是 undefined！）
wx.removeStorageSync('k'); wx.clearStorageSync();
wx.getStorageInfoSync();
```

硬约束清单：

- **单 key ≤ 1MB、总量 ≤ 10MB**（整个小程序所有页面/组件共享此额度，缓存炸了是全局事故）；
- 存的是**序列化后的值**：函数、Symbol、循环引用对象、`Date`（回读成字符串？——Date 会被序列化为字符串再回读，**类型丢失**，跨端通病，呼应 ts-utility 的 JSON 类型话题）；
- **按小程序 appid 隔离**、同一微信用户维度存储——换设备/换微信号即无（不是账号级！）；
- 用户可在"设置-小程序存储"清除、微信也可在存储紧张时清理——**缓存永远可能被清空，读取必须容错+回源**。

---

## 二、和 globalData / 内存变量 / 后端怎么选

| 维度 | Storage | globalData | 页面 data | 后端 DB |
|---|---|---|---|---|
| 寿命 | **跨启动持久** | 本次小程序实例 | 本页存续 | 永久 |
| 速度 | 磁盘 IO（同步版阻塞） | 内存 | 内存 | 网络 |
| 容量 | 10MB 硬顶 | 内存为准 | setData 1MB 警戒 | 无上限 |
| 一致性 | 可能过期/被清 | 单端即时 | 单页 | 唯一权威源 |
| 典型 | token、草稿、偏好、字典 | 登录态镜像、系统信息 | 视图状态 | 业务数据 |

**写入路径的经典三段**：改内存（globalData/store）立即生效 → 防抖写 Storage 持久化 → 关键数据同时上报后端（多端一致）。读取路径：**启动时 Storage 恢复内存态，随后以接口回源校准**（呼应 mp-communication 面试 9、react-data-fetching 的 stale-while-revalidate：先给旧的、后台换新的）。

---

## 三、工程化：一个带命名空间与过期的 cache.js

裸用 `wx.setStorageSync('user', ...)` 三个月后必然遭遇：key 冲突、僵尸数据、无差别清空。上"三件套"：

```js
// utils/cache.js
const NS = 'mp_shop:';                       // ① 命名空间前缀
const now = () => Date.now();

export function set(key, data, ttlMs = 0) {  // ② 过期策略：0=不过期
  wx.setStorageSync(NS + key, { v: data, e: ttlMs ? now() + ttlMs : 0 });
}
export function get(key, fallback = null) {
  const raw = wx.getStorageSync(NS + key);
  if (!raw) return fallback;                 // 注意空串/未命中
  if (raw.e && raw.e < now()) { wx.removeStorageSync(NS + key); return fallback; }
  return raw.v;
}
export function sweep() {                    // ③ 容量治理：启动时扫一遍过期 key
  const keys = wx.getStorageInfoSync().keys.filter((k) => k.startsWith(NS));
  let removed = 0;
  keys.forEach((k) => {
    const raw = wx.getStorageSync(k);
    if (raw?.e && raw.e < now()) { wx.removeStorageSync(k); removed++; }
  });
  return { total: keys.length, removed };
}
export const keys = () => wx.getStorageInfoSync().keys.filter((k) => k.startsWith(NS));
```

使用约定：`cache.set('dict:goods', dict, 24 * 3600e3)`（字典 24h）、`cache.set('token', t)`（不过期，登出时 remove）、`cache.set('draft:order', form, 7 * 864e5)`（草稿 7 天）。

> 呼应：这套 TTL+命名空间正是 **Pinia 持久化插件 / axios 缓存层**的小程序简化版；`sweep` 思路等同 node 课程里"临时目录定期回收"（node-fs）。

---

## 四、敏感数据与大文件

- **token/手机号不要明文裸存**：至少后端加密下发+解密使用；能存"短期 token+refresh"就不存长期凭证（呼应 mp-login 第九题存储清单）；
- 图片音视频**不进 Storage**：用文件系统 `wx.getFileSystemManager()`（本地用户目录限额 10MB 另算）或每次现取 CDN；
- 搜索历史/购物车预览这类"可丢数据"最适合缓存（丢了无感知）；**不可丢数据（订单）永远以服务端为准**，缓存只做展示加速（呼应 exp-rest 单一事实源）。

---

## 五、自检清单

- [ ] getStorageSync 未命中返回什么？为什么这会导致一类隐蔽 bug？
- [ ] 单 key/总额上限？谁共享这个额度？
- [ ] Date 存进去取出来还是 Date 吗？函数呢？
- [ ] 一条数据的"写路径三段"与"读路径两段"分别是什么？
- [ ] 什么数据"最适合缓存"、什么"绝不可以只靠缓存"？

---

## 🚀 部署预告

- 缓存的分寸感=数据分级：可丢/可重建/权威源，先分级再选型；
- 下一关 **mp-subpackage**：把"包"也做数据分级——主包 2M 硬顶下，分包/独立分包/预下载三板斧，与 10-vite 的代码拆分思想在微信基建上重逢（呼应 vite-splitting、react-performance）。
