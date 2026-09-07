# V8.Email 协议原子

业务编排使用接口引擎，下面的方法只供可信后端调用。
连接对象字段为 `Host`、`Port`、`Security`、`UserName`、`Credential`、`Timeout`。
`Credential` 必须是 `V8.Email.ProtectCredential` 产生的当前租户密文。
`Security` 仅允许 `SslOnConnect`、`StartTls`。超时默认 40 秒，最高 60 秒。

| 方法 | 输入补充 | 返回 Data |
| --- | --- | --- |
| `V8.Email.ProtectCredential(value)` | 原文授权码 | 直接返回带版本前缀的租户密文字符串 |
| `V8.Email.TestConnection(p)` | `Protocol: IMAP / SMTP` | `Connected, Protocol, Secure` |
| `V8.Email.ListFolders(p)` | 无 | 最多 200 个 `Path, Name, Kind, Total, Unread` |
| `V8.Email.Fetch(p)` | `Folder, AfterUid, UidValidity, Limit, Recent` | `NextUid, HasMore, Reset, UidValidity, Messages` |
| `V8.Email.Inspect(p)` | `Folder, UidValidity, Uids`（最多 100） | `UidValidity, Messages`，含存在的 UID 和已读/星标/删除标志 |
| `V8.Email.GetMessage(p)` | `Folder, UidValidity, Uid` | 信封、`TextBody, HtmlBody, Attachments` |
| `V8.Email.GetAttachment(p)` | 上述字段及 `AttachmentIndex`（从 0 开始） | `FileName, ContentType, FileByteBase64` |
| `V8.Email.SetFlags(p)` | `Folder, UidValidity, Uid, IsRead, IsStarred` | 结果状态 |
| `V8.Email.Move(p)` | `Folder, UidValidity, Uid, DestinationFolder` | 移动结果；不得对整个目录执行无差别清空 |
| `V8.Email.Send(p)` | SMTP 连接及下述 MIME 字段 | `DeliveryState, MessageId`，外层 `Code` 表示协议结果 |
| `V8.Email.StoreSent(p)` | IMAP 连接及相同 MIME 字段 | 按 Message-Id 查重并保存已发送副本 |

`Fetch.Recent=true` 读取末尾最多 `Limit` 封邮件，但保留历史 `AfterUid` 游标。
常规 Fetch 按 UID 窗口分页，`Limit` 最高 100；即使窗口为空也推进游标。
返回的 `Reset` 必须与 `UidValidity` 一起持久化，不能把旧代邮件指向新代同号 UID。

MIME 字段：`To, Cc, Bcc, Subject, TextBody, HtmlBody, InReplyTo, MessageId, Attachments`。
附件对象：`FileName, ContentType, FileByteBase64`，最多 10 个，总大小不超过 10MB；
读取单封原始邮件上限 25MB，正文上限 2MB。超限应明确报错，不能静默丢内容。

`Send` 的结果：`Accepted`、`Rejected` 或 `Unknown`。
在业务层保存草稿及去重标记后才能调用；不要对 `Unknown` 自动重试 SMTP。
`StoreSent` 与真正发信分开，不可将保存副本当作已经投递。

相关源码：`Microi.Server/Microi.V8Engine/Extend/Email/V8Email.cs`。
