import childProcess from 'node:child_process';
import { createHash } from 'node:crypto';
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
  return transformWindowsDpapi(ciphertext, DPAPI_UNPROTECT_SCRIPT);
}

function transformWindowsDpapi(input: Buffer, script: string): Buffer {
  if (process.platform !== 'win32') {
    throw new Error('Windows DPAPI is unavailable on this platform');
  }
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const powershell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const result = childProcess.spawnSync(
    powershell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    {
      input: input.toString('base64'),
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

const SESSION_TOKEN_PREFIX = 'dpapi-session-v1:';
const MAC_SESSION_TOKEN_PREFIX = 'keychain-session-v1:';
const MAC_SESSION_SERVICE = 'net.microi.cli.session.v1';
const MAC_WORKSPACE_SERVICE = 'net.microi.cli.workspace.v1';
const macAccount = (value: string): string => createHash('sha256').update(value).digest('hex');
function macKeychainGet(account: string, service = MAC_SESSION_SERVICE): string {
  if (process.platform !== 'darwin' || !/^[a-f0-9]{64}$/.test(account)) throw new Error('Invalid macOS Keychain token reference');
  const result = childProcess.spawnSync('/usr/bin/security', ['find-generic-password', '-s', service, '-a', account, '-w'], {
    encoding: 'utf8', timeout: 15_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error('macOS Keychain token lookup failed');
  const encoded = String(result.stdout || '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('macOS Keychain token is invalid');
  return Buffer.from(encoded, 'base64').toString('utf8');
}
function macKeychainStore(account: string, value: string): void {
  if (process.platform !== 'darwin') throw new Error('macOS Keychain is unavailable on this platform');
  const encoded = Buffer.from(value, 'utf8').toString('base64');
  const result = childProcess.spawnSync('/usr/bin/security', ['-q', '-i'], {
    input: `add-generic-password -U -s ${MAC_SESSION_SERVICE} -a ${account} -w ${encoded}\n`,
    encoding: 'utf8', timeout: 15_000, maxBuffer: 4 * 1024 * 1024,
  });
  if (result.error || result.status !== 0 || macKeychainGet(account) !== value) throw new Error('macOS Keychain token write failed');
}
const tokenCache = new Map<string, string>();
export function isProtectedSessionToken(value: unknown): boolean {
  return typeof value === 'string' && (value.startsWith(SESSION_TOKEN_PREFIX) || value.startsWith(MAC_SESSION_TOKEN_PREFIX));
}
export function unprotectSessionToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (!isProtectedSessionToken(value)) return value;
  if (value.startsWith(MAC_SESSION_TOKEN_PREFIX)) return macKeychainGet(value.slice(MAC_SESSION_TOKEN_PREFIX.length));
  if (!tokenCache.has(value)) {
    if (tokenCache.size > 256) tokenCache.clear();
    tokenCache.set(value, unprotectWithWindowsDpapi(Buffer.from(value.slice(SESSION_TOKEN_PREFIX.length), 'base64')).toString('utf8'));
  }
  return tokenCache.get(value)!;
}
export function protectSessionToken(value: string): string {
  if (!value || isProtectedSessionToken(value)) return value;
  if (process.platform === 'darwin') {
    const account = macAccount(value);
    macKeychainStore(account, value);
    return MAC_SESSION_TOKEN_PREFIX + account;
  }
  const script = DPAPI_UNPROTECT_SCRIPT.replace('::Unprotect(', '::Protect(');
  return SESSION_TOKEN_PREFIX + transformWindowsDpapi(Buffer.from(value, 'utf8'), script).toString('base64');
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
  if (!filePath || !usernameKey || !passwordKey) {
    return undefined;
  }
  if (process.platform === 'darwin') {
    try {
      const tokenFile = path.join(path.dirname(filePath), '.microi-mcp-tokens.json');
      const username = macKeychainGet(macAccount(`${tokenFile}\0${usernameKey}`), MAC_WORKSPACE_SERVICE);
      const password = macKeychainGet(macAccount(`${tokenFile}\0${passwordKey}`), MAC_WORKSPACE_SERVICE);
      return username && password ? { username, password } : undefined;
    } catch { return undefined; }
  }
  if (!fs.existsSync(filePath)) return undefined;
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
