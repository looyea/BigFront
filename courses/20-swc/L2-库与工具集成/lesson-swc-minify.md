# 压缩与生产产物

## 一、开启压缩

两条路：

- `.swcrc` / opts 里 `"jsc": { "minify": true }` 或顶层 `"minify": true`；
- CLI：`npx swc src -d dist -C jsc.minify=true`。

minify 与转译在同一趟编译完成——这是 SWC 相比「先 bundle 再单独跑 terser」省一次解析的原因。

## 二、三个子开关

`minify` 为对象时细配：

```jsonc
"minify": {
  "compress": { "drop_console": true, "passes": 2 },  // 死代码/常量折叠
  "mangle":   { "reserved": ["React", "useState"] },   // 标识符改名，可豁免
  "format":   { "comments": false }                    // 输出整形
}
```

`compress` 决定「删什么、怎么折」，`mangle` 决定「变量名怎么缩」（用 `reserved`/`keep_classnames` 豁免反射用到的名字），`format` 管最终排版。

## 三、和 terser 的对照心态

SWC minifier 为了速度做了少量**假设**（官方列了清单：如不依赖 `Function.prototype.toString` 内容、TDZ 违例被忽略、顶层标识符读取无副作用等）。绝大多数业务代码碰不到边界；但当你发现「压缩后行为变了」，先去那份假设清单对照——十有八九是你踩中了某个假设。terser 更保守但慢；极端依赖反射/元编程的库可回退 `minify: false` + 外部 terser。

## 四、体积实测方法

别凭感觉说「SWC 压得小」。固定流程：同一入口分别 `esbuild --minify` / `swc -C minify=true` / `terser -c -m` 各产一份，量 gzip 后字节数 + 记录耗时。你会得到的通常结论是：**速度 SWC/esbuild 完胜，体积三者接近**（个别场景 terser 多一两分）。

## 五、CSS 与 HTML minify 现状

SWC 生态里有独立的 `@swc/html`（HTML 压缩）等包；CSS minify 长期是短板/实验项。别把 JS minify 的成熟度想当然套到 CSS——CSS 压缩继续用 lightningcss/cssnano 更稳。

## 小结
minify 与转译同趟完成、省一次解析；分 compress/mangle/format 三开关；SWC 靠一组假设换速度，行为异常先对照假设清单；体积用 gzip+耗时实测别凭感觉；CSS/HTML minify 成熟度不及 JS。

## 部署预告
拿生产构建的一个 bundle，分别用 swc minify 与 terser 各压一遍，记录 gzip 字节与耗时两张小票；再故意打开 `drop_console` 与 `mangle.reserved`，验证 console 被删、关键全局名未被改坏。
