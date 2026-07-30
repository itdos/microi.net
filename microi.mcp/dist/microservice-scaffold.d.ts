export interface VueMicroServiceRouteInput {
    path: string;
    name: string;
    title: string;
    description?: string;
    isHome?: boolean;
}
export interface VueMicroServiceScaffoldOptions {
    aiApplicationsDirectory: string;
    appKey: string;
    name: string;
    description?: string;
    apiBaseUrl?: string;
    osClient?: string;
    buildVersion?: string;
    routes: VueMicroServiceRouteInput[];
    sdkSource?: string;
    createdAt?: string;
}
export interface VueMicroServiceScaffoldPlan {
    targetDirectory: string;
    appKey: string;
    name: string;
    buildVersion: string;
    routes: Array<VueMicroServiceRouteInput & {
        sourceFile: string;
        sort: number;
        isHome: boolean;
    }>;
    files: Array<{
        relativePath: string;
        size: number;
        sha256: string;
    }>;
    fileContents: Map<string, string>;
}
export interface VueMicroServiceScaffoldResult {
    created: boolean;
    skipped: boolean;
    targetDirectory: string;
    appKey: string;
    fileCount: number;
    routes: VueMicroServiceScaffoldPlan['routes'];
}
export declare function resolveMicroiSdkSource(workspaceRoot?: string): string | undefined;
export declare function buildVueMicroServiceScaffoldPlan(options: VueMicroServiceScaffoldOptions): VueMicroServiceScaffoldPlan;
export declare function scaffoldVueMicroService(options: VueMicroServiceScaffoldOptions): VueMicroServiceScaffoldResult;
//# sourceMappingURL=microservice-scaffold.d.ts.map