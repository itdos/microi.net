process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const apiBase = 'https://localhost:7266';
  const devKey = 'itdos-smoketest-2026';

  // Login
  const r1 = await fetch(`${apiBase}/api/SysUser/Login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Microi-Dev-Key': devKey },
    body: JSON.stringify({ OsClient: 'iTdos', Account: 'admin', Pwd: '_DEV_BYPASS_' }),
  });
  const j1 = await r1.json() as any;
  if (j1.Code !== 1) {
    console.log('LOGIN FAIL:', j1);
    return;
  }
  const token = r1.headers.get('authorization')!;
  console.log('Login OK');

  // Get diy_table row for sys_apiengine
  const r2 = await fetch(`${apiBase}/api/DiyTable/GetFormData`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token, OsClient: 'iTdos' },
    body: JSON.stringify({ OsClient: 'iTdos', _Where: [['Name', '=', 'sys_apiengine']] }),
  });
  console.log('GetFormData status:', r2.status);
  console.log(await r2.text());
}
main().catch(e => console.error(e));
