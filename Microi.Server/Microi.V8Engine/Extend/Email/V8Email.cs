using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using Dos.Common;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Search;
using MailKit.Security;
using MimeKit;
using MimeKit.Utils;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// IMAP/SMTP/MIME 有界协议原子。无 Controller、业务表、调度器或持久客户端；
    /// 账号权限、同步游标、发件去重和保存状态由接口引擎负责。
    /// </summary>
    public sealed class V8Email
    {
        private const string CredentialPrefix = "mci-email:v1:";
        private const string CredentialPurpose = "V8.Email.AccountCredential.v1";
        private const int MaxMessageBytes = 25 * 1024 * 1024;
        private const int MaxAttachmentBytes = 10 * 1024 * 1024;

        static V8Email() => Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        /// <summary>加密邮箱授权码；用途与当前租户绑定，不提供返回明文的方法。</summary>
        public string ProtectCredential(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > 4096)
                throw new ArgumentException("邮箱授权码不能为空且不能超过 4096 字符。");
            if (value.StartsWith(CredentialPrefix, StringComparison.Ordinal))
                throw new ArgumentException("请传入新的邮箱授权码，不能提交密文。");
            return CredentialPrefix + TenantSystemSettingsSecurity.ProtectSecret(Tenant(), CredentialPurpose, value);
        }

        /// <summary>检测 IMAP 或 SMTP 登录；只返回安全状态。</summary>
        public DosResult TestConnection(object param) => Execute(param, (p, ct) =>
        {
            if (Text(p, "Protocol", "IMAP").Equals("SMTP", StringComparison.OrdinalIgnoreCase))
            {
                using var smtp = ConnectSmtp(p, ct);
                return new { Connected = true, Protocol = "SMTP", Secure = smtp.IsSecure };
            }
            using var imap = ConnectImap(p, ct);
            return new { Connected = true, Protocol = "IMAP", Secure = imap.IsSecure };
        });

        /// <summary>读取可选邮件目录和服务端计数，目录路径作为不透明值使用。</summary>
        public DosResult ListFolders(object param) => Execute(param, (p, ct) =>
        {
            using var client = ConnectImap(p, ct);
            var folders = new List<IMailFolder> { client.Inbox };
            foreach (var ns in client.PersonalNamespaces)
                folders.AddRange(client.GetFolders(ns, StatusItems.Count | StatusItems.Unread, false, ct));
            return folders.Where(f => !f.Attributes.HasFlag(FolderAttributes.NoSelect))
                .GroupBy(f => f.FullName, StringComparer.Ordinal).Select(g => g.First()).Take(200)
                .Select(f => new { Path = f.FullName, Name = f.Name, Kind = FolderKind(f), Total = f.Count, Unread = f.Unread }).ToArray();
        });

        /// <summary>按 UID 游标批量读取信封与附件结构，不下载正文；UIDVALIDITY 改变时显式重置。</summary>
        public DosResult Fetch(object param) => Execute(param, (p, ct) =>
        {
            using var client = ConnectImap(p, ct);
            var folder = OpenFolder(client, p, false, ct);
            var previousValidity = UInt(p, "UidValidity");
            var reset = previousValidity != 0 && previousValidity != folder.UidValidity;
            var after = reset ? 0 : UInt(p, "AfterUid");
            var limit = Int(p, "Limit", 50, 1, 100);
            var highest = folder.UidNext.HasValue ? folder.UidNext.Value.Id - 1 : uint.MaxValue - 1;
            // 使用固定 UID 窗口限制服务端 Search 结果；空洞仍推进游标，不无限重扫。
            var through = (uint)Math.Min(highest, Math.Min((long)uint.MaxValue - 1, (long)after + 10000));
            IList<UniqueId> candidates = new List<UniqueId>();
            if (through > after)
                candidates = folder.Search(SearchQuery.Uids(new UniqueIdRange(new UniqueId(after + 1), new UniqueId(through))), ct);
            var recent = p.Value<bool?>("Recent") == true;
            if (recent && folder.Count > 0)
            {
                // 首屏只读取末尾有限封信；历史游标保留给后续后台批次。
                var tail = folder.Fetch(Math.Max(0, folder.Count - limit), -1, MessageSummaryItems.UniqueId, ct);
                candidates = tail.Select(s => s.UniqueId).ToList();
            }
            var selected = candidates.OrderBy(u => u.Id).Take(limit).ToList();
            var scanned = candidates.Count > limit ? selected.Last().Id : Math.Max(after, through);
            var summaries = selected.Count == 0 ? new List<IMessageSummary>() : folder.Fetch(selected,
                MessageSummaryItems.UniqueId | MessageSummaryItems.Envelope | MessageSummaryItems.Flags |
                MessageSummaryItems.InternalDate | MessageSummaryItems.Size | MessageSummaryItems.BodyStructure, ct);
            return new
            {
                Folder = folder.FullName, UidValidity = folder.UidValidity, Reset = reset,
                NextUid = recent ? after : scanned, HasMore = recent || scanned < highest, Total = folder.Count, Unread = folder.Unread,
                Messages = summaries.Select(s => new
                {
                    Uid = s.UniqueId.Id, MessageId = s.Envelope?.MessageId ?? "", Subject = s.Envelope?.Subject ?? "(无主题)",
                    From = s.Envelope?.From?.ToString() ?? "", To = s.Envelope?.To?.ToString() ?? "",
                    Cc = s.Envelope?.Cc?.ToString() ?? "", Date = (s.Envelope?.Date ?? s.InternalDate ?? DateTimeOffset.UtcNow).UtcDateTime.ToString("O"),
                    IsRead = s.Flags.GetValueOrDefault().HasFlag(MessageFlags.Seen),
                    IsStarred = s.Flags.GetValueOrDefault().HasFlag(MessageFlags.Flagged),
                    HasAttachments = s.Attachments?.Any() == true, Size = s.Size ?? 0
                }).ToArray()
            };
        });

        /// <summary>读取一封邮件正文；不自动标记已读，不执行 HTML 或访问远程图片。</summary>
        public DosResult GetMessage(object param) => Execute(param, (p, ct) =>
        {
            using var client = ConnectImap(p, ct);
            var folder = OpenFolder(client, p, false, ct);
            using var message = ReadMessage(folder, p, ct);
            return new
            {
                MessageId = message.MessageId, Subject = message.Subject, From = message.From.ToString(),
                To = message.To.ToString(), Cc = message.Cc.ToString(), ReplyTo = message.ReplyTo.ToString(),
                Date = message.Date.UtcDateTime.ToString("O"),
                TextBody = BoundText(message.TextBody), HtmlBody = BoundText(message.HtmlBody),
                Attachments = message.Attachments.Take(100).Select((a, i) => new
                {
                    Index = i, FileName = AttachmentName(a, i), ContentType = a.ContentType.MimeType
                }).ToArray()
            };
        });

        /// <summary>分页核对已缓存 UID 的存在性、已读和星标。</summary>
        public DosResult Inspect(object param) => Execute(param, (p, ct) =>
        {
            var values = p["Uids"] as JArray ?? throw new ArgumentException("Uids 必须是数组。");
            if (values.Count > 100) throw new ArgumentException("每次最多核对 100 个 UID。");
            var ids = values.Select(v => uint.TryParse(v.ToString(), out var id) && id > 0 ? new UniqueId(id)
                : throw new ArgumentException("Uid 必须是正整数。")).Distinct().ToList();
            using var client = ConnectImap(p, ct);
            var folder = OpenFolder(client, p, false, ct);
            var summaries = ids.Count == 0 ? new List<IMessageSummary>()
                : folder.Fetch(ids, MessageSummaryItems.UniqueId | MessageSummaryItems.Flags, ct);
            return new { UidValidity = folder.UidValidity, Messages = summaries.Select(s => new {
                Uid = s.UniqueId.Id, IsRead = s.Flags.GetValueOrDefault().HasFlag(MessageFlags.Seen),
                IsStarred = s.Flags.GetValueOrDefault().HasFlag(MessageFlags.Flagged),
                IsDeleted = s.Flags.GetValueOrDefault().HasFlag(MessageFlags.Deleted)
            }).ToArray() };
        });

        /// <summary>SMTP 接受后单独保存已发送副本；按稳定 MessageId 检查，不再次投递 SMTP。</summary>
        public DosResult StoreSent(object param) => Execute(param, (p, ct) =>
        {
            using var message = BuildMessage(p);
            using var client = ConnectImap(p, ct);
            IMailFolder folder = null;
            try { folder = client.GetFolder(SpecialFolder.Sent); } catch (NotSupportedException) { }
            if (folder == null)
                foreach (var ns in client.PersonalNamespaces)
                {
                    folder = client.GetFolders(ns, false, ct).FirstOrDefault(f => FolderKind(f) == "sent");
                    if (folder != null) break;
                }
            if (folder == null) throw new ArgumentException("邮箱没有已发送目录，邮件已投递但未保存远端副本。");
            folder.Open(FolderAccess.ReadWrite, ct);
            var existing = folder.Search(SearchQuery.HeaderContains("Message-Id", message.MessageId), ct);
            UniqueId? saved = existing.Count > 0 ? existing[0] : folder.Append(message, MessageFlags.Seen, ct);
            return new { Stored = true, Folder = folder.FullName, Uid = saved?.Id, UidValidity = folder.UidValidity };
        });

        /// <summary>下载一项 MIME 附件；只有显式附件索引被返回，内容受大小上限保护。</summary>
        public DosResult GetAttachment(object param) => Execute(param, (p, ct) =>
        {
            using var client = ConnectImap(p, ct);
            using var message = ReadMessage(OpenFolder(client, p, false, ct), p, ct);
            var index = Int(p, "AttachmentIndex", 0, 0, 99);
            var attachment = message.Attachments.Skip(index).FirstOrDefault()
                ?? throw new ArgumentException("附件不存在。");
            using var output = new LimitedMemoryStream(MaxAttachmentBytes);
            if (attachment is MimePart part) part.Content.DecodeTo(output, ct);
            else if (attachment is MessagePart nested) nested.Message.WriteTo(output, ct);
            else throw new ArgumentException("不支持的附件格式。");
            return new { FileName = AttachmentName(attachment, index), ContentType = attachment.ContentType.MimeType,
                Size = output.Length, FileByteBase64 = Convert.ToBase64String(output.ToArray()) };
        });

        /// <summary>幂等设置已读/星标；不支持删除全部或 EXPUNGE。</summary>
        public DosResult SetFlags(object param) => Execute(param, (p, ct) =>
        {
            using var client = ConnectImap(p, ct);
            var folder = OpenFolder(client, p, true, ct);
            var uid = MessageUid(p);
            foreach (var pair in new[] { ("IsRead", MessageFlags.Seen), ("IsStarred", MessageFlags.Flagged) })
            {
                if (p[pair.Item1] == null) continue;
                if (Bool(p, pair.Item1)) folder.AddFlags(uid, pair.Item2, true, ct);
                else folder.RemoveFlags(uid, pair.Item2, true, ct);
            }
            return new { Updated = true };
        });

        /// <summary>移动一封邮件；返回目标 UID 映射，不永久清空目录。</summary>
        public DosResult Move(object param) => Execute(param, (p, ct) =>
        {
            using var client = ConnectImap(p, ct);
            var folder = OpenFolder(client, p, true, ct);
            var destination = client.GetFolder(Required(p, "DestinationFolder"), ct);
            var uid = folder.MoveTo(MessageUid(p), destination, ct);
            return new { Moved = true, DestinationFolder = destination.FullName, DestinationUid = uid?.Id };
        });

        /// <summary>
        /// 单次 SMTP 投递。调用方先持久化发送意图并防重；进入 DATA 后网络错误返回 Unknown，禁止盲目重发。
        /// Code=1 只表示 SMTP 接受，不表示收件人已阅读或必然进入收件箱。
        /// </summary>
        public DosResult Send(object param)
        {
            var attempted = false;
            try
            {
                var p = Parse(param);
                using var ct = Deadline(p);
                using var message = BuildMessage(p);
                using var client = ConnectSmtp(p, ct.Token);
                attempted = true;
                client.Send(message, ct.Token);
                return new DosResult(1, new { DeliveryState = "Accepted", MessageId = message.MessageId });
            }
            catch (SmtpCommandException ex)
            {
                return new DosResult(0, new { DeliveryState = "Rejected", ErrorCode = ex.StatusCode.ToString() }, "SMTP 服务器拒绝投递，请检查收件人与账号设置。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, new { DeliveryState = attempted ? "Unknown" : "Failed", ErrorCode = ErrorCode(ex) },
                    attempted ? "连接中断，邮件投递结果未知。请先在已发送目录核对，不能直接重复发送。" : SafeError(ex));
            }
        }

        /// <summary>供协议级回归与可信 .NET 调用复用的 MIME 构建器；不连接网络。</summary>
        public static MimeMessage BuildMessage(JObject p)
        {
            var message = new MimeMessage();
            message.From.Add(MailboxAddress.Parse(Required(p, "UserName")));
            AddAddresses(message.To, p["To"]);
            AddAddresses(message.Cc, p["Cc"]);
            AddAddresses(message.Bcc, p["Bcc"]);
            if (message.To.Count + message.Cc.Count + message.Bcc.Count == 0) throw new ArgumentException("至少填写一位收件人。");
            if (message.To.Count + message.Cc.Count + message.Bcc.Count > 100) throw new ArgumentException("单封邮件最多 100 位收件人。");
            message.Subject = Text(p, "Subject");
            if (message.Subject.Length > 998) throw new ArgumentException("邮件主题过长。");
            var id = Required(p, "MessageId");
            if (id.Length > 240 || id.IndexOfAny(new[] { '\r', '\n', '<', '>', ' ' }) >= 0 || !id.Contains("@"))
                throw new ArgumentException("MessageId 格式无效。");
            message.MessageId = id;
            var reply = Text(p, "InReplyTo");
            if (!string.IsNullOrWhiteSpace(reply)) message.InReplyTo = reply;
            var body = new BodyBuilder { TextBody = Text(p, "TextBody"), HtmlBody = NullText(p, "HtmlBody") };
            if ((body.TextBody?.Length ?? 0) + (body.HtmlBody?.Length ?? 0) > 2 * 1024 * 1024) throw new ArgumentException("邮件正文过大。");
            var attachments = p["Attachments"] as JArray ?? new JArray();
            if (attachments.Count > 10) throw new ArgumentException("单封邮件最多 10 个附件。");
            long total = 0;
            foreach (var item in attachments.OfType<JObject>())
            {
                var base64 = Required(item, "FileByteBase64");
                if (base64.Length > MaxAttachmentBytes * 4L / 3 + 4) throw new ArgumentException("附件超过大小上限。");
                var bytes = Convert.FromBase64String(base64);
                total += bytes.Length;
                if (total > MaxAttachmentBytes) throw new ArgumentException("附件合计不能超过 10MB。");
                body.Attachments.Add(SafeFileName(Required(item, "FileName")), bytes,
                    ContentType.Parse(Text(item, "ContentType", "application/octet-stream")));
            }
            message.Body = body.ToMessageBody();
            return message;
        }

        private static DosResult Execute(object input, Func<JObject, CancellationToken, object> run)
        {
            try { var p = Parse(input); using var deadline = Deadline(p); return new DosResult(1, run(p, deadline.Token)); }
            catch (Exception ex) { return new DosResult(0, new { ErrorCode = ErrorCode(ex) }, SafeError(ex)); }
        }

        private static ImapClient ConnectImap(JObject p, CancellationToken ct)
        {
            var client = new ImapClient { Timeout = 30000 };
            try
            {
                client.Connect(Host(p), Int(p, "Port", 993, 1, 65535), Security(p), ct);
                client.Authenticate(Required(p, "UserName"), Password(p), ct);
                // 网易等服务需要 IMAP ID，身份固定为本产品，不接受用户覆写协议命令。
                if (client.Capabilities.HasFlag(ImapCapabilities.Id))
                    client.Identify(new ImapImplementation { Name = "Microi Email", Version = "1.0.0", Vendor = "Microi" }, ct);
                return client;
            }
            catch { client.Dispose(); throw; }
        }

        private static MailKit.Net.Smtp.SmtpClient ConnectSmtp(JObject p, CancellationToken ct)
        {
            var client = new MailKit.Net.Smtp.SmtpClient { Timeout = 30000 };
            try
            {
                client.Connect(Host(p), Int(p, "Port", 465, 1, 65535), Security(p), ct);
                client.Authenticate(Required(p, "UserName"), Password(p), ct);
                return client;
            }
            catch { client.Dispose(); throw; }
        }

        private static IMailFolder OpenFolder(ImapClient client, JObject p, bool write, CancellationToken ct)
        {
            var folder = client.GetFolder(Text(p, "Folder", "INBOX"), ct);
            folder.Open(write ? FolderAccess.ReadWrite : FolderAccess.ReadOnly, ct);
            var expected = UInt(p, "UidValidity");
            if (expected > 0 && expected != folder.UidValidity && p["AfterUid"] == null)
                throw new ArgumentException("邮箱 UIDVALIDITY 已变化，请先重新同步目录。");
            return folder;
        }

        private static MimeMessage ReadMessage(IMailFolder folder, JObject p, CancellationToken ct)
        {
            var uid = MessageUid(p);
            var meta = folder.Fetch(new[] { uid }, MessageSummaryItems.Size, ct).FirstOrDefault()
                ?? throw new ArgumentException("邮件已不存在，请重新同步。");
            if (!meta.Size.HasValue || meta.Size.Value > MaxMessageBytes) throw new ArgumentException("邮件超过 25MB 安全读取上限。");
            using var stream = folder.GetStream(uid, 0, MaxMessageBytes + 1, ct);
            using var buffer = new LimitedMemoryStream(MaxMessageBytes);
            stream.CopyTo(buffer);
            buffer.Position = 0;
            return MimeMessage.Load(buffer, ct);
        }

        private static string Password(JObject p)
        {
            var credential = Required(p, "Credential");
            if (!credential.StartsWith(CredentialPrefix, StringComparison.Ordinal))
                throw new ArgumentException("邮箱凭据尚未加密，请通过账号表单重新保存授权码。");
            return TenantSystemSettingsSecurity.UnprotectSecret(Tenant(), CredentialPurpose, credential.Substring(CredentialPrefix.Length));
        }

        private static string Tenant() => V8TenantContext.Current?.OsClient is string tenant && !string.IsNullOrWhiteSpace(tenant)
            ? tenant : throw new InvalidOperationException("邮件能力必须在可信租户上下文中调用。");
        private static JObject Parse(object value) => value is JObject obj ? obj : JObject.Parse(JsonConvert.SerializeObject(value));
        private static string Text(JObject p, string key, string fallback = "") => p[key]?.Type == JTokenType.Null ? fallback : p[key]?.ToString() ?? fallback;
        private static string NullText(JObject p, string key) => string.IsNullOrWhiteSpace(Text(p, key)) ? null : Text(p, key);
        private static string Required(JObject p, string key) => !string.IsNullOrWhiteSpace(Text(p, key)) ? Text(p, key).Trim() : throw new ArgumentException(key + " 不能为空。");
        private static int Int(JObject p, string key, int fallback, int min, int max) => p[key] == null ? fallback : int.TryParse(Text(p, key), out var value) && value >= min && value <= max ? value : throw new ArgumentException(key + " 超出有效范围。");
        private static uint UInt(JObject p, string key) => p[key] == null ? 0 : uint.TryParse(Text(p, key), out var value) ? value : throw new ArgumentException(key + " 必须是非负整数。");
        private static bool Bool(JObject p, string key) => Text(p, key).Equals("true", StringComparison.OrdinalIgnoreCase) || Text(p, key) == "1";
        private static UniqueId MessageUid(JObject p) => UInt(p, "Uid") > 0 ? new UniqueId(UInt(p, "Uid")) : throw new ArgumentException("Uid 必须大于 0。");
        private static CancellationTokenSource Deadline(JObject p) => new CancellationTokenSource(TimeSpan.FromSeconds(Int(p, "Timeout", 40, 1, 60)));
        private static string Host(JObject p)
        {
            var host = Required(p, "Host");
            if (host.Length > 253 || Uri.CheckHostName(host) == UriHostNameType.Unknown) throw new ArgumentException("邮件服务器必须是有效主机名或 IP。");
            return host;
        }
        private static SecureSocketOptions Security(JObject p)
        {
            switch (Text(p, "Security", "SslOnConnect").ToLowerInvariant())
            {
                case "sslonconnect": return SecureSocketOptions.SslOnConnect;
                case "starttls": return SecureSocketOptions.StartTls;
                default: throw new ArgumentException("邮件连接必须使用 SSL/TLS 或 STARTTLS。");
            }
        }
        private static void AddAddresses(InternetAddressList target, JToken value)
        {
            if (value == null) return;
            if (value is JArray array) { foreach (var item in array) target.AddRange(InternetAddressList.Parse(item.ToString())); }
            else if (!string.IsNullOrWhiteSpace(value.ToString())) target.AddRange(InternetAddressList.Parse(value.ToString().Replace(';', ',')));
        }
        private static string BoundText(string value) => value?.Length > 2 * 1024 * 1024 ? throw new ArgumentException("邮件正文超过显示上限。"): value ?? "";
        private static string FolderKind(IMailFolder folder) => folder.Attributes.HasFlag(FolderAttributes.Inbox) || folder.FullName.Equals("INBOX", StringComparison.OrdinalIgnoreCase) ? "inbox"
            : folder.Attributes.HasFlag(FolderAttributes.Sent) ? "sent" : folder.Attributes.HasFlag(FolderAttributes.Drafts) ? "drafts"
            : folder.Attributes.HasFlag(FolderAttributes.Trash) ? "trash" : folder.Attributes.HasFlag(FolderAttributes.Junk) ? "junk"
            : folder.Attributes.HasFlag(FolderAttributes.Archive) ? "archive" : "folder";
        private static string AttachmentName(MimeEntity attachment, int index) => SafeFileName(attachment.ContentDisposition?.FileName ?? attachment.ContentType.Name ?? "attachment-" + (index + 1) + (attachment is MessagePart ? ".eml" : ".bin"));
        private static string SafeFileName(string name) => Path.GetFileName(name.Replace('\\', '/')).Replace("\r", "").Replace("\n", "");
        private static string ErrorCode(Exception ex) => ex is MailKit.Security.AuthenticationException ? "AuthenticationFailed" : ex is OperationCanceledException ? "Timeout" : ex is ArgumentException || ex is FormatException ? "InvalidInput" : ex.GetType().Name;
        private static string SafeError(Exception ex) => ex is MailKit.Security.AuthenticationException ? "邮箱登录失败，请检查授权码并确认已开启 IMAP/SMTP。"
            : ex is OperationCanceledException ? "邮箱服务器响应超时，请稍后重试。"
            : ex is ArgumentException ? ex.Message : "邮箱协议操作失败（" + ErrorCode(ex) + "），请检查服务器、网络与 TLS 设置。";

        private sealed class LimitedMemoryStream : MemoryStream
        {
            private readonly int _limit;
            internal LimitedMemoryStream(int limit) => _limit = limit;
            public override void Write(byte[] buffer, int offset, int count)
            { if (Length + count > _limit) throw new ArgumentException("邮件或附件超过安全大小上限。"); base.Write(buffer, offset, count); }
            public override void Write(ReadOnlySpan<byte> buffer)
            { if (Length + buffer.Length > _limit) throw new ArgumentException("邮件或附件超过安全大小上限。"); base.Write(buffer); }
        }
    }
}
