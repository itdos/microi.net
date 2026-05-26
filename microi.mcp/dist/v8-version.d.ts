export interface PrepareV8VersionOptions {
    kind: 'ApiEngine' | 'V8Event' | 'Workflow';
    key: string;
    eventType?: string;
    currentCode: string;
    remoteCode?: string;
    remoteVersion?: string;
    functionDescription?: string;
    changeSummary?: string;
    initial?: boolean;
}
export interface PreparedV8Code {
    code: string;
    version: string;
    changeHistory: string;
}
export declare function parseV8Version(value?: string): string | null;
export declare function incrementV8Version(version: string | null): string;
export declare function prepareV8VersionedCode(options: PrepareV8VersionOptions): PreparedV8Code;
//# sourceMappingURL=v8-version.d.ts.map