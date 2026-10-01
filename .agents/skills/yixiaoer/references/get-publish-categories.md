# 获取发布分类/话题 (Get Categories)

获取特定平台账号支持的文章分类、视频分类或话题标签列表。

当前支持平台：百家号、爱奇艺、哔哩哔哩、企鹅号、搜狐号、网易号、一点号、大鱼号、知乎、蜂网、AcFun。

## 触发场景 (Trigger)
- **意图辨析**：在准备发布内容时，为了确保 `platformSettings` 中的分类/话题符合平台标准，不产生非法值，必须预先查询合法值。
- **典型提示词**：
  - “获取这个百家号的视频分类”
  - “查看百家号支持的文章类别”
  - “查询可以挂载的话题”

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 说明 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`categories` |
| `account_id` | `string` | **是** | 蚁小二账号 ID (ObjectId) |
| `type` | `string` | 否 | 发布类型：`video` (默认) 或 `article` |
| `paths` | `boolean` | 否 | 传给 CLI 时显示完整的根分类到末级分类路径 |

## 执行逻辑 (Logic Flow)
1. **身份锚定**：识别目标账号 `account_id`（通过 `accounts` action 获取）。
2. **场景对齐**：根据发布内容决定 `type`。
3. **参数装配**：构造 `action: "categories"` 负载。
4. **指令执行**：调用 `yxer query categories <account_id> [--type video|article] [--paths] --json`。搜狐号视频建议使用 `--paths`。
5. **值注入**：将 CLI 返回的完整分类对象填入发布 Payload 的对应位置，不能只摘取 `id`、`name` 或局部 `raw` 字段。

## 返回数据说明 (Response Details)

返回包含分类对象（`Category` 结构）的树形或扁平结构。发布时必须使用 `yxer query categories` 返回的完整对象数据。
- 使用 `--paths` 时，`data` 结构为 `{ "categories": [...], "paths": [...] }`。`paths` 中的 `path` 是可读的父子路径，`nodes` 保留任意深度的 ID/名称，`category` 是可直接回填的完整分类对象数组；两级路径还会提供 `parentId`、`parentName`、`childId`、`childName`。
- 搜狐号视频必须使用最新查询结果中从父分类到末级分类的完整 `category` 路径，不能只提交末级分类。
- 大鱼号视频必须选择至少一个分类；使用目标账号的 `yxer query categories <account_id> --type video --json` 结果，保留完整分类对象。
- 大鱼号视频分类按蚁小二 Web 端固定目录提供。CLI 内置并嵌入这份目录，确认账号属于大鱼号后直接返回，不请求不支持大鱼号的账号分类接口；返回的对象包含 `yixiaoerId`、`yixiaoerName` 和 `raw`。
- **Agent 手动铺平 (Flattening)**：若返回的数据包含嵌套的 `children` 数组，Agent **必须自行递归遍历**，以便在组装发布表单时能够获取任何层级的分类。
- **层级路径组装 (Cascading Path)**：
  - 对于要求多级分类的平台 (如 Bilibili)，Agent 在组装表单时，不能只填入最终选中的子分类。
  - **必须组装一个数组**：包含从根节点到选中节点的所有路径对象。
  - **包含 `raw` 对象**：路径中每一个对象除 `yixiaoerId` 和 `yixiaoerName` 外，**必须同步传入其对应的 `raw` 对象**（若存在）。

### 复杂对象：CategoryItem
- `yixiaoerId`: 内部分类 ID。
- `yixiaoerName`: 分类名称。
- `raw`: 原始平台返回的分类对象（组装表单时必须保留）。
- `children`: 子分类数组（若存在，需递归处理）。
  - **示例**：
    - 父分类：`{"yixiaoerId": "18", "yixiaoerName": "动漫"}`
    - 子分类：`{"yixiaoerId": "1", "yixiaoerName": "国产动漫"}`
    - 最终处理后的 `category` 字段：
      ```json
      "category": [
        { "yixiaoerId": "18", "yixiaoerName": "动漫", "raw": {} },
        { "yixiaoerId": "1", "yixiaoerName": "国产动漫", "raw": {} }
      ]
      ```
- `raw`: 原始平台返回的分类对象。

## 调用指令 (Command)

```bash
yxer query categories YOUR_ACCOUNT_ID --type video --paths --json
```

