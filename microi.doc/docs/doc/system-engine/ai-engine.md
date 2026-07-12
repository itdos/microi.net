# AI 引擎与 Microi.AI 中转站

## 中转站配置

`mic_ai` 中的 `Microi.AI中转站` 是官方 OpenAI 兼容入口：

- Endpoint：`https://api.itdos.com/v1`
- ApiKey：在吾码官网个人中心生成；创建 SaaS 独立数据库时会自动写入新租户
- 中转模型：由吾码官方 `mic_ai.IsRelayModel = 1` 的启用模型组成，用户在 AI 对话界面选择
- 鉴权与计量：官方服务按 ApiKey 关联官网账号，按每次请求的输入/输出 Token 扣减并记录明细

不要把官方供应商的真实 ApiKey 下发到租户，也不要在租户本地重复扣减。租户只保存用户自己的 `sk-microi-*` ApiKey，供应商密钥仅保留在吾码官方数据库。

AI 对话中的【选择中转模型】始终显示并提交官方目录的模型 Id（例如 `MiniMax-M3`），不能用厂商简称替代模型 Id。AI 引擎列表直接读取模块设计的列表列配置，因此在模块设计中加入【加入AI中转站】后会同步显示，前端不再维护另一份硬编码列清单。

中转站配置行允许 `AiModel` 为空：该行只保存中转站 Endpoint、ApiKey 等接入配置，真正发送给上游的模型 Id 来自【选择中转模型】。前端校验与请求必须使用选中的中转模型 Id，并同时提交中转站配置行的 `AiModelId`。

## 对话归档

左侧对话区可以在【AI对话 / 已归档】之间切换。归档状态保存在 `mic_ai_record.Content.Archived`，同一 `ConversationId` 的所有消息一起归档；归档或还原后只刷新当前列表，不自动切换 Tab。归档不删除历史消息，也不影响审计记录。

## 个人中心

登录吾码官网后，在【个人中心 → AI 中转站】可以查看：

- API Base 与个人 ApiKey
- 总量、已用、剩余 Token
- 每次调用的模型、输入 Token、输出 Token、扣减量、剩余额度和调用来源

个人中心只保留官网导航栏中的一个语言切换器。这里切换的是个人中心 i18n 字典，不改变 `profile.html` 路由；Markdown 文档仍使用独立中英文 URL，以保留 SEO 能力。

个人中心所有受保护请求使用同一份平台 Token。服务端通过响应头 `authorization` 轮换 Token 时，页面会先保存新 Token 再发起后续请求；真正失效时统一清理会话并跳转登录页，不会继续展示旧数据后再在页面底部提示身份过期。

OpenAI 兼容客户端可使用 `/v1/chat/completions`、`/v1/models`；额度查询使用 `/v1/usage`。
