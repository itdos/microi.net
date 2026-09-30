# 错误恢复协议

> 适用范围：`doctor`、`accounts list`、`prepare`、`schema`、`upload`、`query`、`validate`、`publish --dry-run`、正式 `publish` 失败后的处理。

错误恢复的目标是最小修复、保持来源真实、避免重复触发副作用。

## 通用原则

- 先读取 CLI 错误、hint 和 nextCommand，再决定下一步。
- 只修复失败相关字段，不重写整份 payload。
- 写操作失败后，不要立即重复正式写命令；先判断是否需要重新 validate 或 dry-run。
- 修改 payload、发布通道、账号、资源或动态字段后，必须重新执行 validate；发布任务还必须重新 dry-run。

## 错误映射

| 阶段 | 判断条件 | 下一步 | 是否需要用户确认 |
| --- | --- | --- | --- |
| `doctor` | CLI 不存在、未登录、配置缺失 | 按 hint 修复环境或让用户处理登录 | 是，若需要用户登录或安装 |
| `accounts list` | 无可用账号 | 告知用户检查账号状态、cookie 或平台授权 | 是 |
| `accounts list` | 多个可用账号 | 按确认协议展示候选 | 是 |
| `prepare` | 平台或类型不支持 | 核对平台名和 publishType，必要时读取平台索引 | 是，若目标有歧义 |
| `schema fields` | 字段不存在或类型不匹配 | 回到 schema，修正字段路径或类型 | 否，除非字段语义不明确 |
| `upload` | 本地文件不存在 | 检查路径，要求用户提供有效路径 | 是 |
| `upload` | URL 下载失败 | 让用户确认 URL 或改用本地文件 | 是 |
| `query` | 返回空 | 放宽关键词或换 query 类型重试一次 | 是，若仍为空 |
| `query` | 多候选 | 按确认协议展示候选 | 是 |
| `validate` | 缺少 `platformAccountId` | 重新 `accounts list --status 1` | 是，若多账号 |
| `validate` | 资源 key、尺寸、时长错误 | 重新 `yxer upload`，使用返回字段 | 否，除非资源要更换 |
| `validate` | 动态对象 raw 缺失或格式错误 | 重新执行对应 `yxer query ...` | 是，若多候选 |
| `validate` | 视频号剧集字段缺失或含 `raw` | 重新执行 `yxer query drama-tasks`，只保留三个 schema 字段 | 是，若多候选 |
| `validate` | payload 含 `<placeholder>` | 回到来源步骤替换占位符 | 视字段而定 |
| `dry-run` | 请求结构不符合平台要求 | 以 dry-run 错误为准修字段，再 validate | 视字段而定 |
| `publish` | 本机客户端不在线 | 提示启动客户端，或询问是否切云发布 | 是 |
| `publish` | 云发布代理不存在 | 提示检查代理，或询问是否切本机发布 | 是 |
| `publish` | 账号状态变化 | 重新 `accounts list --status 1` | 是 |

## 重试规则

- 查询命令可以在调整关键词后重试。
- 上传命令可以在确认路径或 URL 后重试。
- `validate` 可以在修复字段后重试。
- `publish --dry-run` 可以在重新 validate 后重试。
- 正式 `publish` 只允许在明确判断未产生成功副作用，或用户确认可重试后再次执行。

## 返回给用户的信息

报错时说明三件事：

1. 失败发生在哪个阶段。
2. 当前判断的原因。
3. 下一步要执行的修复命令或需要用户确认的选项。
