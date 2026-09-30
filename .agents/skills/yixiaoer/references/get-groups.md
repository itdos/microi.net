# 获取群聊列表 (Get Groups)

此接口用于获取指定媒体账号在平台上已创建或加入的群聊列表，以便在发布视频时进行绑定。

## 1. 调用指令

```text
当前版本尚未提供独立 `yxer` 子命令。
本页仅保留字段结构说明，执行时应优先扩展 Go CLI，而不是寻找旧脚本入口。
```

## 2. 请求参数

| 参数名 | 类型 | 必填 | 说明 |
| :--- | :--- | :--- | :--- |
| action | string | 是 | 固定为 `groups` |
| account_id | string | 是 | 蚁小二系统内的媒体账号 ID |

## 3. 返回数据结构

返回一个包含 `Group` 对象的数组。

### Group 结构说明
| 字段名 | 类型 | 说明 |
| :--- | :--- | :--- |
| yixiaoerId | string | 群聊 ID |
| yixiaoerName | string | 群聊标题 |
| yixiaoerDesc | string | 群聊描述 |
| yixiaoerImageUrl | string | 群聊头像 URL |
| `raw` | `object` | 平台原始数据。如果在获取时该字段存在，发布表单中必须携带并完整透传 |

## 后端逻辑说明

- **功能**: 封装蚁小二标准化群聊查询接口 (`GET /platform-accounts/{platformAccountId}/group-chats`)。
- **参数映射**: 将 `account_id` 映射为 URL 路径变量。
