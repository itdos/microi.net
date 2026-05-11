/**
 * 业务架构蓝图（System Blueprint）MCP 工具
 *
 * 蓝图是 design-time 知识图谱（不是 runtime 工作流）：
 *   - 三层模型：领域层(ER) / 流程层(Process) / 行为层(V8/接口引擎)
 *   - 既是用户在线协作的"系统总图"
 *   - 也是 AI grounding 的唯一事实源（防止幻觉）
 *
 * AI 使用约定：
 *   1. 在 generate_system / create_table / create_engine 前 **先调用 microi_get_blueprint**
 *      读取与目标系统相关的蓝图，作为生成代码的事实依据。
 *   2. 修改完代码/表结构后，**调用 microi_validate_blueprint** 检查蓝图是否漂移；
 *      若漂移，需要先用 microi_save_blueprint 更新蓝图，再继续后续操作。
 *   3. 写入操作必须传 confirmExecution（蓝图名称 或 "EXECUTE"）。
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { MicroiClient, ApiResponse } from './microi-client.js';
import type { McpServerContext } from './server.js';

type ToolContent = { type: 'text'; text: string };
type ToolResult = { content: ToolContent[]; isError?: boolean };

const jsonRecordSchema = z.record(z.unknown());

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: 'text', text }], isError };
}

function apiText(title: string, response: ApiResponse): ToolResult {
  const lines = [
    `## ${title}`,
    `- Code: ${response.Code}`,
    response.Msg ? `- Message: ${response.Msg}` : '',
    '',
    '```json',
    JSON.stringify(response.Data ?? {}, null, 2),
    '```',
  ].filter(Boolean);
  return textResult(lines.join('\n'), response.Code !== 1);
}

async function audit(client: MicroiClient, action: string, target: string, payload: unknown): Promise<void> {
  try {
    await client.writeAuditLog(action, target, JSON.stringify(payload).slice(0, 6000));
  } catch (error) {
    console.error('[microi-mcp] blueprint audit log failed:', error instanceof Error ? error.message : String(error));
  }
}

const BLUEPRINT_GUIDE = `# Microi 业务架构蓝图（System Blueprint）协议

## 顶层结构
\`\`\`json
{
  "Id": "可选，更新时传",
  "Name": "CRM 客户管理系统",
  "Code": "crm_customer",
  "Description": "客户全生命周期管理...",
  "Version": "1.0",
  "RootDiagramId": "diag_main",
  "Status": 1,
  "BlueprintData": "<JSON 字符串，结构见下>",
  "ChangeSummary": "本次变更说明（可选，写入历史快照）"
}
\`\`\`

## BlueprintData JSON 结构（三层模型）
\`\`\`json
{
  "diagrams": [
    {
      "id": "diag_main",
      "type": "process",
      "name": "总体流程",
      "nodes": [
        {
          "id": "node_customer_create",
          "shape": "table",
          "label": "建档",
          "x": 100, "y": 200,
          "refs": {
            "tables": ["crm_customer"],
            "fields": ["crm_customer.Status"],
            "engines": ["api_customer_create"],
            "menus": ["客户列表"],
            "v8Events": ["crm_customer:SubmitBeforeServerV8"],
            "subDiagram": "diag_followup"
          }
        }
      ],
      "edges": [
        { "source": "node_customer_create", "target": "node_followup", "label": "审核通过", "condition": "Status==1" }
      ]
    },
    { "id": "diag_followup", "type": "process", "parent": "node_customer_create", "nodes": [], "edges": [] }
  ],
  "domainModel": {
    "entities": [
      { "table": "crm_customer", "x": 50, "y": 50,
        "relations": [{ "to": "crm_contact", "type": "1:N", "via": "CustomerId" }] }
    ]
  },
  "metadata": { "lastSyncedSchemaHash": "..." }
}
\`\`\`

## refs 支持的关联类型
- tables: diy_table.Name 或 Id
- fields: "tableName.fieldName" 格式
- engines: sys_apiengine.ApiEngineKey
- menus: sys_menu.Name
- v8Events: "tableName:eventType" （eventType 见 V8 事件大全）
- dataSources / printTemplates / workflows / pages / jobs

## AI 工作流（防幻觉）
1. **生成前**：调用 \`microi_list_blueprints\` 看是否已有蓝图；有则 \`microi_get_blueprint\` 读取作为上下文。
2. **生成中**：根据蓝图节点的 refs 决定建什么表/字段/接口引擎/事件，确保不偏离设计。
3. **生成后**：调用 \`microi_validate_blueprint\` 检查蓝图引用是否仍存在；若 BlueprintData 变化也调用 \`microi_save_blueprint\` 同步。
`;

export function registerBlueprintTools(server: McpServer, client: MicroiClient, context: McpServerContext): void {
  const osClient = context.osClient;

  server.tool(
    'microi_get_blueprint_schema',
    'Return the System Blueprint protocol guide (3-layer model: domain/process/behavior). Read this BEFORE creating or editing any blueprint, especially when AI is generating systems for the first time.',
    {},
    async () => textResult(BLUEPRINT_GUIDE),
  );

  server.tool(
    'microi_list_blueprints',
    `List business blueprints for OsClient ${osClient}. Lightweight metadata only (no BlueprintData). Use this to discover existing system blueprints before generating new code.`,
    { keyword: z.string().optional().describe('Search by Name/Code/Description') },
    async ({ keyword }) => apiText('Blueprints', await client.listBlueprints(keyword)),
  );

  server.tool(
    'microi_get_blueprint',
    `Get full blueprint detail (including BlueprintData JSON) by Id or Name. AI MUST call this before generating any system code so generation is grounded on the blueprint, not guessed. OsClient: ${osClient}`,
    { blueprintId: z.string().describe('Blueprint Id or Name (Name fallback if Id not matched)') },
    async ({ blueprintId }) => apiText('Blueprint Detail', await client.getBlueprint(blueprintId)),
  );

  server.tool(
    'microi_save_blueprint',
    `Create or update a system blueprint. Auto-saves a history snapshot (sys_blueprint_history) and rebuilds the reverse-reference index (sys_blueprint_relation). Pass the blueprint per microi_get_blueprint_schema. OsClient: ${osClient}`,
    {
      blueprint: jsonRecordSchema.describe('Blueprint object: { Id?, Name, Code?, Description?, Version?, RootDiagramId?, Status?, BlueprintData (JSON string), ChangeSummary? }'),
      confirmExecution: z.string().optional().describe('Must equal blueprint Name or "EXECUTE" to actually write'),
    },
    async ({ blueprint, confirmExecution }) => {
      const name = (blueprint?.Name as string) || (blueprint?.name as string) || '';
      if (!name) return textResult('blueprint.Name 不能为空', true);
      if (confirmExecution !== name && confirmExecution !== 'EXECUTE') {
        return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
      }
      await audit(client, 'microi_save_blueprint', name, blueprint);
      return apiText('Save Blueprint', await client.saveBlueprint(blueprint));
    },
  );

  server.tool(
    'microi_delete_blueprint',
    `Soft-delete a blueprint and its reverse-reference rows (history snapshots are preserved). OsClient: ${osClient}`,
    {
      blueprintId: z.string().describe('Blueprint Id'),
      confirmExecution: z.string().describe('Must equal blueprintId or "EXECUTE"'),
    },
    async ({ blueprintId, confirmExecution }) => {
      if (confirmExecution !== blueprintId && confirmExecution !== 'EXECUTE') {
        return textResult(`删除已拦截：请传 confirmExecution="${blueprintId}" 或 "EXECUTE"。`, true);
      }
      await audit(client, 'microi_delete_blueprint', blueprintId, { BlueprintId: blueprintId });
      return apiText('Delete Blueprint', await client.deleteBlueprint(blueprintId));
    },
  );

  server.tool(
    'microi_validate_blueprint',
    `Validate that all platform resources referenced by a blueprint (tables/fields/engines/menus/v8Events) still exist. Returns errors/warnings/CheckedRefs. AI should call this AFTER any system change to detect blueprint drift. OsClient: ${osClient}`,
    { blueprintId: z.string().describe('Blueprint Id or Name') },
    async ({ blueprintId }) => apiText('Validate Blueprint', await client.validateBlueprint(blueprintId)),
  );
}
