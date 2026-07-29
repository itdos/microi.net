import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MicroiClient } from './microi-client.js';
import type { McpServerContext } from './server.js';
export declare function analyzeBackgroundWorkload(buttonInput: unknown): {
    required: boolean;
    reasons: string[];
};
export declare function normalizeViewSchemaJson(raw: unknown): {
    ok: boolean;
    value?: string;
    errors: string[];
    warnings: string[];
};
export declare function registerAdvancedTools(server: McpServer, client: MicroiClient, context: McpServerContext): void;
//# sourceMappingURL=advanced-tools.d.ts.map