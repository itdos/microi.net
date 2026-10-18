/** 仅计量工具载荷，不保留问题、源码、身份、凭据或错误正文；字节不是供应商 token。 */
export declare class ToolPayloadMetrics {
    private readonly actions;
    measure<T>(action: string, request: unknown, run: () => Promise<T> | T): Promise<T>;
    snapshot(): {
        scope: string;
        unit: string;
        providerUsage: string;
        definition: string;
        totals: {
            calls: number;
            errors: number;
            requestBytes: number;
            responseBytes: number;
        };
        actions: {
            elapsedMs: number;
            calls: number;
            errors: number;
            requestBytes: number;
            responseBytes: number;
            action: string;
        }[];
    };
    private bytes;
}
//# sourceMappingURL=tool-metrics.d.ts.map