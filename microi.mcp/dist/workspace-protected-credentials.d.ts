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
 * 从当前用户的 OS 安全存储读取工作区内单个 profile 凭据。函数只返回内存值，
 * 不输出用户名、密码、密文或系统工具 stderr。
 */
export declare function readWorkspaceCredentials(location: WorkspaceCredentialLocation, unprotect?: (ciphertext: Buffer) => Buffer): WorkspaceCredentials | undefined;
//# sourceMappingURL=workspace-protected-credentials.d.ts.map