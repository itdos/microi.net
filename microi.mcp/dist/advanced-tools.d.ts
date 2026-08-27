import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MicroiClient, ApiResponse } from './microi-client.js';
import type { McpServerContext } from './server.js';
type JsonRecord = Record<string, unknown>;
export declare function analyzeBackgroundWorkload(buttonInput: unknown, options?: {
    inferActionSemantics?: boolean;
}): {
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
    storeVersionId?: string;
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
export declare function buildGenerateSystemValidationPayload(results: JsonRecord[], validation: ApiResponse): JsonRecord;
export declare function normalizeViewSchemaJson(raw: unknown): {
    ok: boolean;
    value?: string;
    errors: string[];
    warnings: string[];
};
/** Stable semantic list width used when AI/Manifest callers omit TableWidth. */
export declare function inferTableColumnWidth(value: unknown): number;
/**
 * Minimum production-ready List/Card presentation for every visible bound module.
 * It intentionally contains no Detail/Edit views, so EnableViewSchema remains a
 * custom-form switch only. Metrics are real field aggregates/list counts; never random.
 */
export declare function buildDefaultModulePresentation(moduleName: string, rawFields: unknown[], tableDescription?: string): JsonRecord;
export declare function buildPlan(manifest: JsonRecord): {
    plan: string[];
    errors: string[];
    warnings: string[];
};
/**
 * Build the semantic diy_table Banner patch used by Manifest generation.
 * Explicit arrays win (including []); otherwise business field types supply a
 * stable, useful first rendering for new modules and old databases alike.
 */
export declare function buildDefaultFormBanner(table: JsonRecord): JsonRecord;
/**
 * Validate the portable relation contract before any Manifest write occurs.
 * Runtime ids in raw Config are deliberately not trusted: they are resolved
 * from table/module names after the tenant resources exist.
 */
export declare function validateManifestFieldRelations(manifest: JsonRecord): {
    errors: string[];
    warnings: string[];
};
export declare function resolveManifestRelationConfig(field: JsonRecord, currentTableName: string, tableIdByName: Map<string, string>, moduleIdByName: Map<string, string>): JsonRecord;
/**
 * Resolve a portable Manifest MicroService reference to the tenant-specific
 * sys_microiservice/sys_microiservice_page ids before any system writes begin.
 */
export declare function resolveMicroServiceModuleBinding(client: Pick<MicroiClient, 'getMicroService'>, module: JsonRecord): Promise<JsonRecord | undefined>;
export declare function dataSourcePayload(dataSource: JsonRecord): JsonRecord;
export declare function manifestGuide(osClient: string | undefined): JsonRecord;
export declare function registerAdvancedTools(server: McpServer, client: MicroiClient, context: McpServerContext): void;
export {};
//# sourceMappingURL=advanced-tools.d.ts.map