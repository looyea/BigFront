# next-revalidate 面试题（12 题）

> 来源：整理自 CSDN、掘金、SegmentFault、知乎、InfoQ 等站点 Next.js 缓存控制与 ISR 高频面经，中文重述。

---

## A. ISR 深挖

**1. ISR 的两个'永不'：永不让用户等什么、永不在什么时候打满 CPU？**
**来源**：InfoQ《ISR 的并发模型》；知乎《stale 期间 1000 QPS 进来发生什么》
永不让请求**等待重渲染**（拿 stale 旧页）；也**不会**为 1000 个并发各渲染一次——同一过期页的再生成会被去重为一次（in-flight dedup）。加分：说明这个模型对流量尖峰（大促）的友好性=缓存击穿免疫（对比 node-deploy-perf 里手写缓存要自备互斥锁）。

**2. App Router 的 ISR 和 Pages Router 的 ISR 写法差异？**
**来源**：掘金《getStaticProps.revalidate 到段配置的迁移》
旧：`getStaticProps` 返回 `{ revalidate: 3600 }`，页面级；新：`export const revalidate` 段配置 + fetch 级 `next.revalidate` 两层，**取数缓存与页面缓存解耦**——页面可以静态但含 no-store 数据（动态 hole），语义更自由也更易困惑（呼应 next-render-modes 第三节）。

**3. 内容刚发布，如何做到'下一个用户就是新页'？ISR 能承诺吗？**
**来源**：SegmentFault《ISR 的最终一致性边界》
ISR 承诺的是秒级~分钟级最终一致（revalidate 值）；要"下一个即新"：写侧同步 `revalidatePath` 之外仍需等后台再生成完成——严格即时要么放弃静态（force-dynamic）、要么发布流里**主动预渲染**（触发一次内部请求+等待完成再返回成功，即 build 钩子/pending page 策略）。答出"用一致性换性能"的取舍即高分。

---

## B. 动态与静态边界

**4. 为什么'一个 cookies() 拖垮全页静态化'，而包在 Suspense 里就能救回来？**
**来源**：知乎《React 18 视图与 PPR 的关系》；CSDN（dynamic 段排查案例）
默认模型里"动态性"沿渲染树向上传播到段根（祖先链必须等请求态才能定稿）。Suspense+流式把页面切成独立就绪单元；PPR/cacheComponents 进一步允许"构建期定稿壳、请求期只算 hole"（呼应 next-revalidate 第二、四节）。

**5. connection() 这个 API 存在的意义是什么？举例。**
**来源**：掘金《主动声明动态的官方姿势》
不读任何请求数据、但逻辑依赖"这是谁/在哪/什么时刻"的场景（按请求 IP 的灰度、no-store 的私有接口代理），用 `await connection()` 明确告诉渲染器"此处不可静态"——比偷偷塞一个 `no-store` fetch 可读，是"声明式动态边界"思想（呼应 next-revalidate 第二节、exp-rest 的语义显式化）。

---

## C. 配置与排障

**6. 段配置 dynamic/revalidate 写在 layout 和写在 page 冲突吗？继承规则？**
**来源**：CSDN《段配置层叠规则实测》
同 next-routing 布局作用域：上层 layout 的值对整棵子树生效，page 再导出即覆盖本段。排查"页面为什么没静态化"时沿目录向上查配置是标准动作（与 next-routing 的 children 链形成完整排查图）。

**7. 线上发现 ISR 页在某次发布后全变动态了，你的三步定位？**
**来源**：InfoQ《静默降级动态的根因分析》
① build 日志：该路由 ○/● 变 ƒ 了吗（先确认事实）；② diff 新代码引入的动态反应物（新增 middleware rewrite？组件里多了 headers()？第三方库偷偷用 window 触发 fallback）；③ 检查配置层是否被 env 覆盖（如实验开关）。加分：上线前用"路由模式快照测试"（把 build manifest 纳入 CI diff）防回归（呼应 next-testing、exp-testing）。

**8. cacheComponents 时代还需要记'推断规则'吗？两种范式的心智差别？**
**来源**：知乎《从魔法推断到显式申报》
仍需——推断是默认世界，显式是新范式。差别：旧范式"忘记申报动态→性能损失"是静默的；新范式"忘记 Suspense→构建报错"是响亮的。趋势是**错误显式化**（编译器/构建期兜住运行期魔法），与 ts-strict、eslint 规则化同一路数（呼应 next-revalidate 第四节、ts-strict）。

---

## D. 综合架构

**9. 自托管 Next（无 Vercel）时，这套缓存体系要打什么补丁？**
**来源**：SegmentFault《自建 Next 集群的缓存缺口》
① Data Cache 单机内存 → 外置（Redis 适配器/ISRB 自建）保证多实例一致与重启不丢；② Full Route Cache 落 .next 磁盘 → 对象存储/共享卷或 CDN purge 联动；③ tag 失效广播；④ 后台再生成只发生在被路由到的那台（会话粘滞与否影响命中率）。一句话：框架的缓存在云厂商是产品，在自建是工程项目（呼应 next-fetch-cache 面试 6、next-deploy）。

**10. 设计：多租户 SaaS，租户 A 改配置只应刷新 A 的页。给出失效方案。**
**来源**：掘金（tag 维度设计实践）
数据 fetch 统一打 `tenant-{id}` + 业务双维 tag；写侧只 revalidateTag('tenant-A')；页面用 tag 依赖图只过期涉及页。Router Cache 层给租户配置类 hole 设短 TTL。评分点：tag 命名体系（实体+租户+版本三层）与"失效半径=变更影响面"的映射思维（呼应 next-forms-mutations）。

**11. '缓存命中率'要监控哪些指标才能覆盖三层金字塔？**
**来源**：InfoQ《全栈前端可观测性清单》
服务端：Data Cache hit/miss（fetch 层埋点）、路由再生成队列与失败率、动态页占比；边缘：CDN 命中与 stale 供给数；浏览器：预取命中率与 payload 过期导航占比 + RUM 的 TTFB 分布位移。用一两个指标拍脑袋=盲区（呼应 mp-performance 度量五步、react-performance）。

**12. 产品说"首页要绝对实时且秒开"，作为架构师你怎么回应？**
**来源**：知乎《实时与快是物理矛盾吗》
先拆解：绝对实时的是"哪块数据"（通常只有价格/库存条），其余 95% 可静态——把实时压缩到最小 hole（轮询/SSE/WebSocket 补那一条），壳走 PPR/ISR 秒发。真正全页实时+秒开在物理上冲突（实时=不可缓存=每次现算），给出量化方案（hole 占比、刷新间隔、成本）让产品做选择题，而不是接一个不可能需求（呼应 next-revalidate 第六节决策表、react-architecture 的需求翻译术）。
