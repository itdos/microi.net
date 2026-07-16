export interface McpLabelEnvironment {
    MICROI_LABEL_BASE64?: string;
    MICROI_LABEL?: string;
}
/**
 * MCP 客户端配置优先传 ASCII Base64，避免部分客户端把环境值误走
 * ByteString/Header 链路时无法处理中文。MICROI_LABEL 仅保留旧配置兼容。
 */
export declare function resolveMcpLabel(env: McpLabelEnvironment): string;
//# sourceMappingURL=mcp-label.d.ts.map