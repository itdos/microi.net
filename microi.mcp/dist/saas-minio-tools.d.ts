import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MicroiClient } from './microi-client.js';
/** 部署凭据不进入通用表工具或 V8；只经过主租户管理员的专用控制面。 */
export declare function registerSaasMinioTools(server: McpServer, client: MicroiClient, tenant: string): void;
//# sourceMappingURL=saas-minio-tools.d.ts.map