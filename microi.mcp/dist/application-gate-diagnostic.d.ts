import type { ApiResponse } from './microi-client.js';
export declare const APPLICATION_GATE_RECOVERY = "\u4FDD\u6301\u7528\u6237\u6307\u5B9A\u7684\u5F53\u524D\u5B50\u79DF\u6237 MCP\u3001ApiBase \u548C OsClient\u3002\u6B64\u9519\u8BEF\u662F\u5E94\u7528\u53D1\u5E03\u95E8\u7981\u53D6\u6570/\u914D\u7F6E\u6545\u969C\uFF0C\u4E0D\u80FD\u636E\u4E1A\u52A1\u5E93 sys_osclients \u4E3A\u7A7A\u63A8\u65AD\u4E3B\u63A7\u767B\u8BB0\u7F3A\u5931\uFF1B\u4E0D\u8981\u7D22\u8981\u4E3B\u79DF\u6237\u8D26\u53F7\u3001\u5207\u6362 profile\u3001\u8C03\u7528\u8865\u767B\u8BB0\u63A5\u53E3\u6216\u7ED5\u8FC7\u95E8\u7981\u3002\u8BF7\u5411\u5E73\u53F0\u63D0\u4EA4\u5F53\u524D\u79DF\u6237\u4E09\u53C2\u6570\u3001\u540E\u7AEF\u7248\u672C\u4E0E\u539F\u59CB\u9519\u8BEF\uFF0C\u6838\u67E5 SaaS \u4E3B\u63A7\u5E93\u6765\u6E90\u53CA\u540E\u7AEF\u4FEE\u590D\u3002";
/** Decorate old and new API failures without changing authentication or retry policy. */
export declare function withApplicationGateDiagnostic<T>(result: ApiResponse<T>, binding: {
    osClient?: string;
    apiBaseUrl: string;
}): ApiResponse<T>;
//# sourceMappingURL=application-gate-diagnostic.d.ts.map