# 获取音乐素材列表 (Get Music)

获取发布内容时可供选择的平台背景音乐素材。支持平台：**抖音、快手、视频号**。

## 触发场景 (Trigger)
- **意图辨析**：当用户在准备发布短视频内容，并要求添加特定背景音乐、搜寻热门歌曲或按分类查找音乐时触发。
- **典型提示词**：
  - “帮我找一下适合跳舞的抖音音乐”
  - “搜索周杰伦的《稻香》用于这个视频”
  - “获取热门音乐分类”
  - “我的视频号发布需要配乐”

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`music` |
| `account_id` | `string` | **是** | 蚁小二账号 ID (32位十六进制) |
| `keyword` | `string` | 否 | 搜索音乐关键词 (别名: `keyWord`) |
| `categoryId` | `string` | 否 | 音乐分类 ID。**需与 categoryName 同时提供，仅支持抖音**，优先级高于 `keyword` |
| `categoryName`| `string` | 否 | 音乐分类名称。**需与 categoryId 同时提供，仅支持抖音** |
| `nextPage` | `string` | 否 | 分页标识，在返回结果中获取 |

## 执行逻辑 (Logic Flow)
1. **参数前置**：必须先获取有效的 `account_id`（通过 `accounts` action）。
2. **场景匹配**：判断是否指定了特定分类 (Category)。若指定，则优先注入 `categoryId`。
3. **参数装配**：构造 `action: "music"` 及其余查询参数。
4. **指令执行**：调用 `yxer query music <account_id> [--query 关键词] [--json]`。
5. **素材交付**：将返回的 `MusicItem` 列表展示给用户，或直接提取 `raw` 字段用于发布 Payload。

## 返回结果 (Response)

返回一个包含音乐素材对象的数组。发布时请将整个对象（使用 `MusicItem` 结构）作为 `music` 参数传递给发布脚本，不能只摘取 ID、名称或少数字段。如果在获取时 `raw` 字段有值，发布表单中必须完整保留并透传；`playUrl` / `url` 作为查询结果元数据也应保留，不要手动删除。

```json
[
  {
    "yixiaoerId": "music_123",
    "yixiaoerName": "稻香",
    "artist": "周杰伦",
    "playUrl": "http://...",
    "duration": 240,
    "raw": { ... }
  }
]
```

### 复杂对象：MusicItem
- `yixiaoerId`: (必填) 蚁小二端统一音乐 ID。
- `yixiaoerName`: (必填) 歌曲名称。
- `duration`: (必填) 音乐时长（单位：秒）。
- `playUrl`: (必填) 试听/播放链接。
- `artist`: (可选)歌手/作者名。
- `raw`: (可选) 平台原始数据。如果在音乐列表获取时该字段存在，发布表单中必须携带并完整透传。

## 调用指令 (Command)

```bash
yxer query music XXX --query 周杰伦 --json
```

未指定关键词或榜单时，抖音账号默认查询推荐榜。查询其他榜单时，先执行 `yxer query music-categories XXX --json`，再将返回的 `yixiaoerId` 与 `yixiaoerName` 一并传入 `--category-id` 和 `--category-name`。

## 注意事项
- **抖音专用**：`categoryId` 搜索目前仅在抖音平台调用时生效。
- **透传规则**：`raw` 字段非常关键，某些平台校验严格，必须原样透传。

