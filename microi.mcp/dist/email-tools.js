import { z } from 'zod';
function result(response) {
    // V8Debug 执行回执与普通 ApiEngine 回执统一还原为业务结果。
    const envelope = response.Data;
    const business = envelope?.Result && typeof envelope.Result === 'object'
        ? envelope.Result : response;
    return { content: [{ type: 'text', text: JSON.stringify(business, null, 2) }], isError: business.Code !== 1 };
}
async function call(client, action, input) {
    try {
        return result(await client.executeEngine('mci-email', { ...input, Action: action }));
    }
    catch {
        return { content: [{ type: 'text', text: '邮箱请求未得到确定回执。请检查连接；发信只能用同一草稿 Id 查询或重试，不能创建新草稿重复投递。' }], isError: true };
    }
}
function confirmation(actual, expected) {
    return actual === expected ? null : { content: [{ type: 'text', text: JSON.stringify({ dryRun: true, confirmationRequired: expected, engine: 'mci-email', message: '请先核对账号或草稿内容，再执行该操作；预检不会写入数据或发送邮件。' }) }] };
}
const attachment = z.object({ FileName: z.string().min(1).max(255), ContentType: z.string().max(150).optional(), FileByteBase64: z.string().max(14 * 1024 * 1024) });
const draft = z.object({ To: z.string().max(20000).default(''), Cc: z.string().max(20000).optional(), Bcc: z.string().max(20000).optional(), Subject: z.string().max(998).default(''), TextBody: z.string().max(2 * 1024 * 1024).default(''), HtmlBody: z.string().max(2 * 1024 * 1024).optional(), InReplyTo: z.string().max(500).optional(), Attachments: z.array(attachment).max(10).optional() });
const account = z.object({
    Id: z.string().max(36).optional(), Mingcheng: z.string().max(200).optional(), Key: z.string().max(50).optional(), SystemEmail: z.string().email().max(254),
    SystemEmailPwd: z.string().max(4096).optional().describe('客户端授权码。只传给可信后端加密；修改时留空保留。禁止放入日志、源码或公开示例。'),
    Provider: z.enum(['QQ', '163', '126', 'Exmail', 'Custom']).optional(), ImapServer: z.string().max(200).optional(), ImapPort: z.number().int().min(1).max(65535).optional(),
    ImapSecurity: z.enum(['SslOnConnect', 'StartTls']).optional(), SmtpServer: z.string().max(200).optional(), SmtpPort: z.number().int().min(1).max(65535).optional(),
    SmtpSecurity: z.enum(['SslOnConnect', 'StartTls']).optional(), IsEnabled: z.number().int().min(0).max(1).optional(), AutoSync: z.number().int().min(0).max(1).optional(), SyncInterval: z.number().int().min(1).max(1440).optional()
});
export function registerEmailTools(server, client, context) {
    server.tool('microi_email_query', `Read the current user's email workspace through ApiEngine mci-email on tenant ${context.osClient}. Supports accounts/folders, paginated mail, body, attachment, connection test and durable sync status. Requires the installed email app and platform V8.Email. Account credentials are never returned.`, {
        action: z.enum(['Overview', 'Messages', 'Read', 'Attachment', 'TestConnection', 'SyncStatus']).default('Overview'),
        accountId: z.string().max(36).optional(), id: z.string().max(36).optional(), taskId: z.string().max(50).optional(),
        folderId: z.string().max(36).optional(), folderKind: z.enum(['inbox', 'sent', 'drafts', 'starred', 'outbox', 'trash', 'junk', 'archive', 'folder']).optional(),
        keyword: z.string().max(100).optional(), unreadOnly: z.boolean().optional(), pageIndex: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(100).optional(),
        attachmentIndex: z.number().int().min(0).max(99).optional()
    }, async (input) => {
        if (['Read', 'Attachment'].includes(input.action) && !input.id)
            return { content: [{ type: 'text', text: '该查询需要邮件 id。' }], isError: true };
        if (input.action === 'TestConnection' && !input.accountId)
            return { content: [{ type: 'text', text: '检测连接需要 accountId。' }], isError: true };
        if (input.action === 'SyncStatus' && !input.taskId)
            return { content: [{ type: 'text', text: '查询同步状态需要 taskId。' }], isError: true };
        return call(client, input.action, { AccountId: input.accountId, Id: input.id, TaskId: input.taskId, FolderId: input.folderId, FolderKind: input.folderKind, Keyword: input.keyword, UnreadOnly: input.unreadOnly, PageIndex: input.pageIndex, PageSize: input.pageSize, AttachmentIndex: input.attachmentIndex });
    });
    server.tool('microi_email_manage', 'Manage an owned mailbox or draft through ApiEngine mci-email. SaveAccount reuses mic_email_server and its form events; credentials remain backend-encrypted. Sync queues durable work; reuse requestId. Flags and Move affect the remote mailbox. This tool never sends SMTP mail. Omit confirmExecution for a mutation-free preview.', {
        action: z.enum(['SaveAccount', 'SaveDraft', 'Preferences', 'Sync', 'Flags', 'Move']), accountId: z.string().max(36).optional(), id: z.string().max(36).optional(),
        account: account.optional(), draft: draft.optional(), autoSync: z.boolean().optional(), requestId: z.string().regex(/^[A-Za-z0-9_-]{12,100}$/).optional(),
        isRead: z.boolean().optional(), isStarred: z.boolean().optional(), destinationKind: z.enum(['inbox', 'trash', 'junk', 'archive']).optional(),
        confirmExecution: z.string().optional().describe('Exact action:target, target is id, account.Id, accountId, or new (in this order). E.g. SaveAccount:new or Sync:<accountId>.')
    }, async (input) => {
        const target = input.id || input.account?.Id || input.accountId || 'new';
        const preview = confirmation(input.confirmExecution, input.action + ':' + target);
        if (preview)
            return preview;
        if (input.action === 'SaveAccount' && !input.account)
            return { content: [{ type: 'text', text: 'SaveAccount 需要 account。' }], isError: true };
        if (input.action === 'SaveDraft' && (!input.accountId || !input.draft))
            return { content: [{ type: 'text', text: 'SaveDraft 需要 accountId 和 draft。' }], isError: true };
        if (['Sync', 'Preferences'].includes(input.action) && !input.accountId)
            return { content: [{ type: 'text', text: '该操作需要 accountId。' }], isError: true };
        if (input.action === 'Sync' && !input.requestId)
            return { content: [{ type: 'text', text: '同步需要稳定 requestId。' }], isError: true };
        if (['Flags', 'Move'].includes(input.action) && !input.id)
            return { content: [{ type: 'text', text: '该操作需要邮件 id。' }], isError: true };
        // 审计只记录动作与内部标识，不记录授权码、邮件正文、地址或附件。
        try {
            await client.writeAuditLog('microi_email_manage', target, JSON.stringify({ action: input.action }));
        }
        catch { }
        return call(client, input.action, { AccountId: input.accountId, Id: input.id, Account: input.account, Draft: input.draft, AutoSync: input.autoSync, RequestId: input.requestId, IsRead: input.isRead, IsStarred: input.isStarred, DestinationKind: input.destinationKind });
    });
    server.tool('microi_email_send', 'Send one previously saved email draft through ApiEngine mci-email. First read the draft and obtain the user’s authorization for its recipients and content. confirmExecution must exactly match draftId. Reuse the same draftId after an uncertain response: Sent is SMTP acceptance; Unknown must be checked in Sent folders before any new send intention.', {
        draftId: z.string().min(1).max(36), confirmExecution: z.string().optional().describe('Must exactly equal the reviewed draftId; omitted means preview only.')
    }, async (input) => {
        const preview = confirmation(input.confirmExecution, input.draftId);
        if (preview)
            return preview;
        try {
            await client.writeAuditLog('microi_email_send', input.draftId, JSON.stringify({ action: 'Send' }));
        }
        catch { }
        return call(client, 'Send', { Id: input.draftId });
    });
}
//# sourceMappingURL=email-tools.js.map