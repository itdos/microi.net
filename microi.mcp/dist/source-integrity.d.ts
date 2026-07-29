export interface SourceIntegrityIssue {
    line: number;
    marker: string;
}
export declare function findSourceIntegrityIssues(source: string): SourceIntegrityIssue[];
export declare function assertSourceIntegrity(source: string, operation: string): void;
export declare function assertPayloadSourceIntegrity(value: unknown, operation: string, path?: string): void;
//# sourceMappingURL=source-integrity.d.ts.map