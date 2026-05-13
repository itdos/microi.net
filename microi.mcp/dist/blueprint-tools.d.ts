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
import type { MicroiClient } from './microi-client.js';
import type { McpServerContext } from './server.js';
export declare function registerBlueprintTools(server: McpServer, client: MicroiClient, context: McpServerContext): void;
//# sourceMappingURL=blueprint-tools.d.ts.map