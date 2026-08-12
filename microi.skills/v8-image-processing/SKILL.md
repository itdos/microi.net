---
name: v8-image-processing
description: Microi V8.Image 服务端图像处理指南。用于在接口引擎或后端 V8 事件中生成图片、横向/纵向/网格拼接、图层覆盖、水印、缩放、裁剪、旋转、翻转、格式转换、绘制文字与图形、生成二维码、读取图片信息，以及设计安全的 Base64/Data URI 图像处理流程。
---

> **Codex 非阻塞自动更新：** 当前宿主为 Codex 时，吾码 CLI、Codex 插件与工作区 AI/MCP 由后台自动更新；需要诊断时读取 `../microi-codex-installer/SKILL.md`。更新失败、等待空闲或尚未重载均不得阻断当前、正在进行或新建任务。非 Codex 宿主跳过此项。

# Microi V8 图像处理

使用 `V8.Image` 在服务端处理内存图片。所有方法统一接收对象参数并返回 `DosResult`；图片结果位于 `result.Data.FileByteBase64`。

## 核心原则

1. 只向 `V8.Image` 传入 `FileByteBase64`、`Base64`、`DataUrl` 或 `Bytes`，不要传本地路径或 URL。
2. 每次调用后先判断 `Code`，成功后再读取 `Data`；失败时直接返回原始 `DosResult`，保留准确错误信息。
3. 需要浏览器直接预览或下载图片时，开启接口引擎的“响应文件”，并返回包含 `FileName`、`ContentType`、`FileByteBase64` 的结果。
4. 合并时显式设置 `Mode`、尺寸、画布和图层顺序；覆盖合并使用 `ZIndex` 表达上下层，不依赖数组顺序猜测。
5. 对用户上传、远程下载和批量合并场景先做业务侧数量、类型和权限校验；不要尝试绕过平台内置资源限制。
6. 编写具体参数前读取 [完整 API 参考](references/api-reference.md)；不要发明未列出的模式、输入来源或输出格式。
7. `FontFamily` 是首选字体而不是无条件信任值：运行时会逐字符验证字形，依次使用服务器字体和程序集内置 Noto Sans CJK SC 回退；零字体 Linux / 群晖容器也必须能绘制基础拉丁字符、数字和简体中文。只有系统字体与内置字体都缺字时才明确失败，绝不输出“口口”缺字方框。业务字体仍用于固定品牌字形、区域异体字、特殊符号和 Emoji。

## 工作流程

### 1. 获取内存图片

按来源选择输入：

- 前端上传：从 `V8.FilesByteBase64[文件名]` 取得 Base64。
- 前一步处理结果：使用 `previous.Data.FileByteBase64`。
- 代码生成：先调用 `V8.Image.Create` 或 `V8.Image.CreateQRCode`。
- 远程图片：先校验目标域名和协议，再用 `V8.Http.GetResponse` 下载；将 `RawBytes` 作为 `Bytes` 传入。不要让未受信任的用户直接控制下载 URL。

```javascript
var source = {
  FileByteBase64: V8.FilesByteBase64['photo.png']
};
```

### 2. 选择操作

| 需求 | 方法 | 关键参数 |
|------|------|----------|
| 生成纯色、渐变、文字或图形图片 | `V8.Image.Create` | `Width`、`Height`、`BackgroundColor`、`Elements` |
| 左右、上下或网格拼接 | `V8.Image.Merge` | `Mode`、`Images`、`Gap`、`Padding`、`Alignment` |
| 多图层覆盖、指定上下层 | `V8.Image.Overlay` | `Images`、`CanvasWidth`、`CanvasHeight`、`ZIndex` |
| 调整尺寸 | `V8.Image.Resize` | `Width`、`Height`、`Fit`、`Pad` |
| 裁剪 | `V8.Image.Crop` | `X`、`Y`、`Width`、`Height` |
| 旋转或翻转 | `V8.Image.Rotate` / `Flip` | `Degrees`、`Expand` / `Horizontal`、`Vertical` |
| 转换输出格式 | `V8.Image.Convert` | `OutputFormat`、`Quality` |
| 在现有图片上绘制 | `V8.Image.Draw` | `Elements` |
| 添加常规图片水印 | `V8.Image.Watermark` | `BaseImage`、`Watermark`、`Position`、`Opacity` |
| 生成二维码 | `V8.Image.CreateQRCode` | `Content`、`Size` |
| 读取宽高、格式等元数据 | `V8.Image.GetInfo` | 任一图片来源字段 |

### 3. 设计合并布局

- 左右拼接：使用 `Mode: 'horizontal'`；用 `Direction: 'ltr'` 或 `'rtl'` 控制方向。
- 上下拼接：使用 `Mode: 'vertical'`；用 `Direction: 'ttb'` 或 `'btt'` 控制方向。
- 宫格拼接：使用 `Mode: 'grid'` 并设置 `Columns`。
- 覆盖合并：使用 `Mode: 'overlay'` 或直接调用 `Overlay`；数值更大的 `ZIndex` 后绘制，因此位于更上层。
- 需要稳定输出尺寸时设置 `CanvasWidth`、`CanvasHeight`；否则画布按布局和图片尺寸计算。
- 同时设置 `X` 或 `Y` 后，该图层按绝对坐标定位；否则使用 `Position` / `Anchor` 和偏移量定位。

### 4. 调用并返回结果

下面示例生成一张主图和一张角标，再把角标覆盖到指定坐标：

```javascript
var baseResult = V8.Image.Create({
  Width: 1200,
  Height: 700,
  BackgroundColor: '#2563eb',
  BackgroundColorEnd: '#0f172a',
  GradientDirection: 'left-to-right',
  Text: 'Microi',
  TextColor: '#ffffff',
  FontSize: 72,
  FileName: 'poster.png'
});
if (baseResult.Code !== 1) return baseResult;

var badgeResult = V8.Image.Create({
  Width: 240,
  Height: 120,
  BackgroundColor: '#f97316',
  Text: 'NEW',
  TextColor: '#ffffff',
  FontSize: 42
});
if (badgeResult.Code !== 1) return badgeResult;

var result = V8.Image.Overlay({
  CanvasWidth: 1200,
  CanvasHeight: 700,
  Images: [
    {
      FileByteBase64: baseResult.Data.FileByteBase64,
      Width: 1200,
      Height: 700,
      Fit: 'fill',
      ZIndex: 0
    },
    {
      FileByteBase64: badgeResult.Data.FileByteBase64,
      X: 900,
      Y: 80,
      Scale: 0.75,
      Opacity: 0.95,
      CornerRadius: 16,
      ZIndex: 10
    }
  ],
  OutputFormat: 'png',
  FileName: 'poster-with-badge.png'
});

return result;
```

## 组合处理

将每一步视为不可变处理：读取上一步的 Base64，再传给下一步。任何一步失败都立即返回。

```javascript
var resized = V8.Image.Resize({
  Image: { FileByteBase64: V8.Param.ImageBase64 },
  Width: 800,
  Height: 800,
  Fit: 'cover',
  OutputFormat: 'webp',
  Quality: 85
});
if (resized.Code !== 1) return resized;

var marked = V8.Image.Watermark({
  BaseImage: resized.Data.FileByteBase64,
  Watermark: V8.Param.WatermarkBase64,
  Position: 'bottom-right',
  Width: 160,
  Opacity: 0.7,
  Margin: 24,
  OutputFormat: 'webp',
  Quality: 85,
  FileName: 'result.webp'
});
return marked;
```

## 错误处理

不要把失败结果包装成 `Code: 1`。需要追加业务上下文时，保留底层消息：

```javascript
var result = V8.Image.Merge(options);
if (result.Code !== 1) {
  return {
    Code: 0,
    Msg: '商品图合并失败：' + result.Msg
  };
}
return result;
```

### 复盘：Windows 正常、Linux 连基础拉丁字符也无法绘制

- 触发场景：本地 Windows 的 `V8.Image.Draw` 中英文正常，发布到群晖或精简 Linux 后，首个 `M` 即报服务器无可用字形。
- 根因：原实现把字体可用性完全交给宿主机的 Skia/fontconfig；本地系统字体掩盖了发布包没有任何字体资源的问题。
- 通用规则：图片文字能力必须随 `Dos.Common` 程序集嵌入许可允许再分发的中英文字体；解析顺序固定为指定/系统字体、内置字体、明确缺字错误，禁止把“请运维安装字体”作为基础文字功能的唯一方案。
- 自动化检查：除 Windows 单元测试外，必须在 `FONTCONFIG_FILE` 指向空字体目录的 Linux 容器中验证英文、数字、中文和不存在的 `FontFamily`，同时确认系统 `MatchCharacter` 返回空、输出存在有效文字像素且没有缺字方框。

## 验收清单

- 确认每个图片来源都来自受信任的内存数据，并且没有把路径或 URL 直接传给 `V8.Image`。
- 确认处理链中每一步都检查 `Code === 1`。
- 确认覆盖图层的 `ZIndex`、`X/Y` 或 `Position` 与预期一致。
- 确认输出的 `Width`、`Height`、`ContentType`、`Format` 和 `FileName`。
- 调用 `V8.Image.GetInfo` 回读输出，校验真实宽高与格式。
- 对响应文件接口执行真实 HTTP 请求，检查状态码、`Content-Type`、文件头和浏览器预览结果。
- 发布字体处理改动时，在无系统字体的 Linux 容器中执行中英文绘制回归，不能只在开发机验收。
- 对匿名接口额外确认接口本身没有读取敏感图片、私有配置或任意远程 URL。

## 详细参考

读取 [references/api-reference.md](references/api-reference.md) 获取：

- 所有方法、输入别名和返回字段；
- 合并模式、图层参数、缩放规则和混合模式；
- 创建/绘制元素参数；
- 颜色、输出格式、限制与完整示例。
