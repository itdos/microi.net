# V8.Print TSC 与 ESC/POS 源码 API

本表直接按 `Microi.Client/src/utils/ble/tsc.js`、`esc.js` 与编码文件整理。方法名
（包括历史拼写）必须与源码完全一致，不能根据打印机手册自行改名。

## 目录

- [构建器与编码](#构建器与编码)
- [TSC/TSPL 的 28 个方法](#tsctspl-的-28-个方法)
- [ESC/POS 的 25 个方法](#escpos-的-25-个方法)
- [参数与组合规则](#参数与组合规则)

## 构建器与编码

```javascript
var tsc = V8.Print.createNew();
var esc = V8.Print.createNewESC();
```

两个构建器都把指令累积到普通字节数组，`getData()` 返回该数组。TSC 的全部文本命令、
ESC 的 `setText` 和二维码内容通过本地 `TextEncoder('gb18030', {
NONSTANDARD_allowLegacyEncoding: true })` 编码；映射表来自同目录的
`encoding-indexes.js`，不需要网络请求。

## TSC/TSPL 的 28 个方法

| 方法 | 当前生成的指令/作用 |
|---|---|
| `init()` | 空操作，历史兼容入口 |
| `addCommand(content)` | 以 GB18030 追加原始 TSC 文本；只用于固定可信命令 |
| `setSize(width,height)` | `SIZE width mm,height mm` |
| `setSpeed(speed)` | `SPEED speed` |
| `setDensity(density)` | `DENSITY density` |
| `setGap(gap)` | `GAP gap mm,0 mm` |
| `setBline(bline)` | `BLINE bline mm,0 mm`，黑标纸 |
| `setCountry(country)` | `COUNTRY country` |
| `setCodepage(codepage)` | `CODEPAGE codepage` |
| `setCls()` | `CLS`，清除图像缓冲区 |
| `setFeed(feed)` | `FEED feed`，向前走纸 |
| `setBackFeed(backup)` | `BACKFEED backup`，回拉 |
| `setDirection(direction)` | `DIRECTION direction` |
| `setReference(x,y)` | `REFERENCE x,y`，坐标原点 |
| `setFromfeed()` | 注意源码拼写；实际生成 `FORMFEED` |
| `setHome()` | `HOME`，定位下一张标签 |
| `setSound(level,interval)` | `SOUND level,interval` |
| `setLimitfeed(limit)` | `LIMITFEED limit` |
| `setBar(x,y,width,height)` | `BAR` 线条 |
| `setBox(x1,y1,x2,y2,thickness)` | `BOX` 方框 |
| `setErase(x,y,width,height)` | `ERASE` 清除区域 |
| `setReverse(x,y,width,height)` | `REVERSE` 区域反相 |
| `setText(x,y,font,xScale,yScale,text)` | `TEXT`；旋转值在源码中固定为 `0` |
| `setQR(x,y,level,width,mode,content)` | `QRCODE`；旋转值固定为 `0` |
| `setBarCode(x,y,type,height,readable,narrow,wide,content)` | `BARCODE`；旋转值固定为 `0` |
| `setBitmap(x,y,mode,imageData)` | 生成 TSC `BITMAP` 二进制数据 |
| `setPagePrint()` | `PRINT 1,1` |
| `getData()` | 返回当前字节数组 |

最小顺序通常是 `setSize` → `setGap`/`setBline` → `setCls` → 内容 →
`setPagePrint` → `getData`。字体名、条码类型、纸张传感器、速度和浓度由打印机固件决定，
构建器不验证范围。

## ESC/POS 的 25 个方法

| 方法 | 当前生成的指令/作用 |
|---|---|
| `init()` | ESC `@` 初始化 |
| `setText(content)` | 以 GB18030 追加文字 |
| `setFontSize(n)` | GS `! n` |
| `bold(n)` | ESC `E n` |
| `setUnderline(n)` | ESC `- n` |
| `setUnderline2(n)` | FS `- n` |
| `setSelectSizeOfModuleForQRCode(n)` | 设置二维码模块尺寸，源码钳制到 1–15 |
| `setSelectErrorCorrectionLevelForQRCode(n)` | 设置二维码纠错值，源码不验证范围 |
| `setStoreQRCodeData(content)` | 以 GB18030 暂存二维码内容 |
| `setPrintQRCode()` | 输出已暂存二维码 |
| `setHorTab()` | 水平 Tab |
| `setAbsolutePrintPosition(where)` | 设置绝对横向位置 |
| `setRelativePrintPositon(where)` | 设置相对横向位置；`Positon` 是现有公开拼写 |
| `setSelectJustification(which)` | 对齐：常见值 0 左、1 中、2 右 |
| `space(n)` | 设置水平制表位置 |
| `setLeftMargin(n)` | 设置左边距 |
| `textMarginRight(n)` | 设置字符右间距 |
| `rowSpace(n)` | 设置行间距 |
| `setPrintingAreaWidth(width)` | 设置打印区域宽度 |
| `setSound(n,t)` | 蜂鸣器；大于 9 钳制为 9，小于 0 改为 1，0 会原样保留 |
| `setBitmap(imageData)` | 生成 ESC/POS 光栅位图数据 |
| `setPrint()` | 换行/打印当前行 |
| `setPrintAndFeed(feed)` | 打印并走纸指定单位 |
| `setPrintAndFeedRow(row)` | 打印并走纸指定行数 |
| `getData()` | 返回当前字节数组 |

ESC/POS 二维码需要按顺序调用尺寸、纠错、`setStoreQRCodeData`、
`setPrintQRCode`。源码中虽保留条码类型数组，但没有公开 ESC/POS 条码方法，不能虚构
`setBarCode`；条码需求应先确认型号并扩展实现。

## 参数与组合规则

- `setBitmap` 的参数是 ImageData 风格对象：`width`、`height`、RGBA `data`。它不是图片
  URL、Base64 或 DOM `<img>`；调用前先在 Canvas 得到 `getImageData()`。
- 当前位图算法按透明/非透明像素进行非常简单的黑白映射，不做通用抖动和灰度阈值处理；
  大图先缩放、二值化，逐型号验证方向、颜色和内存。
- TSC `setText`、`setQR`、`setBarCode` 把值放入带双引号的协议字段。移除双引号、CR/LF、
  NUL 和控制字符，限制长度；不要让接口返回值直达 `addCommand`。
- ESC 参数最终作为单字节或低/高字节写入，负数、浮点数、超范围值可能截断或生成无效命令。
  坐标、宽度、走纸、字号和蜂鸣器参数应先转为目标机型允许的整数。
- GB18030 只解决字节编码，不能替代打印机代码页、中文字库和字体配置。二维码通常比文字
  字库更能稳定承载 Unicode 业务标识，但仍受打印机二维码命令实现限制。
