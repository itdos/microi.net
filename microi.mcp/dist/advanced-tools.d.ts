import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MicroiClient } from './microi-client.js';
import type { McpServerContext } from './server.js';
type JsonRecord = Record<string, unknown>;
export declare function analyzeBackgroundWorkload(buttonInput: unknown): {
    required: boolean;
    reasons: string[];
};
export declare function analyzeClientChunking(buttonInput: unknown): {
    declared: boolean;
    valid: boolean;
    maxItemsPerChunk: number;
    resumable: boolean;
};
export declare function normalizeAllMenuJson(data: JsonRecord): {
    data: JsonRecord;
    errors: string[];
    warnings: string[];
};
export declare function normalizeViewSchemaJson(raw: unknown): {
    ok: boolean;
    value?: string;
    errors: string[];
    warnings: string[];
};
export declare function registerAdvancedTools(server: McpServer, client: MicroiClient, context: McpServerContext): void;
export {};
//# sourceMappingURL=advanced-tools.d.ts.map