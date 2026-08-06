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
export type StoreApplicationOperation = 'install' | 'update';
export interface StoreApplicationTaskInput {
    operation: StoreApplicationOperation;
    storeId: string;
    requestId: string;
    storeApiBase?: string;
    storeOsClient?: string;
    appId?: string;
    appName?: string;
    appVersion?: string;
    installParentSysMenuId?: string;
    resumeInstall?: boolean;
}
export declare function buildStoreApplicationBackgroundRequest(input: StoreApplicationTaskInput): {
    ApiEngineKey: string;
    Title: string;
    Param: JsonRecord;
    Options: JsonRecord;
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
export declare function buildPlan(manifest: JsonRecord): {
    plan: string[];
    errors: string[];
    warnings: string[];
};
export declare function manifestGuide(osClient: string | undefined): JsonRecord;
export declare function registerAdvancedTools(server: McpServer, client: MicroiClient, context: McpServerContext): void;
export {};
//# sourceMappingURL=advanced-tools.d.ts.map