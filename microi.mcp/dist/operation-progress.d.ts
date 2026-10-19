import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
type Scope = {
    requests: number;
    mutationStarted: boolean;
    validationRejected: boolean;
    sequence: number;
    report: (message: string, progress: number) => Promise<void>;
};
/** 只能在可信 dispatcher/明确的写前校验分支调用；不能凭“没看到请求”推断未写入。 */
export declare function notExecuted(result: CallToolResult): CallToolResult;
/** 只发送固定阶段名；请求正文、SQL、返回值和身份信息不进入进度通知。 */
export declare function reportOperation(path: string, method: string, completed?: boolean): Promise<void>;
/** 只接收已鉴权 MCP 端点的 ORM 回执；不从模型参数或推测的 SQL 生成事件。 */
export declare function reportDdlEvents(path: string, response: unknown): Promise<void>;
export declare function withOperationProgress(run: () => Promise<CallToolResult>, report?: Scope['report']): Promise<CallToolResult>;
export {};
//# sourceMappingURL=operation-progress.d.ts.map