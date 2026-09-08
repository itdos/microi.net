import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeOfficialApiEnginePolicies } from './official-api-engine-notice.mjs';
import { normalizeOfficialPackageExecutionLimits } from './resource-sync-core.mjs';
import { compareSemanticVersions } from './application-store-replica-sync.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const baseRoot = path.join(root, '.resource-sync-base');
const releaseTime = '2026-08-25 16:00:00';

export const aiSubscriptionTableNames = Object.freeze([
  'mic_sub_provider',
  'mic_sub_model',
  'mic_sub_plan',
  'mic_sub_order',
  'mic_sub_user',
  'mic_sub_usage',
  'mic_sub_alipay_config',
  'mic_sub_apikey',
  'mic_sub_apikey_binduser',
]);
export const aiRelayUsageTableNames = Object.freeze([
  'mci_ai_token_account',
  'mci_ai_token_log',
]);
export const aiRuntimeTableNames = Object.freeze([
  ...aiSubscriptionTableNames,
  ...aiRelayUsageTableNames,
]);
export const aiRemovedDuplicateTableNames = Object.freeze([
  'mci_ai_app_version',
  'mci_ai_app_file',
  'sys_microistore',
]);

export const packageDefinitions = Object.freeze([
  Object.freeze({
    file: 'app.microi.sys_user.json',
    name: '系统账号',
    version: 'v7.6.5',
    bootstrapUrl: 'https://static.itdos.com/itdos/microi-store/packages/01kmfcf8yg0g580n111sbemdcv/202608/app_microi_sys_user-v6_2_9-d1ab1bb18468b39c.json',
    bootstrapSha256: 'd1ab1bb18468b39cde4cd9987acb226d6f32092025c729fa9f8aa2e5032f3e92',
    bootstrapSize: 255947,
    history: '2026-09-03 v7.6.5 新增隐藏字段 HomeUsageStats 与 Managed 接口 platform-home-overview；访问记录只保存在当前账号，返回结果按实时菜单权限过滤，不采集路由参数或业务页面数据。',
    changeLogTitle: '个人首页常用应用与趋势',
    changeType: 'Feature',
    changeLogContent: '新增隐藏字段 HomeUsageStats 与 Managed 接口 platform-home-overview；访问记录只保存在当前账号，返回结果按实时菜单权限过滤，不采集路由参数或业务页面数据。',
    releaseTime: '2026-09-03 18:00:00',
    capabilities: [
      'ApiEngine:platform-user-update-preferences@v1.1.0',
      'ApiEngine:platform-user-update-profile@v1.0.0',
      'ApiEngine:platform-sys-user-admin@v1.0.2',
      'ApiEngine:platform-user-custom-hook@v1.0.0',
      'V8.Method.PrepareCurrentUserProfileUpdate',
      'V8.Method.ManageSysUserAdmin',
      'ApiEngine:platform-user-access-key@v1.0.0',
      'V8.Method.ManageUserAccessKey',
      'ServerField:sys_apiengine.ApiRoutes',
      'ServerField:sys_user.HomeUsageStats',
      'ApiEngine:platform-home-overview@v1.0.0',
    ],
    exactEngineKeys: [
      'platform-user-update-preferences',
      'user-module-table-preference',
      'sys-user-security-action',
      'platform-user-update-profile',
      'platform-sys-user-admin',
      'platform-user-custom-hook',
      'platform-user-access-key',
      'platform-home-overview',
    ],
    engines: [
      { key: 'platform-user-update-preferences', name: '保存当前用户界面偏好', source: 'platform-user-update-preferences.js', id: '01M0M5KNM0N2GH5T0CZS3JV4DV', version: 'v1.1.0', enableLog: 0 },
      { key: 'platform-user-update-profile', name: '更新当前用户资料', source: 'platform-user-update-profile.js', id: '019d2a01-9d63-7f91-8c02-000000000001', version: 'v1.0.0', enableLog: 1 },
      { key: 'platform-sys-user-admin', name: '系统账号管理', source: 'platform-sys-user-admin.js', id: '019d2a01-9d63-7f91-8c02-000000000009', version: 'v1.0.2', enableLog: 1 },
      { key: 'platform-user-custom-hook', name: '系统账号个性化扩展', source: 'platform-user-custom-hook.js', id: '019d2a01-9d63-7f91-8c02-000000000002', version: 'v1.0.0', enableLog: 1, stopHttp: 1, ownership: 'Tenant', upgradePolicy: 'CreateIfMissing' },
      { key: 'platform-user-access-key', name: '用户访问密钥可信管理', source: 'platform-user-access-key.js', id: '019d35f0-7b04-7b91-9801-000000000001', version: 'v1.0.0', allowAnonymous: 1, apiRoutes: '/api/SysUserAccessKey/Create;/api/SysUserAccessKey/List;/api/SysUserAccessKey/Revoke;/api/SysUserAccessKey/Exchange' },
      { key: 'platform-home-overview', name: '个人首页概览与常用应用', source: 'platform-home-overview.js', id: '019d3af0-9003-7b91-9801-000000000001', version: 'v1.0.0', enableLog: 0, history: '2026-09-03 v1.0.0 按当前用户菜单权限统计首页常用应用与近 7 日访问趋势。' },
    ],
  }),
  Object.freeze({
    file: 'app.microi.sys-config.json',
    name: '系统设置',
    version: 'v6.3.12',
    bootstrapUrl: 'https://static.itdos.com/itdos/microi-store/packages/01kkdss2vvm84wx8rtrhfqpx9q/202608/app_microi_sys-config-v6_3_7-6f57fa6d6cef4e90.json',
    bootstrapSha256: '6f57fa6d6cef4e9026e34645ed14e055a6b12b16cad439f057138b1f021b02fd',
    bootstrapSize: 347390,
    history: '2026-09-02 v6.3.12 将 WebOS 菜单图标升级为 320×320 真透明 WebP，按系统、AI、表单、模块等语义分类交付，单图约 23–39KB；菜单默认优先显示图片并保留内置离线兜底，修复图标未居中、暗色底板和主题切换失真。',
    changeLogTitle: 'WebOS iOS 拟物透明图标升级',
    changeType: 'Optimize',
    changeLogContent: '将 WebOS 菜单图标升级为 320×320 真透明 WebP，按系统、AI、表单、模块等语义分类交付，单图约 23–39KB；菜单默认优先显示图片并保留内置离线兜底，修复图标未居中、暗色底板和主题切换失真。',
    releaseTime: '2026-09-02 12:05:00',
    capabilities: [
      'ApiEngine:platform-tenant-system-settings@v1.0.0',
      'ApiEngine:platform-system-settings-custom-hook@v1.0.0',
      'V8.Method.RequireTenantSystemSettingsAdmin',
      'ServerField:sys_apiengine.ApiRoutes',
      'V8.Method.RunPlatformApiRuntime:TenantSystemSettings',
    ],
    engines: [
      { key: 'platform-tenant-system-settings', name: '租户系统设置管理', source: 'platform-tenant-system-settings.js', id: '019d2a01-9d63-7f91-8c02-000000000003', version: 'v1.0.0', enableLog: 1, allowAnonymous: 1 },
      { key: 'platform-system-settings-custom-hook', name: '系统设置个性化扩展', source: 'platform-system-settings-custom-hook.js', id: '019d2a01-9d63-7f91-8c02-000000000004', version: 'v1.0.0', enableLog: 1, stopHttp: 1, ownership: 'Tenant', upgradePolicy: 'CreateIfMissing' },
    ],
  }),
  Object.freeze({
    file: 'app.microi.message-notification.json',
    name: '消息通知',
    version: 'v1.0.15',
    changeType: 'Fix',
    bootstrapUrl: 'https://static.itdos.com/itdos/microi-store/packages/01kz2t8tmetfx9m815r2rxttbz/202608/app_microi_message-notification-v1_0_5-db93ddd22b5fc2fb.json',
    bootstrapSha256: 'db93ddd22b5fc2fbf21b451e50b9fd1ce78cea970a4bea0d509f4386b99b2301',
    bootstrapSize: 250807,
    history: '2026-09-02 v1.0.15 将 WebOS 菜单图标升级为 320×320 真透明 WebP，按系统、AI、表单、模块等语义分类交付，单图约 23–39KB；菜单默认优先显示图片并保留内置离线兜底，修复图标未居中、暗色底板和主题切换失真。',
    changeLogTitle: 'WebOS iOS 拟物透明图标升级',
    changeType: 'Optimize',
    changeLogContent: '将 WebOS 菜单图标升级为 320×320 真透明 WebP，按系统、AI、表单、模块等语义分类交付，单图约 23–39KB；菜单默认优先显示图片并保留内置离线兜底，修复图标未居中、暗色底板和主题切换失真。',
    releaseTime: '2026-09-02 12:05:00',
    capabilities: [
      'ApiEngine:platform-chat-system-message@v1.1.0',
      'ApiEngine:platform-chat-runtime@v1.0.2',
      'ApiEngine:platform-message-notification-custom-hook@v1.0.0',
      'ApiEngine:wechat_send_tpl_msg@v1.0.0',
      'V8.Method.SendWeChatTemplateMessage',
      'V8.Method.RequireManagedProtocolContext',
      'V8.MongoDb.UptFormDataByWhere',
      'V8.MongoDb.DelFormDataByWhere',
      'ServerField:sys_apiengine.ApiRoutes',
      'ApiEngineChatDelivery:v1',
    ],
    exactEngineKeys: [
      'msg_event',
      'msg_internal_list',
      'msg_internal_mark_read',
      'platform-chat-system-message',
      'platform-chat-runtime',
      'platform-message-notification-custom-hook',
      'wechat_send_tpl_msg',
    ],
    engines: [
      { key: 'platform-chat-system-message', name: '平台系统消息编排', source: 'platform-chat-system-message.js', id: '019d2a01-9d63-7f91-8c02-000000000005', version: 'v1.1.0', enableLog: 1, apiRoutes: '/api/DiyChat/SendSystemMessage' },
      { key: 'platform-chat-runtime', name: '平台聊天 Managed 运行时', source: 'platform-chat-runtime.js', id: '019d2a01-9d63-7f91-8c02-00000000000b', version: 'v1.0.2', enableLog: 1, stopHttp: 1 },
      { key: 'platform-message-notification-custom-hook', name: '消息通知个性化扩展', source: 'platform-message-notification-custom-hook.js', id: '019d2a01-9d63-7f91-8c02-000000000006', version: 'v1.0.0', enableLog: 1, stopHttp: 1, ownership: 'Tenant', upgradePolicy: 'CreateIfMissing' },
      { key: 'wechat_send_tpl_msg', name: '微信模板消息可信适配器', source: 'wechat_send_tpl_msg.js', id: '019d2a01-9d63-7f91-8c02-00000000000c', version: 'v1.0.0', enableLog: 1, stopHttp: 1 },
    ],
  }),
  Object.freeze({
    file: 'app.microi.ai-engine.json',
    name: 'AI助手',
    version: 'v7.7.3',
    bootstrapUrl: 'https://static.itdos.com/itdos/microi-store/packages/01kggwkhpq6hw8axdaz4n94rq2/202608/app_microi_ai-engine-v6_3_4-efb7fcdf70c2f467.json',
    bootstrapSha256: 'efb7fcdf70c2f467ffd99b72581b15bcd8790ad977a3ba1f78b33cfd71069763',
    bootstrapSize: 732784,
    history: '2026-09-08 v7.7.3 音乐生成改用持久后台任务和原任务轮询，浏览器停止等待或刷新不会取消后台生成；保存官方 Music3 事件编号与完成文件地址，断流或下载失败可恢复原结果且不重新作曲。失败与不确定状态保留诊断，图片和音乐中转等待任务合并限流并预留供应商执行槽。需同步更新平台 Core、AI、API、前端及使用的吾码中转节点；应用包不会替换二进制，未保存回执的历史请求不自动重发。保留租户模型、密钥、策略与会话数据。',
    changeLogTitle: '音乐持久任务与原结果恢复',
    changeType: 'Fix',
    changeLogContent: '音乐生成改用持久后台任务和原任务轮询，浏览器停止等待或刷新不会取消后台生成；保存官方 Music3 事件编号与完成文件地址，断流或下载失败可恢复原结果且不重新作曲。失败与不确定状态保留诊断，图片和音乐中转等待任务合并限流并预留供应商执行槽。需同步更新平台 Core、AI、API、前端及使用的吾码中转节点；应用包不会替换二进制，未保存回执的历史请求不自动重发。保留租户模型、密钥、策略与会话数据。',
    releaseTime: '2026-09-08 15:30:00',
    capabilities: [
      'ApiEngine:mci_ai_data_assistant@v1.1.8',
      'ApiEngine:platform-ai-account@v1.1.0',
      'ApiEngine:platform-ai-runtime@v1.0.0',
      'ApiEngine:platform-ai-runtime@v1.1.0',
      'ApiEngine:platform-ai-runtime@v1.1.1',
      'ApiEngine:platform-ai-custom-hook@v1.0.0',
      'V8.Method.ManageAiPlatform',
      'V8.Method.RequireManagedProtocolContext',
      'V8.AI.UpdateConversationTitle',
      'V8.AI.Chat',
      'V8.AI.RecognizeIntent',
      'V8.AI.NL2SQL',
      'V8.AI.NL2V8',
      'V8.Image.Grayscale',
      'V8.Image.RemoveSolidBackground',
      'ServerField:sys_apiengine.ApiRoutes',
      'ClientFeature:AiWorkbenchDirectoryV2',
      'ServerFeature:AiImageDurableTasksV1',
      'ClientFeature:AiImageTaskPollingV1',
      'ServerFeature:AiMusicDurableTasksV1',
      'ClientFeature:AiMusicTaskPollingV1',
      'V8.AI.GetMiniMaxMusicTask',
      'V8.AI.RecoverMiniMaxMusicTask',
      'ServerFeature:AiMediaModelDirectoryV1',
      'ClientFeature:AiMediaModelSelectionV1',
    ],
    exactEngineKeys: [
      'mci_ai_data_assistant',
      'platform-ai-account',
      'platform-ai-runtime',
      'platform-ai-custom-hook',
    ],
    removeEngines: [
      'ai_app_list',
      'ai_app_detail',
      'ai_app_get_file',
      'ai_app_save_file',
      'ai_app_create',
      'ai_app_build',
      'ai_app_preview',
      'ai_app_download_source_zip',
      'ai_app_download_build_zip',
      'ai_app_moveobject_probe',
      'ai_app_moveobject_exec_probe',
      'ai_app_publish_store',
    ],
    removeTables: aiRemovedDuplicateTableNames,
    engines: [
      { key: 'platform-ai-account', name: 'AI 平台账户与支付编排', source: 'platform-ai-account.js', id: '019d2a01-9d63-7f91-8c02-000000000007', version: 'v1.1.0', enableLog: 1, allowAnonymous: 1 },
      {
        key: 'platform-ai-runtime',
        name: 'AI 非流式兼容运行时',
        source: 'platform-ai-runtime.js',
        id: '019d2a01-9d63-7f91-8c02-00000000000a',
        version: 'v1.1.1',
        enableLog: 1,
        history: '2026-09-04 v1.1.1 意图识别改传受限附件摘要并隔离 JS 集合，同时将其它动作的空附件和空历史数组归一化为 null，避免 Jint 绑定 .NET List 时触发 IConvertible 异常。',
      },
      { key: 'platform-ai-custom-hook', name: 'AI助手个性化扩展', source: 'platform-ai-custom-hook.js', id: '019d2a01-9d63-7f91-8c02-000000000008', version: 'v1.0.0', enableLog: 1, stopHttp: 1, ownership: 'Tenant', upgradePolicy: 'CreateIfMissing' },
    ],
  }),
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeSource(value) {
  return `${String(value || '').replace(/\r\n?/g, '\n').trimEnd()}\n`;
}

function prependOnce(existing, line) {
  const value = String(existing || '');
  return value.split(/\r?\n/).includes(line) ? value : `${line}\n${value}`;
}

function deterministicGuid(scope) {
  const value = sha256(`microi-official-package:${scope}`);
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}`
    + `-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

function sqlStringValue(value) {
  const text = String(value || '').trim();
  if (/^'.*'$/s.test(text)) return text.slice(1, -1).replace(/''/g, "'");
  if (/^null$/i.test(text)) return null;
  return text;
}

function parseCreateTable(tableName, ddl) {
  const bodyMatch = String(ddl).match(/\(\s*([\s\S]*)\s*\)\s*ENGINE\s*=/i);
  if (!bodyMatch) throw new Error(`${tableName} CREATE TABLE 无法解析。`);
  const primary = new Set();
  const unique = new Set();
  const indexed = new Set();
  const collectKeys = (pattern, target) => {
    for (const match of bodyMatch[1].matchAll(pattern)) {
      for (const column of String(match[1]).matchAll(/`([^`]+)`/g)) target.add(column[1]);
    }
  };
  collectKeys(/PRIMARY\s+KEY\s*\(([^)]*)\)/gi, primary);
  collectKeys(/UNIQUE\s+(?:KEY|INDEX)\s+`[^`]+`\s*\(([^)]*)\)/gi, unique);
  collectKeys(/(?:KEY|INDEX)\s+`[^`]+`\s*\(([^)]*)\)/gi, indexed);

  const columns = [];
  for (const line of bodyMatch[1].split(/\r?\n/)) {
    const match = line.match(/^\s*`([^`]+)`\s+([A-Za-z]+(?:\([^)]*\))?)([\s\S]*?)(?:,\s*)?$/);
    if (!match) continue;
    const name = match[1];
    const columnType = match[2].toLowerCase().replace(/\s+/g, '');
    const suffix = match[3];
    const defaultMatch = suffix.match(/\bDEFAULT\s+('(?:''|[^'])*'|[^\s,]+)/i);
    const commentMatch = suffix.match(/\bCOMMENT\s+'((?:''|[^'])*)'/i);
    columns.push({
      TABLE_NAME: tableName,
      COLUMN_NAME: name,
      COLUMN_TYPE: columnType,
      DATA_TYPE: columnType.replace(/\(.*/, ''),
      IS_NULLABLE: /\bNOT\s+NULL\b/i.test(suffix) ? 'NO' : 'YES',
      COLUMN_DEFAULT: defaultMatch ? sqlStringValue(defaultMatch[1]) : null,
      COLUMN_COMMENT: commentMatch ? commentMatch[1].replace(/''/g, "'") : '',
      COLUMN_KEY: primary.has(name) ? 'PRI' : (unique.has(name) ? 'UNI' : (indexed.has(name) ? 'MUL' : '')),
      EXTRA: /\bON\s+UPDATE\s+CURRENT_TIMESTAMP\b/i.test(suffix) ? 'on update CURRENT_TIMESTAMP' : '',
      ORDINAL_POSITION: columns.length + 1,
    });
  }
  if (!columns.length) throw new Error(`${tableName} CREATE TABLE 没有物理列。`);
  const tableComment = String(ddl).match(/\bCOMMENT\s*=\s*'((?:''|[^'])*)'\s*;?\s*$/i);
  return {
    name: tableName,
    ddl: normalizeSource(ddl).trim(),
    description: tableComment ? tableComment[1].replace(/''/g, "'") : tableName,
    columns,
  };
}

function loadSubscriptionTableSpecs() {
  const sourcePath = path.resolve(root, '..', '..', 'Microi.AI', 'Resource', 'subscription-tables.sql');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const ddlByTable = new Map();
  const pattern = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`([A-Za-z0-9_]+)`\s*\([\s\S]*?\)\s*ENGINE\s*=\s*InnoDB\s+DEFAULT\s+CHARSET\s*=\s*utf8mb4(?:\s+COMMENT\s*=\s*'(?:''|[^'])*')?\s*;/gi;
  for (const match of source.matchAll(pattern)) ddlByTable.set(match[1], match[0]);
  const unexpected = [...ddlByTable.keys()].filter(name => !aiSubscriptionTableNames.includes(name));
  const missing = aiSubscriptionTableNames.filter(name => !ddlByTable.has(name));
  if (missing.length || unexpected.length) {
    throw new Error(
      `subscription-tables.sql 表闭包不正确：缺失=${missing.join(',') || '-'}，`
      + `多余=${unexpected.join(',') || '-'}。`,
    );
  }
  return aiSubscriptionTableNames.map(name => parseCreateTable(name, ddlByTable.get(name)));
}

function relayFieldType(dbType, size) {
  // Dos.ORM CodeFirst maps DbType.String with ParameterSize <= 0 to LONGTEXT on MySQL.
  if (dbType === 'String') return Number(size) > 0 ? `varchar(${size})` : 'longtext';
  if (dbType === 'Int32') return 'int';
  if (dbType === 'Int64') return 'bigint';
  throw new Error(`RelayUsageSchema.cs 包含未支持的 DbType.${dbType}。`);
}

function loadRelayUsageTableSpecs() {
  const sourcePath = path.resolve(root, '..', '..', 'Microi.AI', 'RelayUsageSchema.cs');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const definitions = [
    {
      className: 'RelayTokenAccountEntity',
      tableName: 'mci_ai_token_account',
      description: 'AI 中转站令牌账户',
      indexes: [['idx_mci_ai_token_account_user', 'UserId']],
    },
    {
      className: 'RelayTokenLogEntity',
      tableName: 'mci_ai_token_log',
      description: 'AI 中转站令牌用量日志',
      indexes: [
        ['idx_mci_ai_token_log_user', 'UserId'],
        ['idx_mci_ai_token_log_time', 'CreateTime'],
      ],
    },
  ];
  const comments = {
    PromptPreview: '提示词安全预览',
    Question: '原始问题',
    Answer: '模型回答',
    GiftTokens: '赠送 Token',
    UsedTokens: '已用 Token',
    RemainingTokens: '剩余 Token',
  };
  return definitions.map(definition => {
    const classStart = source.indexOf(`internal sealed class ${definition.className}`);
    const nextClass = source.indexOf('\n    [Table(', classStart + 1);
    if (classStart < 0) throw new Error(`RelayUsageSchema.cs 缺少 ${definition.className}。`);
    const classSource = source.slice(classStart, nextClass < 0 ? source.length : nextClass);
    const columns = [];
    for (const match of classSource.matchAll(/F\("([^"]+)",\s*DbType\.([A-Za-z0-9_]+)(?:,\s*(\d+))?\)/g)) {
      const name = match[1];
      const columnType = relayFieldType(match[2], match[3]);
      columns.push({
        TABLE_NAME: definition.tableName,
        COLUMN_NAME: name,
        COLUMN_TYPE: columnType,
        DATA_TYPE: columnType.replace(/\(.*/, ''),
        IS_NULLABLE: name === 'Id' ? 'NO' : 'YES',
        COLUMN_DEFAULT: null,
        COLUMN_COMMENT: comments[name] || '',
        COLUMN_KEY: name === 'Id' ? 'PRI' : (definition.indexes.some(index => index[1] === name) ? 'MUL' : ''),
        EXTRA: '',
        ORDINAL_POSITION: columns.length + 1,
      });
    }
    if (!columns.length) throw new Error(`RelayUsageSchema.cs 的 ${definition.className} 没有字段。`);
    const columnSql = columns.map(column => {
      const nullable = column.IS_NULLABLE === 'NO' ? ' NOT NULL' : ' NULL';
      const comment = column.COLUMN_COMMENT
        ? ` COMMENT '${column.COLUMN_COMMENT.replace(/'/g, "''")}'`
        : '';
      return `  \`${column.COLUMN_NAME}\` ${column.COLUMN_TYPE}${nullable}${comment}`;
    });
    columnSql.push('  PRIMARY KEY (`Id`)');
    for (const [indexName, fieldName] of definition.indexes) {
      columnSql.push(`  KEY \`${indexName}\` (\`${fieldName}\`)`);
    }
    const ddl = `CREATE TABLE IF NOT EXISTS \`${definition.tableName}\` (\n`
      + `${columnSql.join(',\n')}\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='${definition.description}';`;
    return { ...definition, name: definition.tableName, columns, ddl };
  });
}

function tableNameOf(row) {
  return String(row?.TableName || row?.TABLE_NAME || '').toLowerCase();
}

function removeTableResources(packageModel, tableNames) {
  const names = new Set(tableNames.map(name => String(name).toLowerCase()));
  const removedTableIds = new Set(
    (packageModel.DiyTables || [])
      .filter(table => names.has(String(table.Name || '').toLowerCase()))
      .map(table => String(table.Id || '').toLowerCase())
      .filter(Boolean),
  );
  packageModel.DDLStatements = (packageModel.DDLStatements || [])
    .filter(row => !names.has(tableNameOf(row)));
  packageModel.PhysicalColumns = (packageModel.PhysicalColumns || [])
    .filter(row => !names.has(tableNameOf(row)));
  packageModel.DiyTables = (packageModel.DiyTables || [])
    .filter(row => !names.has(String(row.Name || '').toLowerCase()));
  packageModel.DiyFields = (packageModel.DiyFields || [])
    .filter(row => !names.has(tableNameOf(row))
      && !removedTableIds.has(String(row.TableId || '').toLowerCase()));
  packageModel.DataSets = (packageModel.DataSets || [])
    .filter(row => !names.has(tableNameOf(row))
      && !removedTableIds.has(String(row.TableId || '').toLowerCase()));
}

function isSensitiveAiField(name) {
  return /(?:ApiKey|PrivateKey|PublicKey|AESKey|PlatformApiKey|PromptPreview|Question|Answer)/i.test(name);
}

function fieldComponent(column) {
  const name = String(column.COLUMN_NAME || '');
  const type = String(column.DATA_TYPE || '').toLowerCase();
  if (name === 'Id') return 'Guid';
  if (type === 'datetime' || type === 'timestamp') return 'DateTime';
  if (/^(?:int|bigint|decimal|numeric|float|double)$/.test(type)) {
    return /^(?:Is|Status$)/.test(name) ? 'Switch' : 'NumberText';
  }
  if (/text$/.test(type)) return 'Textarea';
  return 'Text';
}

function configureOwnedTable(packageModel, spec) {
  removeTableResources(packageModel, [spec.name]);
  const tableId = deterministicGuid(`app.microi.ai-engine:table:${spec.name}`);
  packageModel.DDLStatements.push({
    TableName: spec.name,
    TableId: tableId,
    DDL: spec.ddl,
  });
  packageModel.PhysicalColumns.push(...spec.columns.map(column => ({ ...column })));
  packageModel.DiyTables.push({
    Column: 2,
    Description: spec.description,
    Name: spec.name,
    FormOpenWidth: '80%',
    FormOpenType: 'Drawer',
    Id: tableId,
    CreateTime: releaseTime,
  });
  packageModel.DiyFields.push(...spec.columns.map(column => {
    const name = column.COLUMN_NAME;
    const sensitive = isSensitiveAiField(name);
    const hiddenSystemField = /^(?:Id|UserId|IsDeleted|OsClient)$/.test(name);
    return {
      TableName: spec.name,
      AppVisible: sensitive || hiddenSystemField ? 0 : 1,
      Type: column.COLUMN_TYPE,
      Name: name,
      InTableEdit: 0,
      Unique: column.COLUMN_KEY === 'UNI' ? 1 : 0,
      NameConfirm: 1,
      TableWidth: 150,
      TableId: tableId,
      Readonly: /^(?:Id|CreateTime|UpdateTime|UserId|UserName|IsDeleted|OsClient)$/.test(name) ? 1 : 0,
      Encrypt: 0,
      Component: fieldComponent(column),
      Visible: sensitive || hiddenSystemField ? 0 : 1,
      IsLockField: 1,
      Data: '[]',
      Sort: column.ORDINAL_POSITION * 10,
      NotEmpty: column.IS_NULLABLE === 'NO' ? 1 : 0,
      Label: column.COLUMN_COMMENT || name,
      Id: deterministicGuid(`app.microi.ai-engine:field:${spec.name}:${name}`),
      CreateTime: releaseTime,
    };
  }));
}

export function configureAiRuntimeSchemas(packageModel) {
  removeTableResources(packageModel, aiRemovedDuplicateTableNames);
  const specs = [...loadSubscriptionTableSpecs(), ...loadRelayUsageTableSpecs()];
  for (const spec of specs) configureOwnedTable(packageModel, spec);
  const tableNames = (packageModel.DiyTables || []).map(row => String(row.Name || '').toLowerCase());
  for (const name of aiRuntimeTableNames) {
    if (tableNames.filter(value => value === name.toLowerCase()).length !== 1) {
      throw new Error(`app.microi.ai-engine.json 必须且只能声明一次 ${name}。`);
    }
  }
  for (const name of [...aiRemovedDuplicateTableNames, 'sys_user']) {
    if (tableNames.includes(name.toLowerCase())) {
      throw new Error(`app.microi.ai-engine.json 不得声明其它应用拥有的 ${name}。`);
    }
  }
  return specs;
}

export function configureSysUserAiApiKey(packageModel) {
  const table = (packageModel.DiyTables || [])
    .find(row => String(row.Name || '').toLowerCase() === 'sys_user');
  if (!table) throw new Error('app.microi.sys_user.json 缺少 sys_user 低代码表。');
  const ddlRow = (packageModel.DDLStatements || [])
    .find(row => String(row.TableName || '').toLowerCase() === 'sys_user');
  if (!ddlRow) throw new Error('app.microi.sys_user.json 缺少 sys_user DDL。');
  if (!/`AiApiKey`\s+/i.test(String(ddlRow.DDL || ''))) {
    const nextDdl = String(ddlRow.DDL || '').replace(
      /\n\)\s*ENGINE\s*=/i,
      ",\n  `AiApiKey` varchar(200) NULL COMMENT 'AI API Key'\n) ENGINE=",
    );
    if (nextDdl === ddlRow.DDL) throw new Error('sys_user DDL 缺少可插入 AiApiKey 的表尾。');
    ddlRow.DDL = nextDdl;
  }

  packageModel.PhysicalColumns ||= [];
  const physicalMatches = packageModel.PhysicalColumns.filter(row => (
    String(row.TABLE_NAME || '').toLowerCase() === 'sys_user'
    && String(row.COLUMN_NAME || '').toLowerCase() === 'aiapikey'
  ));
  if (!physicalMatches.length) {
    const ordinal = Math.max(0, ...packageModel.PhysicalColumns
      .filter(row => String(row.TABLE_NAME || '').toLowerCase() === 'sys_user')
      .map(row => Number(row.ORDINAL_POSITION) || 0)) + 1;
    packageModel.PhysicalColumns.push({
      TABLE_NAME: 'sys_user', COLUMN_NAME: 'AiApiKey', COLUMN_TYPE: 'varchar(200)',
      DATA_TYPE: 'varchar', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null,
      COLUMN_COMMENT: 'AI API Key', COLUMN_KEY: '', EXTRA: '', ORDINAL_POSITION: ordinal,
    });
  } else if (physicalMatches.length > 1) {
    throw new Error('app.microi.sys_user.json 重复声明 sys_user.AiApiKey 物理列。');
  }

  packageModel.DiyFields ||= [];
  packageModel.DiyFields = packageModel.DiyFields.filter(row => !(
    String(row.TableName || '').toLowerCase() === 'sys_user'
    && String(row.Name || '').toLowerCase() === 'aiapikey'
  ));
  packageModel.DiyFields.push({
    TableName: 'sys_user', AppVisible: 0, Type: 'varchar(200)', Name: 'AiApiKey',
    InTableEdit: 0, Unique: 0, NameConfirm: 1, TableWidth: 150, TableId: table.Id,
    Readonly: 1, Encrypt: 0, Component: 'Text', Visible: 0, IsLockField: 1,
    Data: '[]', Sort: 1190, NotEmpty: 0, Label: 'AI API Key',
    Description: '由 AI助手可信后端签发和轮换；低代码表单只保留字段元数据，不显示或直接编辑。',
    Id: deterministicGuid('app.microi.sys_user:field:sys_user:AiApiKey'),
    CreateTime: releaseTime,
  });
}

export function configureSysUserHomeUsageStats(packageModel) {
  const table = (packageModel.DiyTables || [])
    .find(row => String(row.Name || '').toLowerCase() === 'sys_user');
  if (!table) throw new Error('app.microi.sys_user.json 缺少 sys_user 低代码表。');
  const ddlRow = (packageModel.DDLStatements || [])
    .find(row => String(row.TableName || '').toLowerCase() === 'sys_user');
  if (!ddlRow) throw new Error('app.microi.sys_user.json 缺少 sys_user DDL。');
  if (!/`HomeUsageStats`\s+/i.test(String(ddlRow.DDL || ''))) {
    const nextDdl = String(ddlRow.DDL || '').replace(
      /\n\)\s*ENGINE\s*=/i,
      ",\n  `HomeUsageStats` mediumtext NULL COMMENT '个人首页菜单访问聚合'\n) ENGINE=",
    );
    if (nextDdl === ddlRow.DDL) throw new Error('sys_user DDL 缺少可插入 HomeUsageStats 的表尾。');
    ddlRow.DDL = nextDdl;
  }

  packageModel.PhysicalColumns ||= [];
  const physicalMatches = packageModel.PhysicalColumns.filter(row => (
    String(row.TABLE_NAME || '').toLowerCase() === 'sys_user'
    && String(row.COLUMN_NAME || '').toLowerCase() === 'homeusagestats'
  ));
  if (!physicalMatches.length) {
    const ordinal = Math.max(0, ...packageModel.PhysicalColumns
      .filter(row => String(row.TABLE_NAME || '').toLowerCase() === 'sys_user')
      .map(row => Number(row.ORDINAL_POSITION) || 0)) + 1;
    packageModel.PhysicalColumns.push({
      TABLE_NAME: 'sys_user', COLUMN_NAME: 'HomeUsageStats', COLUMN_TYPE: 'mediumtext',
      DATA_TYPE: 'mediumtext', IS_NULLABLE: 'YES', COLUMN_DEFAULT: null,
      COLUMN_COMMENT: '个人首页菜单访问聚合', COLUMN_KEY: '', EXTRA: '', ORDINAL_POSITION: ordinal,
    });
  } else if (physicalMatches.length > 1) {
    throw new Error('app.microi.sys_user.json 重复声明 sys_user.HomeUsageStats 物理列。');
  }

  packageModel.DiyFields ||= [];
  packageModel.DiyFields = packageModel.DiyFields.filter(row => !(
    String(row.TableName || '').toLowerCase() === 'sys_user'
    && String(row.Name || '').toLowerCase() === 'homeusagestats'
  ));
  packageModel.DiyFields.push({
    TableName: 'sys_user', AppVisible: 0, Type: 'mediumtext', Name: 'HomeUsageStats',
    InTableEdit: 0, Unique: 0, NameConfirm: 1, TableWidth: 150, TableId: table.Id,
    Readonly: 1, Encrypt: 0, Component: 'Textarea', Visible: 0, IsLockField: 1,
    Data: '[]', Sort: 1560, NotEmpty: 0, Label: '个人首页菜单访问聚合',
    Description: '仅由 platform-home-overview 写入当前账号的菜单 Id、总次数、最近时间及按日次数；不记录 URL 参数和业务数据。',
    Id: deterministicGuid('app.microi.sys_user:field:sys_user:HomeUsageStats'),
    CreateTime: releaseTime,
  });
}

function refreshPackageCounts(packageModel) {
  const info = packageModel.PackageInfo;
  info.TableCount = (packageModel.DiyTables || []).length;
  info.FieldCount = (packageModel.DiyFields || []).length;
  info.DDLCount = (packageModel.DDLStatements || []).length;
  info.PhysicalColumnCount = (packageModel.PhysicalColumns || []).length;
  info.DataSetCount = (packageModel.DataSets || []).length;
  info.DataRowCount = (packageModel.DataSets || []).reduce(
    (count, dataSet) => count + (Array.isArray(dataSet.Rows) ? dataSet.Rows.length : 0),
    0,
  );
}

async function ensureBootstrap(definition) {
  fs.mkdirSync(baseRoot, { recursive: true });
  const basePath = path.join(baseRoot, definition.file);
  const localPath = path.join(root, definition.file);
  if (!fs.existsSync(basePath)) {
    const response = await fetch(definition.bootstrapUrl);
    if (!response.ok) throw new Error(`${definition.file} 官方基线下载失败：HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const actualSha = sha256(bytes);
    if (bytes.length !== definition.bootstrapSize || actualSha !== definition.bootstrapSha256) {
      throw new Error(`${definition.file} 官方基线大小或 SHA-256 不匹配，拒绝写入。`);
    }
    fs.writeFileSync(basePath, bytes);
  }
  const baseBytes = fs.readFileSync(basePath);
  let baseModel;
  try {
    baseModel = JSON.parse(baseBytes.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`${definition.file} .resource-sync-base 不是有效 JSON。`, { cause: error });
  }
  if (String(baseModel?.PackageInfo?.Name || '') !== definition.name
      || !Array.isArray(baseModel?.SysApiEngines)) {
    throw new Error(`${definition.file} .resource-sync-base 的应用身份或接口引擎结构不正确。`);
  }
  if (!fs.existsSync(localPath)) fs.writeFileSync(localPath, baseBytes);
  return localPath;
}

function newEngine(definition) {
  return {
    V8Limit: 0,
    IsDeleted: 0,
    UserName: '管理员',
    UserId: 'c74d669c-a3d4-11e5-b60d-b870f43edd03',
    UpdateTime: releaseTime,
    CreateTime: releaseTime,
    Id: definition.id,
    V8Unlimited: 1,
    ChangeHistory: definition.history || '',
    Version: definition.version,
    LimitRecursion: 5000,
    LimitMemory: 2048,
    MaxStatements: 100000000,
    Timeout: 600,
    StopHttp: definition.stopHttp || 0,
    EnableLog: definition.enableLog || 0,
    Category: '平台内置',
    Files: '[]',
    AllowAnonymous: definition.allowAnonymous || 0,
    ApiAddress: `/apiengine/${definition.key}`,
    ResponseFile: 0,
    Lock: definition.lock || 0,
    ApiV8Code: '',
    ApiRole: '[]',
    IsEnable: 1,
    ApiEngineKey: definition.key,
    ApiName: definition.name,
  };
}

function configureEngine(packageModel, definition) {
  packageModel.SysApiEngines ||= [];
  let engine = packageModel.SysApiEngines.find(item => item.ApiEngineKey === definition.key);
  if (!engine) {
    engine = newEngine(definition);
    packageModel.SysApiEngines.push(engine);
  }
  Object.assign(engine, {
    Id: definition.id || engine.Id,
    Version: definition.version,
    ApiName: definition.name,
    ApiEngineKey: definition.key,
    ApiAddress: `/apiengine/${definition.key}`,
    ...(definition.apiRoutes ? { ApiRoutes: definition.apiRoutes } : {}),
    ApiV8Code: normalizeSource(fs.readFileSync(path.join(root, definition.source), 'utf8')),
    IsDeleted: 0,
    IsEnable: 1,
    StopHttp: definition.stopHttp || 0,
    AllowAnonymous: definition.allowAnonymous || 0,
    EnableLog: definition.enableLog || 0,
    Lock: definition.lock || 0,
  });
  if (definition.history) engine.ChangeHistory = prependOnce(engine.ChangeHistory, definition.history);
  packageModel.ResourcePolicies ||= { SchemaVersion: 1, ApiEngines: {} };
  packageModel.ResourcePolicies.SchemaVersion ||= 1;
  packageModel.ResourcePolicies.ApiEngines ||= {};
  packageModel.ResourcePolicies.ApiEngines[definition.key] = {
    Ownership: definition.ownership || 'Platform',
    UpgradePolicy: definition.upgradePolicy || 'Managed',
  };
}

function configureAiDataAssistant(packageModel) {
  const engine = (packageModel.SysApiEngines || []).find(item => item.ApiEngineKey === 'mci_ai_data_assistant');
  if (!engine) throw new Error('app.microi.ai-engine.json 缺少 mci_ai_data_assistant。');
  engine.ApiV8Code = normalizeSource(fs.readFileSync(path.join(root, 'mci-ai-data-assistant.js'), 'utf8'));
  engine.Version = 'v1.1.8';
  // OnlyGet 角色也可调用此受管接口；业务读权限仍由引擎按域与模型校验。
  engine.ApiRole = JSON.stringify(['$authenticated']);
  engine.AllowAnonymous = 0;
  engine.ChangeHistory = prependOnce(
    engine.ChangeHistory,
    '2026-09-06 v1.1.8 默认开放常规对话，按数据域与模型独立校验业务数据权限，支持无角色账号和有效对话模型动态发现；纯媒体型号不进入对话清单。',
  );
  packageModel.ResourcePolicies ||= { SchemaVersion: 1, ApiEngines: {} };
  packageModel.ResourcePolicies.ApiEngines ||= {};
  packageModel.ResourcePolicies.ApiEngines.mci_ai_data_assistant = {
    Ownership: 'Platform',
    UpgradePolicy: 'Managed',
  };
}


// 官方母版回读后的媒体元数据；安装仅增补结构，不携带任何供应商账号或租户配置行。
export const aiMediaModelFields = [
  {
    Id: '01M1TCN4MZ7QD5YCAG4MHPNBY4',
    TableId: '88711c13-1e65-4ff1-9d40-0de85e551d81',
    TableName: 'mic_ai', Name: 'AllowAllRolesChat', Label: '所有角色可常规对话',
    Type: 'int', Component: 'Switch', Tab: '基础配置', Sort: 35,
    Visible: 1, AppVisible: 1, Readonly: 0, NotEmpty: 0, DefaultValue: '1',
    TableWidth: 140, FormWidth: null, Data: '', Config: '', NameConfirm: 1, IsLockField: 1,
    CreateTime: '2026-09-06 11:37:08',
    Description: '默认开启。所有已登录账号（包括未分配角色）可使用此模型常规对话；不授予业务数据、SQL、菜单或管理权限。业务数据仍按角色策略中的数据域、范围和模型白名单校验。关闭后此模型仅供显式授权角色使用；存量空值按开启兼容。'
  },
  {
    "Id": "01M1SS738BPN9Q2NVM2N2E5QAY",
    "TableId": "88711c13-1e65-4ff1-9d40-0de85e551d81",
    "Name": "MediaModels",
    "Label": "媒体模型目录",
    "Type": "mediumtext",
    "Component": "CodeEditor",
    "Description": "JSON 数组，例如 [{\"Id\":\"image-01\",\"Name\":\"图片生成\",\"Capability\":\"image\",\"Protocol\":\"minimax-image\"}]。Capability 可为 image/music/video/speech；模型与协议分开配置，供应商密钥继续使用 ApiKey。中转站可留空并实时发现目录；只返回已实现协议，配置未知协议时明确提示。",
    "Visible": 1,
    "AppVisible": 1,
    "Readonly": 0,
    "NotEmpty": 0,
    "Sort": 210,
    "Tab": "高级配置",
    "Data": "",
    "Config": "",
    "FormWidth": 24,
    "TableWidth": 160,
    "DefaultValue": "",
    "CreateTime": "2026-09-06 05:57:25",
    "TableName": "mic_ai",
    "NameConfirm": 1,
    "IsLockField": 1
  },
  {
    "Id": "01M1SS72J5NWXNJEVSXXSGZNG3",
    "TableId": "88711c13-1e65-4ff1-9d40-0de85e551d81",
    "Name": "MediaProtocol",
    "Label": "媒体默认协议",
    "Type": "varchar(50)",
    "Component": "Select",
    "Description": "媒体模型的默认协议，可在媒体模型目录中为每个模型覆盖；未配置保持存量兼容，未知协议不会调用上游。",
    "Visible": 1,
    "AppVisible": 1,
    "Readonly": 0,
    "NotEmpty": 0,
    "Sort": 200,
    "Tab": "高级配置",
    "Data": "[{\"Key\":\"auto\",\"Value\":\"按模型自动识别\"},{\"Key\":\"minimax\",\"Value\":\"MiniMax 媒体协议\"},{\"Key\":\"openai-image\",\"Value\":\"GPT Image 兼容协议\"}]",
    "Config": "{\"DataSource\":\"KeyValue\",\"SelectLabel\":\"Value\",\"SelectSaveField\":\"Key\",\"SelectSaveFormat\":\"Text\",\"EnableSearch\":false,\"DataSourceSqlRemote\":false}",
    "TableWidth": 130,
    "DefaultValue": "",
    "CreateTime": "2026-09-06 05:57:24",
    "TableName": "mic_ai",
    "NameConfirm": 1,
    "IsLockField": 1
  }
];

function configureAiMediaModelFields(model) {
  const table = model.DiyTables.find(x => x.Name === 'mic_ai');
  if (!table) throw new Error('AI 模型管理表缺失，不能交付媒体目录');
  // OAuth 加密信封可能长于旧版 500 字符；扩容只调整结构，不携带或覆盖租户密钥。
  const credentialField = model.DiyFields.find(x => x.TableId === table.Id && x.Name === 'ApiKey');
  if (credentialField) credentialField.Type = 'mediumtext';
  const credentialColumn = model.PhysicalColumns.find(x => x.TABLE_NAME === 'mic_ai' && x.COLUMN_NAME === 'ApiKey');
  if (credentialColumn) Object.assign(credentialColumn, { COLUMN_TYPE: 'mediumtext', DATA_TYPE: 'mediumtext' });
  const protocol = aiMediaModelFields.find(x => x.Name === 'MediaProtocol');
  const protocolOptions = JSON.parse(protocol.Data);
  if (!protocolOptions.some(x => x.Key === 'minimax-connector-image')) {
    protocolOptions.push({ Key: 'minimax-connector-image', Value: 'MiniMax Code 图像编辑（OAuth）' });
    protocol.Data = JSON.stringify(protocolOptions);
  }
  const names = new Set(aiMediaModelFields.map(x => x.Name));
  model.DiyFields = model.DiyFields.filter(x => !(x.TableId === table.Id && names.has(x.Name)));
  model.DiyFields.push(...aiMediaModelFields.map(x => ({ ...x, TableId: table.Id })));
  model.PhysicalColumns = model.PhysicalColumns.filter(x => !(x.TABLE_NAME === 'mic_ai' && names.has(x.COLUMN_NAME)));
  const last = Math.max(0, ...model.PhysicalColumns.filter(x => x.TABLE_NAME === 'mic_ai').map(x => Number(x.ORDINAL_POSITION) || 0));
  model.PhysicalColumns.push(...aiMediaModelFields.map((x, i) => ({
    TABLE_NAME: 'mic_ai', COLUMN_NAME: x.Name, COLUMN_TYPE: x.Type, DATA_TYPE: x.Type.split('(')[0],
    IS_NULLABLE: 'YES', COLUMN_DEFAULT: null, COLUMN_COMMENT: x.Label, COLUMN_KEY: '', EXTRA: '', ORDINAL_POSITION: last + i + 1
  })));
  const ddl = model.DDLStatements.find(x => x.TableName === 'mic_ai');
  if (!ddl) throw new Error('AI 模型管理表 DDL 缺失');
  ddl.DDL = ddl.DDL.replace(/(`ApiKey`\s+)varchar\(500\)/i, '$1mediumtext');
  const missing = aiMediaModelFields.filter(x => !ddl.DDL.includes('`' + x.Name + '`'));
  if (missing.length) {
    const end = ddl.DDL.lastIndexOf(')');
    if (end < 0) throw new Error('AI 模型管理表 DDL 不完整');
    ddl.DDL = ddl.DDL.slice(0, end).trimEnd() + ',\n' + missing.map(x => '  `' + x.Name + '` ' + x.Type + " NULL COMMENT '" + x.Label + "'").join(',\n') + '\n' + ddl.DDL.slice(end);
  }
}

export function configurePackageModel(packageModel, definition) {
  if (packageModel?.PackageInfo?.Name !== definition.name) {
    throw new Error(`${definition.file} 包名不正确。`);
  }
  // Existing published packages may append independent reference-table fields after
  // generated fields. Regeneration must retain that order, not create false content
  // drift by moving every regenerated field to the end. Align by natural identity.
  const tableNames = new Map((packageModel.DiyTables || []).map(row => [row.Id, row.Name]));
  const fieldKey = row => `${String(row.TableName || tableNames.get(row.TableId) || '').toLowerCase()}:${String(row.Name || '').toLowerCase()}`;
  const fieldOrder = new Map((packageModel.DiyFields || []).map((row, index) => [fieldKey(row), index]));
  const removals = new Set(definition.removeEngines || []);
  const exactEngineKeys = new Set(definition.exactEngineKeys || []);
  packageModel.SysApiEngines = (packageModel.SysApiEngines || [])
    .filter(engine => {
      const key = String(engine.ApiEngineKey || '');
      return !removals.has(key) && (!exactEngineKeys.size || exactEngineKeys.has(key));
    });
  packageModel.ResourcePolicies ||= { SchemaVersion: 1, ApiEngines: {} };
  packageModel.ResourcePolicies.ApiEngines ||= {};
  for (const key of removals) delete packageModel.ResourcePolicies.ApiEngines[key];
  if (exactEngineKeys.size) {
    for (const key of Object.keys(packageModel.ResourcePolicies.ApiEngines)) {
      if (!exactEngineKeys.has(key)) delete packageModel.ResourcePolicies.ApiEngines[key];
    }
  }
  for (const engine of definition.engines) configureEngine(packageModel, engine);
  if (definition.file === 'app.microi.ai-engine.json') {
    configureAiDataAssistant(packageModel);
    configureAiRuntimeSchemas(packageModel);
    configureAiMediaModelFields(packageModel);
  }
  if (definition.file === 'app.microi.sys_user.json') {
    configureSysUserAiApiKey(packageModel);
    configureSysUserHomeUsageStats(packageModel);
  }
  packageModel.DiyFields?.sort((left, right) =>
    (fieldOrder.get(fieldKey(left)) ?? Number.MAX_SAFE_INTEGER)
    - (fieldOrder.get(fieldKey(right)) ?? Number.MAX_SAFE_INTEGER));

  if (exactEngineKeys.size) {
    const actualKeys = (packageModel.SysApiEngines || [])
      .map(engine => String(engine.ApiEngineKey || ''));
    const missing = [...exactEngineKeys].filter(key => !actualKeys.includes(key));
    const unexpected = actualKeys.filter(key => !exactEngineKeys.has(key));
    const duplicates = actualKeys.filter((key, index) => actualKeys.indexOf(key) !== index);
    if (missing.length || unexpected.length || duplicates.length) {
      throw new Error(
        `${definition.file} 接口引擎闭包不正确：缺失=${missing.join(',') || '-'}，`
        + `多余=${unexpected.join(',') || '-'}，重复=${duplicates.join(',') || '-'}。`,
      );
    }
  }

  const info = packageModel.PackageInfo;
  const preserveNewerRelease = compareSemanticVersions(info.Version, definition.version) > 0;
  if (!preserveNewerRelease) info.Version = definition.version;
  info.ApiEngineCount = packageModel.SysApiEngines.length;
  const capabilityName = value => String(value || '').split('@')[0];
  const replacedCapabilityNames = new Set(definition.capabilities.map(capabilityName));
  info.RequiredPlatformCapabilities = Array.from(new Set([
    ...(Array.isArray(info.RequiredPlatformCapabilities)
      ? info.RequiredPlatformCapabilities.filter(
        capability => !replacedCapabilityNames.has(capabilityName(capability)),
      )
      : []),
    ...definition.capabilities,
  ]));
  info.ChangeHistory = prependOnce(info.ChangeHistory, definition.history);
  if (!preserveNewerRelease) info.ChangeLog = {
    Version: definition.version,
    Title: definition.changeLogTitle || 'V8 引擎优先与租户个性化扩展',
    ChangeType: definition.changeType || 'Feature',
    Content: definition.changeLogContent || definition.history,
    ReleaseTime: definition.releaseTime || releaseTime,
  };
  refreshPackageCounts(packageModel);
  normalizeOfficialApiEnginePolicies(packageModel, definition.file);
  const liveEngineKeys = new Set(
    (packageModel.SysApiEngines || []).map(engine => String(engine.ApiEngineKey || '')),
  );
  for (const key of Object.keys(packageModel.ResourcePolicies.ApiEngines)) {
    if (!liveEngineKeys.has(key)) delete packageModel.ResourcePolicies.ApiEngines[key];
  }
  return JSON.parse(normalizeOfficialPackageExecutionLimits(
    definition.file,
    JSON.stringify(packageModel),
  ));
}

export async function configureV8FirstPlatformPackages(definitions = packageDefinitions) {
  const summaries = [];
  for (const definition of definitions) {
    const packagePath = await ensureBootstrap(definition);
    const packageModel = configurePackageModel(
      JSON.parse(fs.readFileSync(packagePath, 'utf8')),
      definition,
    );
    fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, 'utf8');
    summaries.push({
      file: definition.file,
      version: definition.version,
      apiEngineCount: packageModel.SysApiEngines.length,
    });
  }
  return summaries;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const summary of await configureV8FirstPlatformPackages()) {
    process.stdout.write(`${summary.file}\t${summary.version}\t${summary.apiEngineCount}\n`);
  }
}
