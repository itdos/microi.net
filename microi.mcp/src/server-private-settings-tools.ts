import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient } from './microi-client.js';

export function registerServerPrivateSettingsTools(server: McpServer, client: MicroiClient): void {
  server.tool('microi_manage_server_private_secret',
    'Discover/store third-party App Secret, ClientSecret and API keys (including Changjet/T+ ERP) in 系统设置 → 安全与服务接入. Use this EXISTING facility before proposing new server code/configuration. List returns metadata only. Save encrypts through the trusted settings endpoint and reads back HasSecret. Backend V8 uses V8.SysConfig.ServerPrivateSettings[ConfigKey]; frontend V8 and V8.OsClientModel cannot read it. Requires an interactive tenant administrator session; access-key sessions are rejected. No reveal or delete is exposed.',
    {
      action: z.enum(['List', 'Save']),
      configKey: z.string().min(1).max(200).optional().describe('Stable key, e.g. Integration.Changjet.AppSecret.'),
      value: z.string().min(1).max(1048576).optional().describe('Save only: user-supplied secret. Never include in source/output.'),
      category: z.string().max(100).optional(), description: z.string().max(500).optional(),
      confirmExecution: z.string().optional().describe('Save requires SAVE:<ConfigKey>. Existing explicit user authorization is sufficient.'),
    }, async ({ action, configKey, value, category, description, confirmExecution }) => {
      const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });
      if (action === 'Save' && (!configKey || !value || confirmExecution !== `SAVE:${configKey}`))
        return failure('保存需要 ConfigKey、Value 和 confirmExecution=SAVE:<ConfigKey>。');
      try {
        if (action === 'Save') {
          const saved = await client.saveServerPrivateSecret({ configKey: configKey!, value: value!, category, description });
          if (saved.Code !== 1) return failure(`Secret 保存失败（Code=${saved.Code}），请检查当前租户管理员权限与系统设置应用。`);
        }
        const read = await client.listServerPrivateSettings();
        if (read.Code !== 1) return failure('无法回读设置；若刚保存，请用 List 回读，不要重复写入。');
        const rows = Array.isArray(read.Data) ? read.Data : [];
        const safeRows = rows.filter(row => !configKey || row.ConfigKey === configKey).map(row => ({
          Id: row.Id, ConfigKey: row.ConfigKey, Category: row.Category, IsSecret: row.IsSecret,
          HasSecret: row.HasSecret, IsEnabled: row.IsEnabled,
        }));
        if (action === 'Save' && !safeRows.some(row => row.IsSecret && row.HasSecret))
          return failure('保存响应已返回，但 Secret 状态尚未确认，请通过 List 继续回读。');
        return { content: [{ type: 'text' as const, text: JSON.stringify({ Data: safeRows,
          Usage: '后端 V8.SysConfig.ServerPrivateSettings[ConfigKey]；禁止记录、返回或输出原文。' }, null, 2) }] };
      } catch {
        return failure('Secret 操作未确认完成，请检查连接并通过 List 回读；不会自动重复保存或输出秘密。');
      }
    });
}
