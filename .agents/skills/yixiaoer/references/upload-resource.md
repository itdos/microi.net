# 上传资源 (Upload Resource)

将图片、视频或其它素材上传至蚁小二云端存储 (OSS)，并获取用于发布的资源 Key。这是自动化发布的前置步骤。

## 触发场景 (Trigger)
- **意图辨析**：当用户提供原始 URL 或本地路径，并准备进行发布 (publish) 或存入素材库 (material) 之前，必须先将资源“物理上传”以获得系统可识别的 Key。
- **典型提示词**：
  - “把这个视频传上去”
  - “准备发布，上传封面图”
  - “获取这个短剧资源的 Key”

> [!IMPORTANT]
> **素材库上传特殊说明**: 当用户明确要求“上传到素材库”时，这只是第一步 (`upload`)，完成后**必须**紧接着执行第二步 (`material`) 登记入库，否则上传仅停留在临时 OSS 空间。

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`upload` |
| `url` | `string` | **是** | 资源的远程 URL 或本地绝对路径 |
| `bucket` | `string` | **否** | OSS 存储桶。默认 `cloud-publish`；若后续要调用素材库 `action: "material"`，必须使用 `material-library` |
| `contentType` | `string` | **是** | 资源的 MIME 类型 (如 `video/mp4`, `image/png`)。**严格要求**: 请求预签名 URL 时声明的 `contentType` 必须与执行 PUT 上传时 Header 中的 `Content-Type` **完全一致**。 |
| `size` | `number` | 否 | 资源大小 (字节)。 |

## 执行逻辑 (Logic Flow)
1. **源检测**：识别 URL 是远程地址还是本地物理路径。
2. **目标桶确认**：根据用户是否提到“素材库”决定 `bucket`（`cloud-publish` vs `material-library`）。
3. **类型嗅探**：尝试根据后缀名自动推断 `contentType`，若失败则提示用户或使用通用流类型。
4. **指令执行**：调用 `yxer upload <file_path_or_url> [--bucket cloud-publish|material-library]`。
5. **Key 提取**：获取返回的 `key`，并作为后续发布 Payload 的输入（如 `coverKey`, `video.key`）。

> [!IMPORTANT]
> **视频号 512KB 图片限制**:
> 上传视频号视频封面或视频号图文图片时，必须带平台用途参数：
> `yxer upload <图片路径或URL> --platform 视频号 --usage cover` 或 `--usage image`。
> 当图片超过 512KB 时，CLI 会在内部压缩后再上传，并在 JSON 返回中标记 `compressed: true`、`originalSize` 和压缩后的 `size`；后续 payload 必须使用这次上传返回的完整对象。

> [!IMPORTANT]
> **Instagram / Meta 兼容性**:
> 若后续要发 Instagram 视频，原视频文件名不要使用中文、空格或其它非 ASCII 字符。Meta 会主动回拉蚁小二返回的媒体 URL；若 URL 路径中带中文，Meta 下载器可能直接返回 HTTP 400，导致“创建发布容器失败 / The media could not be fetched from the provided URI”。

## 输出结果 (Output)

输出生成的资源标识，供发布脚本引用：
```json
{
  "key": "cloud-publish/2026/03/26/66b2xxx/xxx.jpg",
  "name": "xxx.jpg",
  "bucket": "cloud-publish"
}
```
**注意**: 封面/媒体字段使用返回对象中的 `key`；如果资源要出现在 HTML `<img src>` 中，不能把裸 `key` 当成浏览器地址，必须通过文章导入/正文图片物化流程换成稳定 URL。

## 调用指令 (Command)

```bash
yxer upload https://example.com/image.jpg --bucket cloud-publish
yxer upload ./cover.png --platform 视频号 --usage cover
```

> [!IMPORTANT]
> **发布合规性提醒**:
> 所有的封面图、图文图片、视频文件均**严禁直接使用外部网络 URL**，必须通过本项目提供的上传接口进行处理并获取 `key` 后进行发布。不遵守此规范将直接导致任务失败。

> [!CAUTION]
> **ContentType 签名一致性**:
> 在上传资源时，必须确保获取上传地址所传入的 `contentType` 参数与 PUT 请求实际发送的 `Content-Type` Header **完全一致**。

