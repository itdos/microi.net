import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

interface ProtectedVaultEnvelope {
  version: 1;
  protection: 'windows-dpapi-current-user';
  ciphertext: string;
}
interface ProtectedVaultDocument {
  version: 1;
  values: Record<string, string>;
}

export interface WorkspaceCredentialLocation {
  filePath?: string;
  usernameKey?: string;
  passwordKey?: string;
}

export interface WorkspaceCredentials {
  username: string;
  password: string;
}

const DPAPI_UNPROTECT_SCRIPT = [
  'Add-Type -AssemblyName System.Security;',
  '$inputBase64 = [Console]::In.ReadToEnd().Trim();',
  '$cipher = [Convert]::FromBase64String($inputBase64);',
  '$plain = [Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser);',
  '[Console]::Out.Write([Convert]::ToBase64String($plain));',
].join(' ');

export function unprotectWithWindowsDpapi(ciphertext: Buffer): Buffer {
  if (process.platform !== 'win32') {
    throw new Error('Windows DPAPI is unavailable on this platform');
  }
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = childProcess.spawnSync(
    powershell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', DPAPI_UNPROTECT_SCRIPT],
    {
      input: ciphertext.toString('base64'),
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 15_000,
    },
  );
  if (result.error || result.status !== 0 || !String(result.stdout || '').trim()) {
    throw new Error('Windows DPAPI unprotect failed');
  }
  return Buffer.from(String(result.stdout).trim(), 'base64');
}

/**
 * 读取当前工作区 DPAPI 保险库中的单个 profile 凭据。函数只返回内存值，
 * 不输出用户名、密码、密文或 PowerShell stderr。
 */
export function readWorkspaceCredentials(
  location: WorkspaceCredentialLocation,
  unprotect: (ciphertext: Buffer) => Buffer = unprotectWithWindowsDpapi,
): WorkspaceCredentials | undefined {
  const filePath = String(location.filePath || '').trim();
  const usernameKey = String(location.usernameKey || '').trim();
  const passwordKey = String(location.passwordKey || '').trim();
  if (!filePath || !usernameKey || !passwordKey || !fs.existsSync(filePath)) {
    return undefined;
  }
  if (fs.statSync(filePath).size > 2 * 1024 * 1024) {
    return undefined;
  }
  try {
    const envelope = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ProtectedVaultEnvelope;
    if (envelope.version !== 1
      || envelope.protection !== 'windows-dpapi-current-user'
      || typeof envelope.ciphertext !== 'string'
      || !envelope.ciphertext) {
      return undefined;
    }
    const plain = unprotect(Buffer.from(envelope.ciphertext, 'base64'));
    const document = JSON.parse(plain.toString('utf8')) as ProtectedVaultDocument;
    if (document.version !== 1 || !document.values || typeof document.values !== 'object') {
      return undefined;
    }
    const username = typeof document.values[usernameKey] === 'string'
      ? document.values[usernameKey]
      : '';
    const password = typeof document.values[passwordKey] === 'string'
      ? document.values[passwordKey]
      : '';
    return username && password ? { username, password } : undefined;
  } catch {
    return undefined;
  }
}
