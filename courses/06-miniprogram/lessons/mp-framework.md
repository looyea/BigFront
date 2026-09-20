# 跨端框架 Taro / uni-app

> 目标：你在 04/05 包学的 Vue/React 为什么还要学小程序方言？——因为工业界的答案常是"**一套 React/Vue 代码，编译出微信/支付宝/H5/RN**"。本课讲跨端的三种技术路线、Taro（React 写小程序）与 uni-app（Vue 写多端）的编译原理、以及"原生 vs 跨端"的决策框架（呼应 **react-architecture**、**vue-ssr-nuxt** 的技术选型思维、mp-overview 双线程）。

---

## 一、跨端的两条老大难与三条路线

痛点：一个业务要覆盖 微信/支付宝/抖音小程序 + H5 + App，各端 API 与模板方言互不相通。

| 路线 | 代表 | 原理 | 代价 |
|---|---|---|---|
| **编译时** | uni-app（早期）、mpvue（已归档） | 把 Vue 模板/样式 **转译**成各端原生方言代码 | 能力受"最大公约数"限制，转译边界多 |
| **运行时** | Taro 3、Remax | 用 React/Vue **虚拟 DOM 跑在端上**，再映射成小程序 setData | 包一层 runtime：性能损耗、体积增大 |
| **自绘引擎** | Flutter、RN(Skia 新架构) | 干脆不用 WebView，Canvas/GPU 自绘一切 | 生态另起炉灶，不算"小程序跨端" |

Taro 3 的机制一句话：**React 渲染器（reconciler）产出"DOM 模拟树"→ 序列化 diff → 翻译成小程序 setData 更新**。你在 mp-setdata 学到的成本模型，在这里变成跨端框架性能问题的总根源（呼应 mp-setdata：跨端框架里"一次 setState 可能触发更大的 setData"）。

---

## 二、Taro：用 React 写小程序

```jsx
// pages/index.jsx —— 函数组件、Hooks 全原生体验
import { View, Text, Button } from '@tarojs/components'
import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'

export default function Index() {
  const [n, setN] = useState(0);
  useDidShow(() => console.log('页面 onShow 时跑'));   // 生命周期 → Hooks 化
  return (
    <View>
      <Text>{n}</Text>
      <Button onClick={() => Taro.previewImage({ urls: [...] })}>+1</Button>
    </View>
  );
}
```

对照检查你的知识迁移度：

- `View/Text/Button` = 小程序原生组件的 React 包装（`<view>` → `<View>`，wxss → css/scss + postcss 转）；
- `Taro.navigateTo/request` = wx API 的统一门面（`wx.` 改 `Taro.`，内部按平台分发）；
- 页面生命周期 → `useDidShow/useLoad` 等 Hooks（**组件生命周期与页面生命周期两套**，和原生 Page vs Component 的分裂一致，呼应 mp-component-lifecycle）；
- 配置：`index.config.js` 对应原生页面 json；分包 `subPackages` 也在配置里（产物仍是原生分包，呼应 mp-subpackage 面试 11）。

工程链：Taro CLI + vite/webpack 双编译内核（Vite 模式新）——你的 **10-vite** 知识（alias/环境变量/构建分析）直接复用（呼应 vite 全包）。

---

## 三、uni-app：Vue 语法 + 条件编译打天下

```vue
<template>
  <view class="cnt">
    <!-- #ifdef MP-WEIXIN -->
    <button open-type="getPhoneNumber" @getphonenumber="onPhone">手机号快登</button>
    <!-- #endif -->
    <!-- #ifdef H5 -->
    <button @click="oauthLogin">微信网页授权</button>
    <!-- #endif -->
    <text>{{ count }}</text>
  </template>
</template>
<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
const count = ref(0)
onShow(() => console.log('页面显示'))
</script>
```

特色两件套：

1. **条件编译** `#ifdef MP-WEIXIN / H5 / APP-PLUS`——差异代码用注释块"编译期裁剪"（类似 C 宏；处理"平台特有 API/审核差异"的终极武器，比运行时 if 省体积）；
2. **uni.* API + uni_modules 生态**：DCloud 插件市场组件即插（含原生插件）；HBuilderX 可选（CLI + VSCode 工作流同样成立）。

Vue3 版 uni-app（uni-app x 另说）运行时基于 Vue3 reactivity——**vue-reactivity 与小程序 setData 之间由框架桥接**：ref 变化 → Vue 调度 → 翻译成 setData（呼应 vue-reactivity-theory）。

---

## 四、选型决策框架（面试与架构评审通用）

| 问题 | 偏原生 | 偏跨端 |
|---|---|---|
| 只做一个微信端且重度微信能力（支付/直播/蓝盾） | ✅ 方言即本体，无转译损耗 | 能力靠"原生混写"补丁 |
| 同一团队要 H5+多小程序+App | 维护 N 套 | ✅ 这就是跨端存在的全部理由 |
| 性能极限（列表万行、动效工作） | ✅ | 加一层 runtime = 加一层账 |
| 团队 React/Vue 熟练、小程序新 | 全员学方言 | ✅ 技能复用 |
| 平台新能力跟进速度 | 首日可用 | 等框架适配（一两周~数月） |
| 招人与代码审查 | 小程序专家池 | ✅ 大前端通用池 |

**混编逃生门**：Taro/uni 都支持"原生页面/组件直接混进工程"——90% 跨端 + 10% 原生关键页是成熟团队的常态（呼应 react-architecture 的"为变化留接缝"）。

---

## 五、自检清单

- [ ] 编译时/运行时/自绘三路线各一个代表与一句代价？
- [ ] Taro 3 一次 setState 背后经过了哪几层翻译？
- [ ] 条件编译解决什么？为何优于运行时 if？
- [ ] 什么项目组合会让你顶住压力选原生？
- [ ] 跨端框架里 setData 膨胀问题从哪来？（用 mp-setdata 语言回答）

---

## 🚀 部署预告

- 学完本课，前面 23 关的所有方言知识都获得了"翻译器视角"——知道框架替你干了什么，才能debug 它干砸了什么；
- 下一关 **mp-cloud**：不写服务器的后端——微信云开发（云函数/云数据库/云存储）与 Serverless 取舍；顺便回答"没有 Express 团队时小程序怎么活"（呼应 09-express 全包的对照组、node-deploy-perf）。
