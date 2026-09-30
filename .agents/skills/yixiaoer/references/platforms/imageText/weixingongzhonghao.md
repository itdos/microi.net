# 微信公众号图文发布参数 (WeiXinGongZhongHao Image-Text)

> [!IMPORTANT]
> 使用本平台字段前，先阅读 [图文发布首页](./index.md)。微信公众号 `imageText` 的内容、图片和发布设置均属于账号表单 `accountForms[].contentPublishForm`；只有微信公众号 `article` 使用平台级结构。

## 触发场景

- “发布图片/文字到微信公众号”
- “把这几张图发成公众号图文”
- “发布公众号小绿书/图片文字”

## 执行顺序

1. `yxer accounts list 微信公众号 --status 1 --json`
2. `yxer prepare WeiXinGongZhongHao imageText`
3. `yxer schema fields WeiXinGongZhongHao imageText`
4. 每张图片分别执行 `yxer upload <图片路径或 URL>`，保留返回的完整资源对象
5. 填写 `payload.json`
6. `yxer validate WeiXinGongZhongHao imageText payload.json`
7. `yxer publish imageText WeiXinGongZhongHao payload.json --dry-run`
8. 确认 dry-run 请求后再执行正式发布

## 账号表单字段

| 字段 | 类型 | 必填 | 说明 | 默认值 |
| --- | --- | --- | --- | --- |
| `formType` | string | 否 | 内容表单类型，固定为 `task` | `task` |
| `title` | string | 否 | 图文标题，最多 20 个 Unicode 字符 | - |
| `desc` | string | 否 | 图文正文/描述，支持 HTML | - |
| `images` | array | 是 | 写在 `accountForms[].images` 的已上传图片对象数组，可多选；至少 1 张 | - |

## 账号级发布设置

以下字段填写在 `publishArgs.accountForms[].contentPublishForm`。`statement` 必须直接传数值，网关会将其转换为下游的 `{ "type": 值 }`。

| 字段 | 类型 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `notifySubscribers` | number | `0` 不群发，`1` 群发 | `0` |
| `sex` | number | `0` 全部，`1` 男，`2` 女 | `0` |
| `scheduledTime` | integer | 13 位 Unix 毫秒时间戳；必须不早于当前时间 2 小时 | 立即发布（不传） |
| `needOpenComment` | number | `0` 关闭留言，`1` 仅关注用户，`2` 关注满 7 天，`3` 所有人可留言 | `0` |
| `statement` | number | 内容合规声明：`0` 无需声明，`1` AI 生成，`3` 剧情演绎仅供娱乐，`4` 个人观点仅供参考，`5` 健康医疗分享仅供参考，`6` 投资观点仅供参考 | `0` |
| `disableRecommend` | number | `0` 允许平台推荐，`1` 不允许平台推荐 | `0` |
| `pubType` | number | `1` 直接发布，`0` 保存到平台草稿箱 | `1` |

### 图片和封面

`accountForms[].images` 中的每一项都必须是 `yxer upload` 返回的已上传资源对象，并至少包含非空 `key`。默认情况下 CLI 会把第一张图片作为内部封面；如果接口已经返回账号级 `coverKey`，CLI 会保留它，不要求再补一个 `cover` 对象。不要手写外部图片 URL，也不要漏传任意一张用户选择的图片。

## Payload 示例

```json
{
  "action": "publish",
  "publishType": "imageText",
  "platforms": ["微信公众号"],
  "publishChannel": "cloud",
  "publishArgs": {
    "accountForms": [
      {
        "platformAccountId": "ACC_ID_001",
        "images": [
          { "key": "img_key_1", "size": 102400, "width": 1080, "height": 1440, "format": "jpg" },
          { "key": "img_key_2", "size": 98304, "width": 1080, "height": 1440, "format": "png" }
        ],
        "contentPublishForm": {
          "formType": "task",
          "title": "公众号图片文字示例",
          "desc": "<p>这是一条公众号图文描述。</p>",
          "notifySubscribers": 0,
          "sex": 0,
          "needOpenComment": 3,
          "statement": 4,
          "disableRecommend": 0,
          "pubType": 1
        }
      }
    ]
  }
}
```

## 重要约束

- 公众号图文与公众号文章是两个发布类型：本页使用 `publish imageText`，不要改成 `publish article`。
- 不要传 `statement: { "type": 4 }`；图文任务中应传 `statement: 4`。
- 要群发时设置 `notifySubscribers=1`；`sex` 只表达群发人群性别。
- 描述字段使用 `desc`；不要把公众号图文写成其他平台通用的 `description`。
- 设置了 `scheduledTime` 时，CLI 会在本地 preflight 阶段拒绝距离当前不足 2 小时的时间。
- `pubType=0` 是目标平台草稿箱，不是蚁小二内部草稿；蚁小二内部草稿仍使用顶层 `isDraft=true`。
