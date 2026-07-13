# V8.Image 完整 API 参考

## 目录

1. [调用与返回约定](#调用与返回约定)
2. [图片来源](#图片来源)
3. [公共输出参数](#公共输出参数)
4. [方法总览](#方法总览)
5. [Create 生成图片](#create-生成图片)
6. [Merge 与 Overlay 合并图片](#merge-与-overlay-合并图片)
7. [Resize 调整尺寸](#resize-调整尺寸)
8. [Crop 裁剪](#crop-裁剪)
9. [Rotate 旋转](#rotate-旋转)
10. [Flip 翻转](#flip-翻转)
11. [Convert 格式转换](#convert-格式转换)
12. [Draw 绘制](#draw-绘制)
13. [Watermark 水印](#watermark-水印)
14. [CreateQRCode 生成二维码](#createqrcode-生成二维码)
15. [GetInfo 读取信息](#getinfo-读取信息)
16. [兼容别名](#兼容别名)
17. [颜色、格式与资源限制](#颜色格式与资源限制)

## 调用与返回约定

所有公开方法都接收一个参数对象。底层也兼容内容为 JSON 对象的字符串，但 V8 代码应优先直接传对象，并使用规范的 PascalCase 字段名。

处理成功时，除 `GetInfo` 外均返回：

```javascript
{
  Code: 1,
  Data: {
    FileName: 'image.png',
    ContentType: 'image/png',
    FileByteBase64: '<base64>',
    Width: 800,
    Height: 600,
    Size: 12345,
    Format: 'png'
  },
  Msg: ''
}
```

处理失败时返回 `Code: 0`，错误说明位于 `Msg`。任何调用链都必须先判断 `Code`：

```javascript
var result = V8.Image.Resize(options);
if (result.Code !== 1) return result;
var nextBase64 = result.Data.FileByteBase64;
```

如果接口引擎已开启“响应文件”，可直接 `return result`，由平台使用 `Data.FileName`、`Data.ContentType` 和 `Data.FileByteBase64` 返回文件。

## 图片来源

`V8.Image` 只读取内存数据，不读取本地路径，也不会主动访问 URL。

| 字段 | 类型 | 说明 |
|------|------|------|
| `FileByteBase64` | string | 推荐的纯 Base64 字符串 |
| `Base64` | string | `FileByteBase64` 的等价来源字段 |
| `DataUrl` | string | `data:image/png;base64,...` 形式；前缀会被剥离 |
| `Bytes` | byte[] | .NET 字节数组，例如 `V8.Http.GetResponse(...).RawBytes` |
| `FileName` | string | 可选来源元数据；不会代替输出层的 `FileName` |

单图方法支持三种对象结构：

```javascript
// 顶层来源
V8.Image.Resize({ FileByteBase64: base64, Width: 400 });

// Image 嵌套来源
V8.Image.Resize({ Image: { DataUrl: dataUrl }, Width: 400 });

// Source 嵌套来源；Image/Source 也可直接写 Base64 或 Data URI 字符串
V8.Image.Resize({ Source: base64, Width: 400 });
```

合并方法的 `Images` / `Layers` 中，每项既可以是图层对象，也可以直接是 Base64 或 Data URI 字符串：

```javascript
V8.Image.Merge({
  Mode: 'horizontal',
  Images: [
    firstBase64,
    { DataUrl: secondDataUrl, Height: 300 }
  ]
});
```

远程图片必须先由业务代码下载。对可变 URL 做协议、域名、端口和目标地址白名单校验，防止 SSRF：

```javascript
var response = V8.Http.GetResponse({ Url: trustedUrl });
var result = V8.Image.GetInfo({ Bytes: response.RawBytes });
```

## 公共输出参数

除 `GetInfo` 外，各方法均支持以下参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `OutputFormat` | 取 `Format` | 输出格式，支持 `png`、`jpeg` / `jpg`、`webp`、`bmp` |
| `Format` | `png` | 未设置 `OutputFormat` 时使用 |
| `Quality` | `90` | 编码质量；运行时限制到 `1` 至 `100` |
| `BackgroundColor` | PNG/WebP/BMP 为透明，JPEG 为白色 | 输出画布背景色 |
| `FileName` | `image.<扩展名>` | 输出文件名；路径部分会被移除，扩展名按真实格式修正 |

`OutputFormat` 优先级高于 `Format`。兼容别名包括 `ImageFormat`、`OutputType`、`Background`、`BgColor`。

## 方法总览

| 方法 | 作用 |
|------|------|
| `V8.Image.Create(param)` | 生成纯色、渐变、文字和基础图形图片 |
| `V8.Image.Merge(param)` | 横向、纵向、网格或覆盖合并 |
| `V8.Image.Overlay(param)` | 覆盖合并快捷方法；未传 `Mode` 时自动使用 `overlay` |
| `V8.Image.Resize(param)` | 按宽高和适配策略调整尺寸 |
| `V8.Image.Crop(param)` | 按矩形区域裁剪 |
| `V8.Image.Rotate(param)` | 旋转图片 |
| `V8.Image.Flip(param)` | 水平或垂直翻转 |
| `V8.Image.Convert(param)` | 转换编码格式 |
| `V8.Image.Draw(param)` | 在原图上绘制文字和图形 |
| `V8.Image.Watermark(param)` | 按锚点添加图片水印 |
| `V8.Image.CreateQRCode(param)` | 生成二维码 |
| `V8.Image.GetInfo(param)` | 读取图片元数据，不重新编码 |

## Create 生成图片

### 参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Width` / `Height` | `800` / `600` | 画布宽高 |
| `CanvasWidth` / `CanvasHeight` | 未设置 | 设置后分别覆盖 `Width` / `Height` |
| `BackgroundColor` | 透明或 JPEG 白色 | 起始背景色 |
| `BackgroundColorEnd` | 未设置 | 设置后启用线性渐变 |
| `GradientDirection` | `left-to-right` | `left-to-right`、`top-to-bottom` / `vertical` / `down`、`diagonal` / `top-left-to-bottom-right` |
| `Text` | 未设置 | 在画布中心追加一段快捷文字 |
| `TextColor` | `#111827` | 快捷文字颜色 |
| `FontSize` | `32` | 快捷文字字号 |
| `FontFamily` | 默认字体 | 快捷文字字体族 |
| `Elements` | 未设置 | 绘制元素列表，详见 [Draw 绘制](#draw-绘制) |

### 示例

```javascript
var result = V8.Image.Create({
  Width: 1200,
  Height: 630,
  BackgroundColor: '#2563eb',
  BackgroundColorEnd: '#0f172a',
  GradientDirection: 'diagonal',
  Elements: [
    {
      Type: 'text',
      X: 60,
      Y: 80,
      Text: 'Microi V8',
      Color: '#ffffff',
      FontSize: 56,
      FontStyle: 'bold'
    },
    {
      Type: 'round-rect',
      X: 60,
      Y: 150,
      Width: 360,
      Height: 80,
      FillColor: 'rgba(255,255,255,0.18)',
      CornerRadius: 18
    }
  ],
  FileName: 'cover.png'
});
```

## Merge 与 Overlay 合并图片

### 合并级参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Mode` | `horizontal` | `horizontal`、`vertical`、`grid`、`overlay` |
| `Layout` | 未设置 | 设置后优先于 `Mode`；支持模式及方向快捷值 |
| `Direction` | 横向 `ltr`，纵向 `ttb` | `ltr`、`rtl`、`ttb`、`btt` 及完整英文别名 |
| `Images` / `Layers` | 必填 | 一个或多个图层；最多 50 张 |
| `CanvasWidth` / `CanvasHeight` | 自动计算 | 强制输出画布尺寸 |
| `Padding` | `0` | 画布内边距；负数按 0 处理 |
| `Gap` | `0` | 非覆盖模式的图层间距；负数按 0 处理 |
| `Alignment` | `center` | 横向时控制上下对齐，纵向时控制左右对齐；网格时控制单元格内对齐 |
| `Columns` | 自动接近平方布局 | `grid` 的列数，运行时限制在 1 至图片数 |

### 模式、布局与方向

| 值 | 结果 |
|----|------|
| `horizontal` / `row` | 左右拼接 |
| `vertical` / `column` | 上下拼接 |
| `grid` | 网格拼接 |
| `overlay` / `canvas` / `cover` | 覆盖合并 |
| `Layout: 'right'` | 横向，从左到右 |
| `Layout: 'left'` | 横向，从右到左 |
| `Layout: 'bottom'` / `'down'` | 纵向，从上到下 |
| `Layout: 'top'` / `'up'` | 纵向，从下到上 |

`Direction` 还接受 `left-to-right`、`right-to-left`、`top-to-bottom`、`bottom-to-top`，以及 `right`、`left`、`down`、`up`。

对于非覆盖模式，`rtl` 或 `btt` 会反转图层排列顺序。覆盖模式始终按 `ZIndex` 从小到大绘制，`ZIndex` 相同时按原数组顺序绘制；后绘制的图层位于上方。

### 图层参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 图片来源字段 | 必填 | `Bytes`、`FileByteBase64`、`Base64` 或 `DataUrl` |
| `Width` / `Height` | 原图尺寸 | 目标尺寸；只设一个维度时保持比例 |
| `Scale` | `1` | 在目标尺寸计算后再次缩放，必须大于 0 且不超过 100 |
| `Fit` | `contain` | 同时设置宽高时使用：`contain`、`cover`、`fill` / `stretch`、`none` |
| `X` / `Y` | 未设置 | 覆盖模式绝对坐标；只要设置其一，另一项默认使用 `Padding` |
| `Position` / `Anchor` | `top-left` | 未设置绝对坐标时的锚点；`Position` 优先 |
| `OffsetX` / `OffsetY` | `0` | 在坐标或锚点结果上追加偏移 |
| `Opacity` | `1` | 透明度，运行时限制到 0 至 1 |
| `Rotation` | `0` | 顺时针旋转角度；布局按旋转后的外接矩形计算 |
| `ZIndex` | `0` | 覆盖顺序；数值越大越靠上 |
| `FlipHorizontal` / `FlipVertical` | `false` | 水平或垂直翻转该图层 |
| `CropX` / `CropY` | `0` | 缩放前的源图裁剪起点 |
| `CropWidth` / `CropHeight` | 到源图边界 | 缩放前的源图裁剪尺寸 |
| `CornerRadius` | `0` | 圆角半径 |
| `BorderColor` / `BorderWidth` | 未设置 / `0` | 图层边框 |
| `BlendMode` | `src-over` | 图层混合模式 |

`Fit` 规则：

- `contain`：完整保留内容，在给定宽高范围内等比缩放；图层本身不会自动补齐空白到目标框。
- `cover`：等比缩放并从中心裁掉超出部分，最终严格使用指定宽高。
- `fill` / `stretch`：强制拉伸为指定宽高，可能改变比例。
- `none`：同时设置宽高时仍使用源图尺寸。
- 只设置 `Width` 或 `Height`：无论 `Fit` 值如何都保持比例。

常用锚点为 `top-left`、`top`、`top-right`、`left`、`center` / `middle`、`right`、`bottom-left`、`bottom`、`bottom-right`。兼容 `left-top`、`right-top`、`left-bottom`、`right-bottom` 和 `centre`。

混合模式支持 `src-over`、`multiply`、`screen`、`overlay`、`darken`、`lighten`、`plus` / `add`、`src`、`dst-over`；未知值回退为 `src-over`。

### 横向、纵向和网格示例

```javascript
var horizontal = V8.Image.Merge({
  Mode: 'horizontal',
  Direction: 'ltr',
  Gap: 24,
  Padding: 24,
  Alignment: 'center',
  BackgroundColor: '#f8fafc',
  Images: [
    { FileByteBase64: first, Height: 320 },
    { FileByteBase64: second, Height: 320 }
  ]
});

var vertical = V8.Image.Merge({
  Mode: 'vertical',
  Direction: 'ttb',
  Gap: 16,
  Alignment: 'left',
  Images: [first, second, third]
});

var grid = V8.Image.Merge({
  Mode: 'grid',
  Columns: 3,
  Gap: 12,
  Padding: 12,
  Images: imageList
});
```

### 覆盖示例

```javascript
var result = V8.Image.Overlay({
  CanvasWidth: 1280,
  CanvasHeight: 720,
  BackgroundColor: '#ffffff',
  Images: [
    {
      FileByteBase64: background,
      Width: 1280,
      Height: 720,
      Fit: 'cover',
      ZIndex: 0
    },
    {
      FileByteBase64: foreground,
      X: 920,
      Y: 60,
      Width: 260,
      Opacity: 0.9,
      Rotation: -6,
      CornerRadius: 20,
      BorderColor: '#ffffff',
      BorderWidth: 4,
      ZIndex: 10
    }
  ],
  FileName: 'overlay.png'
});
```

未设置 `CanvasWidth` / `CanvasHeight` 时，覆盖画布先按第一个图层和 `Padding` 计算；显式的正向 `X` / `Y` 可能扩大画布。锚点定位、负坐标和超出右下边界的内容不会自动保证全部可见，固定版式应显式设置画布。

### 双图快捷结构

`Merge` / `Overlay` 也兼容主图加覆盖图的简写：

```javascript
var result = V8.Image.Overlay({
  BaseImage: background,
  OverlayImage: foreground,
  X: 900,
  Y: 80,
  OverlayWidth: 240,
  OverlayHeight: 120,
  Opacity: 0.85,
  Scale: 1,
  FileName: 'result.png'
});
```

主图别名：`BaseImage`、`BackgroundImage`、`FirstImage`、`Base`。覆盖图别名：`OverlayImage`、`ForegroundImage`、`SecondImage`、`Overlay`。顶层 `X`、`Y`、`Position`、`Opacity`、`OverlayWidth`、`OverlayHeight`、`Scale` 会应用到第二张图，第二张图自动获得 `ZIndex: 1`。

## Resize 调整尺寸

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 图片来源 | 必填 | 顶层或 `Image` / `Source` |
| `Width` / `Height` | 至少设置一个 | 目标宽高 |
| `Fit` | `contain` | 规则与合并图层一致 |
| `Pad` | `false` | 同时给出宽高后，是否保留完整目标画布并把图片按 `Alignment` 放入 |
| `AllowUpscale` | `true` | `false` 时避免把较小图片放大 |
| `Alignment` | `center` | `Pad: true` 时的画布内锚点 |

```javascript
var result = V8.Image.Resize({
  Image: sourceBase64,
  Width: 800,
  Height: 600,
  Fit: 'contain',
  Pad: true,
  Alignment: 'center',
  BackgroundColor: '#ffffff',
  OutputFormat: 'webp',
  Quality: 85
});
```

## Crop 裁剪

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 图片来源 | 必填 | 顶层或 `Image` / `Source` |
| `X` / `Y` | `0` | 裁剪起点 |
| `Width` / `Height` | 必填且大于 0 | 裁剪尺寸 |
| `Clamp` | `false` | `true` 时把部分越界区域收缩到图片范围；无有效交集仍失败 |

```javascript
var result = V8.Image.Crop({
  FileByteBase64: sourceBase64,
  X: 100,
  Y: 80,
  Width: 640,
  Height: 360,
  Clamp: false
});
```

## Rotate 旋转

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 图片来源 | 必填 | 顶层或 `Image` / `Source` |
| `Degrees` | `0` | 顺时针旋转角度，可为负数 |
| `Expand` | `true` | 是否扩展画布容纳旋转后外接矩形；`false` 可能裁掉边缘 |

```javascript
var result = V8.Image.Rotate({
  Image: sourceBase64,
  Degrees: 90,
  Expand: true,
  BackgroundColor: 'transparent'
});
```

## Flip 翻转

| 参数 | 默认值 | 说明 |
|------|--------|------|
| 图片来源 | 必填 | 顶层或 `Image` / `Source` |
| `Horizontal` | `true` | 水平翻转 |
| `Vertical` | `false` | 垂直翻转 |

```javascript
var result = V8.Image.Flip({
  Image: sourceBase64,
  Horizontal: false,
  Vertical: true
});
```

## Convert 格式转换

保留原图宽高，把静态画面重新编码为指定输出格式。

```javascript
var result = V8.Image.Convert({
  Image: sourceBase64,
  OutputFormat: 'jpeg',
  Quality: 88,
  BackgroundColor: '#ffffff',
  FileName: 'converted.jpg'
});
```

透明图片转换为 JPEG 时，透明背景会使用不透明背景色；未设置时为白色。

## Draw 绘制

`Draw` 在输入图片上绘制 `Elements`，输出尺寸与输入相同。`Create` 也使用同一套元素结构。

### 元素通用参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Type` | `text` | 元素类型 |
| `X` / `Y` | `0` | 起点；文字按对齐方式解释 |
| `X2` / `Y2` | 未设置 | 线段终点；未设置时使用 `X + Width` / `Y + Height` |
| `Width` / `Height` | `0` | 图形尺寸，也用于旋转中心计算 |
| `Color` | `#111827` | 默认文字、填充和描边颜色 |
| `FillColor` | 取 `Color` | 图形填充色 |
| `StrokeColor` | 取 `Color` | 图形描边色 |
| `StrokeWidth` | `0` | 描边宽度；线段未设置时使用 1 像素 |
| `CornerRadius` | `0` | 矩形圆角 |
| `Opacity` | `1` | 透明度，运行时限制到 0 至 1 |
| `Rotation` | `0` | 顺时针旋转角度 |

### 元素类型

| 类型 | 专用参数 |
|------|----------|
| `text` | `Text`、`FontSize`、`FontFamily`、`FontStyle`、`Align`、`VerticalAlign` |
| `rectangle` / `rect` / `round-rect` | `Width`、`Height`、`CornerRadius` |
| `ellipse` / `circle` | `Width`、`Height` |
| `line` | `X2`、`Y2` 或 `Width`、`Height`，以及描边参数 |

文字默认 `FontSize: 24`、`FontStyle: 'normal'`、`Align: 'left'`、`VerticalAlign: 'top'`。`FontStyle` 可包含 `bold`、`italic` 或两者；水平对齐支持 `left`、`center` / `middle`、`right` / `end`，垂直对齐支持 `top`、`middle` / `center`、`bottom`。

`FontFamily` 表示首选字体。即使没有传入，或传入的字体族在服务器上不存在，运行时也会逐个 Unicode 字符检查实际字形，先回退到服务器已安装且包含该字形的字体，再回退到 `Dos.Common` 程序集内置的 Noto Sans CJK SC；同一段中英文混排文字可使用多个字体段。没有系统字体的 Linux / 群晖 / 精简容器仍可绘制基础拉丁字符、数字和简体中文。只有系统字体与内置字体都不包含某字符时，调用才返回包含字符和 `U+XXXX` 码位的明确错误，不会生成“口口”缺字方框。

单次最多绘制 500 个元素。

```javascript
var result = V8.Image.Draw({
  Image: sourceBase64,
  Elements: [
    {
      Type: 'text',
      X: 40,
      Y: 40,
      Text: 'CONFIDENTIAL',
      Color: 'rgba(239,68,68,0.75)',
      FontSize: 36,
      FontStyle: 'bold',
      Rotation: -8
    },
    {
      Type: 'line',
      X: 40,
      Y: 70,
      X2: 360,
      Y2: 70,
      StrokeColor: '#ef4444',
      StrokeWidth: 3
    }
  ]
});
```

## Watermark 水印

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `BaseImage` / `Image` | 必填 | 主图；`BaseImage` 优先 |
| `Watermark` | 必填 | 水印图 |
| `Width` / `Height` | 水印原尺寸 | 水印目标尺寸 |
| `Scale` | `1` | 水印附加缩放比例 |
| `Position` | `bottom-right` | 水印锚点 |
| `Margin` | `10` | 根据锚点向内保留的边距 |
| `OffsetX` / `OffsetY` | `0` | 锚点定位后的附加偏移 |
| `Opacity` | `1` | 水印透明度 |
| `Rotation` | `0` | 水印旋转角度 |

```javascript
var result = V8.Image.Watermark({
  BaseImage: sourceBase64,
  Watermark: logoBase64,
  Width: 180,
  Position: 'bottom-right',
  Margin: 24,
  Opacity: 0.7,
  FileName: 'watermarked.png'
});
```

## CreateQRCode 生成二维码

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `Content` / `Text` | 必填 | 二维码内容；`Content` 优先 |
| `Size` | `300` | 正方形边长 |

```javascript
var result = V8.Image.CreateQRCode({
  Content: 'https://microi.net/',
  Size: 420,
  OutputFormat: 'png',
  FileName: 'qrcode.png'
});
```

## GetInfo 读取信息

参数使用任一图片来源形式。成功时 `Data` 为：

| 字段 | 说明 |
|------|------|
| `Width` / `Height` | 编码图片宽高 |
| `Format` | 检测到的原始编码格式 |
| `ContentType` | 对应 MIME 类型 |
| `Size` | 输入字节数 |
| `FrameCount` | 帧数 |
| `RepetitionCount` | 动画重复次数 |
| `Origin` | 编码方向信息 |
| `HasAlpha` | 是否包含 Alpha 通道 |

```javascript
var info = V8.Image.GetInfo({ Image: sourceBase64 });
if (info.Code !== 1) return info;
if (info.Data.Width < 800 || info.Data.Height < 600) {
  return { Code: 0, Msg: '图片尺寸不能小于 800×600' };
}
```

`GetInfo` 可以报告多帧信息，但其它处理方法输出的是重新编码后的静态图片，不应把它们当作动画编辑 API。

## 兼容别名

字段名匹配不区分大小写，仍建议使用规范名称。

### 公共别名

| 别名 | 规范字段 |
|------|----------|
| `ImageFormat` / `OutputType` | `OutputFormat` |
| `Background` / `BgColor` | `BackgroundColor` |
| `ImageBase64` | 顶层 `FileByteBase64`（单图方法） |

### 合并别名

| 别名 | 规范字段 |
|------|----------|
| `MergeType` / `Type` | `Mode` |
| `Items` | `Images` |
| 图层 `Order` | `ZIndex` |
| 图层 `Alpha` | `Opacity` |
| 图层 `Rotate` | `Rotation` |
| 图层 `Left` / `Top` | `X` / `Y` |

图层对象还可通过嵌套的 `Image` 或 `Source` 提供图片来源；来源字段会展开到图层对象。

### 水印别名

| 别名 | 规范字段 |
|------|----------|
| `Base` | `BaseImage` |
| `Overlay` | `Watermark` |

## 颜色、格式与资源限制

### 颜色

支持：

- `transparent`、`white`、`black`、`red`、`green`、`blue`、`yellow`、`gray` / `grey`、`orange`、`purple`；
- `#RGB`、`#RGBA`、`#RRGGBB`、`#RRGGBBAA`；
- `rgb(r,g,b)`、`rgba(r,g,b,a)`，其中 Alpha 可用 0 至 1 或 0 至 255。

颜色自身的 Alpha 会与图层或元素的 `Opacity` 相乘，不会被覆盖。

### 输出格式

只支持 `png`、`jpeg` / `jpg`、`webp`、`bmp`。输入格式取决于当前 SkiaSharp 运行环境能否解码；可先用 `GetInfo` 验证。

### 内置限制

| 项目 | 限制 |
|------|------|
| 单次合并图片数 | 50 |
| 输入或输出单边 | 16,384 像素 |
| 单张输入或输出画布像素 | 25,000,000 |
| 单次解码总像素 | 50,000,000 |
| 单次缩放后图层总像素 | 50,000,000 |
| 单张输入文件 | 25 MB |
| 单次输入总量 | 100 MB |
| 输出文件 | 50 MB |
| 单次绘制元素 | 500 |

这些是运行时保护上限，不是业务推荐值。匿名接口、批量任务和高并发场景应配置更严格的业务限制，并控制并发，避免大量图片同时解码占用内存。

文字绘制优先使用操作系统字体，并以内置 Noto Sans CJK SC 保证零字体环境下的基础中英文可用性。运行时会对不存在的 `FontFamily` 和缺失字形逐字回退，并在系统字体与内置字体都确实没有字形时明确失败，绝不输出“口口”缺字方框。内置字体不承诺品牌字形、区域异体字、特殊符号和 Emoji；这些场景仍应安装业务字体并显式传 `FontFamily`，不要假设开发机字体在生产容器中存在。
