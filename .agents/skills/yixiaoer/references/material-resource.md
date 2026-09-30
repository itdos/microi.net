# 上传到素材库 (Material Library Save)

将资源上传并登记到素材库，生成可在素材管理中复用的视频或图片记录。

## 触发场景 (Trigger)
- **意图辨析**：当用户希望将已上传的临时资源“持久化”或“资产化”，以便后续多次复用、团队共享或在网页端素材库中进行统一管理时触发。
- **典型提示词**：
  - “把这个视频存进素材库方便以后调用”
  - “我的宣传片已经传好了，帮我入库”
  - “将这个 Key 对应的图片登记到素材管理中”

> [!TIP]
> 当用户意图是“把文件放进素材库”，直接使用：
>
> ```bash
> yxer material add --file ./demo.mp4
> ```
>
> 该命令会自动完成：
> 1. 上传到 `material-library`
> 2. 素材登记入库

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值: `material` |
| `filePath` | `string` | **是** | 已上传到蚁小二 OSS 的资源 `key`（通过 `upload` 获取） |
| `fileName` | `string` | **是** | 展示用文件名，建议保留扩展名 |
| `width` | `number` | **是** | 素材宽度 |
| `height` | `number` | **是** | 素材高度 |
| `type` | `string` | **是** | 素材类型。常用值为 `video` 或 `image` |
| `thumbPath` | `string` | 否 | 缩略图资源 `key`。视频建议传封面，图片可不传 |

## 执行逻辑 (Logic Flow)
1. **链路检查**：确认资源是否已通过 `upload` 动作上传（建议使用 `bucket: "material-library"`）。
2. **元数据提取**：识别文件的真实名称、宽高及类型。
3. **参数装配**：构造 `action: "material"` 及完整元数据。
4. **指令执行**：调用 `yxer material add --file ...`；只有高级定制时再拆分成 `upload + material create`。
5. **入库反馈**：向用户确认素材 ID 及入库成功状态。

## 执行链路

1. 直接使用：

```bash
yxer material add --file ./demo.mp4
```

2. 如需手工控制资源 key 或缩略图，再拆分成：
- `yxer upload ./demo.mp4 --bucket material-library`
- `yxer material create material-payload.json`

## 调用指令 (Command)

```bash
yxer material create material-payload.json
```

也可直接上传并登记：

```bash
yxer material add --file ./demo.mp4
```

如需手工控制资源 key 或缩略图，先执行：

```bash
yxer upload ./demo.mp4 --bucket material-library
```

再将返回的 `key` 组装进 `material-payload.json`：

```json
{
  "filePath": "uploaded/demo.mp4",
  "fileName": "demo.mp4",
  "width": 1080,
  "height": 1920,
  "type": "video"
}
```

## 注意事项
- **Bucket 匹配**：若目标是素材库，请在上传步骤显式使用 `bucket: "material-library"`。
- **重复校验**：若相同资源已入库，后端可能返回已有记录。
