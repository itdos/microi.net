import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ApiResponse, MicroiClient } from './microi-client.js';
export { buildMcpOcrResult, decodeMcpTranslatedFile, prepareMcpOcrInput, prepareMcpTranslateFileInput, } from './document-inputs.js';
export type { PreparedMcpOcrInput, PreparedMcpTranslateFileInput } from './document-inputs.js';
/** MCP Server 上下文（用于区分不同租户） */
export interface McpServerContext {
    osClient: string;
    /** Exact SaaS coordinate component; an empty string remains significant. */
    osClientType?: string;
    /** Exact SaaS coordinate component; an empty string remains significant. */
    osClientNetwork?: string;
    apiBaseUrl: string;
    /** 服务器显示名称（SysTitle），与 mcp.json 中的 key 一致 */
    label: string;
    /** Codex compatibility mode exposes only microi_codex at protocol level. */
    codexMode?: boolean;
}
export interface LocalApplicationAsset {
    absolutePath: string;
    relativePath: string;
    size: number;
    sha256: string;
    isEntry: boolean;
}
export interface LocalApplicationAssetManifest {
    rootDirectory: string;
    entryPath: string;
    assets: LocalApplicationAsset[];
    totalSize: number;
    manifestHash: string;
    skippedSourceMaps: string[];
    skippedInternalEvidenceFiles: string[];
}
export interface LocalMicroServiceSourceFile {
    absolutePath: string;
    relativePath: string;
    size: number;
    sha256: string;
}
export interface LocalMicroServiceSourceManifest {
    rootDirectory: string;
    files: LocalMicroServiceSourceFile[];
    totalSize: number;
    manifestHash: string;
    skippedDirectories: string[];
    skippedFiles: string[];
}
export type ApplicationStreamPublishMode = 'stage' | 'finalize' | 'stage-and-finalize';
export interface ApplicationDirectoryStreamPublishInput {
    appIdOrKey: string;
    versionNo: string;
    directory: string;
    entryPath?: string;
    routes?: Array<Record<string, unknown>>;
    changeSummary?: string;
    sourceManifestHash?: string;
    runtimeManifestHash?: string;
    routeSnapshotJson?: string;
    routeSnapshotHash?: string;
    deliveryBatchId?: string;
    publishMode?: ApplicationStreamPublishMode;
    protocolVersion?: 3;
    expectedGateEpoch?: string;
    requestId?: string;
    requestFingerprint?: string;
    expectedCurrentVersion?: number;
    expectedAppVersion?: string | null;
    expectedPublishFence?: string;
    expectedPublishRowVersion?: string;
    expectedVersionRowVersion?: string | null;
    expectedActivePublishVersionId?: string | null;
    expectedCommittedPublishVersionId?: string | null;
    includeSourceMaps?: boolean;
    maxFiles?: number;
    maxTotalMegabytes?: number;
    timeoutMsPerFile?: number;
    allowLegacyFallback?: boolean;
    confirmExecution?: string;
}
export type ApplicationStreamGateMode = 'LegacyOpen' | 'Drain' | 'V3Only';
export interface ApplicationStreamGateTransitionInput {
    osClient: string;
    osClientType: string;
    osClientNetwork: string;
    expectedMode: ApplicationStreamGateMode;
    expectedMinProtocol: 2 | 3;
    expectedGateEpoch: string;
    targetMode: ApplicationStreamGateMode;
    transitionId: string;
    reason: string;
    drainProofJson: string;
    drainProofHash: string;
}
export interface ApplicationStreamGateTransitionConfirmation {
    payload: {
        OsClient: string;
        OsClientType: string;
        OsClientNetwork: string;
        ExpectedMode: ApplicationStreamGateMode;
        ExpectedMinProtocol: 2 | 3;
        ExpectedGateEpoch: string;
        TargetMode: ApplicationStreamGateMode;
        TargetMinProtocol: 2 | 3;
        TransitionId: string;
        Reason: string;
        DrainProofJson: string;
        DrainProofHash: string;
    };
    confirmationCanonicalJson: string;
    confirmationSha256: string;
}
export declare function validateLocalApplicationAssetSize(relativePath: string, fileSize: number, nextTotalSize: number, maxTotalBytes?: number): void;
export declare function buildApplicationAssetRequestId(input: {
    deliveryBatchId: string;
    appIdOrKey: string;
    versionNo: string;
    relativePath: string;
    sha256: string;
}): string;
export declare function buildApplicationFinalizeRequestId(input: {
    deliveryBatchId: string;
    appIdOrKey: string;
    versionNo: string;
    runtimeManifestHash: string;
    expectedCurrentVersion?: number;
    expectedAppVersion?: string | null;
}): string;
interface ResolvedApplicationAssetStreamV3Contract {
    protocolVersion: 3;
    expectedGateEpoch: string;
    requestId: string;
    requestFingerprint: string;
    deliveryBatchId: string;
    sourceManifestHash: string;
    runtimeManifestHash: string;
    routeSnapshotJson: string;
    routeSnapshotHash: string;
    expectedCurrentVersion: number;
    expectedAppVersion: string | null;
    expectedPublishFence: string;
    expectedPublishRowVersion: string;
    expectedVersionRowVersion: string | null;
    expectedActivePublishVersionId: string | null;
    expectedCommittedPublishVersionId: string | null;
}
/**
 * Validate and freeze an application-stream gate transition before any remote
 * call is possible. The returned SHA-256 covers the exact tenant coordinate,
 * compare-and-swap baseline, target state, reason, and canonical drain proof.
 */
export declare function buildApplicationStreamGateTransitionConfirmation(input: ApplicationStreamGateTransitionInput, context: Pick<McpServerContext, 'osClient' | 'osClientType' | 'osClientNetwork'>): ApplicationStreamGateTransitionConfirmation;
export declare function buildApplicationAssetStreamV3RouteSnapshot(routes?: Array<Record<string, unknown>>): {
    routeSnapshotJson: string;
    routeSnapshotHash: string;
};
export declare function resolveApplicationAssetStreamV3Contract(input: ApplicationDirectoryStreamPublishInput, runtimeManifestHash: string): ResolvedApplicationAssetStreamV3Contract | null;
/**
 * Mirror Core's protocol-v3 path contract without using the legacy path
 * normalizer. v3 never trims, decodes, slash-rewrites, or silently normalizes a
 * caller path: the bytes covered by the manifest must be the bytes uploaded.
 */
export declare function encodeApplicationAssetStreamV3RelativePath(value: string, label?: string): string;
export declare function buildConservativeApplicationAssetStreamV3ImmutablePath(input: {
    appIdOrKey: string;
    versionNo: string;
    requestFingerprint: string;
    relativePath: string;
}): {
    encodedRelativePath: string;
    immutablePath: string;
};
/**
 * Inspect and hash a built directory without loading any file wholly into RAM.
 * The hard caps also stop accidental node_modules/.git/trash-directory loops.
 */
export declare function buildLocalApplicationAssetManifest(rootDirectory: string, entryPath?: string, options?: {
    includeSourceMaps?: boolean;
    maxFiles?: number;
    maxTotalBytes?: number;
}): Promise<LocalApplicationAssetManifest>;
/**
 * Build the private-source manifest inside the MCP process. Source bytes never
 * enter the model context: callers pass one local directory and the server
 * reads each ordinary file directly after a bounded preflight.
 */
export declare function buildLocalMicroServiceSourceManifest(rootDirectory: string, options?: {
    maxFiles?: number;
    maxTotalBytes?: number;
}): Promise<LocalMicroServiceSourceManifest>;
export interface LegacyStreamPublishFallbackResult {
    attempted: boolean;
    reason: string;
    appKey?: string;
    response?: ApiResponse;
}
/**
 * A short-lived compatibility detector for API nodes that predate the strongly
 * typed HDFS selector fix. Those nodes fail before writing the first asset when
 * the dynamic runtime tries to invoke Dos.Common.Val<T> on a JValue.
 */
export declare function isLegacyApplicationStreamJValueFailure(result?: Partial<ApiResponse> | null): boolean;
/**
 * Detect old API nodes whose dynamic JSON path calls Val<T>() on a JValue.
 * Keep this generic so metadata tools can use a narrowly-scoped, verified
 * compatibility path without treating unrelated server failures as writable.
 */
export declare function isLegacyJValueValFailure(result?: Partial<ApiResponse> | null): boolean;
export declare function defaultLayoutFieldFormWidth(component: string, formWidth?: number): number | undefined;
export declare function normalizeLayoutFieldConfig(component: string, config?: string | Record<string, unknown>): string | undefined;
export declare function resolveLegacyApplicationStreamFallbackPolicy(result: Partial<ApiResponse> | null | undefined, uploadedCount: number, allowLegacyFallback?: boolean): {
    matched: boolean;
    attemptFallback: boolean;
    requireMultipartStream: boolean;
};
/**
 * Bridge a rolling-upgrade window without retrying the broken stream endpoint.
 * The fallback is deliberately restricted to small existing MicroServices: it
 * uses the legacy C# PublishMicroService JSON endpoint, never Jint, and refuses
 * Web/UniApp or large directories rather than silently changing their runtime.
 */
export declare function tryLegacyMicroServiceStreamPublishFallback(client: MicroiClient, manifest: LocalApplicationAssetManifest, input: {
    appIdOrKey: string;
    versionNo: string;
    routes?: Array<Record<string, unknown>>;
    deliveryBatchId: string;
    sourceManifestHash?: string;
    expectedCurrentVersion?: number;
    expectedAppVersion?: string | null;
}): Promise<LegacyStreamPublishFallbackResult>;
/**
 * Execute the application-directory stream protocol independently of MCP tool
 * registration so stage/finalize/retry semantics can be tested directly.
 */
export declare function runApplicationDirectoryStreamPublish(client: MicroiClient, input: ApplicationDirectoryStreamPublishInput): Promise<CallToolResult>;
interface AccessKeyCreationConfirmationInput {
    name: string;
    allowedRoutes: string[];
    allowedTableNames: string[];
    scopes?: string[];
    redirectPath?: string;
    allowedApiEngineKeys?: string[];
    allowedDataSourceKeys?: string[];
    expiresAt?: string;
    remark?: string;
}
/**
 * Canonicalize the effective access-key grant before asking for confirmation.
 * The returned SHA-256 binds confirmation to scopes, allowlists and expiry,
 * rather than only to a reusable display name.
 */
export declare function buildAccessKeyCreationConfirmation(input: AccessKeyCreationConfirmationInput): {
    normalized: Required<AccessKeyCreationConfirmationInput>;
    sha256: string;
};
/**
 * 创建 MCP Server 并注册所有工具
 * @param client - Microi API 客户端
 * @param context - 服务器上下文（OsClient、API地址），用于在 instructions 中标识身份
 */
export declare function createMcpServer(client: MicroiClient, context: McpServerContext): McpServer;
//# sourceMappingURL=server.d.ts.map