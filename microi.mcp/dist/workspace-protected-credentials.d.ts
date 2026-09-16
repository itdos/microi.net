export interface WorkspaceCredentialLocation {
    filePath?: string;
    usernameKey?: string;
    passwordKey?: string;
}
export interface WorkspaceCredentials {
    username: string;
    password: string;
}
export declare function unprotectWithWindowsDpapi(ciphertext: Buffer): Buffer;
export declare function isProtectedSessionToken(value: unknown): boolean;
export declare function unprotectSessionToken(value: unknown): string;
export declare function protectSessionToken(value: string): string;
/**
 * 读取当前工作区 DPAPI 保险库中的单个 profile 凭据。函数只返回内存值，
 * 不输出用户名、密码、密文或 PowerShell stderr。
 */
export declare function readWorkspaceCredentials(location: WorkspaceCredentialLocation, unprotect?: (ciphertext: Buffer) => Buffer): WorkspaceCredentials | undefined;
//# sourceMappingURL=workspace-protected-credentials.d.ts.map