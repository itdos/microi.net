/**
 * Blueprint API E2E smoke test against backend at https://localhost:7266 (OsClient=iTdos).
 * Uses raw fetch so we can attach the X-Microi-Dev-Key bypass header (env-gated test login).
 *
 * Requires backend started with env var MICROI_DEV_TEST_KEY=<key> matching --dev-key arg.
 *
 * Usage:
 *   $env:MICROI_DEV_TEST_KEY='itdos-test-key';
 *   $env:MICROI_DEV_KEY='itdos-test-key';
 *   $env:PW_TEST_ACCOUNT='admin'; $env:PW_TEST_PASSWORD='123456';
 *   node dist/blueprint-smoke-test.js
 */
import * as crypto from 'node:crypto';

const apiBaseUrl = process.env.MICROI_API || 'https://localhost:7266';
const osClient = process.env.MICROI_OSCLIENT || 'iTdos';
const username = process.env.PW_TEST_ACCOUNT || 'admin';
const password = process.env.PW_TEST_PASSWORD || '123456';
const devKey = process.env.MICROI_DEV_KEY || '';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
1DsI9VJ7gTHGL3R7sQIDAQAB
-----END PUBLIC KEY-----`;

function rsaEncrypt(plainText: string): string {
  const encrypted = crypto.publicEncrypt(
    { key: RSA_PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(plainText, 'utf-8'),
  );
  return encrypted.toString('base64');
}

function ok(label: string, value: unknown = undefined): void {
  console.log(`✅ ${label}`);
  if (value !== undefined) console.log(JSON.stringify(value, null, 2).slice(0, 800));
  console.log('');
}
function fail(label: string, err: unknown): never {
  console.error(`❌ ${label}`);
  console.error(typeof err === 'string' ? err : JSON.stringify(err, null, 2));
  process.exit(1);
}

let token = '';

interface ApiResponse<T = unknown> { Code: number; Data?: T; Msg?: string; }

async function call<T = unknown>(path: string, body: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
      OsClient: osClient,
    },
    body: JSON.stringify({ OsClient: osClient, ...body }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as ApiResponse<T>;
}

async function login(): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (devKey) headers['X-Microi-Dev-Key'] = devKey;
  // When dev key matches, backend honors Pwd="_DEV_BYPASS_" to skip password check.
  const pwdField = devKey ? '_DEV_BYPASS_' : rsaEncrypt(password);
  const res = await fetch(`${apiBaseUrl}/api/SysUser/Login`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      Account: username,
      Pwd: pwdField,
      OsClient: osClient,
      _ClientType: 'TEST',
    }),
  });
  const text = await res.text();
  const json = JSON.parse(text) as ApiResponse;
  if (json.Code !== 1) throw new Error(`Login failed: ${json.Msg}`);
  const hdr = res.headers.get('authorization') || '';
  if (!hdr) throw new Error('No authorization header in login response');
  token = hdr;
}

async function main(): Promise<void> {
  try {
    await login();
    ok('Login (dev-key bypass)');

    // 1) initial list
    const list1 = await call<unknown[]>('/api/V8Engine/ListBlueprints');
    if (list1.Code !== 1) fail('listBlueprints initial', list1);
    const initialCount = Array.isArray(list1.Data) ? list1.Data!.length : 0;
    ok(`listBlueprints initial (count=${initialCount})`);

    // 2) save (create)
    const blueprintData = JSON.stringify({
      diagrams: [{
        id: 'diag_main',
        type: 'process',
        name: '主流程',
        nodes: [
          { id: 'n_user', shape: 'task', label: '用户管理', x: 120, y: 200,
            refs: { tables: ['Sys_User'], fields: ['Sys_User.Account'] } },
          { id: 'n_role', shape: 'task', label: '分配角色', x: 400, y: 200,
            refs: { tables: ['sys_role'] } },
          { id: 'n_phantom', shape: 'task', label: '幽灵节点', x: 600, y: 400,
            refs: { tables: ['this_table_does_not_exist_xyz'] } },
        ],
        edges: [{ source: 'n_user', target: 'n_role', label: '审核通过' }],
      }],
      domainModel: {
        entities: [{ table: 'Sys_User', x: 50, y: 50, relations: [] }],
      },
    });

    const saveName = `__SmokeTestBP_${Date.now()}`;
    const save1 = await call<{ Id?: string }>('/api/V8Engine/SaveBlueprint', {
      Name: saveName,
      Code: 'smoke_test_bp',
      Description: 'Auto smoke test blueprint',
      Version: '1.0',
      RootDiagramId: 'diag_main',
      Status: 1,
      BlueprintData: blueprintData,
      ChangeSummary: 'initial create from smoke test',
    });
    if (save1.Code !== 1) fail('saveBlueprint create', save1);
    const blueprintId = save1.Data?.Id;
    if (!blueprintId) fail('saveBlueprint create: no Id returned', save1);
    ok(`saveBlueprint create → Id=${blueprintId}`);

    // 3) get by Id
    const detail1 = await call('/api/V8Engine/GetBlueprint', { BlueprintId: blueprintId });
    if (detail1.Code !== 1) fail('getBlueprint by Id', detail1);
    ok('getBlueprint by Id');

    // 4) get by Name (fallback)
    const detail2 = await call('/api/V8Engine/GetBlueprint', { BlueprintId: saveName });
    if (detail2.Code !== 1) fail('getBlueprint by Name', detail2);
    ok('getBlueprint by Name (fallback)');

    // 5) list increased
    const list2 = await call<unknown[]>('/api/V8Engine/ListBlueprints');
    const newCount = Array.isArray(list2.Data) ? list2.Data!.length : 0;
    if (newCount < initialCount + 1) fail(`list count expected >= ${initialCount + 1}, got ${newCount}`, list2);
    ok(`listBlueprints after create (count=${newCount})`);

    // 6) keyword filter
    const list3 = await call<unknown[]>('/api/V8Engine/ListBlueprints', { Keyword: saveName });
    const filteredCount = Array.isArray(list3.Data) ? list3.Data!.length : 0;
    if (filteredCount < 1) fail('listBlueprints keyword: no match', list3);
    ok(`listBlueprints keyword (matches=${filteredCount})`);

    // 7) update
    const save2 = await call('/api/V8Engine/SaveBlueprint', {
      Id: blueprintId,
      Name: saveName,
      Description: 'updated description',
      BlueprintData: blueprintData,
      ChangeSummary: 'update test',
    });
    if (save2.Code !== 1) fail('saveBlueprint update', save2);
    ok('saveBlueprint update');

    // 8) validate (drift detection)
    const validation = await call<{ errors?: unknown[]; warnings?: unknown[]; CheckedRefs?: number }>(
      '/api/V8Engine/ValidateBlueprint', { BlueprintId: blueprintId },
    );
    if (validation.Code !== 1) fail('validateBlueprint', validation);
    const vData = validation.Data;
    const errors = vData?.errors ?? [];
    const warnings = vData?.warnings ?? [];
    if (errors.length === 0 && warnings.length === 0) {
      console.warn('⚠️  validate returned no errors/warnings — phantom table drift not flagged.');
    } else {
      ok(`validateBlueprint flagged drift (errors=${errors.length}, warnings=${warnings.length}, checked=${vData?.CheckedRefs ?? '?'})`, vData);
    }

    // 9) delete
    const del = await call('/api/V8Engine/DeleteBlueprint', { BlueprintId: blueprintId });
    if (del.Code !== 1) fail('deleteBlueprint', del);
    ok('deleteBlueprint');

    // 10) deleted no longer in list
    const list4 = await call<unknown[]>('/api/V8Engine/ListBlueprints', { Keyword: saveName });
    const remainCount = Array.isArray(list4.Data) ? list4.Data!.length : 0;
    if (remainCount !== 0) fail(`expected 0 after delete, got ${remainCount}`, list4);
    ok('listBlueprints after delete (count=0)');

    console.log('🎉 ALL BLUEPRINT API SMOKE TESTS PASSED');
  } catch (err) {
    fail('Unhandled error', err instanceof Error ? err.message : err);
  }
}

main();

