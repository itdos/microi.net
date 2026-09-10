import { z } from 'zod';
const configEngine = 'platform-message-notification-config', reminderEngine = 'platform-reminder-runtime';
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,99}$/);
const requestId = z.string().regex(/^[A-Za-z0-9-]{16,80}$/);
const channels = z.enum(['平台内部', '邮件', '短信', '微信公众号模板消息']);
const businessRule = z.object({
    Key: identifier.max(50), Title: z.string().min(1).max(50), Type: z.array(channels).min(1).max(4), IsEnable: z.boolean(),
    Receivers: z.array(identifier).max(200).default([]), ReceiversRoles: z.array(identifier).max(50).default([]),
    WxTplMsgId: z.string().max(100).optional(), ChannelApiEngineMap: z.object({ '邮件': identifier.optional(), '短信': identifier.optional() }).strict().optional()
}).strict();
const reminderRule = z.object({
    Title: z.string().min(1).max(200), Content: z.string().min(1).max(8000),
    ScopeType: z.enum(['Users', 'Tenants', 'Editions']), AccountScope: z.enum(['AllAccounts', 'SuperAdmins']).optional().describe('本租户 Users 默认 AllAccounts；跨租户 Tenants 与版本 Editions 默认 SuperAdmins。'),
    AllTargets: z.boolean().default(false), TargetKeys: z.array(identifier).max(200).default([]),
    DisplayMode: z.enum(['Once', 'EveryEntry', 'AfterServerRestart']).default('Once'),
    ReminderType: z.enum(['Announcement', 'Scheduled', 'Trial']).default('Announcement'),
    Icon: z.enum(['bell', 'clock', 'warning', 'maintenance', 'info', 'gift']).default('bell'),
    Severity: z.enum(['info', 'success', 'warning', 'error']).default('info'), Priority: z.number().int().min(0).max(100).default(0),
    StartsAt: z.string().datetime({ offset: true }), EndsAt: z.string().datetime({ offset: true }),
    RepeatMode: z.enum(['None', 'Daily', 'Weekly', 'Interval']).default('None'), IntervalMinutes: z.number().int().min(0).max(525600).optional(),
    TrialExpiresAt: z.string().datetime({ offset: true }).optional(), AdvanceMinutes: z.number().int().min(0).max(525600).optional(),
    LinkUrl: z.string().max(500).optional(), LinkText: z.string().max(30).optional()
}).strict();
function output(value, isError = false) { return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], isError }; }
function unwrap(response) {
    const envelope = response.Data;
    return envelope?.Result && typeof envelope.Result === 'object' ? envelope.Result : response;
}
async function execute(client, key, params) { return unwrap(await client.executeEngine(key, params)); }
function failed(message) { return output({ Code: 0, Msg: message }, true); }
function uncertain() { return failed('未取得确定回执。请先按原 Id / Key 查询已保存的数据；提醒保存和发布重试必须复用原 requestId，不能重新创建同一通知。'); }
function preview(expected, operation, target) { return output({ dryRun: true, operation, target, confirmationRequired: expected, message: '此调用没有写入或发布；核对当前连接、内容与范围后，使用精确确认串执行。' }); }
export function registerMessageNotificationTools(server, client, context) {
    server.tool('microi_get_notification_context', `读取当前租户 ${context.osClient} 的统一消息通知中心：能力、原 mic_msgset 业务配置、系统公告、接收对象、微信模板及分页投递记录。仅查询当前租户角色；Tenants/Editions 使用 AllAccounts 或 SuperAdmins，绝不读取其它平台的角色列表。本工具不会发送消息。`, {
        action: z.enum(['Capabilities', 'BusinessRules', 'BusinessRule', 'Reminders', 'Reminder', 'Recipients', 'Templates', 'Adapters', 'Logs', 'History']).default('Capabilities'),
        id: identifier.optional(), keyword: z.string().max(100).optional(), recipientScope: z.enum(['Users', 'Roles', 'Tenants', 'Editions']).optional(),
        configId: identifier.optional(), channelType: channels.optional(), pageIndex: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).max(100).optional()
    }, async (input) => {
        try {
            if (['BusinessRule', 'Reminder', 'History'].includes(input.action) && !input.id)
                return failed('此查询需要明确的 id。');
            if (input.action === 'Capabilities') {
                const reminders = await execute(client, reminderEngine, { Action: 'Capabilities' });
                if (reminders.Code !== 1)
                    return output(reminders, true);
                const configuration = await execute(client, configEngine, { Action: 'Capabilities' });
                if (configuration.Code !== 1)
                    return output(configuration, true);
                return output({ Code: 1, Data: { Reminders: reminders.Data, BusinessNotifications: configuration.Data, ApplicationKey: 'app.microi.message-notification', Menu: '系统引擎 → 消息通知', RequiredReceiverProtocol: 2 } });
            }
            let key = configEngine, action = input.action;
            if (input.action === 'BusinessRules')
                action = 'List';
            if (input.action === 'BusinessRule')
                action = 'Get';
            if (input.action === 'Reminders') {
                key = reminderEngine;
                action = 'List';
            }
            if (input.action === 'Reminder') {
                key = reminderEngine;
                action = 'Get';
            }
            if (input.action === 'History')
                key = reminderEngine;
            // 当前租户帐号/角色走同一有界查询；跨租户和产品版本仅获取固定目标目录。
            if (input.action === 'Recipients' && ['Tenants', 'Editions'].includes(input.recipientScope || ''))
                key = reminderEngine;
            const result = await execute(client, key, { Action: action, Id: input.id, Keyword: input.keyword, ScopeType: input.recipientScope === 'Roles' ? undefined : input.recipientScope || 'Users', Kind: input.recipientScope === 'Roles' ? 'Roles' : 'Users', ConfigId: input.configId, ChannelType: input.channelType, PageIndex: input.pageIndex, PageSize: input.pageSize });
            return output(result, result.Code !== 1);
        }
        catch {
            return uncertain();
        }
    });
    server.tool('microi_configure_business_notification', '通过 Managed 配置接口引擎校验或保存多渠道业务通知，继续存入原 mic_msgset 表，保留 Key、用户/角色、模板及通道适配器契约。ChannelApiEngineMap 只填写接口 Key，不得放入密钥。Validate 不写入、不发送；Save 的 confirmExecution 为 Save:<id 或 Key>，编辑还需 id 和查询得到的 expectedRevision。保存成功自动按 Id 回读。本工具不会调用 msg_event 或向外发送消息。', {
        action: z.enum(['Validate', 'Save']).default('Validate'), id: identifier.optional(), expectedRevision: z.number().int().min(0).optional(), rule: businessRule, confirmExecution: z.string().optional()
    }, async (input) => {
        const target = input.id || input.rule.Key, expected = `Save:${target}`;
        if (input.id && input.action === 'Save' && input.expectedRevision === undefined)
            return failed('编辑配置必须提供查询得到的 expectedRevision。');
        if (input.action === 'Save' && input.confirmExecution !== expected)
            return preview(expected, input.action, target);
        try {
            if (input.action === 'Save')
                await client.writeAuditLog('microi_configure_business_notification', target, JSON.stringify({ action: 'Save' }));
            const result = await execute(client, configEngine, { Action: input.action, Id: input.id, ExpectedRevision: input.expectedRevision, Rule: input.rule });
            if (result.Code !== 1 || input.action !== 'Save')
                return output(result, result.Code !== 1);
            const saved = result.Data;
            if (!saved?.Rule?.Id)
                return failed('保存响应缺少记录 Id，请按原 Key 查询回读。');
            const readback = await execute(client, configEngine, { Action: 'Get', Id: saved.Rule.Id });
            return output({ Code: readback.Code, Mutation: result, Readback: readback }, readback.Code !== 1);
        }
        catch {
            return uncertain();
        }
    });
    server.tool('microi_manage_system_reminder', '在统一消息通知应用中校验、保存、发布或撤回系统公告。Save 只保存草稿；只有通过官方 License 身份判断的服务可选择 Editions，主租户可选择 Tenants。AccountScope 使用 SuperAdmins 或 AllAccounts，由接收服务按本地可信身份裁剪。AfterServerRestart 要求接收协议 2，每个帐号在每次 API 启动批次中领取一次。只有用户授权对应内容和接收范围后才发布。结果不确定时复用原 requestId；confirmExecution 为 <action>:<id 或 requestId>。', {
        action: z.enum(['Validate', 'Save', 'Publish', 'Withdraw']).default('Validate'), id: z.string().regex(/^[a-f0-9]{32}$/).optional(), expectedRevision: z.number().int().min(1).optional(), requestId: requestId.optional(), rule: reminderRule.optional(), confirmExecution: z.string().optional()
    }, async (input) => {
        if (['Validate', 'Save'].includes(input.action) && !input.rule)
            return failed('校验和保存提醒必须提供 rule。');
        if (['Publish', 'Withdraw'].includes(input.action) && (!input.id || input.expectedRevision === undefined))
            return failed('发布或撤回必须提供已回读的 id 和 expectedRevision。');
        if (input.action === 'Save' && input.id && input.expectedRevision === undefined)
            return failed('编辑提醒必须提供 expectedRevision。');
        if (['Save', 'Publish'].includes(input.action) && !input.requestId)
            return failed('保存和发布必须提供稳定 requestId，并在重试时复用。');
        const target = input.id || input.requestId || 'new', expected = `${input.action}:${target}`;
        if (input.action !== 'Validate' && input.confirmExecution !== expected)
            return preview(expected, input.action, target);
        try {
            if (input.action !== 'Validate')
                await client.writeAuditLog('microi_manage_system_reminder', target, JSON.stringify({ action: input.action, requestId: input.requestId, expectedRevision: input.expectedRevision }));
            // 本租户已显式选定的普通帐号应可收件；只有跨租户/产品版本默认收紧到超级管理员。
            const rule = input.rule ? { ...input.rule, AccountScope: input.rule.AccountScope || (input.rule.ScopeType === 'Users' ? 'AllAccounts' : 'SuperAdmins') } : undefined;
            const result = await execute(client, reminderEngine, { Action: input.action, Id: input.id, ExpectedRevision: input.expectedRevision, RequestId: input.requestId, Rule: rule });
            if (result.Code !== 1 || input.action === 'Validate')
                return output(result, result.Code !== 1);
            const resultData = result.Data, id = input.id || resultData?.Id;
            if (!id)
                return failed('操作响应缺少规则 Id，请按原请求查询回读。');
            const readback = await execute(client, reminderEngine, { Action: 'Get', Id: id });
            return output({ Code: readback.Code, Mutation: result, Readback: readback }, readback.Code !== 1);
        }
        catch {
            return uncertain();
        }
    });
}
//# sourceMappingURL=message-notification-tools.js.map