/*
 * V8 ApiEngine
 * ApiEngineKey: mci-wechat-content-callback-extension
 * Version: v1.0.0
 * Ownership: Tenant / CreateIfMissing
 *
 * 此接口首次安装后归当前租户维护，应用更新永不覆盖。
 */

// 可在这里增加业务表写入、系统日志、MQ/outbox 等逻辑。
// 对外部通知、积分、库存等副作用，必须以 V8.Param.EventId 建唯一约束或幂等记录。
// 示例：
// V8.Method.AddSysLog({
//   Type: 'ContentSecurity',
//   Title: 'TenantWeChatContentCallback',
//   Content: JSON.stringify(V8.Param),
//   Level: 1
// });

return { Code: 1, Data: { EventId: V8.Param.EventId } };
