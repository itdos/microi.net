import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MicroiClient } from './microi-client.js';
/** MCP Server 上下文（用于区分不同租户） */
export interface McpServerContext {
    osClient: string;
    apiBaseUrl: string;
    /** 服务器显示名称（SysTitle），与 mcp.json 中的 key 一致 */
    label: string;
}
/**
 * 创建 MCP Server 并注册所有工具
 * @param client - Microi API 客户端
 * @param context - 服务器上下文（OsClient、API地址），用于在 instructions 中标识身份
 */
export declare function createMcpServer(client: MicroiClient, context: McpServerContext): McpServer;
//# sourceMappingURL=server.d.ts.map