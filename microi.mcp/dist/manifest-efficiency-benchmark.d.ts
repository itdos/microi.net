/** 输出为离线 MCP 载荷对照，不把 UTF-8 字节或 mock 验收当作模型账单/远端业务验收。 */
export declare function runManifestEfficiencyBenchmark(outputPath?: string): Promise<{
    format: string;
    measuredAt: string;
    metric: string;
    baseline: string;
    candidate: string;
    boundary: string;
    gates: {
        sameResourceOperations: boolean;
        sameValidationEnvelope: boolean;
        independentValidationExecuted: boolean;
        failures: number;
    };
    cases: {
        id: string;
        manifestBytes: number;
        baseline: {
            requestBytes: number;
            responseBytes: number;
            toolCalls: number;
            clientCalls: number;
            validationCalls: number;
            errors: number;
            passed: any;
        };
        candidate: {
            requestBytes: number;
            responseBytes: number;
            toolCalls: number;
            clientCalls: number;
            validationCalls: number;
            errors: number;
            passed: any;
        };
        requestReductionPercent: number;
        totalReductionPercent: number;
        selected: {
            requestBytes: number;
            responseBytes: number;
            toolCalls: number;
            clientCalls: number;
            validationCalls: number;
            errors: number;
            passed: any;
            strategy: string;
        };
        contractHash: string;
        contractsEqual: boolean;
    }[];
}>;
//# sourceMappingURL=manifest-efficiency-benchmark.d.ts.map