# 获取账号数据概览 (Get Account Overviews V2)

获取当前团队下各账号的综合表现概览。主要用于账号矩阵的权重分析、整体粉丝量监控及核心指标汇总。

## 触发场景 (Trigger)
- **意图辨析**：当用户需要宏观查看某个平台下的“账号全景图”，而不是单个作品的数据时。例如：分析团队资产总量、对比部门/负责人之间的账号表现差异。
- **典型提示词**：
  - “汇总一下我旗下所有抖音号的粉丝量”
  - “我的视频号账号最近表现如何？”
  - “查看张三负责的账号的数据看板”

## 参数定义 (Parameters)

### 参数列表 (Payload Properties)

| 字段名 | 类型 | 是否必填 | 描述 |
| :--- | :--- | :--- | :--- |
| `action` | `string` | **是** | 固定值：`account-overviews` |
| `platform` | `string` | **是** | 指定查询某个平台。见 [平台定义](./platform.md)。 |
| `name` | `string` | 否 | 按照账号昵称模糊查询。 |
| `group` | `string` | 否 | 按照分组名称查询。 |
| `loginStatus` | `number` | 否 | 账号状态 (0未登录, 1成功, 2过期, 3失败)。 |
| `memberIds` | `string[]` | 否 | 负责人成员 ID 数组 (ObjectId)。 |
| `page` | `number` | 否 | 当前页码，默认 `1`。 |
| `size` | `number` | 否 | 每页数量，默认 `10`。 |

## 执行逻辑 (Logic Flow)
1. **维度确定**：识别查询的目标平台（`platform` 为必填）。
2. **权限过滤**：若提到特定人员，解析并注入其 `memberIds`。
3. **参数装配**：构造 `action: "account-overviews"` 及分页参数。
4. **指令执行**：当前能力正在迁移到 `yxer` CLI，本文档不再推荐脚本直调。
5. **看板交付**：提取 `overviewData` 中的总粉丝数、总播放量等关键指标反馈给用户。

## 返回结果说明 (Response Details)

返回包含账号表现信息列表的对象。

### 复杂对象：data.data[i] (账号概览对象)

| 字段 | 类型 | 描述 |
| :--- | :--- | :--- |
| `platformAccountId` | `string` | 媒体账号 ID |
| `platformAvatar` | `string` | 账号头像地址 |
| `platformAccountName` | `string` | 账号昵称 |
| `principalName` | `string` | 当前负责成员名 |
| `overviewData` | `object` | 统计数据总计。包含 `fansTotal`, `playTotal`, `commentsTotal`, `likesTotal` 等。 |

## 调用指令 (Command)

```text
当前版本尚未提供独立 `yxer` 子命令。
本页仅保留字段结构说明，执行时应优先扩展 Go CLI，而不是寻找旧脚本入口。
```

## 注意事项
- **总量聚合**：账号数据 V2 提供的是总量的统计概览，适合查看整体情况。
