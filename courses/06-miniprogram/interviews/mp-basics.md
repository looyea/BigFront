# 面试题 · 微信小程序架构

1. **小程序的双线程模型？**
   **渲染层**（WebView，最多 3 个）+ **逻辑层**（JsCore/V8）。setData 通过 JSBridge 跨线程传 JSON，**性能瓶颈常见于此**。

2. **小程序页面生命周期至少讲 4 个。**
   onLoad → onShow → onReady → onHide → onUnload；onPullDownRefresh、onReachBottom、onShareAppMessage 是特化钩子。

3. **wx:for 和 wx:key 的注意点？**
   - wx:key 必须是数据项的**唯一字符串字段名**，不能写 `{{item.id}}`。
   - 列表项有交互状态/新增删除时不写 key 会有 bug。

4. **setData 优化？**
   - 局部路径更新：`this.setData({ 'list[0].name': 'x' })`；
   - 避免高频 setData（合并、节流）；
   - 只 setData 视图用到的字段；
   - 大对象拆分。

5. **小程序分包的意义与限制？**
   主包 ≤ 2M、总包 ≤ 30M（截至最新规范，具体以官方为准）。首屏只下载主包，减少启动耗时；tabBar 页必须在主包。

6. **自定义组件 properties 与 data 的区别？**
   properties 由父传子，是**只读**；子要改需 `this.setData` 一个内部 data 镜像，或用 `observers`。

7. **什么是 WXS？**
   在 WXML 里跑的受限脚本，用于**视图层的轻量计算**（过滤/格式化），不经过 setData，性能高，但作用域受限。

8. **如何调试小程序？**
   开发者工具：真机调试、AppData 面板看 setData 次数与负载、Performance 面板看帧率、Network 面板看请求。
